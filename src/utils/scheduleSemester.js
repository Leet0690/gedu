export const normalizeSemester = semester => semester === 'S2' ? 'S2' : 'S1';

const normalizeLookupValue = value => String(value || '').trim().toLocaleLowerCase('fr');

// A spaced slash is the historical separator; slashes within a name (TCP/IP)
// are kept. Arrays from imports are also accepted without string coercion.
export const normalizeScheduleModules = value => {
  const names = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\s+\/\s+/) : [];
  return [...new Set(names.filter(name => typeof name === 'string').map(name => name.trim()).filter(Boolean))];
};

export const formatScheduleModules = value => normalizeScheduleModules(value).join(' / ');

export const serializeScheduleModules = ({ moduleS1, moduleS2 } = {}) => {
  const firstSemester = formatScheduleModules(moduleS1);
  const secondSemester = formatScheduleModules(moduleS2);
  return {
    moduleS1: firstSemester,
    moduleS2: secondSemester,
    module: firstSemester || secondSemester,
  };
};

const getUniqueCatalogSemester = modules => {
  const semesters = new Set((modules || []).map(module => module?.semester || 'S1'));
  return semesters.size === 1 ? [...semesters][0] : '';
};

export const getScheduleModulesForSemester = (session = {}, semester = 'S1', moduleCatalog = []) => {
  const activeSemester = normalizeSemester(semester);
  const firstSemester = normalizeScheduleModules(session.moduleS1);
  const secondSemester = normalizeScheduleModules(session.moduleS2);

  // Explicit semester assignments win over the compatibility module field.
  if (firstSemester.length || secondSemester.length) {
    return activeSemester === 'S2' ? secondSemester : firstSemester;
  }

  const legacyModules = normalizeScheduleModules(session.module);
  if (!legacyModules.length) return [];

  const sessionAcademicYear = session.academicYear || '';
  const catalogForYear = sessionAcademicYear
    ? (moduleCatalog || []).filter(module => !module?.academicYear || module.academicYear === sessionAcademicYear)
    : (moduleCatalog || []);
  const scopedCatalog = catalogForYear.length > 0 ? catalogForYear : (moduleCatalog || []);

  return legacyModules.filter(legacyModule => {
    const normalizedLegacyModule = normalizeLookupValue(legacyModule);
    const configuredModules = scopedCatalog.filter(module =>
      normalizeLookupValue(module?.name) === normalizedLegacyModule &&
      (!session.filiere || normalizeLookupValue(module?.major) === normalizeLookupValue(session.filiere)) &&
      (!session.annee || normalizeLookupValue(module?.year) === normalizeLookupValue(session.annee)) &&
      (!session.diploma || !module?.diploma || module.diploma === session.diploma)
    );

    let moduleSemester = getUniqueCatalogSemester(configuredModules);
    if (!moduleSemester) {
      moduleSemester = getUniqueCatalogSemester(scopedCatalog.filter(module =>
        normalizeLookupValue(module?.name) === normalizedLegacyModule
      ));
    }

    // Never guess a semester when legacy metadata is absent or contradictory.
    return moduleSemester === 'Annuel' || moduleSemester === activeSemester;
  });
};

export const getScheduleModuleForSemester = (session = {}, semester = 'S1', moduleCatalog = []) =>
  getScheduleModulesForSemester(session, semester, moduleCatalog).join(' / ');
