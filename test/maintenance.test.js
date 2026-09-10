import test from 'node:test';
import assert from 'node:assert/strict';

import { 
  MAINTENANCE_CONFIG, 
  isMaintenanceActive, 
  isMaintenanceBypassed, 
  getRemainingTime 
} from '../src/config/maintenance.js';

test('maintenance mode is active with a 5-hour planned window', () => {
  assert.equal(isMaintenanceActive(), true, 'Maintenance must be active');
  assert.equal(MAINTENANCE_CONFIG.durationMs, 5 * 60 * 60 * 1000, 'Duration should be exactly 5 hours');
  
  const start = new Date(MAINTENANCE_CONFIG.startTime).getTime();
  const end = new Date(MAINTENANCE_CONFIG.targetEndTime).getTime();
  assert.equal(end - start, 5 * 60 * 60 * 1000, 'Window between startTime and targetEndTime should be 5 hours');
});

test('getRemainingTime calculates hours, minutes, and seconds properly for future target', () => {
  const futureTarget = new Date(Date.now() + (3 * 3600 + 25 * 60 + 40) * 1000).toISOString();
  const remaining = getRemainingTime(futureTarget);

  assert.equal(remaining.hours, 3);
  assert.equal(remaining.minutes, 25);
  assert.ok(remaining.seconds >= 38 && remaining.seconds <= 41, 'Seconds should be around 40');
  assert.equal(remaining.isCompleted, false);
});

test('getRemainingTime reports completion when target time is reached or passed', () => {
  const pastTarget = new Date(Date.now() - 10000).toISOString();
  const remaining = getRemainingTime(pastTarget);

  assert.equal(remaining.hours, 0);
  assert.equal(remaining.minutes, 0);
  assert.equal(remaining.seconds, 0);
  assert.equal(remaining.isCompleted, true);
  assert.equal(remaining.progressPercent, 100);
});

test('isMaintenanceBypassed validates the bypass secret key', () => {
  // In Node environment without window, returns false safely
  assert.equal(isMaintenanceBypassed('?bypass=wrong'), false);
  assert.equal(isMaintenanceBypassed(''), false);
});
