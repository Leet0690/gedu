import {
  GRADE_ACADEMIC_YEARS_FIELD,
  getGradeByModuleName,
  getGradesForAcademicYear,
  getLegacyGrades,
  getModuleName,
  getStudentGradeModules,
} from './gradeSync.js';
import { calcStudentSynthesisAverages, parseScore } from './gradeCalculations.js';
import {
  getStudentAcademicSnapshot,
  isLaureatStudent,
  validateAcademicYear,
} from './studentStatus.js';

const ASSESSMENT_FIELDS = ['c1', 'c2', 'c3', 'efcft', 'efcfp'];

/** Only documented study-year keys may override the student's current year. */
export const selectStudentStudyYear = (availableYears = [], yearParam = '') => {
  const years = availableYears || [];
  const requested = years.find(year => year.key === yearParam);
  return requested || years.find(year => year.isCurrent) || years[years.length - 1] || null;
};

/** A saved bucket, including an empty bucket, always overrides legacy notes. */
export const getStudentResultsGrades = (rawGrades = {}, studyYear) => {
  if (!validateAcademicYear(studyYear?.academicYear)) return {};

  const resolved = getGradesForAcademicYear(rawGrades, studyYear.academicYear);
  const academicYears = rawGrades?.[GRADE_ACADEMIC_YEARS_FIELD];
  const hasSavedYear = academicYears &&
    Object.prototype.hasOwnProperty.call(academicYears, studyYear.academicYear);

  if (studyYear.key === '1' && !hasSavedYear) {
    return getLegacyGrades(rawGrades);
  }
  return resolved;
};

/** Missing assessments are different from actual zero scores. */
export const hasStudentResultsGrades = (studentGrades = {}, modules = []) =>
  (modules || []).some(module => {
    const grade = getGradeByModuleName(studentGrades, getModuleName(module));
    return ASSESSMENT_FIELDS.some(field => Number.isFinite(parseScore(grade?.[field])));
  });

const isLaureatSnapshot = snapshot => isLaureatStudent({
  status: snapshot.academicStatus || snapshot.status,
});

/** Rank assessed classmates in the selected historical class and academic year. */
export const getStudentResultsRank = ({
  students = [],
  grades = {},
  allModules = [],
  studentSnapshot,
  operationalAcademicYear,
} = {}) => {
  if (!studentSnapshot || !validateAcademicYear(studentSnapshot.academicYear)) {
    return { rank: null, total: 0 };
  }

  const studyYear = {
    key: String(studentSnapshot.year || '').includes('1') ? '1' : '2',
    academicYear: studentSnapshot.academicYear,
    yearLevel: studentSnapshot.year,
  };
  const peerAverages = (students || [])
    .map(student => getStudentAcademicSnapshot(
      student,
      studentSnapshot.academicYear,
      operationalAcademicYear
    ))
    .filter(snapshot => snapshot &&
      snapshot.diploma === studentSnapshot.diploma &&
      snapshot.major === studentSnapshot.major &&
      snapshot.year === studentSnapshot.year &&
      snapshot.academicYear === studentSnapshot.academicYear &&
      isLaureatSnapshot(snapshot) === isLaureatSnapshot(studentSnapshot))
    .flatMap(snapshot => {
      const studentGrades = getStudentResultsGrades(grades?.[snapshot.id], studyYear);
      const modules = getStudentGradeModules(allModules, snapshot);
      if (!hasStudentResultsGrades(studentGrades, modules)) return [];
      const { generalAverage } = calcStudentSynthesisAverages(studentGrades, modules);
      return Number.isFinite(generalAverage)
        ? [{ id: snapshot.id, average: generalAverage }]
        : [];
    });

  const current = peerAverages.find(peer => peer.id === studentSnapshot.id);
  return {
    rank: current
      ? peerAverages.filter(peer => peer.average > current.average + 0.0001).length + 1
      : null,
    total: peerAverages.length,
  };
};
