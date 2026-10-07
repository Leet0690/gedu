import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { createTemporaryPortalIdentity } from '../src/services/teacherGradePortalClient.js';

test('temporary grade identity uses password auth without changing the administrator session', {
  skip: process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099', timeout: 60000,
}, async () => {
  const resources = [];
  const authFor = name => {
    const app = initializeApp({ projectId: 'demo-ipfp-rbac', apiKey: 'test' }, name);
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    resources.push({ app, auth });
    return auth;
  };
  try {
    const adminAuth = authFor('temporary-grade-admin');
    const portalAuth = authFor('temporary-grade-reader');
    const administrator = await createUserWithEmailAndPassword(adminAuth, `admin-${crypto.randomUUID()}@example.test`, 'Admin-Test-Password-9!');
    const temporary = await createTemporaryPortalIdentity(portalAuth);
    assert.notEqual(temporary.user.uid, administrator.user.uid);
    assert.equal(adminAuth.currentUser.uid, administrator.user.uid);
    assert.equal(temporary.user.isAnonymous, false);
    assert.match(temporary.user.email, /^portal-[a-f0-9-]+@sessions\.ipfp\.invalid$/);
    assert.equal(temporary.user.providerData[0].providerId, 'password');
    await deleteUser(temporary.user);
    assert.equal(portalAuth.currentUser, null);
    assert.equal(adminAuth.currentUser.uid, administrator.user.uid);
  } finally {
    await Promise.all(resources.map(async ({ app, auth }) => {
      if (auth.currentUser) await deleteUser(auth.currentUser);
      await deleteApp(app);
    }));
  }
});
