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

export const INSTITUTION_PALETTES = Object.freeze({
  campus: { label: 'Campus vert & or', primary: '#236247', accent: '#e5b93f' },
  ocean: { label: 'Savoir bleu & or', primary: '#155e75', accent: '#f2c94c' },
  terracotta: { label: 'Campus terre cuite', primary: '#9a3412', accent: '#f3c969' },
  plum: { label: 'Institut prune & miel', primary: '#6b3f72', accent: '#e6b84f' },
  custom: { label: 'Palette personnalisée', primary: '#236247', accent: '#e5b93f' },
});

const normalizeHex = (value, fallback) => {
  const normalized = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toLowerCase() : fallback;
};

const hexToRgb = hex => {
  const value = normalizeHex(hex, '#000000').slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }) => `#${[r, g, b]
  .map(channel => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
  .join('')}`;

const mixColors = (first, second, amount) => {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
};

const rgbString = hex => {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
};

const channelLuminance = channel => {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

const contrastColor = hex => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
  return luminance > 0.48 ? '#17352a' : '#ffffff';
};

export const getInstitutionPalette = (institution = {}) => {
  const paletteKey = INSTITUTION_PALETTES[institution.paletteKey] ? institution.paletteKey : 'campus';
  const preset = INSTITUTION_PALETTES[paletteKey];
  const primary = paletteKey === 'custom'
    ? normalizeHex(institution.primaryColor, preset.primary)
    : preset.primary;
  const accent = paletteKey === 'custom'
    ? normalizeHex(institution.accentColor, preset.accent)
    : preset.accent;
  const primaryDark = mixColors(primary, '#071d14', 0.68);
  const primaryLight = mixColors(primary, '#ffffff', 0.28);
  const primaryUltraLight = mixColors(primary, '#ffffff', 0.91);
  const background = mixColors(primary, '#ffffff', 0.975);
  const border = mixColors(primary, '#ffffff', 0.82);
  const borderLight = mixColors(primary, '#ffffff', 0.93);
  const muted = mixColors(primary, '#ffffff', 0.95);
  const textSecondary = mixColors(primary, '#ffffff', 0.47);

  return {
    key: paletteKey,
    primary,
    primaryLight,
    primaryDark,
    primaryUltraLight,
    primaryRgb: rgbString(primary),
    accent,
    accentLight: mixColors(accent, '#ffffff', 0.42),
    accentRgb: rgbString(accent),
    accentForeground: contrastColor(accent),
    primaryForeground: contrastColor(primary),
    background,
    foreground: primaryDark,
    card: '#ffffff',
    border,
    borderLight,
    muted,
    mutedForeground: mixColors(primary, '#64748b', 0.46),
    textSecondary,
    success: mixColors(primary, '#16845b', 0.52),
    successBg: mixColors(primary, '#ffffff', 0.89),
    warning: mixColors(accent, '#7c4a03', 0.54),
    warningBg: mixColors(accent, '#ffffff', 0.82),
    info: primary,
    infoBg: primaryUltraLight,
    shadowRgb: rgbString(primaryDark),
  };
};

export const applyInstitutionTheme = (institution = {}) => {
  if (typeof document === 'undefined') return;
  const palette = getInstitutionPalette(institution);
  const root = document.documentElement;
  const vars = {
    '--primary': palette.primary,
    '--primary-light': palette.primaryLight,
    '--primary-dark': palette.primaryDark,
    '--primary-ultra-light': palette.primaryUltraLight,
    '--primary-rgb': palette.primaryRgb,
    '--primary-foreground': palette.primaryForeground,
    '--secondary': palette.primaryUltraLight,
    '--secondary-foreground': palette.primary,
    '--accent': palette.accent,
    '--accent-light': palette.accentLight,
    '--accent-foreground': palette.accentForeground,
    '--accent-rgb': palette.accentRgb,
    '--yellow': palette.accent,
    '--yellow-soft': palette.warningBg,
    '--teal': palette.primaryLight,
    '--teal-soft': palette.successBg,
    '--background': palette.background,
    '--bg-page': palette.background,
    '--bg-main': palette.background,
    '--foreground': palette.foreground,
    '--card': palette.card,
    '--surface': palette.card,
    '--border': palette.border,
    '--border-light': palette.borderLight,
    '--border-hover': mixColors(palette.primary, '#ffffff', 0.64),
    '--muted': palette.muted,
    '--muted-foreground': palette.mutedForeground,
    '--text-secondary': palette.textSecondary,
    '--success': palette.success,
    '--success-bg': palette.successBg,
    '--warning': palette.warning,
    '--warning-bg': palette.warningBg,
    '--info': palette.info,
    '--info-bg': palette.infoBg,
    '--ring': palette.primary,
    '--theme-glow-primary-rgb': palette.primaryRgb,
    '--theme-glow-accent-rgb': palette.accentRgb,
    '--shadow-xs': `0 1px 2px rgba(${palette.shadowRgb}, 0.04)`,
    '--shadow-sm': `0 5px 16px rgba(${palette.shadowRgb}, 0.06)`,
    '--shadow-md': `0 12px 32px rgba(${palette.shadowRgb}, 0.08)`,
    '--shadow-lg': `0 20px 48px rgba(${palette.shadowRgb}, 0.11)`,
  };
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
  root.dataset.institutionPalette = palette.key;
  if (typeof window !== 'undefined') {
    window.__GEDU_INSTITUTION__ = { ...institution, palette: palette.key };
  }
};

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
  paletteKey: 'campus',
  primaryColor: '',
  accentColor: '',
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
    paletteKey: INSTITUTION_PALETTES[base.paletteKey] ? base.paletteKey : DEFAULT_INSTITUTION.paletteKey,
    primaryColor: normalizeHex(base.primaryColor, ''),
    accentColor: normalizeHex(base.accentColor, ''),
    useStarterCatalog: base.useStarterCatalog !== false,
  };
};

export const institutionConfig = getInstitutionConfig();

export const getInstitutionLocation = (institution = institutionConfig) =>
  [institution.city, institution.country].filter(Boolean).join(', ');

export const getPortalBaseUrl = (institution = institutionConfig) =>
  stringValue(institution.portalUrl, getOrigin()).replace(/\/$/, '');

