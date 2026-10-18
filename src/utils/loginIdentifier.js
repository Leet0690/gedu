import { institutionConfig } from '../config/institution.js';

const getUsernameDomain = () => `@${institutionConfig.authEmailDomain}`;

// Creation and sign-in must resolve a username to the same Firebase identity.
export function toAuthEmail(identifier) {
  const value = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
  if (!value || /\s/.test(value)) {
    const error = new Error('Saisissez un nom d’utilisateur valide, sans espace.');
    error.code = 'auth/invalid-identifier';
    throw error;
  }
  return value.includes('@') ? value : `${value}${getUsernameDomain()}`;
}

export function getLoginIdentifier(email) {
  const value = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const usernameDomain = getUsernameDomain();
  return value.endsWith(usernameDomain) ? value.slice(0, -usernameDomain.length) : value;
}
