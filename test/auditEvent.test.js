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

test('empty-document lifecycle is audited, unknown collection names are ignored, and token IDs are redacted', () => {
  assert.equal(describeAuditChange('students', 'empty', null, {}).actionType, 'CREATE');
  assert.equal(describeAuditChange('students', 'empty', {}, null).actionType, 'DELETE');
  assert.equal(describeAuditChange('students', 'empty', null, null), null);
  assert.equal(describeAuditChange('constructor', 'id', null, { value: 1 }), null);
  const result = describeAuditChange('tokens', 'sensitive-bearer-token', null, { owner: 'test' });
  assert.equal(JSON.stringify(result).includes('sensitive-bearer-token'), false);
});
