import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getStudentResultsGrades,
  getStudentResultsRank,
  hasStudentResultsGrades,
  selectStudentStudyYear,
} from '../src/utils/studentResults.js';
import { FIRST_YEAR, SECOND_YEAR, getStudentAcademicSnapshot } from '../src/utils/studentStatus.js';

const firstYear = { key: '1', yearLevel: FIRST_YEAR, academicYear: '2024-2025' };
const secondYear = { key: '2', yearLevel: SECOND_YEAR, academicYear: '2025-2026', isCurrent: true };
const completeGrade = score => ({ c1: score, c2: score, efcft: score, efcfp: score });
const moduleFor = (year, extra = {}) => ({
  name: 'Gestion', diploma: 'Technicien', major: 'Gestion', year, ...extra,
});
const studentFor = (id, extra = {}) => ({
  id, diploma: 'Technicien', major: 'Gestion', year: SECOND_YEAR,
  academicYear: '2025-2026', status: 'active', ...extra,
});

test('study-year selection accepts exact URL keys and otherwise selects the current year', () => {
  const years = [firstYear, secondYear];
  assert.equal(selectStudentStudyYear(years, '1'), firstYear);
  assert.equal(selectStudentStudyYear(years, '2'), secondYear);
  for (const invalid of ['', null, '2024-2025', '21', 'year1', '01', '1 ', '3']) {
    assert.equal(selectStudentStudyYear(years, invalid), secondYear);
  }
  assert.equal(selectStudentStudyYear([firstYear], '2'), firstYear);
  assert.equal(selectStudentStudyYear([], '1'), null);
});

test('wholly unversioned documents retain existing grade resolution for both study years', () => {
  const legacy = { Gestion: completeGrade(12) };
  for (const year of [firstYear, secondYear]) {
    assert.deepEqual(getStudentResultsGrades(legacy, year), legacy);
    assert.deepEqual(getStudentResultsGrades({ ...legacy, academicYears: {} }, year), legacy);
  }
});

test('missing first-year partition can use legacy notes, but missing second-year partition cannot', () => {
  const legacy = { Gestion: completeGrade(12) };
  assert.deepEqual(getStudentResultsGrades({
    ...legacy, academicYears: { '2025-2026': { Gestion: completeGrade(18) } },
  }, firstYear), legacy);
  assert.deepEqual(getStudentResultsGrades({
    ...legacy, academicYears: { '2024-2025': legacy },
  }, secondYear), {});
});

test('an explicitly empty first-year partition suppresses stale legacy grades', () => {
  const grades = {
    Gestion: completeGrade(19),
    academicYears: { '2024-2025': {}, '2025-2026': { Gestion: completeGrade(15) } },
  };
  assert.deepEqual(getStudentResultsGrades(grades, firstYear), {});
  assert.deepEqual(getStudentResultsGrades(grades, secondYear), { Gestion: completeGrade(15) });
});

test('present partitions never merge legacy records and malformed saved buckets remain empty', () => {
  const grades = {
    Gestion: completeGrade(19), LegacyOnly: completeGrade(20),
    academicYears: { '2024-2025': { Gestion: { c1: 11 } } },
  };
  assert.deepEqual(getStudentResultsGrades(grades, firstYear), { Gestion: { c1: 11 } });
  for (const bucket of [null, [], '']) {
    assert.deepEqual(getStudentResultsGrades({
      ...grades, academicYears: { '2024-2025': bucket },
    }, firstYear), {});
  }
  assert.deepEqual(getStudentResultsGrades(null, firstYear), {});
  assert.deepEqual(getStudentResultsGrades(grades, null), {});
});

test('assessment detection ignores empty, invalid, unrelated and metadata-only records', () => {
  const modules = [moduleFor(FIRST_YEAR)];
  for (const grades of [
    {}, null, { Gestion: {} }, { Other: completeGrade(20) },
    { Gestion: { updatedAt: '2025', comment: '12' } },
    { Gestion: { c1: '', c2: null, c3: 'absent', efcft: undefined, efcfp: 'Infinity' } },
  ]) {
    assert.equal(hasStudentResultsGrades(grades, modules), false);
  }
  assert.equal(hasStudentResultsGrades({ Gestion: completeGrade(12) }, []), false);
});

test('assessment detection counts zero, partial assessments and known module aliases', () => {
  for (const field of ['c1', 'c2', 'c3', 'efcft', 'efcfp']) {
    assert.equal(hasStudentResultsGrades({ Gestion: { [field]: 0 } }, ['Gestion']), true);
  }
  assert.equal(hasStudentResultsGrades({ ERP: { c1: '12.5' } }, ['ERP avec ODOO']), true);
});

test('ranking excludes unassessed classmates but includes actual zero grades and ties', () => {
  const students = ['target', 'tie', 'zero', 'empty', 'unrelated'].map(id => studentFor(id));
  const grades = {
    target: { Gestion: completeGrade(12) },
    tie: { Gestion: completeGrade(12) },
    zero: { Gestion: completeGrade(0) },
    empty: { Gestion: { c1: '', updatedAt: '2025' } },
    unrelated: { Other: completeGrade(20) },
  };
  const options = {
    students, grades, allModules: [moduleFor(SECOND_YEAR)], operationalAcademicYear: '2025-2026',
  };
  assert.deepEqual(getStudentResultsRank({ ...options, studentSnapshot: students[0] }), { rank: 1, total: 3 });
  assert.deepEqual(getStudentResultsRank({ ...options, studentSnapshot: students[2] }), { rank: 3, total: 3 });
  assert.deepEqual(getStudentResultsRank({ ...options, studentSnapshot: students[3] }), { rank: null, total: 3 });
});

test('historical ranking restores alumni membership and excludes other classes and cohorts', () => {
  const history = { academicYear: '2024-2025', diploma: 'Technicien', major: 'Gestion', year: FIRST_YEAR, status: 'active' };
  const students = [
    studentFor('target', { classHistory: [history] }),
    studentFor('alumni', { status: 'laureat', classHistory: [history] }),
    studentFor('other-major', { classHistory: [{ ...history, major: 'Informatique' }] }),
    studentFor('other-diploma', { classHistory: [{ ...history, diploma: 'Qualification' }] }),
    studentFor('other-year', { classHistory: [{ ...history, year: SECOND_YEAR }] }),
    studentFor('other-cohort', { academicYear: '2026-2027' }),
    studentFor('already-alumni', { status: 'laureat', classHistory: [{ ...history, status: 'laureat' }] }),
  ];
  const grades = Object.fromEntries(students.map((student, index) => [student.id, {
    academicYears: { '2024-2025': { Gestion: completeGrade(index === 0 ? 12 : 18) } },
  }]));
  const studentSnapshot = getStudentAcademicSnapshot(students[0], '2024-2025', '2026-2027');
  assert.deepEqual(getStudentResultsRank({
    students, grades, studentSnapshot, allModules: [moduleFor(FIRST_YEAR), moduleFor(SECOND_YEAR)],
    operationalAcademicYear: '2026-2027',
  }), { rank: 2, total: 2 });
});

test('historical ranking uses the same first-year fallback and authoritative empty buckets as the page', () => {
  const students = ['target', 'legacy', 'empty'].map(id => studentFor(id));
  const grades = {
    target: { academicYears: { '2024-2025': { Gestion: completeGrade(12) } } },
    legacy: { Gestion: completeGrade(18), academicYears: { '2025-2026': {} } },
    empty: { Gestion: completeGrade(20), academicYears: { '2024-2025': {} } },
  };
  const studentSnapshot = getStudentAcademicSnapshot(students[0], '2024-2025', '2025-2026');
  assert.deepEqual(getStudentResultsRank({
    students, grades, studentSnapshot, allModules: [moduleFor(FIRST_YEAR)], operationalAcademicYear: '2025-2026',
  }), { rank: 2, total: 2 });
});

test('ranking is unavailable without a snapshot, modules, or a valid academic year', () => {
  assert.deepEqual(getStudentResultsRank(), { rank: null, total: 0 });
  const student = studentFor('target');
  assert.deepEqual(getStudentResultsRank({
    students: [student], studentSnapshot: student, grades: { target: { Gestion: completeGrade(20) } },
  }), { rank: null, total: 0 });
  assert.deepEqual(getStudentResultsRank({ studentSnapshot: { ...student, academicYear: '' } }), { rank: null, total: 0 });
});
