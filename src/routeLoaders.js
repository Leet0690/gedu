const routeLoaders = {
  login: () => import('./pages/Login'),
  adminDashboard: () => import('./pages/AdminDashboard'),
  teacherPortal: () => import('./pages/TeacherPortal'),
  studentResults: () => import('./pages/StudentResults'),
  gradeManagement: () => import('./pages/GradeManagement'),
  studentAttendance: () => import('./pages/StudentAttendance'),
  teacherAttendance: () => import('./pages/TeacherAttendance'),
  reports: () => import('./pages/Reports'),
  scheduleManagement: () => import('./pages/ScheduleManagement'),
  studentScheduleView: () => import('./pages/StudentScheduleView'),
  financeDashboard: () => import('./pages/FinanceDashboard'),
  moduleManagement: () => import('./pages/ModuleManagement'),
  monthlyAttendance: () => import('./pages/MonthlyAttendance'),
  monthlyAttendanceTeachers: () => import('./pages/MonthlyAttendanceTeachers'),
  accessLogs: () => import('./pages/AccessLogs'),
  scheduleGeneration: () => import('./pages/ScheduleGeneration'),
  continuousTrainings: () => import('./pages/ContinuousTrainings'),
  userManagement: () => import('./pages/UserManagement'),
};

const routeKeysByPath = {
  '/': 'adminDashboard',
  '/login': 'login',
  '/admin/students': 'adminDashboard',
  '/admin/teachers': 'adminDashboard',
  '/admin/schedules': 'scheduleManagement',
  '/admin/grades': 'gradeManagement',
  '/admin/attendance-students': 'studentAttendance',
  '/admin/monthly-attendance': 'monthlyAttendance',
  '/admin/monthly-attendance-teachers': 'monthlyAttendanceTeachers',
  '/admin/modules': 'moduleManagement',
  '/admin/reports': 'reports',
  '/admin/attendance-teachers': 'teacherAttendance',
  '/admin/finance': 'financeDashboard',
  '/admin/continuous': 'continuousTrainings',
  '/admin/schedule-generation': 'scheduleGeneration',
  '/admin/users': 'userManagement',
};

const routePromises = new Map();

export const loadRoute = (key) => {
  if (!routePromises.has(key)) {
    const routePromise = routeLoaders[key]().catch(error => {
      routePromises.delete(key);
      throw error;
    });
    routePromises.set(key, routePromise);
  }
  return routePromises.get(key);
};
export const preloadRoute = (path) => {
  if (typeof navigator === 'undefined') return;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData || connection?.effectiveType === '2g') return;

  const key = routeKeysByPath[path];
  if (key) loadRoute(key);
};
