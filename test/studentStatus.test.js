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
  getStudentAvailableStudyYears,
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

test('getStudentAvailableStudyYears returns 1 year for 1st year students, and 2 years for 2nd year students and laureates', () => {
  // 1st year student
  const student1st = {
    id: 's-1st',
    year: FIRST_YEAR,
    academicYear: '2025-2026',
    status: 'active',
  };
  const years1st = getStudentAvailableStudyYears(student1st, '2025-2026');
  assert.equal(years1st.length, 1);
  assert.equal(years1st[0].key, '1');
  assert.equal(years1st[0].yearLevel, FIRST_YEAR);
  assert.equal(years1st[0].academicYear, '2025-2026');
  assert.equal(years1st[0].isCurrent, true);

  // 2nd year student with classHistory
  const student2ndWithHistory = {
    id: 's-2nd-hist',
    year: SECOND_YEAR,
    academicYear: '2025-2026',
    status: 'active',
    classHistory: [
      { academicYear: '2024-2025', year: FIRST_YEAR, status: 'active' },
    ],
  };
  const years2ndHist = getStudentAvailableStudyYears(student2ndWithHistory, '2025-2026');
  assert.equal(years2ndHist.length, 2);
  assert.equal(years2ndHist[0].key, '1');
  assert.equal(years2ndHist[0].yearLevel, FIRST_YEAR);
  assert.equal(years2ndHist[0].academicYear, '2024-2025');
  assert.equal(years2ndHist[0].isCurrent, false);
  assert.equal(years2ndHist[1].key, '2');
  assert.equal(years2ndHist[1].yearLevel, SECOND_YEAR);
  assert.equal(years2ndHist[1].academicYear, '2025-2026');
  assert.equal(years2ndHist[1].isCurrent, true);

  // 2nd year legacy student without classHistory (infers 2024-2025 for 1st year)
  const student2ndLegacy = {
    id: 's-2nd-leg',
    year: SECOND_YEAR,
    academicYear: '2025-2026',
    status: 'active',
  };
  const years2ndLeg = getStudentAvailableStudyYears(student2ndLegacy, '2025-2026');
  assert.equal(years2ndLeg.length, 2);
  assert.equal(years2ndLeg[0].key, '1');
  assert.equal(years2ndLeg[0].yearLevel, FIRST_YEAR);
  assert.equal(years2ndLeg[0].academicYear, '2024-2025');
  assert.equal(years2ndLeg[1].key, '2');
  assert.equal(years2ndLeg[1].yearLevel, SECOND_YEAR);
  assert.equal(years2ndLeg[1].academicYear, '2025-2026');

  // Lauréat student
  const studentLaureat = {
    id: 's-laureat',
    year: SECOND_YEAR,
    status: 'laureat',
    graduationAcademicYear: '2025-2026',
  };
  const yearsLaureat = getStudentAvailableStudyYears(studentLaureat, '2025-2026');
  assert.equal(yearsLaureat.length, 2);
  assert.equal(yearsLaureat[0].academicYear, '2024-2025');
  assert.equal(yearsLaureat[1].academicYear, '2025-2026');

  // Empty or invalid safely handled
  assert.deepEqual(getStudentAvailableStudyYears(null), []);
  assert.deepEqual(getStudentAvailableStudyYears({}), []);
});

const assertStudyYearsMatchSnapshots = (student, operationalAcademicYear, expectedAcademicYears) => {
  const years = getStudentAvailableStudyYears(student, operationalAcademicYear);
  assert.deepEqual(years.map(year => year.academicYear), expectedAcademicYears);
  assert.equal(years.filter(year => year.isCurrent).length, 1);
  for (const year of years) {
    const snapshot = getStudentAcademicSnapshot(student, year.academicYear, operationalAcademicYear);
    assert.ok(snapshot);
    assert.equal(snapshot.academicYear, year.academicYear);
    assert.equal(snapshot.year, year.yearLevel);
    assert.equal(year.isCurrent, !snapshot.isHistoricalSnapshot);
  }
  return years;
};

test('study years resolve without a database ID and stay in the operational year for legacy records', () => {
  assertStudyYearsMatchSnapshots({ year: FIRST_YEAR }, '2025-2026', ['2025-2026']);
  assertStudyYearsMatchSnapshots({ year: SECOND_YEAR }, '2025-2026', ['2024-2025', '2025-2026']);
  assertStudyYearsMatchSnapshots({
    year: SECOND_YEAR,
    academicYear: '2026-2027',
    classHistory: [null, { academicYear: 'invalid', year: FIRST_YEAR }],
  }, '2025-2026', ['2024-2025', '2025-2026']);
});

test('a promotion without class history restores the previous year and its active status', () => {
  const student = {
    year: SECOND_YEAR,
    previousAcademicYear: '2024-2025',
    promotedFromYear: FIRST_YEAR,
  };
  assertStudyYearsMatchSnapshots(student, '2025-2026', ['2024-2025', '2025-2026']);
  assert.equal(getStudentAcademicSnapshot(student, '2024-2025', '2025-2026').academicStatus, 'active');
  const afterGap = { ...student, academicYear: '2026-2027' };
  assertStudyYearsMatchSnapshots(afterGap, '2026-2027', ['2024-2025', '2026-2027']);
  assert.equal(getStudentAcademicSnapshot(afterGap, '2025-2026', '2026-2027'), null);
});

test('all recorded attempts remain available regardless of history order or gaps', () => {
  const student = {
    year: SECOND_YEAR,
    academicYear: '2026-2027',
    diploma: 'Technicien',
    major: 'Current major',
    classHistory: [
      { academicYear: '2022-2023', year: FIRST_YEAR, major: 'Older major' },
      { academicYear: '2024-2025', year: FIRST_YEAR, diploma: 'Technicien Spécialisé', major: 'Archived major' },
      { academicYear: '2023-2024', year: FIRST_YEAR, major: 'Older major' },
    ],
  };
  const options = assertStudyYearsMatchSnapshots(student, '2026-2027', ['2022-2023', '2023-2024', '2024-2025', '2026-2027']);
  assert.equal(options.find(option => option.key === '1').academicYear, '2024-2025');
  const archived = getStudentAcademicSnapshot(student, '2024-2025', '2026-2027');
  assert.equal(archived.diploma, 'Technicien Spécialisé');
  assert.equal(archived.major, 'Archived major');
  assert.equal(getStudentAcademicSnapshot(student, '2025-2026', '2026-2027'), null);
});

test('first-year repeaters can consult previous attempts without invented second-year membership', () => {
  const student = {
    year: FIRST_YEAR,
    classHistory: [{ academicYear: '2023-2024', year: FIRST_YEAR }],
  };
  assertStudyYearsMatchSnapshots(student, '2025-2026', ['2023-2024', '2025-2026']);
  assert.equal(getStudentAcademicSnapshot(student, '2024-2025', '2025-2026'), null);
});

test('second-year repeaters infer first year before their earliest second-year attempt', () => {
  for (const historyFields of [
    { classHistory: [{ academicYear: '2024-2025', year: SECOND_YEAR }] },
    { previousAcademicYear: '2024-2025', promotedFromYear: SECOND_YEAR },
  ]) {
    const student = { year: SECOND_YEAR, academicYear: '2025-2026', ...historyFields };
    assertStudyYearsMatchSnapshots(student, '2025-2026', ['2023-2024', '2024-2025', '2025-2026']);
    assert.equal(getStudentAcademicSnapshot(student, '2024-2025', '2025-2026').year, SECOND_YEAR);
  }
});

test('alumni without a stored level use graduation year and the final level of their diploma', () => {
  const student = {
    status: 'laureat',
    diploma: 'Technicien Spécialisé',
    academicYear: '2026-2027',
    graduationAcademicYear: '2024-2025',
  };
  assert.equal(getStudentCurrentAcademicYear(student, '2026-2027'), '2024-2025');
  assertStudyYearsMatchSnapshots(student, '2026-2027', ['2023-2024', '2024-2025']);
  assert.equal(getStudentAcademicSnapshot(student, '', '2026-2027').year, SECOND_YEAR);
  assert.equal(getStudentAcademicSnapshot(student, '2023-2024', '2026-2027').academicStatus, 'active');
});

test('an alumnus with only the final history entry can still consult the preceding first year', () => {
  const student = {
    year: SECOND_YEAR,
    status: 'laureat',
    graduationAcademicYear: '2025-2026',
    classHistory: [{ academicYear: '2025-2026', year: SECOND_YEAR, status: 'active' }],
  };
  assertStudyYearsMatchSnapshots(student, '2026-2027', ['2024-2025', '2025-2026']);
  assert.equal(getStudentAcademicSnapshot(student, '2025-2026', '2026-2027').academicStatus, 'laureat');
  assert.equal(getStudentAcademicSnapshot(student, '2024-2025', '2026-2027').academicStatus, 'active');
});

test('one-year Licence Professionnelle alumni do not gain a fictitious second year', () => {
  for (const year of [FIRST_YEAR, undefined]) {
    const student = {
      year,
      diploma: 'Licence Professionnelle',
      status: 'laureat',
      graduationAcademicYear: '2024-2025',
    };
    const years = assertStudyYearsMatchSnapshots(student, '2026-2027', ['2024-2025']);
    assert.equal(years[0].key, '1');
    assert.equal(getStudentAcademicSnapshot(student, '2023-2024', '2026-2027'), null);
  }
});
