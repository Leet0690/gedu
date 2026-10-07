import test from 'node:test';
import assert from 'node:assert/strict';
import { createSerialTaskQueue } from '../src/utils/serialTaskQueue.js';

test('overlapping portal reads finish their cleanup before the next session opens', async () => {
  const queue = createSerialTaskQueue();
  const events = [];
  let releaseFirst;
  const waiting = new Promise(resolve => { releaseFirst = resolve; });
  const first = queue.run(async () => {
    events.push('session-a');
    await waiting;
    events.push('cleanup-a');
    return 'a';
  });
  const second = queue.run(async () => {
    events.push('session-b', 'cleanup-b');
    return 'b';
  });
  await Promise.resolve();
  assert.deepEqual(events, ['session-a']);
  releaseFirst();
  assert.deepEqual(await Promise.all([first, second]), ['a', 'b']);
  await queue.drain();
  assert.deepEqual(events, ['session-a', 'cleanup-a', 'session-b', 'cleanup-b']);
});

test('a failed read remains visible to its caller while allowing a later retry', async () => {
  const queue = createSerialTaskQueue();
  const failed = queue.run(() => { throw new Error('permission-denied'); });
  const retry = queue.run(() => 'loaded');
  await assert.rejects(failed, /permission-denied/);
  assert.equal(await retry, 'loaded');
  await queue.drain();
});
