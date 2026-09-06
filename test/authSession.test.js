import test from 'node:test';
import assert from 'node:assert/strict';
import { profileSessionState, getLoginDestination } from '../src/utils/authSession.js';
import { hasModulePermission } from '../src/utils/permissions.js';

const identity = { uid: 'real-uid', email: 'person@example.test' };
const snapshot = (profile, metadata = {}) => ({
  metadata: { fromCache: false, hasPendingWrites: false, ...metadata },
  exists: () => profile != null, data: () => profile,
});
test('unconfirmed and optimistic privilege changes never authorize a session', () => {
  const privileged = { isActive: true, role: 'admin' };
  assert.equal(profileSessionState(snapshot(privileged, { fromCache: true }), identity), null);
  assert.equal(profileSessionState(snapshot(privileged, { hasPendingWrites: true }), identity), null);
  assert.equal(profileSessionState(snapshot(privileged), identity).user.role, 'admin');
});
test('missing/disabled profiles deny access and server identity overrides profile fields', () => {
  for (const profile of [null, { role: 'admin' }, { role: 'admin', isActive: false }]) {
    const result = profileSessionState(snapshot(profile), identity);
    assert.equal(result.user, null);
    assert.ok(result.error);
  }
  const result = profileSessionState(snapshot({ uid: 'forged', email: 'forged', isActive: true, role: 'custom' }), identity);
  assert.equal(result.user.uid, identity.uid);
  assert.equal(result.user.email, identity.email);
});
test('profile errors distinguish missing, disabled and malformed activation', () => {
  assert.match(profileSessionState(snapshot(null), identity).error, /UID/);
  assert.match(profileSessionState(snapshot({ isActive: false }), identity).error, /désactivé/);
  for (const isActive of [undefined, null, 'true', 'false', 1]) {
    const result = profileSessionState(snapshot({ isActive }), identity);
    assert.equal(result.user, null);
    assert.match(result.error, /booléen/);
  }
});
test('login destinations are allowed internal routes, even with a forged return location', () => {
  const modules = [{ id: 'dashboard', path: '/' }, { id: 'students', path: '/admin/students' }, { id: 'finance', path: '/admin/finance' }];
  const user = { isActive: true, role: 'custom', permissions: { students: 'view' } };
  for (const requested of ['/admin/finance', 'https://example.test/', '/login', undefined]) {
    assert.equal(getLoginDestination(modules, user, hasModulePermission, requested), '/admin/students');
  }
  assert.equal(getLoginDestination(modules, { ...user, role: 'admin' }, hasModulePermission, '/admin/finance'), '/admin/finance');
});
