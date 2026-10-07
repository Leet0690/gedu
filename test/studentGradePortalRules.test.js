import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  initializeFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer,
  getDocsFromServer, collection, query, where, updateDoc, deleteDoc, terminate,
  setLogLevel, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { readStudentPortalGrades } from '../src/services/teacherGradePortalClient.js';

test('student grade sessions read only personal grades and reject invalid, revoked or expired access', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 60000,
}, async () => {
  setLogLevel('silent');
  const prefix = `student-grade-rules-${randomUUID()}`;
  const resources = [];
  const database = (name, authenticated = true) => {
    const app = initializeApp({ projectId: 'demo-ipfp-rbac', apiKey: 'test' }, `${prefix}-${name}`);
    const db = initializeFirestore(app, {});
    const uid = `${prefix}-${name}`;
    connectFirestoreEmulator(db, '127.0.0.1', 8085, !authenticated ? {} : {
      mockUserToken: name === 'owner' ? 'owner' : { sub: uid, user_id: uid },
    });
    resources.push({ app, db });
    return db;
  };
  const owner = database('owner');
  const visitor = database('visitor', false);
  const portal = database('portal');
  const peer = database('peer');
  const uid = `${prefix}-portal`;
  const peerUid = `${prefix}-peer`;
  const studentId = `${prefix}-student`;
  const peerId = `${prefix}-peer-student`;
  const missingGradeId = `${prefix}-without-grades`;
  const token = `${prefix}-private-link`;
  const peerToken = `${prefix}-peer-link`;
  const missingGradeToken = `${prefix}-missing-grade-link`;
  const grades = { academicYears: { '2026-2027': { Module: { cc1: 0, exam: 14 } } } };
  const session = (student = studentId, link = token) => ({
    studentId: student, token: link, createdAt: serverTimestamp(),
  });
  const sessionRef = doc(portal, 'student_grade_sessions', uid);
  const gradeRef = doc(portal, 'grades', studentId);
  const denied = promise => assert.rejects(promise, error => error.code === 'permission-denied');

  try {
    await setDoc(doc(owner, 'students', studentId), { major: `${prefix}-group`, token });
    await setDoc(doc(owner, 'students', peerId), { major: `${prefix}-group`, token: peerToken });
    await setDoc(doc(owner, 'students', missingGradeId), { major: `${prefix}-group`, token: missingGradeToken });
    await setDoc(doc(owner, 'grades', studentId), grades);
    await setDoc(doc(owner, 'grades', peerId), { Module: { cc1: 17 } });

    await denied(getDocFromServer(doc(visitor, 'grades', studentId)));
    await denied(getDocFromServer(gradeRef));
    await denied(getDocFromServer(doc(peer, 'grades', studentId)));
    assert.deepEqual(await readStudentPortalGrades(portal, uid, studentId, token), { [studentId]: grades });
    assert.equal((await getDocFromServer(sessionRef)).exists(), false);
    await denied(getDocFromServer(gradeRef));

    assert.deepEqual(await readStudentPortalGrades(portal, uid, missingGradeId, missingGradeToken), {});
    assert.equal((await getDocFromServer(sessionRef)).exists(), false);
    await denied(readStudentPortalGrades(portal, uid, studentId, 'invalid-link'));
    await denied(readStudentPortalGrades(portal, uid, studentId, peerToken));
    await denied(readStudentPortalGrades(portal, uid, `${prefix}-missing-student`, token));
    await denied(readStudentPortalGrades(portal, peerUid, studentId, token));
    await denied(setDoc(doc(visitor, 'student_grade_sessions', uid), session()));
    await denied(setDoc(sessionRef, session(studentId, '')));
    await denied(setDoc(sessionRef, { ...session(), extra: true }));
    await denied(setDoc(sessionRef, { studentId, token }));
    await denied(setDoc(sessionRef, { ...session(), createdAt: Timestamp.fromMillis(0) }));
    assert.equal((await getDocFromServer(sessionRef)).exists(), false);

    await setDoc(sessionRef, session());
    assert.deepEqual((await getDocFromServer(gradeRef)).data(), grades);
    await denied(getDocFromServer(doc(portal, 'grades', peerId)));
    await denied(getDocsFromServer(collection(portal, 'grades')));
    await denied(getDocsFromServer(query(collection(portal, 'grades'), where('__name__', '==', studentId))));
    await denied(getDocsFromServer(collection(portal, 'student_grade_sessions')));
    await denied(getDocFromServer(doc(peer, 'student_grade_sessions', uid)));
    await denied(deleteDoc(doc(peer, 'student_grade_sessions', uid)));
    await denied(setDoc(gradeRef, { Module: { cc1: 20 } }));
    await denied(updateDoc(gradeRef, { Module: { cc1: 20 } }));
    await denied(deleteDoc(gradeRef));
    await denied(setDoc(doc(portal, 'grades', missingGradeId), { Module: { cc1: 20 } }));
    assert.deepEqual((await getDocFromServer(doc(owner, 'grades', studentId))).data(), grades);

    const revokedToken = `${prefix}-renewed-link`;
    await updateDoc(doc(owner, 'students', studentId), { token: revokedToken });
    await denied(getDocFromServer(gradeRef));
    await denied(readStudentPortalGrades(portal, uid, studentId, token));
    await setDoc(sessionRef, session(studentId, revokedToken));
    assert.deepEqual((await getDocFromServer(gradeRef)).data(), grades);

    await setDoc(doc(owner, 'student_grade_sessions', uid), {
      studentId, token: revokedToken, createdAt: Timestamp.fromMillis(Date.now() - 11 * 60 * 1000),
    });
    await denied(getDocFromServer(gradeRef));
    await deleteDoc(sessionRef);
    assert.equal((await getDocFromServer(sessionRef)).exists(), false);
    assert.deepEqual(await readStudentPortalGrades(portal, uid, studentId, revokedToken), { [studentId]: grades });
    assert.equal((await getDocFromServer(sessionRef)).exists(), false);
  } finally {
    await Promise.all(resources.map(async ({ app, db }) => {
      await terminate(db);
      await deleteApp(app);
    }));
  }
});
