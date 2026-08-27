import { getModulesForFiliere } from '../data/modules.js';

export const sanitizeGradeKey = (subject = '') => String(subject || '').replace(/\./g, '_');

export const GRADE_ACADEMIC_YEARS_FIELD = 'academicYears';

const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value);

export const getLegacyGrades = (studentGrades = {}) => {
  if (!isPlainObject(studentGrades)) return {};
  return Object.fromEntries(
    Object.entries(studentGrades).filter(([key]) => key !== GRADE_ACADEMIC_YEARS_FIELD)
  );
};

/**
 * Resolve one academic-year grade map while keeping old flat documents
 * readable until their first versioned snapshot is created. Once versioning
 * exists, an absent year stays empty instead of leaking notes from another year.
 */
export const getGradesForAcademicYear = (studentGrades = {}, academicYear = '') => {
  if (!isPlainObject(studentGrades)) return {};

  const legacyGrades = getLegacyGrades(studentGrades);
  if (!academicYear) return legacyGrades;

  const academicYears = studentGrades[GRADE_ACADEMIC_YEARS_FIELD];
  if (!isPlainObject(academicYears) || Object.keys(academicYears).length === 0) {
    return legacyGrades;
  }

  const versionedGrades = academicYears[academicYear];
  return isPlainObject(versionedGrades) ? versionedGrades : {};
};

export const getGradeAcademicYears = (studentGrades = {}) =>
  Object.keys(studentGrades?.[GRADE_ACADEMIC_YEARS_FIELD] || {}).sort((a, b) => b.localeCompare(a));

/** Seed the first versioned year with legacy notes; later years start isolated. */
export const getGradeBucketForWrite = (studentGrades = {}, academicYear = '') => {
  if (!isPlainObject(studentGrades) || !academicYear) return {};
  const academicYears = isPlainObject(studentGrades[GRADE_ACADEMIC_YEARS_FIELD])
    ? studentGrades[GRADE_ACADEMIC_YEARS_FIELD]
    : {};
  const existingBucket = isPlainObject(academicYears[academicYear])
    ? academicYears[academicYear]
    : {};
  const legacySeed = Object.keys(academicYears).length === 0
    ? getLegacyGrades(studentGrades)
    : {};
  return { ...legacySeed, ...existingBucket };
};

export const getModuleName = (module) => typeof module === 'string'
  ? module
  : (module?.name || module?.module || module?.label || '');

const gradeAliasGroups = [
  {
    target: 'Soft skills',
    aliases: ['SOFTSKILS', 'Soft skills et Techniques de communication'],
  },
  {
    target: 'ERP avec ODOO',
    aliases: ['ERP'],
  },
  {
    target: 'Développement web (HTML / PHP / CSS / JavaScript)',
    aliases: ['Développement web (HTML/PHP/CSS/JavaScript)'],
  },
  {
    target: 'Management et organisation des entreprises',
    aliases: ['Management et Organisation des E/ses'],
  },
  {
    target: 'Frameworks web : Laravel (back end)',
    aliases: ['Framework web : Laravel (back end)'],
  },
];

const normalizeGradeName = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('fr');

const normalizeModuleOrderName = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const addGradeKeyVariant = (keys, value) => {
  const raw = String(value || '').trim();
  if (!raw) return;
  keys.add(raw);
  keys.add(sanitizeGradeKey(raw));
};

export const getGradeKeyCandidates = (moduleName = '') => {
  const keys = new Set();
  addGradeKeyVariant(keys, moduleName);

  const normalizedModuleName = normalizeGradeName(moduleName);
  const aliasGroup = gradeAliasGroups.find(group =>
    normalizeGradeName(group.target) === normalizedModuleName ||
    group.aliases.some(alias => normalizeGradeName(alias) === normalizedModuleName)
  );

  if (aliasGroup) {
    addGradeKeyVariant(keys, aliasGroup.target);
    aliasGroup.aliases.forEach(alias => addGradeKeyVariant(keys, alias));
  }

  return Array.from(keys);
};

const isFilledGradeValue = (value) =>
  value !== undefined && value !== null && value !== '';

export const mergeGradeRecords = (...records) => {
  const filledRecords = records.filter(record => record && typeof record === 'object');
  if (filledRecords.length === 0) return null;

  const merged = {};
  filledRecords.forEach(record => {
    Object.entries(record).forEach(([field, value]) => {
      if (!isFilledGradeValue(merged[field]) && isFilledGradeValue(value)) {
        merged[field] = value;
      } else if (merged[field] === undefined && value !== undefined) {
        merged[field] = value;
      }
    });
  });

  return Object.keys(merged).length > 0 ? merged : null;
};

export const getGradeByModuleName = (studentGrades = {}, moduleName = '', academicYear = '') => {
  if (!studentGrades || !moduleName) return null;

  const resolvedGrades = academicYear
    ? getGradesForAcademicYear(studentGrades, academicYear)
    : studentGrades;

  const gradeRecords = getGradeKeyCandidates(moduleName)
    .filter(key => Object.prototype.hasOwnProperty.call(resolvedGrades, key))
    .map(key => resolvedGrades[key]);

  return mergeGradeRecords(...gradeRecords);
};

export const getModuleOrder = (module) => {
  const order = Number(module?.order);
  if (Number.isFinite(order) && order > 0) return order;

  const defaultModules = getModulesForFiliere(module?.diploma, module?.major, module?.year);
  const moduleNameVariants = new Set(
    getGradeKeyCandidates(getModuleName(module)).map(normalizeModuleOrderName)
  );
  const defaultIndex = defaultModules.findIndex(name =>
    getGradeKeyCandidates(name).some(candidate =>
      moduleNameVariants.has(normalizeModuleOrderName(candidate))
    )
  );

  return defaultIndex >= 0 ? defaultIndex + 1 : null;
};

const getModuleCreatedAtMillis = (module) => {
  const createdAt = module?.createdAt;
  if (!createdAt) return null;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt.seconds === 'number') {
    return createdAt.seconds * 1000 + Math.floor((createdAt.nanoseconds || 0) / 1000000);
  }
  const parsed = Date.parse(createdAt);
  return Number.isNaN(parsed) ? null : parsed;
};

export const sortModulesByOrder = (modules = []) => {
  return [...modules].sort((a, b) => {
    const orderA = getModuleOrder(a);
    const orderB = getModuleOrder(b);
    const explicitOrderCompare =
      (orderA ?? Number.MAX_SAFE_INTEGER) - (orderB ?? Number.MAX_SAFE_INTEGER);
    if (explicitOrderCompare !== 0) return explicitOrderCompare;

    if (orderA === null && orderB === null) {
      const createdAtCompare =
        (getModuleCreatedAtMillis(a) ?? Number.MAX_SAFE_INTEGER) -
        (getModuleCreatedAtMillis(b) ?? Number.MAX_SAFE_INTEGER);
      if (createdAtCompare !== 0) return createdAtCompare;
    }

    return String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', {
      numeric: true,
      sensitivity: 'base',
    });
  });
};

export const sortModulesByName = sortModulesByOrder;

export const dedupeModulesByName = (modules = []) => {
  const seenNames = new Set();

  return (modules || []).filter(module => {
    const name = getModuleName(module);
    const normalizedName = normalizeGradeName(name);
    if (!normalizedName || seenNames.has(normalizedName)) return false;
    seenNames.add(normalizedName);
    return true;
  });
};

export const getStudentGradeModules = (allModules = [], student) => {
  if (!student) return [];

  return dedupeModulesByName(
    sortModulesByOrder((allModules || []).filter(module =>
      module?.diploma === student.diploma &&
      module?.major === student.major &&
      module?.year === student.year
    ))
  );
};
