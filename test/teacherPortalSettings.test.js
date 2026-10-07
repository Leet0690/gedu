import test from 'node:test';
import assert from 'node:assert/strict';
import { readTeacherPortalSettings } from '../functions/teacherPortalSettings.js';
import { getScheduleModuleForSemester } from '../src/utils/scheduleSemester.js';
import { getLocalDate } from '../src/utils/localDate.js';

class PortalError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function database(settings, tokens = { tokenAttendance: 'attendance-link', tokenGrades: 'grades-link' }) {
  return {
    collection: name => {
      assert.equal(name, 'teachers');
      return { where: (field, operator, token) => {
        assert.equal(operator, '==');
        return { limit: () => ({ get: async () => ({ empty: tokens[field] !== token }) }) };
      } };
    },
    doc: path => {
      assert.equal(path, 'settings/app');
      return { get: async () => ({ data: () => settings }) };
    },
  };
}

test('attendance and grade portals use the server semester and year without exposing private settings', async () => {
  const db = database({ activeSemester: 'S2', operationalAcademicYear: '2026-2027', academicYearClosure: { private: true } });
  for (const token of ['attendance-link', 'grades-link']) {
    const result = await readTeacherPortalSettings(db, token, PortalError);
    assert.deepEqual(result, { activeSemester: 'S2', operationalAcademicYear: '2026-2027' });
    const session = { moduleS1: 'Ancien module', moduleS2: 'Module actuel' };
    assert.equal(getScheduleModuleForSemester(session, result.activeSemester), 'Module actuel');
  }
});

test('unknown or missing teacher links cannot read settings', async () => {
  for (const token of ['unknown', '', undefined, ' ']) {
    await assert.rejects(readTeacherPortalSettings(database({}), token, PortalError),
      error => ['invalid-argument', 'permission-denied'].includes(error.code));
  }
});

test('missing settings use the initial scheduling scope', async () => {
  assert.deepEqual(await readTeacherPortalSettings(database(undefined), 'attendance-link', PortalError),
    { activeSemester: 'S1', operationalAcademicYear: '2025-2026' });
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
