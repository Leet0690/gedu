// Only confirmed server snapshots can change the permission-bearing session.
export function profileSessionState(snapshot, firebaseUser) {
  if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return null;
  const profile = snapshot.exists() ? snapshot.data() : null;
  if (profile?.isActive !== true) return { user: null, error: 'Compte non autorisé ou désactivé. Contactez votre administrateur.' };
  return { user: { ...profile, uid: firebaseUser.uid, email: firebaseUser.email }, error: '' };
}

export function getLoginDestination(modules, user, hasPermission, requestedPath) {
  const allowed = modules.filter(module => hasPermission(user, module.id));
  return allowed.find(module => module.path === requestedPath)?.path || allowed[0]?.path || '/';
}
