import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateStudentAttendanceRate,
  findStudentAttendanceRecord,
  getStudentAttendanceWriteTarget,
  isTeacherSessionComplete,
  makeAttendanceColumnKey,
  makeStudentAttendanceDocId,
} from '../src/utils/attendanceKeys.js';
import { getScheduleModuleForSemester } from '../src/utils/scheduleSemester.js';

test('a shared teacher time slot does not complete an unmarked group', () => {
  const sharedSlotRecord = { status: 'present', timeSlot: '10:30-12:00' };
  assert.equal(isTeacherSessionComplete(sharedSlotRecord, true), true);
  assert.equal(isTeacherSessionComplete(sharedSlotRecord, false), false);
  assert.equal(isTeacherSessionComplete({ status: 'absent' }, false), true);
});

test('dashboard attendance rate isolates the selected cohort and calendar month', () => {
  const records = [
    { studentId: 's1', date: '2025-08-03', status: 'present' },
    { studentId: 's1', date: '2025-08-04', status: 'absent' },
    { studentId: 's1', date: '2024-08-03', status: 'present' },
    { studentId: 's2', date: '2025-08-03', status: 'present' },
    { studentId: 's1', date: '2025-08-05', status: '' },
  ];

  assert.equal(calculateStudentAttendanceRate(records, new Set(['s1']), '2025-08'), 50);
  assert.equal(calculateStudentAttendanceRate(records, new Set(['missing']), '2025-08'), null);
});

test('student attendance lookup targets the exact session time', () => {
  const records = [
    { id: 'legacy', studentId: 's1', moduleId: 'Réseaux', date: '2026-06-29', status: 'absent', timeSlot: '' },
    { id: 'morning', studentId: 's1', moduleId: 'Réseaux', date: '2026-06-29', status: 'present', timeSlot: '08:30-10:30' },
    { id: 'noon', studentId: 's1', moduleId: 'Réseaux', date: '2026-06-29', status: 'absent', timeSlot: '10:30-12:00' },
  ];

  assert.equal(findStudentAttendanceRecord(records, 's1', 'Réseaux', '2026-06-29', '10:30-12:00')?.id, 'noon');
  assert.equal(findStudentAttendanceRecord(records, 's1', 'Réseaux', '2026-06-29', '14:00-16:00')?.id, 'legacy');
  assert.equal(findStudentAttendanceRecord(records, 's1', 'Réseaux', '2026-06-29', '14:00-16:00', { allowLegacy: false }), null);
  assert.equal(findStudentAttendanceRecord(records, 's1', 'Réseaux', '2026-06-29', '', { legacyOnly: true })?.id, 'legacy');
  assert.notEqual(
    makeStudentAttendanceDocId('s1', 'Réseaux', '2026-06-29', '08:30-10:30'),
    makeStudentAttendanceDocId('s1', 'Réseaux', '2026-06-29', '10:30-12:00'),
  );
});

test('attendance writes migrate legacy ids and monthly columns keep separate time slots', () => {
  const legacyId = makeStudentAttendanceDocId('s1', 'Réseaux', '2026-06-29');
  const target = getStudentAttendanceWriteTarget('s1', 'Réseaux', '2026-06-29', '10:30-12:00', legacyId);

  assert.equal(target.previousId, legacyId);
  assert.equal(target.canonicalId, makeStudentAttendanceDocId('s1', 'Réseaux', '2026-06-29', '10:30-12:00'));
  assert.notEqual(
    makeAttendanceColumnKey('2026-06-29', 'Réseaux', '08:30-10:30'),
    makeAttendanceColumnKey('2026-06-29', 'Réseaux', '10:30-12:00'),
  );
  assert.notEqual(
    makeAttendanceColumnKey('2026-06-29', 'Réseaux'),
    makeAttendanceColumnKey('2026-06-29', 'Réseaux', '10:30-12:00'),
  );
});

test('S1 and S2 schedules remain strictly separated', () => {
  const paired = {
    filiere: 'Développement Informatique',
    annee: '2ème année',
    moduleS1: 'Réseaux informatiques',
    moduleS2: 'Fondamentaux de la cybersécurité',
  };
  assert.equal(getScheduleModuleForSemester(paired, 'S1'), 'Réseaux informatiques');
  assert.equal(getScheduleModuleForSemester(paired, 'S2'), 'Fondamentaux de la cybersécurité');

  const legacyS2 = {
    filiere: 'Gestion Informatisée',
    annee: '2ème année',
    module: 'Fondamentaux de la cybersécurité',
  };
  const catalog = [{
    name: 'Fondamentaux de la cybersécurité',
    major: 'Gestion Informatisée',
    year: '2ème année',
    semester: 'S2',
  }];
  assert.equal(getScheduleModuleForSemester(legacyS2, 'S1', catalog), '');
  assert.equal(getScheduleModuleForSemester(legacyS2, 'S2', catalog), 'Fondamentaux de la cybersécurité');

  const legacyWithUniqueNameMatch = {
    filiere: 'Gestion Informatisée',
    annee: '2ème année',
    module: 'Management des RH',
  };
  const uniqueNameCatalog = [{
    name: 'Management des RH',
    major: 'Gestion des Entreprises',
    year: '2ème année',
    semester: 'S2',
  }];
  assert.equal(getScheduleModuleForSemester(legacyWithUniqueNameMatch, 'S1', uniqueNameCatalog), '');
  assert.equal(getScheduleModuleForSemester(legacyWithUniqueNameMatch, 'S2', uniqueNameCatalog), 'Management des RH');

  const contradictoryCatalog = [
    { name: 'Module partagé', major: 'Groupe A', year: '1ère année', semester: 'S1' },
    { name: 'Module partagé', major: 'Groupe B', year: '1ère année', semester: 'S2' },
  ];
  const unresolvedLegacy = { filiere: 'Groupe C', annee: '1ère année', module: 'Module partagé' };
  assert.equal(getScheduleModuleForSemester(unresolvedLegacy, 'S1', contradictoryCatalog), '');
  assert.equal(getScheduleModuleForSemester(unresolvedLegacy, 'S2', contradictoryCatalog), '');
  assert.equal(getScheduleModuleForSemester({ module: 'Module inconnu' }, 'S1', []), '');
});
