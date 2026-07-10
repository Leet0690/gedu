export const sanitizeGradeKey = (subject = '') => String(subject || '').replace(/\./g, '_');

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
];

const normalizeGradeName = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('fr');

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

export const getGradeByModuleName = (studentGrades = {}, moduleName = '') => {
  if (!studentGrades || !moduleName) return null;

  const gradeRecords = getGradeKeyCandidates(moduleName)
    .filter(key => Object.prototype.hasOwnProperty.call(studentGrades, key))
    .map(key => studentGrades[key]);

  return mergeGradeRecords(...gradeRecords);
};

export const getModuleOrder = (module) => {
  const order = Number(module?.order);
  return Number.isFinite(order) && order > 0 ? order : null;
};

export const sortModulesByOrder = (modules = []) => {
  return [...modules].sort((a, b) =>
    (getModuleOrder(a) ?? Number.MAX_SAFE_INTEGER) - (getModuleOrder(b) ?? Number.MAX_SAFE_INTEGER) ||
    String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', {
      numeric: true,
      sensitivity: 'base',
    })
  );
};

export const sortModulesByName = sortModulesByOrder;

export const getStudentGradeModules = (allModules = [], student) => {
  if (!student) return [];

  return sortModulesByOrder(
    (allModules || []).filter(module =>
      module?.diploma === student.diploma &&
      module?.major === student.major &&
      module?.year === student.year
    )
  );
};
