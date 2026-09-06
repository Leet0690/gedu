import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, query, where, serverTimestamp, writeBatch, terminate, setLogLevel } from 'firebase/firestore';
import { MODULE_KEYS, normalizePermissions } from '../src/utils/permissions.js';

const enabled = process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8085';
test('Firestore RBAC and audit enforce authorization on the server', { skip: !enabled, timeout: 60000 }, async t => {
  setLogLevel('silent');
  const apps = [];
  const databases = [];
  const database = (uid, owner = false) => {
    const app = initializeApp({ projectId: 'demo-ipfp-rbac', apiKey: 'test-only' }, `rules-${uid}`);
    const db = initializeFirestore(app, {});
    connectFirestoreEmulator(db, '127.0.0.1', 8085, uid === 'anonymous' ? {} : { mockUserToken: owner ? 'owner' : { sub: uid, user_id: uid } });
    apps.push(app); databases.push(db);
    return db;
  };
  const owner = database('seed', true);
  const admin = database('admin');
  const reader = database('reader');
  const editor = database('editor');
  const stranger = database('stranger');
  const anonymous = database('anonymous');
  const manager = database('manager');
  const managerReader = database('manager-reader');
  const profile = (uid, role, permissions = {}) => ({ uid, email: `${uid}@example.test`, displayName: uid, role, isActive: true, permissions: normalizePermissions(role, permissions), createdAt: serverTimestamp(), lastLogin: null });
  const denied = promise => assert.rejects(promise, error => error.code === 'permission-denied');
  try {
    const reset = await fetch('http://127.0.0.1:8085/emulator/v1/projects/demo-ipfp-rbac/databases/(default)/documents', { method: 'DELETE' });
    assert.equal(reset.ok, true, 'The dedicated demo database must be reset before each run');
    await Promise.all([
      setDoc(doc(owner, 'users', 'admin'), profile('admin', 'admin')),
      setDoc(doc(owner, 'users', 'reader'), profile('reader', 'custom', { students: 'view' })),
      setDoc(doc(owner, 'users', 'editor'), profile('editor', 'custom', { students: 'edit' })),
      setDoc(doc(owner, 'users', 'manager'), profile('manager', 'secretary', Object.fromEntries(MODULE_KEYS.map(key => [key, key === 'finance' ? 'none' : 'edit'])))),
      setDoc(doc(owner, 'users', 'manager-reader'), profile('manager-reader', 'custom', { users: 'view' })),
      setDoc(doc(owner, 'users', 'finance-user'), profile('finance-user', 'custom', { finance: 'edit' })),
      setDoc(doc(owner, 'students', 'sample'), { name: 'Fictional student' }),
      setDoc(doc(owner, 'payments', 'sample'), { amount: 1 }),
    ]);
    await t.test('anonymous access, absent profiles and self-bootstrap are denied', async () => {
      if (process.env.IPFP_RULES_MODE === 'portal-compat') {
        assert.equal((await getDoc(doc(anonymous, 'students', 'sample'))).exists(), true);
      } else {
        await denied(getDoc(doc(anonymous, 'students', 'sample')));
      }
      await denied(updateDoc(doc(anonymous, 'students', 'sample'), { name: 'Anonymous write' }));
      await denied(getDoc(doc(anonymous, 'payments', 'sample')));
      await denied(getDocs(collection(anonymous, 'users')));
      await denied(setDoc(doc(anonymous, 'users', 'anonymous-admin'), profile('anonymous-admin', 'admin')));
      await denied(getDoc(doc(stranger, 'students', 'sample')));
      await denied(setDoc(doc(stranger, 'users', 'stranger'), profile('stranger', 'admin')));
    });
    await t.test('readers can read their module but cannot write, read finance or enumerate users', async () => {
      assert.equal((await getDoc(doc(reader, 'students', 'sample'))).exists(), true);
      await denied(updateDoc(doc(reader, 'students', 'sample'), { name: 'Changed' }));
      await denied(getDoc(doc(reader, 'payments', 'sample')));
      await denied(getDocs(collection(reader, 'users')));
    });
    await t.test('self promotion is denied but a server-timestamp login update is allowed', async () => {
      await denied(updateDoc(doc(reader, 'users', 'reader'), { role: 'admin' }));
      await updateDoc(doc(reader, 'users', 'reader'), { lastLogin: serverTimestamp() });
      await denied(updateDoc(doc(reader, 'users', 'reader'), { lastLogin: 'forged' }));
    });
    await t.test('editors can write; revocation and disabling immediately deny further server requests', async () => {
      await updateDoc(doc(editor, 'students', 'sample'), { name: 'Allowed' });
      await updateDoc(doc(owner, 'users', 'editor'), { permissions: normalizePermissions('custom', { students: 'view' }) });
      await denied(updateDoc(doc(editor, 'students', 'sample'), { name: 'Denied' }));
      await updateDoc(doc(owner, 'users', 'editor'), { isActive: false });
      await denied(getDoc(doc(editor, 'students', 'sample')));
    });
    await t.test('administrator creation works, malformed permissions and admin lockout are denied', async () => {
      await setDoc(doc(admin, 'users', 'new-user'), profile('new-user', 'secretary', { students: 'view' }));
      const invalid = profile('bad-user', 'custom'); invalid.permissions.students = 'write';
      await denied(setDoc(doc(admin, 'users', 'bad-user'), invalid));
      await denied(updateDoc(doc(admin, 'users', 'admin'), { isActive: false, updatedAt: serverTimestamp() }));
      await denied(updateDoc(doc(admin, 'users', 'admin'), { role: 'custom', updatedAt: serverTimestamp() }));
      await denied(deleteDoc(doc(admin, 'users', 'admin')));
    });
    await t.test('delegated managers can manage nonfinancial users but cannot access finance or grant privileges', async () => {
      assert.ok((await getDocs(collection(manager, 'users'))).size > 0);
      await setDoc(doc(manager, 'users', 'delegated-user'), profile('delegated-user', 'secretary', { students: 'edit', users: 'edit' }));
      await updateDoc(doc(manager, 'users', 'delegated-user'), { displayName: 'Updated by manager', updatedAt: serverTimestamp() });
      await updateDoc(doc(manager, 'users', 'delegated-user'), { isActive: false, updatedAt: serverTimestamp() });
      await updateDoc(doc(manager, 'users', 'delegated-user'), { isActive: true, updatedAt: serverTimestamp() });
      await denied(getDoc(doc(manager, 'payments', 'sample')));
      for (const name of ['payments', 'salaries', 'expenses', 'receipt_counters']) {
        await denied(setDoc(doc(manager, name, 'denied-write'), { value: 1 }));
        await denied(getDocs(collection(manager, name)));
      }
      await denied(setDoc(doc(manager, 'users', 'delegated-admin'), profile('delegated-admin', 'admin')));
      await denied(setDoc(doc(manager, 'users', 'delegated-finance'), profile('delegated-finance', 'custom', { finance: 'view' })));
      await denied(updateDoc(doc(manager, 'users', 'manager'), { role: 'admin', updatedAt: serverTimestamp() }));
      await denied(updateDoc(doc(manager, 'users', 'manager'), { permissions: normalizePermissions('secretary', { finance: 'edit' }), updatedAt: serverTimestamp() }));
      await denied(updateDoc(doc(manager, 'users', 'delegated-user'), { permissions: normalizePermissions('secretary', { finance: 'view' }), updatedAt: serverTimestamp() }));
      await denied(updateDoc(doc(manager, 'users', 'admin'), { displayName: 'Hijacked admin', updatedAt: serverTimestamp() }));
      await denied(updateDoc(doc(manager, 'users', 'finance-user'), { permissions: normalizePermissions('custom'), updatedAt: serverTimestamp() }));
      await denied(updateDoc(doc(manager, 'users', 'finance-user'), { isActive: false, updatedAt: serverTimestamp() }));
      await denied(updateDoc(doc(manager, 'users', 'manager'), { isActive: false, updatedAt: serverTimestamp() }));
      for (const name of ['settings', 'operations', 'academic_year_backups', 'tokens']) {
        await denied(setDoc(doc(manager, name, 'denied-admin-operation'), { value: 1 }));
      }
    });
    await t.test('view-only user management cannot mutate users', async () => {
      assert.ok((await getDocs(collection(managerReader, 'users'))).size > 0);
      await denied(setDoc(doc(managerReader, 'users', 'reader-created'), profile('reader-created', 'custom')));
      await denied(updateDoc(doc(managerReader, 'users', 'delegated-user'), { displayName: 'Forbidden', updatedAt: serverTimestamp() }));
    });
    const event = { userId: 'reader', userName: 'reader', userRole: 'custom', message: 'Test event', type: 'info', timestamp: serverTimestamp(), createdAt: serverTimestamp() };
    await t.test('audit attribution and timestamps cannot be forged; events cannot be erased', async () => {
      await setDoc(doc(reader, 'activity_logs', 'reader-event'), event);
      await denied(setDoc(doc(reader, 'activity_logs', 'forged'), { ...event, userId: 'admin', userRole: 'admin' }));
      await denied(setDoc(doc(reader, 'activity_logs', 'forged-name'), { ...event, userName: 'admin' }));
      await denied(setDoc(doc(reader, 'activity_logs', 'forged-time'), { ...event, timestamp: 123 }));
      await denied(setDoc(doc(reader, 'activity_logs', 'server-reserved'), event));
      await denied(setDoc(doc(reader, 'activity_logs', 'forged-source'), { ...event, source: 'server' }));
      await denied(updateDoc(doc(admin, 'activity_logs', 'reader-event'), { message: 'Changed' }));
      await denied(deleteDoc(doc(admin, 'activity_logs', 'reader-event')));
      assert.equal((await getDocs(query(collection(reader, 'activity_logs'), where('userId', '==', 'reader')))).size, 1);
      await denied(getDocs(collection(reader, 'activity_logs')));
    });
    await t.test('profile and audit commit atomically', async () => {
      const batch = writeBatch(admin);
      batch.set(doc(admin, 'users', 'atomic-user'), profile('atomic-user', 'custom'));
      batch.set(doc(admin, 'activity_logs', 'invalid-atomic-event'), event);
      await denied(batch.commit());
      assert.equal((await getDoc(doc(owner, 'users', 'atomic-user'))).exists(), false);
      const validBatch = writeBatch(admin);
      validBatch.set(doc(admin, 'users', 'atomic-user'), profile('atomic-user', 'custom'));
      validBatch.set(doc(admin, 'activity_logs', 'valid-atomic-event'), { ...event, userId: 'admin', userName: 'admin', userRole: 'admin' });
      await validBatch.commit();
      assert.equal((await getDoc(doc(owner, 'users', 'atomic-user'))).exists(), true);
      const renameBatch = writeBatch(admin);
      renameBatch.update(doc(admin, 'users', 'admin'), { displayName: 'Renamed admin', updatedAt: serverTimestamp() });
      renameBatch.set(doc(admin, 'activity_logs', 'rename-event'), { ...event, userId: 'admin', userName: 'admin', userRole: 'admin' });
      await renameBatch.commit();
    });
  } finally {
    await Promise.all(databases.map(db => terminate(db)));
    await Promise.all(apps.map(app => deleteApp(app)));
  }
});
