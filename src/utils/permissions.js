export const MODULE_KEYS = ['dashboard', 'students', 'teachers', 'continuous', 'finance', 'modules', 'grades', 'reports', 'schedules', 'schedule_generation', 'attendance_students', 'attendance_teachers', 'logs', 'users'];
export const isAdministrator = user => user?.isActive === true && ['admin', 'super_admin'].includes(user.role);

export function hasModulePermission(user, module, level = 'view') {
  if (user?.isActive !== true || !MODULE_KEYS.includes(module) || !['view', 'edit'].includes(level)) return false;
  if (isAdministrator(user)) return true;
  if (module === 'users') return false;
  const permission = user.permissions?.[module];
  return permission === 'edit' || (level === 'view' && permission === 'view');
}

export const COLLECTION_MODULES = {
  students: 'students', teachers: 'teachers', grades: 'grades', schedules: 'schedules',
  modules: 'modules', attendance_stagiaires: 'attendance_students',
  attendance_formateurs: 'attendance_teachers', payments: 'finance', salaries: 'finance',
  expenses: 'finance', receipt_counters: 'finance', continuousTrainings: 'continuous',
  continuousTrainingTypes: 'continuous', ctStudents: 'continuous', ctSessions: 'continuous',
  activity_logs: 'logs', access_logs: 'logs', users: 'users',
};

export function normalizePermissions(role, permissions = {}) {
  if (!['admin', 'super_admin', 'director', 'secretary', 'instructor', 'custom'].includes(role)) throw new Error('Rôle invalide.');
  return Object.fromEntries(MODULE_KEYS.map(key => {
    const value = permissions[key] ?? 'none';
    if (!['none', 'view', 'edit'].includes(value)) throw new Error('Niveau de permission invalide.');
    return [key, ['admin', 'super_admin'].includes(role) ? 'edit' : key === 'users' ? 'none' : value];
  }));
}
