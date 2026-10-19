import { getGradeByModuleName, getGradesForAcademicYear, getStudentGradeModules } from './gradeSync.js';
import { getModuleCoefficient, isEmptyScore, parseScore } from './gradeCalculations.js';

export const SCHOOL_ASSESSMENTS = ['c1', 'c2', 'c3', 'c4'];
export const getSchoolTermGrade = (subjectGrade = {}, semester = 'S1') => subjectGrade.school?.[semester] || {};
export const calcSchoolSubjectAverage = (grade = {}, defaultScale = 20) => {
  const scale = grade.scale || defaultScale;
  const scores = SCHOOL_ASSESSMENTS.map(key => grade[key]).filter(value => !isEmptyScore(value));
  if (scores.length === 0 || scores.some(value => parseScore(value) === null || parseScore(value) > scale)) return null;
  return scores.reduce((sum, value) => sum + parseScore(value), 0) / scores.length;
};
export const getSchoolSubjects = (modules, student, academicYear) => getStudentGradeModules(modules, student, academicYear, { allowFallback: false });

export const calcSchoolReport = (gradeDocument = {}, modules = [], academicYear = '', scale = 20) => {
  const bucket = getGradesForAcademicYear(gradeDocument, academicYear);
  const rows = modules.map(module => {
    const grade = getGradeByModuleName(bucket, module) || {};
    const termAverage = semester => {
      const term = getSchoolTermGrade(grade, semester);
      const value = calcSchoolSubjectAverage(term, scale);
      return value === null ? null : value * scale / (term.scale || scale);
    };
    const s1 = termAverage('S1');
    const s2 = termAverage('S2');
    const semester = String(module.semester || 'Annuel').toUpperCase();
    const expected = semester === 'S1' ? [s1] : semester === 'S2' ? [s2] : [s1, s2];
    const annual = expected.every(value => value !== null) ? expected.reduce((sum, value) => sum + value, 0) / expected.length : null;
    return { module, grade, s1, s2, annual, coefficient: getModuleCoefficient(module) };
  });
  const average = field => {
    const available = rows.filter(row => row[field] !== null && (field === 'annual' || !['S1', 'S2'].includes(String(row.module.semester).toUpperCase()) || String(row.module.semester).toLowerCase() === field));
    const weight = available.reduce((sum, row) => sum + row.coefficient, 0);
    return weight > 0 ? available.reduce((sum, row) => sum + row[field] * row.coefficient, 0) / weight : null;
  };
  const annualComplete = rows.length > 0 && rows.every(row => row.annual !== null);
  return { rows, scale, s1: average('s1'), s2: average('s2'), annual: annualComplete ? average('annual') : null, annualComplete };
};
