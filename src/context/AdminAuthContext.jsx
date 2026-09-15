import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { changeUserPasswordDirect } from '../services/userService';
import { hasModulePermission, isAdministrator, MODULE_KEYS } from '../utils/permissions';
import { profileSessionState } from '../utils/authSession';
import { toAuthEmail } from '../utils/loginIdentifier';

const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const loginPending = useRef(false);
  const logoutGeneration = useRef(0);
  useEffect(() => {
    try {
      ['admin_session', 'admin_session_token', 'eco_auth', 'admin_lastLogin'].forEach(key => localStorage.removeItem(key));
      sessionStorage.removeItem('ipfp_director_auth');
    } catch { /* Storage may be unavailable. */ }
    let unsubscribeProfile;
    let generation = 0;
    let profileTimeout;
    const unsubscribeAuth = onAuthStateChanged(auth, firebaseUser => {
      const currentGeneration = ++generation;
      const currentLogoutGeneration = logoutGeneration.current;
      unsubscribeProfile?.();
      clearTimeout(profileTimeout);
      profileTimeout = undefined;
      setAdminUser(null);
      setLoading(Boolean(firebaseUser));
      if (!firebaseUser) return;
      profileTimeout = setTimeout(() => {
        if (currentGeneration !== generation || currentLogoutGeneration !== logoutGeneration.current) return;
        setAdminUser(null);
        setAuthError('Impossible de vérifier votre accès. Vérifiez votre connexion Internet.');
        setLoading(false);
      }, 15000);
      unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), { includeMetadataChanges: true }, snapshot => {
        if (currentGeneration !== generation || currentLogoutGeneration !== logoutGeneration.current) return;
        // A local role change must never grant privileges before server acceptance.
        if (snapshot.metadata.hasPendingWrites) return;
        if (snapshot.metadata.fromCache) {
          setAdminUser(null);
          if (!profileTimeout) {
            setLoading(true);
            profileTimeout = setTimeout(() => {
              if (currentGeneration !== generation || currentLogoutGeneration !== logoutGeneration.current) return;
              setAuthError('Impossible de vérifier votre accès. Vérifiez votre connexion Internet.');
              setLoading(false);
            }, 15000);
          }
          return;
        }
        const confirmed = profileSessionState(snapshot, firebaseUser);
        clearTimeout(profileTimeout);
        profileTimeout = undefined;
        setAdminUser(confirmed.user);
        setAuthError(confirmed.error);
        setLoading(false);
      }, error => {
        if (currentGeneration !== generation || currentLogoutGeneration !== logoutGeneration.current) return;
        console.error('Impossible de vérifier le profil utilisateur :', error);
        clearTimeout(profileTimeout);
        setAdminUser(null);
        setAuthError('Impossible de vérifier les autorisations de votre compte.');
        setLoading(false);
      });
    });
    return () => { generation++; clearTimeout(profileTimeout); unsubscribeProfile?.(); unsubscribeAuth(); };
  }, []);

  const login = async (identifier, password) => {
    if (loginPending.current) return { success: false, error: 'Une connexion est déjà en cours.' };
    loginPending.current = true;
    setAuthError('');
    const startedGeneration = logoutGeneration.current;
    try {
      const credential = await signInWithEmailAndPassword(auth, toAuthEmail(identifier), password);
      if (startedGeneration !== logoutGeneration.current) {
        await signOut(auth);
        return { success: false, error: 'Connexion annulée.' };
      }
      const snapshot = await getDocFromServer(doc(db, 'users', credential.user.uid));
      if (startedGeneration !== logoutGeneration.current) return { success: false, error: 'Connexion annulée.' };
      const confirmed = profileSessionState(snapshot, credential.user);
      if (!confirmed?.user) {
        const message = confirmed?.error || 'Votre profil n’a pas encore été confirmé par le serveur. Veuillez réessayer.';
        await signOut(auth);
        setAuthError(message);
        return { success: false, error: message };
      }
      const user = confirmed.user;
      // Failure to update a diagnostic timestamp must not undo a valid login.
      void updateDoc(snapshot.ref, { lastLogin: serverTimestamp() }).catch(error => {
        console.warn('Dernière connexion non enregistrée :', error.code);
      });
      // The profile listener is the only authority that updates the session.
      return { success: true, admin: user };
    } catch (error) {
      setAdminUser(null);
      await signOut(auth).catch(() => {});
      const message = {
        'auth/invalid-identifier': error.message,
        'auth/invalid-email': 'Nom d’utilisateur invalide.',
        'auth/invalid-credential': 'Nom d’utilisateur ou mot de passe incorrect.',
        'auth/user-not-found': 'Nom d’utilisateur ou mot de passe incorrect.',
        'auth/wrong-password': 'Nom d’utilisateur ou mot de passe incorrect.',
        'auth/user-disabled': 'Ce compte est désactivé. Contactez votre administrateur.',
        'auth/operation-not-allowed': 'La connexion par mot de passe doit être activée dans Firebase Authentication.',
        'auth/too-many-requests': 'Trop de tentatives. Veuillez patienter avant de réessayer.',
        'auth/network-request-failed': 'Connexion au serveur impossible. Vérifiez votre connexion Internet.',
        unavailable: 'Connexion au serveur impossible. Vérifiez votre connexion Internet.',
        'permission-denied': 'La lecture du profil est refusée par Firestore. Faites vérifier les règles d’accès à votre profil.',
      }[error.code] || 'Connexion impossible. Vérifiez vos identifiants et l’activation de votre compte.';
      setAuthError(message);
      return { success: false, error: message };
    } finally {
      loginPending.current = false;
    }
  };
  const logout = useCallback(async () => {
    logoutGeneration.current++;
    setAdminUser(null);
    setAuthError('');
    await signOut(auth);
  }, []);
  // lastLogin and other profile metadata must not restart every data loader.
  const permissionSignature = JSON.stringify(MODULE_KEYS.map(module => [
    hasModulePermission(adminUser, module), hasModulePermission(adminUser, module, 'edit'),
  ]));
  const hasPermission = useCallback((module, level = 'view') => {
    const index = MODULE_KEYS.indexOf(module);
    if (index < 0 || !['view', 'edit'].includes(level)) return false;
    return JSON.parse(permissionSignature)[index][level === 'edit' ? 1 : 0];
  }, [permissionSignature]);
  return <AdminAuthContext.Provider value={{
    adminUser, currentUser: adminUser, loading, authError, login, logout,
    isAuthenticated: adminUser?.isActive === true,
    isAdmin: isAdministrator(adminUser), hasPermission, changePassword: changeUserPasswordDirect,
  }}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return context;
};
