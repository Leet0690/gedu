import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { changeUserPasswordDirect } from '../services/userService';
import { hasModulePermission, isAdministrator } from '../utils/permissions';

const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    try {
      ['admin_session', 'admin_session_token', 'eco_auth', 'admin_lastLogin'].forEach(key => localStorage.removeItem(key));
      sessionStorage.removeItem('ipfp_director_auth');
    } catch { /* Storage may be unavailable. */ }
    let unsubscribeProfile;
    let generation = 0;
    const unsubscribeAuth = onAuthStateChanged(auth, firebaseUser => {
      const currentGeneration = ++generation;
      unsubscribeProfile?.();
      setAdminUser(null);
      setLoading(Boolean(firebaseUser));
      if (!firebaseUser) return;
      unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), { includeMetadataChanges: true }, snapshot => {
        if (currentGeneration !== generation) return;
        // Cached profiles cannot authorize a session before server confirmation.
        if (snapshot.metadata.fromCache) {
          setAdminUser(null);
          setLoading(false);
          return;
        }
        const profile = snapshot.data();
        if (!snapshot.exists() || profile.isActive !== true) {
          setAdminUser(null);
          setLoading(false);
          return;
        }
        setAdminUser({ ...profile, uid: firebaseUser.uid, email: firebaseUser.email });
        setLoading(false);
      }, error => {
        if (currentGeneration !== generation) return;
        console.error('Impossible de vérifier le profil utilisateur :', error);
        setAdminUser(null);
        setLoading(false);
      });
    });
    return () => { generation++; unsubscribeProfile?.(); unsubscribeAuth(); };
  }, []);

  const login = async (email, password) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snapshot = await getDocFromServer(doc(db, 'users', credential.user.uid));
      if (!snapshot.exists() || snapshot.data().isActive !== true) {
        await signOut(auth);
        return { success: false, error: 'Compte non autorisé ou désactivé. Contactez votre administrateur.' };
      }
      const user = { ...snapshot.data(), uid: credential.user.uid, email: credential.user.email };
      await updateDoc(snapshot.ref, { lastLogin: serverTimestamp() });
      // The profile listener is the only authority that updates the session.
      return { success: true, admin: user };
    } catch (error) {
      setAdminUser(null);
      await signOut(auth).catch(() => {});
      return { success: false, error: error.code === 'auth/too-many-requests'
        ? 'Trop de tentatives. Veuillez patienter avant de réessayer.'
        : error.code === 'auth/network-request-failed' || error.code === 'unavailable'
          ? 'Connexion au serveur impossible. Vérifiez votre connexion Internet.'
          : 'Connexion impossible. Vérifiez vos identifiants et l’activation de votre compte.' };
    }
  };
  const logout = useCallback(async () => {
    setAdminUser(null);
    await signOut(auth);
  }, []);
  const hasPermission = useCallback((module, level = 'view') => hasModulePermission(adminUser, module, level), [adminUser]);
  return <AdminAuthContext.Provider value={{
    adminUser, currentUser: adminUser, loading, login, logout,
    isAuthenticated: adminUser?.isActive === true,
    isAdmin: isAdministrator(adminUser), hasPermission, changePassword: changeUserPasswordDirect,
  }}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return context;
};
