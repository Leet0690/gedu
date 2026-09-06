import test from 'node:test';
import assert from 'node:assert/strict';
import { describeAuditChange } from '../functions/auditEvent.js';

test('server auditing describes create, update and delete without copying sensitive values', () => {
  const record = { password: 'never-log-this', token: 'secret-token', amount: 200 };
  const created = describeAuditChange('students', 'sample', null, record);
  assert.equal(created.actionType, 'CREATE');
  assert.equal(created.source, 'server');
  assert.deepEqual(created.metadata.changedFields, ['password', 'token', 'amount']);
  assert.equal(JSON.stringify(created).includes('never-log-this'), false);
  assert.equal(JSON.stringify(created).includes('secret-token'), false);
  assert.equal(describeAuditChange('students', 'sample', record, { ...record, amount: 300 }).actionType, 'UPDATE');
  assert.equal(describeAuditChange('students', 'sample', record, null).actionType, 'DELETE');
});
test('audit events do not recurse and unchanged data does not produce noise', () => {
  assert.equal(describeAuditChange('activity_logs', 'id', null, { message: 'x' }), null);
  assert.equal(describeAuditChange('access_logs', 'id', null, { message: 'x' }), null);
  assert.equal(describeAuditChange('students', 'id', { name: 'A' }, { name: 'A' }), null);
});
