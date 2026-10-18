export const MODULE_KEYS = ['dashboard', 'students', 'teachers', 'continuous', 'finance', 'modules', 'grades', 'reports', 'schedules', 'schedule_generation', 'attendance_students', 'attendance_teachers', 'logs', 'users', 'catalog'];
export const isAdministrator = user => user?.isActive === true && ['admin', 'super_admin'].includes(user.role);

export function hasModulePermission(user, module, level = 'view') {
  if (user?.isActive !== true || !MODULE_KEYS.includes(module) || !['view', 'edit'].includes(level)) return false;
  if (isAdministrator(user)) return true;
  if (module === 'users' && (user.permissions?.finance ?? 'none') !== 'none') return false;
  const permission = user.permissions?.[module];
  return permission === 'edit' || (level === 'view' && permission === 'view');
}

export const canManageUsers = user => hasModulePermission(user, 'users', 'edit');

export function canManageUserTarget(actor, target) {
  if (!canManageUsers(actor) || !target) return false;
  if (isAdministrator(actor)) return true;
  return ['director', 'secretary', 'instructor', 'custom'].includes(target.role)
    && (target.permissions?.finance ?? 'none') === 'none';
}

export function assertCanManageUserTarget(actor, target) {
  if (canManageUserTarget(actor, target)) return;
  const error = new Error('Les comptes administrateurs et les comptes ayant accès à Finance restent réservés à l’administrateur.');
  error.code = 'permission-denied';
  throw error;
}

export function assertModuleEdit(user, module) {
  if (module === 'administration' ? isAdministrator(user) : hasModulePermission(user, module, 'edit')) return;
  const error = new Error('Lecture seule : vous ne pouvez pas effectuer cette modification.');
  error.code = 'permission-denied';
  throw error;
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
  if (!['admin', 'super_admin'].includes(role) && (permissions.users ?? 'none') !== 'none' && (permissions.finance ?? 'none') !== 'none') {
    throw new Error('La gestion déléguée des utilisateurs ne peut pas être associée à un accès Finance.');
  }
  return Object.fromEntries(MODULE_KEYS.map(key => {
    const value = permissions[key] ?? 'none';
    if (!['none', 'view', 'edit'].includes(value)) throw new Error('Niveau de permission invalide.');
    return [key, ['admin', 'super_admin'].includes(role) ? 'edit' : value];
  }));
}
