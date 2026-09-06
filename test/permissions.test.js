import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_KEYS, hasModulePermission, normalizePermissions, assertModuleEdit, canManageUsers, canManageUserTarget, assertCanManageUserTarget } from '../src/utils/permissions.js';

test('missing, inactive and malformed profiles fail closed, including administrators', () => {
  for (const user of [null, {}, { role: 'admin' }, { role: 'admin', isActive: false }]) {
    assert.equal(hasModulePermission(user, 'users'), false);
  }
  const admin = { role: 'admin', isActive: true };
  assert.equal(hasModulePermission(admin, 'unknown'), false);
  assert.equal(hasModulePermission(admin, 'students', 'invalid'), false);
});
test('read permissions never authorize writes and user management requires an explicit grant', () => {
  const user = { role: 'custom', isActive: true, permissions: { students: 'view', grades: 'edit', users: 'edit' } };
  assert.equal(hasModulePermission(user, 'students'), true);
  assert.equal(hasModulePermission(user, 'students', 'edit'), false);
  assert.equal(hasModulePermission(user, 'grades', 'edit'), true);
  assert.equal(hasModulePermission(user, 'finance'), false);
  assert.equal(hasModulePermission(user, 'users'), true);
  assert.equal(canManageUsers({ ...user, permissions: { users: 'view' } }), false);
  assert.equal(canManageUsers({ ...user, permissions: {} }), false);
});
test('permission normalization denies missing modules and rejects invalid roles and levels', () => {
  const result = normalizePermissions('custom', { students: 'view', users: 'edit' });
  assert.deepEqual(Object.keys(result), MODULE_KEYS);
  assert.equal(result.users, 'edit');
  assert.equal(result.finance, 'none');
  assert.throws(() => normalizePermissions('owner', {}));
  assert.throws(() => normalizePermissions('custom', { students: 'write' }));
  assert.ok(Object.values(normalizePermissions('admin')).every(level => level === 'edit'));
});

test('delegated managers cannot create or edit administrators or finance users', () => {
  const actor = { isActive: true, role: 'secretary', permissions: normalizePermissions('secretary', Object.fromEntries(MODULE_KEYS.map(key => [key, key === 'finance' ? 'none' : 'edit']))) };
  assert.equal(canManageUsers(actor), true);
  assert.equal(hasModulePermission(actor, 'finance'), false);
  assert.equal(hasModulePermission(actor, 'finance', 'edit'), false);
  for (const key of MODULE_KEYS.filter(key => key !== 'finance')) assert.equal(hasModulePermission(actor, key, 'edit'), true);
  assert.equal(canManageUserTarget(actor, { role: 'custom', permissions: {} }), true);
  assert.equal(canManageUserTarget(actor, actor), true);
  for (const target of [null, { role: 'admin' }, { role: 'super_admin', isActive: false }, { role: 'custom', permissions: { finance: 'view' } }, { role: 'secretary', permissions: { finance: 'edit' } }]) {
    assert.equal(canManageUserTarget(actor, target), false);
    assert.throws(() => assertCanManageUserTarget(actor, target), { code: 'permission-denied' });
  }
  assert.equal(canManageUserTarget({ role: 'admin', isActive: true }, { role: 'secretary', permissions: { finance: 'edit' } }), true);
});

test('finance privileges cannot be combined with delegated user management', () => {
  for (const finance of ['view', 'edit']) {
    assert.throws(() => normalizePermissions('secretary', { users: 'edit', finance }));
    assert.equal(canManageUsers({ role: 'secretary', isActive: true, permissions: { users: 'edit', finance } }), false);
  }
  assert.throws(() => assertModuleEdit({ role: 'secretary', isActive: true, permissions: { users: 'edit' } }, 'administration'));
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
