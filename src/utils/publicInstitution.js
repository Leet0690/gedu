import { getInstitutionConfig } from '../config/institution.js';

// Branding and teaching mode only; private settings and identity domains stay private.
export const getPublicInstitution = (institution = {}) => {
  const config = getInstitutionConfig(institution);
  return Object.fromEntries([
    'name', 'shortName', 'appName', 'typeLabel', 'city', 'country', 'logoUrl',
    'paletteKey', 'primaryColor', 'accentColor', 'educationType', 'schoolCycles', 'schoolGradeScales',
  ].map(key => [key, config[key]]));
};
