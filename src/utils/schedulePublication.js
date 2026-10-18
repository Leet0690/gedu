import { getDiplomaForMajor } from '../data/modules.js';
import { getScheduleModuleForSemester } from './scheduleSemester.js';

export const isScheduleShareToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
export const normalizeScheduleScope = (scope = {}) => {
  const { diploma, filiere, annee, academicYear, semester } = scope;
  if (typeof diploma !== 'string' || !diploma.trim() || diploma.length > 240 ||
    typeof filiere !== 'string' || !filiere.trim() || filiere.length > 240 ||
    typeof annee !== 'string' || !annee.trim() || annee.length > 120 ||
    !/^\d{4}-\d{4}$/.test(academicYear || '') || Number(academicYear.slice(5)) !== Number(academicYear.slice(0, 4)) + 1 || !['S1', 'S2'].includes(semester)) {
    throw new Error('Le groupe, l’année ou le semestre est invalide.');
  }
  return { diploma, filiere, annee, academicYear, semester };
};
export const buildSchedulePublication = (input, { schedules = [], teachers = [], getModule } = {}) => {
  const scope = normalizeScheduleScope(input);
  const resolveModule = getModule || (session => getScheduleModuleForSemester(session, scope.semester));
  const text = value => typeof value === 'string' ? value : '';
  const rows = schedules.filter(session =>
    (session.diploma || getDiplomaForMajor(session.filiere)) === scope.diploma &&
    session.filiere === scope.filiere && session.annee === scope.annee &&
    (session.academicYear || '2025-2026') === scope.academicYear
  ).map(session => ({
    day: text(session.day), time: text(session.time), type: text(session.type), room: text(session.room),
    module: text(resolveModule(session)), teacherName: text(teachers.find(teacher => teacher.id === session.teacherId)?.name),
  })).filter(session => session.module);
  if (rows.length > 200) throw new Error('Le planning dépasse la limite de 200 séances par publication.');
  return { scope, rows };
};
