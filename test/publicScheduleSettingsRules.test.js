import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, getDocsFromServer, collection, deleteDoc, terminate, setLogLevel, writeBatch } from 'firebase/firestore';

test('public scheduling scope follows private settings and permits only administrator publication', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 60000,
}, async () => {
  setLogLevel('silent');
  const resources = [];
  const database = uid => {
    const app = initializeApp({ projectId: 'demo-ipfp-rbac', apiKey: 'test' }, `scope-${uid}`);
    const db = initializeFirestore(app, {});
    connectFirestoreEmulator(db, '127.0.0.1', 8085, uid === 'anonymous' ? {} : {
      mockUserToken: uid === 'owner' ? 'owner' : { sub: uid, user_id: uid },
    });
    resources.push({ app, db });
    return db;
  };
  const owner = database('owner'); const admin = database('admin');
  const visitor = database('anonymous'); const reader = database('reader');
  const denied = promise => assert.rejects(promise, error => error.code === 'permission-denied');
  try {
    const scope = { activeSemester: 'S2', operationalAcademicYear: '2026-2027' };
    await setDoc(doc(owner, 'users', 'admin'), { isActive: true, role: 'admin' });
    await setDoc(doc(owner, 'users', 'reader'), { isActive: true, role: 'custom', permissions: {} });
    await setDoc(doc(owner, 'settings', 'app'), { ...scope, privateNote: 'secret' });
    await setDoc(doc(admin, 'public_settings', 'schedule'), scope);
    assert.deepEqual((await getDocFromServer(doc(visitor, 'public_settings', 'schedule'))).data(), scope);
    await denied(getDocsFromServer(collection(visitor, 'public_settings')));
    await denied(getDocFromServer(doc(visitor, 'settings', 'app')));
    await denied(setDoc(doc(visitor, 'public_settings', 'schedule'), scope));
    await denied(setDoc(doc(reader, 'public_settings', 'schedule'), scope));
    await denied(setDoc(doc(admin, 'public_settings', 'schedule'), { ...scope, privateNote: 'secret' }));
    await denied(setDoc(doc(admin, 'public_settings', 'schedule'), { ...scope, activeSemester: 'S3' }));
    await denied(setDoc(doc(admin, 'public_settings', 'schedule'), { ...scope, activeSemester: 'S1' }));
    await denied(deleteDoc(doc(admin, 'public_settings', 'schedule')));
    const publicInstitution = { name: 'École de test', logoUrl: '', educationType: 'private_school', schoolCycles: ['Primaire'] };
    await setDoc(doc(admin, 'public_settings', 'institution'), publicInstitution);
    assert.deepEqual((await getDocFromServer(doc(visitor, 'public_settings', 'institution'))).data(), publicInstitution);
    await denied(setDoc(doc(visitor, 'public_settings', 'institution'), publicInstitution));
    await denied(setDoc(doc(reader, 'public_settings', 'institution'), publicInstitution));
    await denied(setDoc(doc(admin, 'public_settings', 'institution'), { ...publicInstitution, authEmailDomain: 'private.example' }));
    await denied(setDoc(doc(admin, 'public_settings', 'institution'), { ...publicInstitution, educationType: 'invalid' }));
    const next = { ...scope, activeSemester: 'S1' };
    const batch = writeBatch(admin);
    batch.set(doc(admin, 'settings', 'app'), next, { merge: true });
    batch.set(doc(admin, 'public_settings', 'schedule'), next);
    await batch.commit();
    assert.deepEqual((await getDocFromServer(doc(visitor, 'public_settings', 'schedule'))).data(), next);
  } finally {
    await Promise.all(resources.map(async ({ app, db }) => { await terminate(db); await deleteApp(app); }));
  }
});
