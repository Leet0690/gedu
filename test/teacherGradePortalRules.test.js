import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator, doc, setDoc, getDocsFromServer, collection, query, where, updateDoc, deleteDoc, terminate, setLogLevel } from 'firebase/firestore';

test('legacy teacher grade portal loads grades and only a valid grade link can save for its assigned groups', {
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
  const owner = database('owner'); const portal = database('anonymous');
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

    const loaded = await getDocsFromServer(gradeQuery(portal));
    assert.deepEqual(loaded.docs.map(item => item.id).sort(), ['student-a', 'student-b']);
    assert.equal(loaded.docs.find(item => item.id === 'student-a').data().academicYears['2026-2027'].Module.cc1, 12);
    await denied(getDocsFromServer(gradeQuery(reader)));
    await denied(updateDoc(doc(portal, 'grades', 'student-a'), { Module: { cc1: 20 } }));
    for (const tokenGrades of ['invalid-link', 'attendance-link']) {
      await denied(setDoc(doc(portal, 'grades', 'student-a'), { teacherId: 'teacher-a', tokenGrades, Module: { cc1: 15 } }, { merge: true }));
    }
    const update = { teacherId: 'teacher-a', tokenGrades: 'grade-link', academicYears: { '2026-2027': { Module: { cc1: 15 } } } };
    await setDoc(doc(portal, 'grades', 'student-a'), update, { merge: true });
    await setDoc(doc(portal, 'grades', 'student-without-grades'), update, { merge: true });
    await denied(setDoc(doc(portal, 'grades', 'other-group'), update));
    await denied(deleteDoc(doc(portal, 'grades', 'student-a')));
    const refreshed = await getDocsFromServer(gradeQuery(portal));
    assert.equal(refreshed.size, 3);
    assert.equal(refreshed.docs.find(item => item.id === 'student-a').data().academicYears['2026-2027'].Module.cc1, 15);
  } finally {
    await Promise.all(resources.map(async ({ app, db }) => { await terminate(db); await deleteApp(app); }));
  }
});
