import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicScheduleSettings, readPublicScheduleSettings } from '../src/utils/publicScheduleSettings.js';
import { getScheduleModuleForSemester } from '../src/utils/scheduleSemester.js';
import { getLocalDate } from '../src/utils/localDate.js';

test('published scheduling scope excludes private administration fields and selects the server semester', () => {
  const scope = getPublicScheduleSettings({ activeSemester: 'S2', operationalAcademicYear: '2026-2027', academicYearClosure: { private: true } });
  assert.deepEqual(scope, { activeSemester: 'S2', operationalAcademicYear: '2026-2027' });
  const result = readPublicScheduleSettings({ exists: () => true, data: () => scope });
  assert.equal(getScheduleModuleForSemester({ moduleS1: 'Ancien module', moduleS2: 'Module actuel' }, result.activeSemester), 'Module actuel');
});

test('missing or malformed publication does not silently fall back to a cached semester', () => {
  assert.throws(() => readPublicScheduleSettings({ exists: () => false }));
  for (const data of [{}, { activeSemester: 'S3', operationalAcademicYear: '2026-2027' }, { activeSemester: 'S2', operationalAcademicYear: 'invalid' }]) {
    assert.throws(() => readPublicScheduleSettings({ exists: () => true, data: () => data }));
  }
});

test('legacy private settings publish the initial scheduling scope', () => {
  assert.deepEqual(getPublicScheduleSettings(), { activeSemester: 'S1', operationalAcademicYear: '2025-2026' });
});

test('the portal date follows the local calendar at midnight', () => {
  const previousTimeZone = process.env.TZ;
  try {
    process.env.TZ = 'Africa/Casablanca';
    assert.equal(getLocalDate(new Date('2026-10-06T23:30:00Z')), '2026-10-07');
    process.env.TZ = 'America/Los_Angeles';
    assert.equal(getLocalDate(new Date('2026-10-07T01:00:00Z')), '2026-10-06');
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
});
