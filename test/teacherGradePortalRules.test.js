import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, getDocsFromServer, collection, query, where, updateDoc, deleteDoc, terminate, setLogLevel, serverTimestamp, Timestamp } from 'firebase/firestore';
import { readTeacherPortalGrades } from '../src/services/teacherGradePortalClient.js';

test('teacher grade sessions load only assigned students, expire and honor link revocation', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 60000,
}, async () => {
  setLogLevel('silent');
  const resources = [];
  const database = uid => {
    const app = initializeApp({ projectId: 'demo-ipfp-rbac', apiKey: 'test' }, `teacher-grade-${uid}`);
    const db = initializeFirestore(app, {});
    connectFirestoreEmulator(db, '127.0.0.1', 8085, uid === 'anonymous' ? {} : {
      mockUserToken: uid === 'owner' ? 'owner' : { sub: uid, user_id: uid },
    });
    resources.push({ app, db });
    return db;
  };
  const owner = database('owner'); const visitor = database('anonymous');
  const portal = database('portal-user');
  const reader = database('reader');
  const denied = promise => assert.rejects(promise, error => error.code === 'permission-denied');
  const gradeQuery = db => query(collection(db, 'grades'), where('__name__', 'in', ['student-a', 'student-b', 'student-without-grades']));
  try {
    await setDoc(doc(owner, 'users', 'reader'), { isActive: true, role: 'custom', permissions: {} });
    await setDoc(doc(owner, 'teachers', 'teacher-a'), {
      tokenGrades: 'grade-link', tokenAttendance: 'attendance-link', groups: ['Group A'],
    });
    await setDoc(doc(owner, 'students', 'student-a'), { major: 'Group A' });
    await setDoc(doc(owner, 'students', 'student-b'), { major: 'Group A' });
    await setDoc(doc(owner, 'students', 'student-without-grades'), { major: 'Group A' });
    await setDoc(doc(owner, 'students', 'other-group'), { major: 'Group B' });
    await setDoc(doc(owner, 'grades', 'student-a'), { academicYears: { '2026-2027': { Module: { cc1: 12 } } } });
    await setDoc(doc(owner, 'grades', 'student-b'), { Module: { cc1: 10 } });

    await denied(getDocFromServer(doc(visitor, 'grades', 'student-a')));
    await denied(getDocsFromServer(gradeQuery(visitor)));
    await denied(getDocFromServer(doc(portal, 'grades', 'student-a')));
    const loaded = await readTeacherPortalGrades(portal, 'portal-user', 'teacher-a', 'grade-link', ['student-a', 'student-b', 'student-without-grades']);
    assert.deepEqual(Object.keys(loaded).sort(), ['student-a', 'student-b']);
    assert.equal(loaded['student-a'].academicYears['2026-2027'].Module.cc1, 12);
    assert.equal((await getDocFromServer(doc(portal, 'teacher_grade_sessions', 'portal-user'))).exists(), false);
    await denied(getDocsFromServer(gradeQuery(reader)));
    await denied(readTeacherPortalGrades(portal, 'portal-user', 'teacher-a', 'invalid-link', ['student-a']));
    await denied(readTeacherPortalGrades(portal, 'portal-user', 'teacher-a', 'attendance-link', ['student-a']));
    await denied(readTeacherPortalGrades(portal, 'portal-user', 'teacher-a', 'grade-link', ['other-group']));
    await denied(setDoc(doc(portal, 'teacher_grade_sessions', 'another-user'), { teacherId: 'teacher-a', tokenGrades: 'grade-link', createdAt: serverTimestamp() }));
    await denied(updateDoc(doc(portal, 'grades', 'student-a'), { Module: { cc1: 20 } }));
    for (const tokenGrades of ['invalid-link', 'attendance-link']) {
      await denied(setDoc(doc(portal, 'grades', 'student-a'), { teacherId: 'teacher-a', tokenGrades, Module: { cc1: 15 } }, { merge: true }));
    }
    const update = { teacherId: 'teacher-a', tokenGrades: 'grade-link', academicYears: { '2026-2027': { Module: { cc1: 15 } } } };
    await setDoc(doc(portal, 'grades', 'student-a'), update, { merge: true });
    await setDoc(doc(portal, 'grades', 'student-without-grades'), update, { merge: true });
    await denied(setDoc(doc(portal, 'grades', 'other-group'), update));
    await denied(deleteDoc(doc(portal, 'grades', 'student-a')));
    await setDoc(doc(owner, 'teachers', 'school-teacher'), { tokenGrades: 'school-link', groups: ['A'], diplomas: ['Primaire'], years: ['3ème année primaire'] });
    await setDoc(doc(owner, 'students', 'school-assigned'), { major: 'A', diploma: 'Primaire', year: '3ème année primaire' });
    await setDoc(doc(owner, 'students', 'school-other-cycle'), { major: 'A', diploma: 'Collège', year: '1ère année collège' });
    await setDoc(doc(owner, 'students', 'school-other-level'), { major: 'A', diploma: 'Primaire', year: '4ème année primaire' });
    const schoolUpdate = { teacherId: 'school-teacher', tokenGrades: 'school-link', academicYears: { '2026-2027': { Français: { school: { S1: { c1: 7, scale: 10 } } } } } };
    await setDoc(doc(portal, 'grades', 'school-assigned'), schoolUpdate);
    await denied(setDoc(doc(portal, 'grades', 'school-other-cycle'), schoolUpdate));
    await denied(setDoc(doc(portal, 'grades', 'school-other-level'), schoolUpdate));
    const refreshed = await readTeacherPortalGrades(portal, 'portal-user', 'teacher-a', 'grade-link', ['student-a', 'student-b', 'student-without-grades']);
    assert.equal(Object.keys(refreshed).length, 3);
    assert.equal(refreshed['student-a'].academicYears['2026-2027'].Module.cc1, 15);
    await setDoc(doc(portal, 'teacher_grade_sessions', 'portal-user'), { teacherId: 'teacher-a', tokenGrades: 'grade-link', createdAt: serverTimestamp() });
    await denied(getDocsFromServer(collection(portal, 'grades')));
    await denied(getDocsFromServer(collection(portal, 'teacher_grade_sessions')));
    await updateDoc(doc(owner, 'teachers', 'teacher-a'), { tokenGrades: 'new-link' });
    await denied(getDocFromServer(doc(portal, 'grades', 'student-a')));
    await setDoc(doc(owner, 'teacher_grade_sessions', 'portal-user'), { teacherId: 'teacher-a', tokenGrades: 'new-link', createdAt: Timestamp.fromMillis(Date.now() - 11 * 60 * 1000) });
    await denied(getDocFromServer(doc(portal, 'grades', 'student-a')));
  } finally {
    await Promise.all(resources.map(async ({ app, db }) => { await terminate(db); await deleteApp(app); }));
  }
});
