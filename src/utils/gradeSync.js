export const sanitizeGradeKey = (subject = '') => String(subject || '').replace(/\./g, '_');

export const sortModulesByName = (modules = []) => {
  return [...modules].sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', {
      numeric: true,
      sensitivity: 'base',
    })
  );
};

export const getStudentGradeModules = (allModules = [], student) => {
  if (!student) return [];

  return sortModulesByName(
    (allModules || []).filter(module =>
      module?.diploma === student.diploma &&
      module?.major === student.major &&
      module?.year === student.year
    )
  );
};
