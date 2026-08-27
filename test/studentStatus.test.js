import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIRST_YEAR,
  SECOND_YEAR,
  getDefaultAcademicYearTransition,
  getPaymentAcademicYear,
  getStudentAcademicSnapshot,
  isStudentCurrentlyInAcademicYear,
} from '../src/utils/studentStatus.js';

test('the proposed closure year changes in September, not in August', () => {
  assert.deepEqual(
    getDefaultAcademicYearTransition(new Date(2026, 7, 26)),
    { fromAcademicYear: '2025-2026', toAcademicYear: '2026-2027' }
  );
  assert.deepEqual(
    getDefaultAcademicYearTransition(new Date(2026, 8, 1)),
    { fromAcademicYear: '2026-2027', toAcademicYear: '2027-2028' }
  );
});

test('historical snapshots restore the class for the selected academic year', () => {
  const student = {
    id: 's1',
    status: 'active',
    academicYear: '2026-2027',
    diploma: 'Technicien Spécialisé',
    major: 'Gestion',
    year: SECOND_YEAR,
    classHistory: [{
      academicYear: '2025-2026',
      diploma: 'Technicien Spécialisé',
      major: 'Gestion',
      year: FIRST_YEAR,
      status: 'active',
    }],
  };

  const snapshot = getStudentAcademicSnapshot(student, '2025-2026');
  assert.equal(snapshot.year, FIRST_YEAR);
  assert.equal(snapshot.academicYear, '2025-2026');
  assert.equal(snapshot.isHistoricalSnapshot, true);
  assert.equal(isStudentCurrentlyInAcademicYear(student, '2025-2026'), false);
  assert.equal(isStudentCurrentlyInAcademicYear(student, '2026-2027'), true);
});

test('historical selection does not project a first-year student into a future class', () => {
  const student = {
    id: 's2',
    status: 'active',
    academicYear: '2025-2026',
    diploma: 'Technicien Spécialisé',
    major: 'Gestion',
    year: FIRST_YEAR,
  };

  assert.equal(getStudentAcademicSnapshot(student, '2026-2027'), null);
});

test('legacy active students remain visible in the proposed year before closure', () => {
  const student = {
    id: 'legacy-live',
    status: 'active',
    academicYear: '2026-2027',
    diploma: 'Technicien SpÃ©cialisÃ©',
    major: 'Gestion',
    year: SECOND_YEAR,
  };

  const snapshot = getStudentAcademicSnapshot(student, '2025-2026');
  assert.ok(snapshot);
  assert.equal(snapshot.academicYear, '2025-2026');
  assert.equal(snapshot.year, SECOND_YEAR);
});

test('an explicit payment academic year has priority over receipt series and date', () => {
  assert.equal(getPaymentAcademicYear({
    academicYear: '2024-2025',
    receiptAcademicYear: '2026-2027',
    date: '2026-10-10',
  }), '2024-2025');
  assert.equal(getPaymentAcademicYear({ date: '2026-08-26' }), '2025-2026');
  assert.equal(getPaymentAcademicYear({ date: '2026-09-01' }), '2026-2027');
});
