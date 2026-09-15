// Collections used by each page, including its dialogs and exports.
const requirements = {
  '/': ['students', 'teachers', 'grades', 'schedules', 'modules'],
  '/admin/students': ['students', 'grades', 'modules'],
  '/admin/teachers': ['teachers', 'modules'],
  '/admin/grades': ['students', 'teachers', 'grades', 'modules'],
  '/admin/reports': ['students', 'grades', 'modules'],
  '/admin/modules': ['modules'],
  '/admin/schedules': ['teachers', 'schedules', 'modules'],
  '/admin/schedule-generation': ['teachers', 'schedules', 'modules'],
  '/admin/attendance-students': ['students', 'teachers', 'schedules', 'modules'],
  '/admin/monthly-attendance': ['students'],
  '/admin/attendance-teachers': ['teachers', 'schedules', 'modules'],
  '/admin/monthly-attendance-teachers': ['teachers', 'schedules'],
  '/admin/finance': ['students', 'teachers'],
  '/admin/continuous': ['teachers', 'continuousTrainings', 'continuousTrainingTypes', 'ctStudents', 'ctSessions'],
};

export const getPageCollections = (pathname = '') => {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return requirements[path] || [];
};
