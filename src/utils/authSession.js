// Only confirmed server snapshots can change the permission-bearing session.
export function profileSessionState(snapshot, firebaseUser) {
  if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return null;
  const profile = snapshot.exists() ? snapshot.data() : null;
  if (!profile) return {
    user: null,
    error: 'Profil d’accès introuvable. Le document users doit avoir le même identifiant que l’UID du compte Firebase Authentication.',
  };
  if (profile.isActive === false) return { user: null, error: 'Ce compte est désactivé. Contactez votre administrateur.' };
  if (profile.isActive !== true) return {
    user: null,
    error: 'Profil mal configuré : le champ isActive doit être un booléen égal à true dans Firestore.',
  };
  return { user: { ...profile, uid: firebaseUser.uid, email: firebaseUser.email }, error: '' };
}

export function getLoginDestination(modules, user, hasPermission, requestedPath) {
  const allowed = modules.filter(module => hasPermission(user, module.id));
  return allowed.find(module => module.path === requestedPath)?.path || allowed[0]?.path || '/';
}
