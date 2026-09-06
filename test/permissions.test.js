import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_KEYS, hasModulePermission, normalizePermissions, assertModuleEdit } from '../src/utils/permissions.js';

test('missing, inactive and malformed profiles fail closed, including administrators', () => {
  for (const user of [null, {}, { role: 'admin' }, { role: 'admin', isActive: false }]) {
    assert.equal(hasModulePermission(user, 'users'), false);
  }
  const admin = { role: 'admin', isActive: true };
  assert.equal(hasModulePermission(admin, 'unknown'), false);
  assert.equal(hasModulePermission(admin, 'students', 'invalid'), false);
});
test('read permissions never authorize writes and custom users cannot administer accounts', () => {
  const user = { role: 'custom', isActive: true, permissions: { students: 'view', grades: 'edit', users: 'edit' } };
  assert.equal(hasModulePermission(user, 'students'), true);
  assert.equal(hasModulePermission(user, 'students', 'edit'), false);
  assert.equal(hasModulePermission(user, 'grades', 'edit'), true);
  assert.equal(hasModulePermission(user, 'finance'), false);
  assert.equal(hasModulePermission(user, 'users'), false);
});
test('permission normalization denies missing modules and rejects invalid roles and levels', () => {
  const result = normalizePermissions('custom', { students: 'view', users: 'edit' });
  assert.deepEqual(Object.keys(result), MODULE_KEYS);
  assert.equal(result.users, 'none');
  assert.equal(result.finance, 'none');
  assert.throws(() => normalizePermissions('owner', {}));
  assert.throws(() => normalizePermissions('custom', { students: 'write' }));
  assert.ok(Object.values(normalizePermissions('admin')).every(level => level === 'edit'));
});

test('denied async mutations reject before persistence or success feedback', async () => {
  const effects = [];
  const save = async user => {
    assertModuleEdit(user, 'students');
    effects.push('persisted');
  };
  await assert.rejects(async () => {
    await save({ isActive: true, role: 'custom', permissions: { students: 'view' } });
    effects.push('success');
  }, error => error.code === 'permission-denied');
  assert.deepEqual(effects, []);
  await save({ isActive: true, role: 'custom', permissions: { students: 'edit' } });
  assert.deepEqual(effects, ['persisted']);
  assert.throws(() => assertModuleEdit({ isActive: true, role: 'director' }, 'administration'));
});
