export const normalizeSemester = semester => semester === 'S2' ? 'S2' : 'S1';

const normalizeLookupValue = value => String(value || '').trim().toLocaleLowerCase('fr');

const getUniqueCatalogSemester = modules => {
  const semesters = new Set((modules || []).map(module => module?.semester || 'S1'));
  return semesters.size === 1 ? [...semesters][0] : '';
};

export const getScheduleModuleForSemester = (session = {}, semester = 'S1', moduleCatalog = []) => {
  const activeSemester = normalizeSemester(semester);
  const isS2 = activeSemester === 'S2';

  if (isS2) {
    if (session.moduleS2) return session.moduleS2;
    if (session.moduleS1) return '';
  } else {
    if (session.moduleS1) return session.moduleS1;
    if (session.moduleS2) return '';
  }

  const legacyModule = session.module || '';
  if (!legacyModule) return '';

  const normalizedLegacyModule = normalizeLookupValue(legacyModule);
  const configuredModules = (moduleCatalog || []).filter(module =>
    normalizeLookupValue(module?.name) === normalizedLegacyModule &&
    (!session.filiere || normalizeLookupValue(module?.major) === normalizeLookupValue(session.filiere)) &&
    (!session.annee || normalizeLookupValue(module?.year) === normalizeLookupValue(session.annee)) &&
    (!session.diploma || !module?.diploma || module.diploma === session.diploma)
  );

  let moduleSemester = getUniqueCatalogSemester(configuredModules);
  if (!moduleSemester) {
    const sameNameModules = (moduleCatalog || []).filter(module =>
      normalizeLookupValue(module?.name) === normalizedLegacyModule
    );
    moduleSemester = getUniqueCatalogSemester(sameNameModules);
  }

  if (moduleSemester) {
    return moduleSemester === 'Annuel' || moduleSemester === activeSemester
      ? legacyModule
      : '';
  }

  // Never guess a semester when legacy metadata is absent or contradictory.
  return '';
};
