import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentClosure, buildStudentClosureUndo, buildStudentClosureCorrection, getClosureDecisionOptions, getRecordedClosureDecision } from '../src/utils/academicYearClosure.js';
import {
  FIRST_YEAR, SECOND_YEAR, getStudentAcademicSnapshot, getStudentAvailableStudyYears,
  getStudentStatusLabel, isActiveStudent, isStudentCurrentlyInAcademicYear,
} from '../src/utils/studentStatus.js';
import { getStudentResultsGrades, selectStudentStudyYear } from '../src/utils/studentResults.js';

const base = {
  id: 's1', firstName: 'Sara', diploma: 'Technicien', major: 'Gestion',
  year: FIRST_YEAR, academicYear: '2025-2026', status: 'active', token: 'personal-link',
  documents: ['dossier.pdf'], fee: 800,
};
const close = (student, decision, grades = {}) => buildStudentClosure({
  student, decision, grades, fromAcademicYear: '2025-2026', toAcademicYear: '2026-2027',
  operationId: 'closure-1', closedAt: '2026-08-31T10:00:00.000Z',
});
const apply = (student, result) => ({ ...student, ...result.data });

test('admission advances only non-final levels and graduates final levels', () => {
  const first = close(base, 'pass');
  assert.equal(first.type, 'promoted');
  assert.equal(first.data.year, SECOND_YEAR);
  assert.equal(first.data.academicYear, '2026-2027');
  for (const student of [
    { ...base, year: SECOND_YEAR },
    { ...base, diploma: 'Licence Professionnelle' },
  ]) {
    const result = close(student, 'graduate');
    assert.equal(result.type, 'graduated');
    assert.equal(result.data.status, 'laureat');
    assert.equal(result.data.graduationAcademicYear, '2025-2026');
  }
});

test('repeating either level keeps the level and isolates old grades from the new attempt', () => {
  for (const year of [FIRST_YEAR, SECOND_YEAR]) {
    const original = { ...base, year };
    const grades = { Gestion: { c1: 7, efcft: 6 } };
    const result = close(original, 'repeat', grades);
    const student = apply(original, result);
    assert.equal(result.type, 'repeated');
    assert.equal(student.year, year);
    assert.equal(student.status, 'active');
    assert.equal(student.academicYear, '2026-2027');
    assert.equal(student.graduationAcademicYear, undefined);
    const document = { ...grades, academicYears: result.gradeYears };
    const options = getStudentAvailableStudyYears(student, '2026-2027');
    const old = options.find(option => option.academicYear === '2025-2026');
    const current = options.find(option => option.isCurrent);
    assert.deepEqual(getStudentResultsGrades(document, old), grades);
    assert.deepEqual(getStudentResultsGrades(document, current), {});
    assert.equal(selectStudentStudyYear(options, old.key), old);
    assert.equal(selectStudentStudyYear(options), current);
    assert.equal(new Set(options.map(option => option.key)).size, options.length);
  }
});

test('departure retains dossier, token, old attempts and grades without future enrollment', () => {
  const original = {
    ...base, year: SECOND_YEAR, previousAcademicYear: '2024-2025', promotedFromYear: FIRST_YEAR,
    classHistory: [{ academicYear: '2024-2025', year: FIRST_YEAR, status: 'active' }],
  };
  const grades = { academicYears: {
    '2024-2025': { Gestion: { c1: 15 } }, '2025-2026': { Gestion: { c1: 8 } },
  } };
  const before = structuredClone({ original, grades });
  const result = close(original, 'withdraw', grades);
  const student = apply(original, result);
  assert.equal(student.status, 'withdrawn');
  assert.equal(getStudentStatusLabel(student), 'ABANDON');
  assert.equal(isActiveStudent(student), false);
  assert.equal(isStudentCurrentlyInAcademicYear(student, '2026-2027', '2026-2027'), false);
  assert.equal(getStudentAcademicSnapshot(student, '2026-2027', '2026-2027'), null);
  assert.equal(student.token, original.token);
  assert.deepEqual(student.documents, original.documents);
  assert.equal(student.fee, original.fee);
  assert.equal(student.academicYear, '2025-2026');
  assert.equal(student.classHistory.at(-1).decision, 'withdraw');
  const options = getStudentAvailableStudyYears(student, '2027-2028');
  assert.deepEqual(options.map(option => option.academicYear), ['2024-2025', '2025-2026']);
  const retainedGrades = { academicYears: { ...grades.academicYears, ...result.gradeYears } };
  for (const option of options) {
    assert.deepEqual(getStudentResultsGrades(retainedGrades, option), grades.academicYears[option.academicYear]);
  }
  assert.deepEqual({ original, grades }, before);
  assert.throws(() => buildStudentClosure({
    student, decision: 'pass', fromAcademicYear: '2026-2027', toAcademicYear: '2027-2028',
  }));
});

test('undo restores each decision and earlier transition metadata', () => {
  const original = {
    ...base, year: SECOND_YEAR, previousAcademicYear: '2024-2025',
    promotedFromYear: FIRST_YEAR, promotedAt: 'earlier-promotion',
    classHistory: [{ academicYear: '2024-2025', year: FIRST_YEAR }],
  };
  for (const decision of ['graduate', 'repeat', 'withdraw']) {
    const restored = { ...apply(original, close(original, decision)), ...buildStudentClosureUndo(apply(original, close(original, decision))) };
    for (const [field, value] of Object.entries(original)) assert.deepEqual(restored[field], value);
    assert.equal(restored.withdrawnAt, '');
    assert.equal(restored.withdrawalAcademicYear, '');
    assert.equal(restored.repeatedAt, '');
    assert.equal(restored.graduationAcademicYear, '');
  }
});

test('missing or invalid decisions cannot silently promote a trainee', () => {
  for (const decision of [undefined, '', 'admis', 'invalid']) assert.throws(() => close(base, decision));
  assert.throws(() => close({ ...base, status: 'withdrawn' }, 'pass'));
  assert.throws(() => close({ ...base, classHistory: [{ academicYear: '2025-2026' }] }, 'repeat'));
});

test('empty years are archived and existing next-year notes are preserved', () => {
  assert.deepEqual(close(base, 'withdraw').gradeYears, { '2025-2026': {} });
  const next = { Gestion: { c1: 12 } };
  assert.deepEqual(close(base, 'repeat', { academicYears: { '2026-2027': next } }).gradeYears, {
    '2025-2026': {}, '2026-2027': next,
  });
});

test('passage and laureate are distinct and restricted to the appropriate levels', () => {
  assert.deepEqual(getClosureDecisionOptions(base).filter(option => !option.disabled).map(option => option.value), ['pass', 'repeat', 'withdraw']);
  assert.deepEqual(getClosureDecisionOptions({ ...base, year: SECOND_YEAR }).filter(option => !option.disabled).map(option => option.value), ['graduate', 'repeat', 'withdraw']);
  assert.throws(() => close(base, 'graduate'));
  assert.throws(() => close({ ...base, year: SECOND_YEAR }, 'pass'));
});

test('all valid decision corrections recalculate enrollment without losing existing data', () => {
  for (const year of [FIRST_YEAR, SECOND_YEAR]) {
    const original = { ...base, year };
    const choices = getClosureDecisionOptions(original).filter(option => !option.disabled).map(option => option.value);
    for (const before of choices) {
      for (const after of choices.filter(choice => choice !== before)) {
        const closed = apply(original, close(original, before));
        const grades = { academicYears: {
          '2025-2026': { Gestion: { c1: 8 } },
          '2026-2027': { Gestion: { c1: 17 } },
        } };
        const beforeData = structuredClone({ closed, grades });
        const corrected = buildStudentClosureCorrection({
          student: closed, academicYear: '2025-2026', decision: after, grades,
          correctedAt: '2026-09-15T10:00:00.000Z', reason: 'Décision du jury', expectedRevision: 0,
        });
        const student = apply(closed, corrected);
        const expected = apply(original, close(original, after));
        assert.equal(student.status, expected.status);
        assert.equal(student.academicYear, expected.academicYear);
        assert.equal(student.year, expected.year);
        assert.equal(student.token, original.token);
        assert.deepEqual(student.documents, original.documents);
        assert.equal(student.fee, original.fee);
        assert.equal(student.classHistory.length, closed.classHistory.length);
        assert.equal(student.classHistory.at(-1).closedAt, closed.classHistory.at(-1).closedAt);
        assert.equal(student.classHistory.at(-1).revision, 1);
        assert.deepEqual(student.classHistory.at(-1).corrections[0], {
          from: before, to: after, correctedAt: '2026-09-15T10:00:00.000Z', reason: 'Décision du jury',
        });
        assert.deepEqual({ ...grades.academicYears, ...corrected.gradeYears }, grades.academicYears);
        assert.deepEqual({ closed, grades }, beforeData);
        if (after !== 'graduate') assert.equal(student.graduationAcademicYear, '');
        if (after !== 'withdraw') assert.equal(student.withdrawalAcademicYear, '');
      }
    }
  }
});

test('corrections preserve their full audit history and reject outdated edits', () => {
  const closed = apply(base, close(base, 'pass'));
  const args = { academicYear: '2025-2026', correctedAt: '2026-09-15T10:00:00.000Z' };
  const first = apply(closed, buildStudentClosureCorrection({ ...args, student: closed, decision: 'repeat', expectedRevision: 0 }));
  assert.throws(() => buildStudentClosureCorrection({ ...args, student: first, decision: 'withdraw', expectedRevision: 0 }), /entre-temps/);
  const second = apply(first, buildStudentClosureCorrection({ ...args, student: first, decision: 'withdraw', expectedRevision: 1 }));
  assert.equal(second.classHistory.at(-1).corrections.length, 2);
  assert.equal(second.classHistory.at(-1).revision, 2);
  assert.equal(buildStudentClosureUndo(second).year, FIRST_YEAR);
  assert.throws(() => buildStudentClosureCorrection({ ...args, student: second, decision: 'withdraw' }), /différente/);
  assert.throws(() => buildStudentClosureCorrection({ ...args, student: first, academicYear: '2024-2025', decision: 'pass' }), /dernière clôture/);
});

test('legacy graduation recorded as pass can be corrected to repeat', () => {
  const original = { ...base, year: SECOND_YEAR };
  const closed = apply(original, close(original, 'graduate'));
  closed.classHistory[0].decision = 'pass';
  assert.equal(getRecordedClosureDecision(closed, closed.classHistory[0]), 'graduate');
  delete closed.classHistory[0].decision;
  assert.equal(getRecordedClosureDecision(closed, closed.classHistory[0]), 'graduate');
  const correction = buildStudentClosureCorrection({
    student: closed, academicYear: '2025-2026', decision: 'repeat', correctedAt: '2026-09-15T10:00:00.000Z',
  });
  assert.equal(correction.beforeDecision, 'graduate');
  assert.equal(correction.data.status, 'active');
  assert.equal(correction.data.year, SECOND_YEAR);
});
