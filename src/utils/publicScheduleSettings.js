import { normalizeSemester } from './scheduleSemester.js';
import { INITIAL_OPERATIONAL_ACADEMIC_YEAR, validateAcademicYear } from './studentStatus.js';

export const getPublicScheduleSettings = (settings = {}) => ({
  activeSemester: normalizeSemester(settings.activeSemester),
  operationalAcademicYear: validateAcademicYear(settings.operationalAcademicYear)
    ? settings.operationalAcademicYear
    : INITIAL_OPERATIONAL_ACADEMIC_YEAR,
});

export const readPublicScheduleSettings = snapshot => {
  if (!snapshot.exists()) throw new Error("Les paramètres de l'emploi du temps ne sont pas encore publiés.");
  const data = snapshot.data();
  if (!['S1', 'S2'].includes(data?.activeSemester) || !validateAcademicYear(data?.operationalAcademicYear)) {
    throw new Error("Les paramètres de l'emploi du temps sont invalides.");
  }
  return getPublicScheduleSettings(data);
};
