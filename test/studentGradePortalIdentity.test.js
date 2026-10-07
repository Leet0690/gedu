import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, connectAuthEmulator, deleteUser } from 'firebase/auth';
import {
  initializeFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer,
  deleteDoc, terminate, setLogLevel,
} from 'firebase/firestore';
import { createTemporaryPortalIdentity, readStudentPortalGrades } from '../src/services/teacherGradePortalClient.js';

test('student portal reads grades with an actual temporary password identity and removes its session', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085'
    || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9098',
  timeout: 60000,
}, async () => {
  setLogLevel('silent');
  const prefix = `student-grade-identity-${randomUUID()}`;
  const config = { projectId: 'demo-ipfp-rbac', apiKey: 'test' };
  const ownerApp = initializeApp(config, `${prefix}-owner`);
  const owner = initializeFirestore(ownerApp, {});
  connectFirestoreEmulator(owner, '127.0.0.1', 8085, { mockUserToken: 'owner' });
  const portalApp = initializeApp(config, `${prefix}-portal`);
  const portalAuth = initializeAuth(portalApp, { persistence: inMemoryPersistence });
  connectAuthEmulator(portalAuth, 'http://127.0.0.1:9098', { disableWarnings: true });
  const portal = initializeFirestore(portalApp, {});
  // This connection uses the real Auth emulator identity, without mockUserToken.
  connectFirestoreEmulator(portal, '127.0.0.1', 8085);
  const studentId = `${prefix}-student`;
  const token = `${prefix}-private-link`;
  const grades = { academicYears: { '2026-2027': { Module: { cc1: 0, exam: 15 } } } };
  let temporaryUid;

  try {
    await setDoc(doc(owner, 'students', studentId), { major: `${prefix}-group`, token });
    await setDoc(doc(owner, 'grades', studentId), grades);
    await assert.rejects(getDocFromServer(doc(portal, 'grades', studentId)), error => error.code === 'permission-denied');

    const temporary = await createTemporaryPortalIdentity(portalAuth);
    temporaryUid = temporary.user.uid;
    assert.equal(portalAuth.currentUser.uid, temporaryUid);
    assert.equal(temporary.user.isAnonymous, false);
    assert.equal(temporary.user.providerData[0].providerId, 'password');
    assert.match(temporary.user.email, /^portal-[a-f0-9-]+@sessions\.ipfp\.invalid$/);
    assert.deepEqual(await readStudentPortalGrades(portal, temporaryUid, studentId, token), { [studentId]: grades });
    assert.equal((await getDocFromServer(doc(portal, 'student_grade_sessions', temporaryUid))).exists(), false);
    await assert.rejects(getDocFromServer(doc(portal, 'grades', studentId)), error => error.code === 'permission-denied');

    await deleteUser(temporary.user);
    assert.equal(portalAuth.currentUser, null);
  } finally {
    try {
      if (portalAuth.currentUser) await deleteUser(portalAuth.currentUser);
      const fixtureRefs = [doc(owner, 'students', studentId), doc(owner, 'grades', studentId)];
      if (temporaryUid) fixtureRefs.push(doc(owner, 'student_grade_sessions', temporaryUid));
      await Promise.all(fixtureRefs.map(ref => deleteDoc(ref)));
    } finally {
      await Promise.all([{ app: ownerApp, db: owner }, { app: portalApp, db: portal }].map(async ({ app, db }) => {
        await terminate(db);
        await deleteApp(app);
      }));
    }
  }
});
