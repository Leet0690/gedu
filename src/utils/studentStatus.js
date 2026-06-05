export const STUDENT_STATUS = {
  ACTIVE: 'active',
  LAUREAT: 'laureat',
};

export const FIRST_YEAR = '1\u00e8re ann\u00e9e';
export const SECOND_YEAR = '2\u00e8me ann\u00e9e';

export const normalizeStudentStatus = (student = {}) =>
  String(student.status || STUDENT_STATUS.ACTIVE).toLowerCase();

export const isLaureatStudent = (student = {}) =>
  normalizeStudentStatus(student) === STUDENT_STATUS.LAUREAT;

export const isActiveStudent = (student = {}) => !isLaureatStudent(student);

export const getStudentStatusLabel = (student = {}) =>
  isLaureatStudent(student) ? 'LAUR\u00c9AT' : 'ACTIF';

export const getDefaultAcademicYearTransition = (date = new Date()) => {
  const year = date.getFullYear();
  const closingYear = date.getMonth() >= 7 ? year + 1 : year;
  return {
    fromAcademicYear: `${closingYear - 1}-${closingYear}`,
    toAcademicYear: `${closingYear}-${closingYear + 1}`,
  };
};

/** Validate academic year format: must be "YYYY-YYYY" with consecutive years */
export const validateAcademicYear = (yearStr) => {
  if (!yearStr || typeof yearStr !== 'string') return false;
  const match = yearStr.match(/^(\d{4})-(\d{4})$/);
  if (!match) return false;
  const [, startYear, endYear] = match;
  return parseInt(endYear) === parseInt(startYear) + 1;
};

/** Validate that toAcademicYear follows fromAcademicYear */
export const validateAcademicYearTransition = (from, to) => {
  if (!validateAcademicYear(from) || !validateAcademicYear(to)) return false;
  const fromEnd = parseInt(from.split('-')[1]);
  const toStart = parseInt(to.split('-')[0]);
  return toStart === fromEnd;
};

/** Check if a closure already exists for a given academic year in students' classHistory */
export const hasExistingClosure = (students, fromAcademicYear) => {
  return (students || []).some(s =>
    Array.isArray(s.classHistory) &&
    s.classHistory.some(h => h.academicYear === fromAcademicYear)
  );
};
