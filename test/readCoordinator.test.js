import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, collection, query, where, queryEqual, terminate } from 'firebase/firestore';
import { createReadCoordinator, createInFlightReader, READ_TTL_MS } from '../src/utils/readCoordinator.js';
import { getPageCollections } from '../src/utils/dataRequirements.js';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('concurrent mounts and forced refreshes share pending work', async () => {
  const reads = createReadCoordinator();
  const gate = deferred();
  let calls = 0;
  const task = async () => { calls++; await gate.promise; };
  const first = reads.run('students', task);
  const second = reads.run('students', task, { force: true });
  assert.equal(first, second);
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test('navigation reuses completed work without reverting local edits, then expires', async () => {
  let time = 0;
  let state;
  let readsCount = 0;
  const reads = createReadCoordinator({ now: () => time });
  const fetch = async () => { readsCount++; state = 'server'; };
  await reads.run('students', fetch);
  state = 'local edit';
  time = READ_TTL_MS - 1;
  await reads.run('students', fetch);
  assert.equal(state, 'local edit');
  assert.equal(readsCount, 1);
  time = READ_TTL_MS;
  await reads.run('students', fetch);
  assert.equal(readsCount, 2);
  assert.equal(state, 'server');
});

test('failed reads remain retryable and empty results count as loaded', async () => {
  const reads = createReadCoordinator();
  await assert.rejects(reads.run('month', async () => { throw new Error('offline'); }));
  assert.equal(reads.isFresh('month'), false);
  await reads.run('month', async () => []);
  assert.equal(reads.isFresh('month'), true);
});

test('clearing the cache prevents an older response from replacing refreshed state', async () => {
  const reads = createReadCoordinator();
  const gate = deferred();
  let state;
  const old = reads.run('grades', async isCurrent => {
    await gate.promise;
    if (isCurrent()) state = 'old';
  });
  await Promise.resolve();
  reads.clear();
  await reads.run('grades', async isCurrent => { if (isCurrent()) state = 'new'; });
  gate.resolve();
  await old;
  assert.equal(state, 'new');
  assert.equal(reads.isFresh('grades'), true);
});

test('force bypasses completed work and separate account instances never share results', async () => {
  const firstAccount = createReadCoordinator();
  const secondAccount = createReadCoordinator();
  let count = 0;
  const fetch = async () => count++;
  await firstAccount.run('finance', fetch);
  await firstAccount.run('finance', fetch, { force: true });
  await secondAccount.run('finance', fetch);
  assert.equal(count, 3);
});

test('Firestore query deduplication respects filters and does not cache stale snapshots', async () => {
  const app = initializeApp({ projectId: 'demo-read-dedupe' }, 'read-dedupe');
  const db = getFirestore(app);
  const gate = deferred();
  let count = 0;
  const read = createInFlightReader(async () => { count++; await gate.promise; return []; }, queryEqual);
  const ref = token => query(collection(db, 'students'), where('token', '==', token));
  try {
    const first = read(ref('one'));
    const duplicate = read(ref('one'));
    const other = read(ref('two'));
    assert.equal(first, duplicate);
    assert.notEqual(first, other);
    gate.resolve();
    await Promise.all([first, duplicate, other]);
    assert.equal(count, 2);
    await read(ref('one'));
    assert.equal(count, 3);
  } finally {
    await terminate(db);
    await deleteApp(app);
  }
});

test('direct entry to lightweight pages excludes unrelated collections', () => {
  for (const path of ['/login', '/admin/logs', '/admin/users']) {
    assert.deepEqual(getPageCollections(path), []);
  }
  assert.deepEqual(getPageCollections('/admin/modules'), ['modules']);
  assert.deepEqual(getPageCollections('/admin/modules/'), ['modules']);
  assert.equal(getPageCollections('/admin/attendance-students').includes('grades'), false);
  assert.equal(getPageCollections('/').includes('ctStudents'), false);
  assert.equal(getPageCollections('/admin/continuous').includes('ctStudents'), true);
  assert.equal(getPageCollections('/admin/students').includes('grades'), true, 'student report exports need grades');
  assert.deepEqual(getPageCollections('/admin/finance'), ['students']);
});
