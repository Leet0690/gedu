const USERNAME_DOMAIN = '@ipfp.edu';

// Creation and sign-in must resolve a username to the same Firebase identity.
export function toAuthEmail(identifier) {
  const value = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
  if (!value || /\s/.test(value)) {
    const error = new Error('Saisissez un nom d’utilisateur valide, sans espace.');
    error.code = 'auth/invalid-identifier';
    throw error;
  }
  return value.includes('@') ? value : `${value}${USERNAME_DOMAIN}`;
}

export function getLoginIdentifier(email) {
  const value = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return value.endsWith(USERNAME_DOMAIN) ? value.slice(0, -USERNAME_DOMAIN.length) : value;
}
