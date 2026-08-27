const ACADEMIC_YEAR_SCOPED_PATHS = new Set([
  '/',
  '/admin/students',
  '/admin/grades',
  '/admin/attendance-students',
  '/admin/monthly-attendance',
  '/admin/reports',
  '/admin/finance',
]);

export const isAcademicYearScopedPath = (pathname = '') => {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return ACADEMIC_YEAR_SCOPED_PATHS.has(normalizedPath);
};
