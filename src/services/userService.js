import { collection, doc, getDocs, getDocFromServer, onSnapshot, writeBatch, runTransaction, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser, sendPasswordResetEmail, updatePassword } from 'firebase/auth';
import { db, auth, createSecondaryAuth } from '../firebase';
import { isAdministrator, normalizePermissions } from '../utils/permissions';

export const APP_MODULES = [
  { id: 'dashboard', label: 'Tableau de bord', path: '/', category: 'Général' },
  { id: 'students', label: 'Stagiaires', path: '/admin/students', category: 'Administration' },
  { id: 'teachers', label: 'Formateurs', path: '/admin/teachers', category: 'Administration' },
  { id: 'continuous', label: 'Formations Continues', path: '/admin/continuous', category: 'Administration' },
  { id: 'finance', label: 'Finance & Trésorerie', path: '/admin/finance', category: 'Administration' },
  { id: 'modules', label: 'Modules & Filières', path: '/admin/modules', category: 'Pôle Académique' },
  { id: 'grades', label: 'Notes & Évaluations', path: '/admin/grades', category: 'Pôle Académique' },
  { id: 'reports', label: 'Rapports & Bulletins', path: '/admin/reports', category: 'Pôle Académique' },
  { id: 'schedules', label: 'Emplois du temps', path: '/admin/schedules', category: 'Pôle Académique' },
  { id: 'schedule_generation', label: 'Génération EDT', path: '/admin/schedule-generation', category: 'Pôle Académique' },
  { id: 'attendance_students', label: 'Absences Stagiaires', path: '/admin/attendance-students', category: 'Suivi de Présence' },
  { id: 'attendance_teachers', label: 'Présences Formateurs', path: '/admin/attendance-teachers', category: 'Suivi de Présence' },
  { id: 'logs', label: 'Journaux d’accès', path: '/admin/logs', category: 'Sécurité' },
  { id: 'users', label: 'Gestion Utilisateurs & Droits', path: '/admin/users', category: 'Sécurité' },
];

export const ROLE_PRESETS = {
  admin: {
    label: 'Administrateur Principal',
    description: 'Accès total et illimité à l’ensemble des modules et actions de l’application.',
    badgeClass: 'badge-admin',
    color: '#3b82f6',
    defaultPermissions: APP_MODULES.reduce((acc, mod) => {
      acc[mod.id] = 'edit';
      return acc;
    }, {})
  },
  director: {
    label: 'Direction',
    description: 'Accès de gestion générale et consultation globale.',
    badgeClass: 'badge-director',
    color: '#8b5cf6',
    defaultPermissions: APP_MODULES.reduce((acc, mod) => {
      if (mod.id === 'users') {
        acc[mod.id] = 'none';
      } else {
        acc[mod.id] = 'edit';
      }
      return acc;
    }, {})
  },
  secretary: {
    label: 'Secrétariat',
    description: 'Gestion des inscriptions, présences, emplois du temps et saisie courante.',
    badgeClass: 'badge-secretary',
    color: '#06b6d4',
    defaultPermissions: {
      dashboard: 'view',
      students: 'edit',
      teachers: 'view',
      attendance_students: 'edit',
      attendance_teachers: 'view',
      schedules: 'view',
      schedule_generation: 'none',
      modules: 'view',
      grades: 'view',
      reports: 'view',
      continuous: 'view',
      finance: 'none',
      logs: 'none',
      users: 'none'
    }
  },
  instructor: {
    label: 'Formateur / Enseignant',
    description: 'Consultation des modules, saisie des notes et présences stagiaires.',
    badgeClass: 'badge-instructor',
    color: '#10b981',
    defaultPermissions: {
      dashboard: 'view',
      students: 'view',
      teachers: 'none',
      attendance_students: 'edit',
      attendance_teachers: 'view',
      schedules: 'view',
      schedule_generation: 'none',
      modules: 'view',
      grades: 'edit',
      reports: 'view',
      continuous: 'none',
      finance: 'none',
      logs: 'none',
      users: 'none'
    }
  },
  custom: {
    label: 'Personnalisé',
    description: 'Permissions configurées sur-mesure.',
    badgeClass: 'badge-custom',
    color: '#f59e0b',
    defaultPermissions: APP_MODULES.reduce((acc, mod) => {
      acc[mod.id] = 'none';
      return acc;
    }, {})
  }
};

export const getPresetPermissions = role => ({ ...(ROLE_PRESETS[role]?.defaultPermissions || ROLE_PRESETS.custom.defaultPermissions) });

export const subscribeUsers = (callback, onError = console.error) => onSnapshot(
  collection(db, 'users'),
  snapshot => callback(snapshot.docs.map(item => ({ ...item.data(), id: item.id, uid: item.id })).sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || ''), 'fr'))), onError,
);
export const fetchUsers = async () => (await getDocs(collection(db, 'users'))).docs.map(item => ({ ...item.data(), id: item.id, uid: item.id }));
export const getUserProfile = async uid => {
  const snapshot = await getDocFromServer(doc(db, 'users', uid));
  return snapshot.exists() ? { ...snapshot.data(), id: uid, uid } : null;
};
const requireAdmin = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Session invalide.');
  const profile = await getUserProfile(user.uid);
  if (!isAdministrator(profile)) throw new Error('Action réservée à un administrateur actif.');
  return profile;
};
const audit = (actor, actionType, targetId, message) => ({
  userId: actor.uid, userName: actor.displayName, userRole: actor.role,
  actionType, module: 'users', metadata: { targetId }, message, type: 'info',
  timestamp: serverTimestamp(), createdAt: serverTimestamp(),
});
const errorMessage = error => ({
  'auth/email-already-in-use': 'Cette adresse email est déjà utilisée.',
  'auth/weak-password': 'Le mot de passe ne respecte pas la politique de sécurité Firebase.',
  'auth/invalid-email': 'Adresse email invalide.',
  'auth/requires-recent-login': 'Veuillez vous reconnecter avant de changer votre mot de passe.',
}[error.code] || error.message);

export const createUserAccount = async ({ email, password, displayName, role = 'custom', permissions }) => {
  let secondary;
  let createdUser;
  let committed = false;
  try {
    const actor = await requireAdmin();
    const cleanName = displayName?.trim();
    if (!cleanName || !email?.trim() || typeof password !== 'string' || password.length < 6) throw new Error('Nom, email et mot de passe valides requis.');
    const normalized = normalizePermissions(role, permissions || getPresetPermissions(role));
    secondary = await createSecondaryAuth();
    createdUser = (await createUserWithEmailAndPassword(secondary.secondaryAuth, email.trim().toLowerCase(), password)).user;
    const profile = { uid: createdUser.uid, email: createdUser.email, displayName: cleanName, role,
      permissions: normalized, isActive: true, createdAt: serverTimestamp(), lastLogin: null };
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', createdUser.uid), profile);
    batch.set(doc(collection(db, 'activity_logs')), audit(actor, 'USER_CREATED', createdUser.uid, `Utilisateur créé : ${cleanName}`));
    await batch.commit();
    committed = true;
    return { success: true, user: profile };
  } catch (error) {
    if (createdUser && !committed) {
      try { await deleteUser(createdUser); }
      catch (rollbackError) {
        console.error('Compte Auth à nettoyer :', createdUser.uid, rollbackError.code);
        return { success: false, error: `Profil non créé. Le compte Auth ${createdUser.uid} doit être supprimé depuis la console Firebase avant de réessayer.` };
      }
    }
    return { success: false, error: errorMessage(error) };
  } finally {
    await secondary?.cleanup();
  }
};

export const updateUserProfile = async (uid, changes) => {
  try {
    const actor = await requireAdmin();
    await runTransaction(db, async transaction => {
      const ref = doc(db, 'users', uid);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error('Utilisateur introuvable.');
      const existing = snapshot.data();
      const updates = {};
      if (changes.displayName !== undefined) {
        updates.displayName = changes.displayName.trim();
        if (!updates.displayName) throw new Error('Le nom est obligatoire.');
      }
      if (changes.role !== undefined) updates.role = changes.role;
      if (changes.permissions !== undefined || changes.role !== undefined) updates.permissions = normalizePermissions(changes.role || existing.role, changes.permissions || existing.permissions);
      if (changes.isActive !== undefined) {
        if (typeof changes.isActive !== 'boolean') throw new Error('Statut invalide.');
        updates.isActive = changes.isActive;
      }
      // Protect every active administrator: concurrent edits cannot remove the last one.
      if (isAdministrator(existing) && (updates.isActive === false || (updates.role && updates.role !== existing.role))) throw new Error('Un administrateur actif ne peut être désactivé ou rétrogradé depuis cette interface.');
      if (uid === actor.uid && updates.isActive === false) throw new Error('Vous ne pouvez pas désactiver votre propre compte.');
      transaction.update(ref, { ...updates, updatedAt: serverTimestamp() });
      transaction.set(doc(collection(db, 'activity_logs')), audit(actor, 'USER_UPDATED', uid, `Profil utilisateur mis à jour : ${updates.displayName || existing.displayName}`));
    });
    return { success: true };
  } catch (error) { return { success: false, error: errorMessage(error) }; }
};
export const toggleUserStatus = async (uid, currentStatus) => {
  const result = await updateUserProfile(uid, { isActive: !currentStatus });
  return { ...result, newStatus: result.success ? !currentStatus : currentStatus };
};
// Preserve identity and audit history; deleting an Auth account requires a trusted server.
export const deleteUserDoc = uid => updateUserProfile(uid, { isActive: false });
export const sendUserPasswordReset = async email => {
  try {
    const actor = await requireAdmin();
    await sendPasswordResetEmail(auth, email.trim());
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'activity_logs')), audit(actor, 'PASSWORD_RESET_REQUESTED', email.trim(), 'Email de réinitialisation demandé.'));
    await batch.commit();
    return { success: true };
  } catch (error) { return { success: false, error: errorMessage(error) }; }
};
export const changeUserPasswordDirect = async newPassword => {
  try {
    if (!auth.currentUser) throw new Error('Session invalide. Veuillez vous reconnecter.');
    await updatePassword(auth.currentUser, newPassword);
    return { success: true };
  } catch (error) { return { success: false, error: errorMessage(error) }; }
};
