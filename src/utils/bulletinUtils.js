import {
  calcCcAverage,
  calcModuleAverage,
  parseScore,
} from './gradeCalculations.js';
import { getGradeByModuleName, getModuleOrder } from './gradeSync.js';

export const STAGE_RESERVATION_NOTE = 'Sous réserve de la note de stage en entreprise.';

const getModuleName = (module) => typeof module === 'string'
  ? module
  : (module?.name || module?.module || module?.label || '');

const normalizeModuleName = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const getStudyYearNumber = (year = '') => {
  const match = String(year || '').match(/\d+/);
  return match?.[0] || '1';
};

export const formatModuleUfNumber = (module, fallbackIndex = 0, fallbackYear = '') => {
  const moduleYear = typeof module === 'object' ? module?.year : '';
  const yearNumber = getStudyYearNumber(moduleYear || fallbackYear);
  const fallbackOrder = Number.isInteger(fallbackIndex) && fallbackIndex >= 0
    ? fallbackIndex + 1
    : 1;
  const order = getModuleOrder(module) ?? fallbackOrder;

  return `UF ${yearNumber}.${order}`;
};

export const isCompanyInternshipModule = (module) =>
  normalizeModuleName(getModuleName(module)).includes('stage en entreprise');

const isModuleGradeComplete = (grade) => {
  const ccAverage = calcCcAverage(grade);
  const theoretical = parseScore(grade?.efcft);
  const practical = parseScore(grade?.efcfp);

  return calcModuleAverage({ ccAverage, theoretical, practical }) !== null;
};

export const isCompanyInternshipGradeMissing = (modules = [], studentGrades = {}) => {
  const internshipModules = (modules || []).filter(isCompanyInternshipModule);
  if (internshipModules.length === 0) return false;

  return internshipModules.some(module => {
    const grade = getGradeByModuleName(studentGrades, getModuleName(module));
    return !isModuleGradeComplete(grade);
  });
};
