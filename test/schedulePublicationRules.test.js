import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteDoc, getDocFromServer, getDocsFromServer, collection, terminate, setLogLevel } from 'firebase/firestore';
import { createScheduleShareClient } from '../src/services/scheduleShareClient.js';
import { normalizePermissions } from '../src/utils/permissions.js';

test('Firestore schedule sharing works without Functions and enforces read-only scoped access', { skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 60000 }, async () => {
  setLogLevel('silent');
  const resources = [];
  const database = uid => {
    const app = initializeApp({ projectId: 'demo-ipfp-rbac', apiKey: 'test' }, `share-${uid}`);
    const db = initializeFirestore(app, {});
    connectFirestoreEmulator(db, '127.0.0.1', 8085, uid === 'anonymous' ? {} : { mockUserToken: uid === 'owner' ? 'owner' : { sub: uid, user_id: uid } });
    resources.push({ app, db });
    return db;
  };
  const owner = database('owner'); const reader = database('publisher'); const visitor = database('anonymous'); const stranger = database('stranger');
  const denied = promise => assert.rejects(promise, error => error.code === 'permission-denied');
  const scope = { diploma: 'Technicien Spécialisé', filiere: 'Développement Informatique', annee: '1ère année', academicYear: '2025-2026', semester: 'S2' };
  const source = { schedules: [{ ...scope, day: 'Lundi', time: '08:30-10:30', type: 'Cours', room: 'A1', moduleS1: 'Python', moduleS2: 'Web / Java', teacherId: 'teacher', privateNote: 'secret' }], teachers: [{ id: 'teacher', name: 'Test', phone: 'private', salary: 1000 }] };
  try {
    await fetch('http://127.0.0.1:8085/emulator/v1/projects/demo-ipfp-rbac/databases/(default)/documents', { method: 'DELETE' });
    await setDoc(doc(owner, 'users', 'publisher'), { isActive: true, role: 'custom', permissions: normalizePermissions('custom', { schedules: 'view' }) });
    const publisher = createScheduleShareClient(reader, { currentUser: { uid: 'publisher' } });
    const publicClient = createScheduleShareClient(visitor, { currentUser: null });
    const { token } = await publisher.createScheduleShare(scope, source);
    const result = await publicClient.getPublicSchedule(token);
    assert.equal(result.semester, 'S2');
    assert.deepEqual(Object.keys(result.schedules[0]).sort(), ['id', 'day', 'time', 'type', 'room', 'module', 'teacherName'].sort());
    assert.equal(result.schedules[0].module, 'Web / Java');
    assert.equal(result.schedules[0].teacherName, 'Test');
    await denied(getDocsFromServer(collection(visitor, 'public_schedules')));
    await denied(getDocsFromServer(collection(visitor, 'schedule_share_scopes')));
    await denied(updateDoc(doc(visitor, 'public_schedules', token), { semester: 'S1' }));
    await denied(deleteDoc(doc(visitor, 'public_schedules', token)));
    await denied(setDoc(doc(visitor, 'public_schedules', token, 'sessions', 'forged'), { module: 'forged' }));
    await denied(setDoc(doc(reader, 'public_schedules', token, 'sessions', 'leak'), { ...result.schedules[0], email: 'private' }));
    await denied(createScheduleShareClient(stranger, { currentUser: { uid: 'stranger' } }).createScheduleShare(scope, source));
    const next = await publisher.createScheduleShare(scope, { ...source, schedules: [{ ...source.schedules[0], moduleS2: 'Updated', room: 'B2' }] });
    assert.equal(next.token, token);
    const updated = await publicClient.getPublicSchedule(token);
    assert.equal(updated.schedules.length, 1);
    assert.equal(updated.schedules[0].module, 'Updated');
    assert.equal(updated.schedules[0].room, 'B2');
    await publisher.createScheduleShare(scope, { schedules: [], teachers: [] });
    assert.deepEqual((await publicClient.getPublicSchedule(token)).schedules, []);
    await updateDoc(doc(owner, 'users', 'publisher'), { isActive: false });
    await denied(publisher.createScheduleShare(scope, source));
    await deleteDoc(doc(owner, 'public_schedules', token));
    await assert.rejects(publicClient.getPublicSchedule(token), /plus disponible/);
    await denied(getDocFromServer(doc(visitor, 'public_schedules', token, 'sessions', 'orphan')));
  } finally {
    await Promise.all(resources.map(async ({ app, db }) => { await terminate(db); await deleteApp(app); }));
  }
});
