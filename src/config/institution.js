const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

const stringValue = (value, fallback = '') => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
};

const normalizeDomain = (value, fallback) => stringValue(value, fallback)
  .replace(/^https?:\/\//i, '')
  .replace(/^@/, '')
  .replace(/\/$/, '')
  .toLowerCase();

const getOrigin = () => {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
};

export const DEFAULT_INSTITUTION = Object.freeze({
  name: 'Établissement de Formation Professionnelle',
  // Keep the legacy default for existing deployments; new installations can
  // override it with VITE_INSTITUTION_SHORT_NAME or the admin profile screen.
  shortName: 'IPFP',
  appName: 'Gestion EFP',
  typeLabel: 'École / institut de formation professionnelle',
  city: '',
  country: 'Maroc',
  logoUrl: '/logo-ipfpp.png',
  portalUrl: '',
  portalHostname: '',
  authEmailDomain: 'ipfp.edu',
  sessionEmailDomain: 'sessions.ipfp.invalid',
  studentIdPrefix: 'EFP',
  useStarterCatalog: true,
});

export const getInstitutionConfig = (overrides = {}) => {
  const base = {
    ...DEFAULT_INSTITUTION,
    name: stringValue(env.VITE_INSTITUTION_NAME, DEFAULT_INSTITUTION.name),
    shortName: stringValue(env.VITE_INSTITUTION_SHORT_NAME, DEFAULT_INSTITUTION.shortName),
    appName: stringValue(env.VITE_INSTITUTION_APP_NAME, DEFAULT_INSTITUTION.appName),
    typeLabel: stringValue(env.VITE_INSTITUTION_TYPE, DEFAULT_INSTITUTION.typeLabel),
    city: stringValue(env.VITE_INSTITUTION_CITY, DEFAULT_INSTITUTION.city),
    country: stringValue(env.VITE_INSTITUTION_COUNTRY, DEFAULT_INSTITUTION.country),
    logoUrl: stringValue(env.VITE_INSTITUTION_LOGO_URL, DEFAULT_INSTITUTION.logoUrl),
    portalUrl: stringValue(env.VITE_PUBLIC_PORTAL_URL, DEFAULT_INSTITUTION.portalUrl),
    portalHostname: stringValue(env.VITE_PUBLIC_PORTAL_HOSTNAME, DEFAULT_INSTITUTION.portalHostname),
    authEmailDomain: normalizeDomain(env.VITE_AUTH_EMAIL_DOMAIN, DEFAULT_INSTITUTION.authEmailDomain),
    sessionEmailDomain: normalizeDomain(env.VITE_SESSION_EMAIL_DOMAIN, DEFAULT_INSTITUTION.sessionEmailDomain),
    studentIdPrefix: stringValue(env.VITE_STUDENT_ID_PREFIX, DEFAULT_INSTITUTION.studentIdPrefix).toUpperCase(),
    useStarterCatalog: env.VITE_USE_STARTER_CATALOG !== 'false',
    ...overrides,
  };

  const portalUrl = stringValue(base.portalUrl);
  const portalHostname = stringValue(base.portalHostname);

  return {
    ...base,
    name: stringValue(base.name, DEFAULT_INSTITUTION.name),
    shortName: stringValue(base.shortName, DEFAULT_INSTITUTION.shortName),
    appName: stringValue(base.appName, DEFAULT_INSTITUTION.appName),
    typeLabel: stringValue(base.typeLabel, DEFAULT_INSTITUTION.typeLabel),
    city: stringValue(base.city),
    country: stringValue(base.country),
    logoUrl: stringValue(base.logoUrl, DEFAULT_INSTITUTION.logoUrl),
    portalUrl,
    portalHostname,
    authEmailDomain: normalizeDomain(base.authEmailDomain, DEFAULT_INSTITUTION.authEmailDomain),
    sessionEmailDomain: normalizeDomain(base.sessionEmailDomain, DEFAULT_INSTITUTION.sessionEmailDomain),
    studentIdPrefix: stringValue(base.studentIdPrefix, DEFAULT_INSTITUTION.studentIdPrefix).toUpperCase(),
    useStarterCatalog: base.useStarterCatalog !== false,
  };
};

export const institutionConfig = getInstitutionConfig();

export const getInstitutionLocation = (institution = institutionConfig) =>
  [institution.city, institution.country].filter(Boolean).join(', ');

export const getPortalBaseUrl = (institution = institutionConfig) =>
  stringValue(institution.portalUrl, getOrigin()).replace(/\/$/, '');

