import test from 'node:test';
import assert from 'node:assert/strict';
import { startAutoRefresh } from '../src/utils/autoRefresh.js';
import { createReadCoordinator, READ_TTL_MS } from '../src/utils/readCoordinator.js';

function browser() {
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  windowTarget.navigator = { onLine: true };
  documentTarget.visibilityState = 'visible';
  let tick;
  windowTarget.setInterval = callback => { tick = callback; return 1; };
  windowTarget.clearInterval = () => { tick = null; };
  return { windowTarget, documentTarget, tick: () => tick?.() };
}

test('automatic refresh waits five minutes and coalesces focus, timer and online events', () => {
  const env = browser();
  let time = 0;
  let count = 0;
  const stop = startAutoRefresh({ ...env, now: () => time, refresh: () => count++ });
  time = READ_TTL_MS - 1;
  env.windowTarget.dispatchEvent(new Event('focus'));
  assert.equal(count, 0);
  time++;
  env.tick();
  env.windowTarget.dispatchEvent(new Event('focus'));
  env.windowTarget.dispatchEvent(new Event('online'));
  assert.equal(count, 1);
  time += READ_TTL_MS;
  env.tick();
  assert.equal(count, 2);
  stop();
});

test('hidden and offline tabs pause refresh; resuming refreshes once and cleanup removes listeners', () => {
  const env = browser();
  let time = 0;
  let count = 0;
  const stop = startAutoRefresh({ ...env, now: () => time, refresh: () => count++ });
  env.documentTarget.visibilityState = 'hidden';
  time += READ_TTL_MS * 3;
  env.tick();
  assert.equal(count, 0);
  env.documentTarget.visibilityState = 'visible';
  env.windowTarget.navigator.onLine = false;
  env.documentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(count, 0);
  env.windowTarget.navigator.onLine = true;
  env.windowTarget.dispatchEvent(new Event('online'));
  assert.equal(count, 1);
  stop();
  time += READ_TTL_MS;
  env.tick();
  env.windowTarget.dispatchEvent(new Event('focus'));
  env.windowTarget.dispatchEvent(new Event('online'));
  env.documentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(count, 1);
});

test('automatic wakeups reuse fresh resources and reload only expired data', async () => {
  const env = browser();
  let time = 0;
  let count = 0;
  let pending;
  const reads = createReadCoordinator({ now: () => time });
  const load = () => reads.run('modules', async () => count++);
  const stop = startAutoRefresh({ ...env, now: () => time, refresh: () => { pending = load(); } });
  time = READ_TTL_MS - 1000;
  await load(); // A page visited shortly before the next automatic wakeup.
  time = READ_TTL_MS;
  env.tick();
  await pending;
  assert.equal(count, 1);
  time += READ_TTL_MS;
  env.tick();
  await pending;
  assert.equal(count, 2);
  stop();
});
