import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIRST_YEAR,
  SECOND_YEAR,
  canEditAttendanceForAcademicYear,
  getAcademicYearTransition,
  getAcademicYearForDate,
  getAvailableAcademicYears,
  getCalendarYearForAcademicMonth,
  getPaymentAcademicYear,
  getStudentAcademicSnapshot,
  getStudentCurrentAcademicYear,
  getStudentStudyCycleRange,
  getStudentPayableMonths,
  getStudentPreviousYearBalance,
  isStudentVacationMonth,
  isStudentCurrentlyInAcademicYear,
  getScheduleAcademicYear,
  filterSchedulesForAcademicYear,
} from '../src/utils/studentStatus.js';

test('calendar dates and months resolve inside September-to-August academic years', () => {
  assert.equal(getAcademicYearForDate('2026-08-31'), '2025-2026');
  assert.equal(getAcademicYearForDate('2026-09-01'), '2026-2027');
  assert.equal(getAcademicYearForDate('2026-02-31'), '');
  assert.equal(getCalendarYearForAcademicMonth('2024-2025', 8), 2024);
  assert.equal(getCalendarYearForAcademicMonth('2024-2025', 7), 2025);
});

test('attendance editing is restricted to the writable year and valid non-future dates', () => {
  const base = {
    writableAcademicYear: '2025-2026',
    selectedAcademicYear: '2025-2026',
    today: '2026-08-27',
  };

  assert.equal(canEditAttendanceForAcademicYear({ ...base, selectedDate: '2026-08-27' }), true);
  assert.equal(canEditAttendanceForAcademicYear({ ...base, selectedDate: '2026-08-28' }), false);
  assert.equal(canEditAttendanceForAcademicYear({ ...base, selectedDate: '2025-08-31' }), false);
  assert.equal(canEditAttendanceForAcademicYear({
    ...base,
    selectedAcademicYear: '2024-2025',
    selectedDate: '2025-08-27',
  }), false);
});

test('the proposed closure is derived only from the operational academic year', () => {
  assert.deepEqual(
    getAcademicYearTransition('2025-2026'),
    { fromAcademicYear: '2025-2026', toAcademicYear: '2026-2027' }
  );
  assert.deepEqual(
    getAcademicYearTransition('2026-2027'),
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

  const snapshot = getStudentAcademicSnapshot(student, '2025-2026', '2026-2027');
  assert.equal(snapshot.year, FIRST_YEAR);
  assert.equal(snapshot.academicYear, '2025-2026');
  assert.equal(snapshot.isHistoricalSnapshot, true);
  assert.equal(isStudentCurrentlyInAcademicYear(student, '2025-2026', '2026-2027'), false);
  assert.equal(isStudentCurrentlyInAcademicYear(student, '2026-2027', '2026-2027'), true);
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

  assert.equal(getStudentAcademicSnapshot(student, '2026-2027', '2025-2026'), null);
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

  const snapshot = getStudentAcademicSnapshot(student, '2025-2026', '2025-2026');
  assert.ok(snapshot);
  assert.equal(snapshot.academicYear, '2025-2026');
  assert.equal(snapshot.year, SECOND_YEAR);
});

test('a legacy second-year student keeps the stored level in the operational year', () => {
  const student = {
    id: 'legacy-second-year',
    status: 'active',
    regNo: 'TS-DI/25',
    diploma: 'Technicien Spécialisé',
    major: 'Développement Informatique',
    year: SECOND_YEAR,
  };

  assert.equal(getStudentCurrentAcademicYear(student, '2025-2026'), '2025-2026');
  const snapshot = getStudentAcademicSnapshot(student, '2025-2026', '2025-2026');
  assert.ok(snapshot);
  assert.equal(snapshot.year, SECOND_YEAR);
});

test('study cycle uses academic year and level, never the matricule', () => {
  assert.equal(
    getStudentStudyCycleRange({ regNo: 'TS-DI/25', year: SECOND_YEAR }, '2025-2026'),
    '2024 - 2026'
  );
  assert.equal(
    getStudentStudyCycleRange({ regNo: 'TS-DI/24', year: FIRST_YEAR }, '2025-2026'),
    '2025 - 2027'
  );
});

test('the next academic year is hidden until the manual closure changes the operational year', () => {
  const legacyStudents = [{
    id: 'legacy-live',
    status: 'active',
    academicYear: '2026-2027',
    year: SECOND_YEAR,
  }];
  assert.equal(getStudentCurrentAcademicYear(legacyStudents[0], '2025-2026'), '2025-2026');
  assert.deepEqual(
    getAvailableAcademicYears(
      legacyStudents,
      [{ date: '2026-09-02' }],
      '2025-2026'
    ),
    ['2025-2026']
  );

  const promotedStudents = [{
    ...legacyStudents[0],
    previousAcademicYear: '2025-2026',
    classHistory: [{ academicYear: '2025-2026', year: FIRST_YEAR }],
  }];
  assert.deepEqual(
    getAvailableAcademicYears(promotedStudents, [], '2026-2027', ['2025-2026']),
    ['2026-2027', '2025-2026']
  );
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

test('vacation months depend on the student study year', () => {
  const firstYear = { year: FIRST_YEAR };
  const secondYear = { year: SECOND_YEAR };

  assert.equal(isStudentVacationMonth(firstYear, 'Août'), true);
  assert.equal(isStudentVacationMonth(firstYear, 'Septembre'), true);
  assert.equal(isStudentVacationMonth(firstYear, 'Juillet'), false);
  assert.equal(isStudentVacationMonth(secondYear, 'Juillet'), true);
  assert.equal(isStudentVacationMonth(secondYear, 'Août'), true);
  assert.equal(isStudentVacationMonth(secondYear, 'Septembre'), false);
  assert.equal(getStudentPayableMonths(firstYear).length, 10);
  assert.equal(getStudentPayableMonths(secondYear).length, 10);
});

test('vacation months never generate previous-year arrears', () => {
  const student = {
    id: 's-arrears',
    classHistory: [{ academicYear: '2025-2026', year: FIRST_YEAR }],
  };
  const balance = getStudentPreviousYearBalance(student, []);

  assert.equal(balance.unpaidCount, 10);
  assert.equal(balance.details[0].unpaidMonths.includes('Août'), false);
  assert.equal(balance.details[0].unpaidMonths.includes('Septembre'), false);
  assert.equal(balance.details[0].unpaidMonths.includes('Juillet'), true);
});

test('schedule timetable is scoped to academic year: 2025-2026 displays existing schedules, new operational year is empty', () => {
  const legacySchedule1 = { id: 'sch-1', day: 'Lundi', time: '08:30-10:30', module: 'Dev Web' };
  const legacySchedule2 = { id: 'sch-2', day: 'Mardi', time: '10:30-12:30', module: 'Algo', academicYear: '2025-2026' };
  const futureSchedule = { id: 'sch-3', day: 'Mercredi', time: '14:00-16:00', module: 'React', academicYear: '2027-2028' };
  const allSchedules = [legacySchedule1, legacySchedule2, futureSchedule];

  // Legacy schedules without academicYear default to 2025-2026
  assert.equal(getScheduleAcademicYear(legacySchedule1), '2025-2026');
  assert.equal(getScheduleAcademicYear(legacySchedule2), '2025-2026');
  assert.equal(getScheduleAcademicYear(futureSchedule), '2027-2028');

  // When 2025-2026 is selected in Admin Dashboard: legacy + 2025-2026 schedules appear
  const schedules2025 = filterSchedulesForAcademicYear(allSchedules, '2025-2026');
  assert.equal(schedules2025.length, 2);
  assert.deepEqual(schedules2025.map(s => s.id), ['sch-1', 'sch-2']);

  // When current year 2026-2027 is selected in Admin Dashboard and has no schedules yet: returns empty array
  const schedules2026 = filterSchedulesForAcademicYear(allSchedules, '2026-2027');
  assert.equal(schedules2026.length, 0);

  // Invalid or empty calls return empty array safely
  assert.deepEqual(filterSchedulesForAcademicYear(null, '2025-2026'), []);
  assert.deepEqual(filterSchedulesForAcademicYear([], '2025-2026'), []);
  assert.deepEqual(filterSchedulesForAcademicYear(allSchedules, ''), []);
});
