import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedulePublication, isScheduleShareToken } from '../src/utils/schedulePublication.js';
const scope = { diploma: 'Technicien Spécialisé', filiere: 'Développement Informatique', annee: '1ère année', academicYear: '2025-2026', semester: 'S2' };
test('published schedules exclude private fields, other groups, years and semesters', () => {
  const session = { ...scope, day: 'Lundi', time: '08:30-10:30', moduleS1: 'Python', moduleS2: 'Web / Java', teacherId: 't', privateNote: 'secret' };
  const result = buildSchedulePublication(scope, { schedules: [session, { ...session, annee: '2ème année' }, { ...session, academicYear: '2026-2027' }, { ...session, moduleS2: '' }], teachers: [{ id: 't', name: 'Test', email: 'private' }] });
  assert.deepEqual(result.rows, [{ day: 'Lundi', time: '08:30-10:30', module: 'Web / Java', type: '', room: '', teacherName: 'Test' }]);
  assert.ok(isScheduleShareToken('A'.repeat(43)));
  assert.equal(isScheduleShareToken('../private'), false);
});
