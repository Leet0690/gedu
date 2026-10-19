import { educationText } from '../utils/education';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  KeyRound, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  Edit3, 
  Filter, 
  UserRound,
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  ShieldAlert, 
  HelpCircle,
  Clock,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useToast } from '../context/ToastContext';
import { getLoginIdentifier } from '../utils/loginIdentifier';
import { 
  APP_MODULES, 
  ROLE_PRESETS, 
  fetchUsersPage,
  createUserAccount, 
  updateUserProfile, 
  toggleUserStatus, 
  setUserPasswordByAdmin,
  deleteUserDoc,
  getPresetPermissions 
} from '../services/userService';

const MODULE_CATEGORIES = ['Général', 'Administration', 'Pôle Académique', 'Suivi de Présence', 'Sécurité'];

export default function UserManagement() {
  const { isAdmin, adminUser } = useAdminAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userPageCursors, setUserPageCursors] = useState([null]);
  const [hasNextUserPage, setHasNextUserPage] = useState(false);
  const initialUsersLoadRef = useRef(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState('');
  const [passwordModalSubmitting, setPasswordModalSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'secretary',
    permissions: getPresetPermissions('secretary')
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadUsersPage = useCallback(async ({ page = 1, reset = false } = {}) => {
    if (!isAdmin) return;
    setLoading(true);
    setLoadError('');
    try {
      const cursor = reset || page === 1 ? null : userPageCursors[page - 1] || null;
      const result = await fetchUsersPage({ cursor });
      setUsers(result.users);
      setUserPage(page);
      setHasNextUserPage(result.hasMore);
      setUserPageCursors(previous => {
        const next = reset || page === 1 ? [null] : [...previous];
        next[page] = result.lastDoc;
        return next;
      });
    } catch (error) {
      console.error('Chargement paginé des utilisateurs :', error);
      setLoadError('Impossible de charger les utilisateurs. Vérifiez la connexion et les droits Firestore.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, userPageCursors]);

  useEffect(() => {
    if (!isAdmin) {
      initialUsersLoadRef.current = false;
      return;
    }
    if (initialUsersLoadRef.current) return;
    initialUsersLoadRef.current = true;
    setUserPageCursors([null]);
    loadUsersPage({ page: 1, reset: true });
  }, [isAdmin, loadUsersPage]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        (user.displayName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
      const matchesStatus = 
        statusFilter === 'ALL' || 
        (statusFilter === 'ACTIVE' && user.isActive === true) ||
        (statusFilter === 'INACTIVE' && user.isActive !== true);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const handleOpenCreate = () => {
    setFormData({
      displayName: '',
      email: '',
      password: '',
      role: 'secretary',
      permissions: getPresetPermissions('secretary')
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      displayName: user.displayName || '',
      email: user.email || '',
      password: '',
      role: user.role || 'custom',
      permissions: { ...(user.permissions || getPresetPermissions(user.role || 'custom')) }
    });
    setFormError('');
  };

  const handleRoleChange = (newRole) => {
    if (editingUser?.isActive === true && ['admin', 'super_admin'].includes(editingUser.role) && newRole !== editingUser.role) { setFormError('Le rôle d’un administrateur actif est protégé.'); return; }
    setFormData(prev => ({
      ...prev,
      role: newRole,
      permissions: getPresetPermissions(newRole)
    }));
  };

  const handlePermissionChange = (moduleId, level) => {
    if (['admin', 'super_admin'].includes(formData.role)) return;
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleId]: level
      }
    }));
  };

  const handleSetAllPermissions = (level) => {
    if (['admin', 'super_admin'].includes(formData.role)) return;
    const updated = {};
    APP_MODULES.forEach(mod => {
      if (mod.id === 'users' && formData.role !== 'admin') {
        updated[mod.id] = 'none';
      } else {
        updated[mod.id] = level;
      }
    });
    setFormData(prev => ({ ...prev, permissions: updated }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (formSubmitting) return;
    setFormError('');
    if (!formData.email || !formData.password || !formData.displayName) {
      setFormError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (formData.password.length < 6) {
      setFormError("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    setFormSubmitting(true);
    const res = await createUserAccount({
      email: formData.email,
      password: formData.password,
      displayName: formData.displayName,
      role: formData.role,
      permissions: formData.permissions
    });
    setFormSubmitting(false);

    if (res.success) {
      showToast(`Utilisateur ${formData.displayName} créé avec succès !`, 'success');
      setIsCreateModalOpen(false);
      await loadUsersPage({ page: userPage });
    } else {
      setFormError(res.error || "Erreur lors de la création de l'utilisateur.");
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (formSubmitting) return;
    setFormError('');
    if (!formData.displayName) {
      setFormError("Le nom de l'utilisateur est obligatoire.");
      return;
    }

    setFormSubmitting(true);
    const res = await updateUserProfile(editingUser.id || editingUser.uid, {
      displayName: formData.displayName,
      role: formData.role,
      permissions: formData.permissions
    });
    setFormSubmitting(false);

    if (res.success) {
      showToast(`Profil de ${formData.displayName} mis à jour.`, 'success');
      setEditingUser(null);
      await loadUsersPage({ page: userPage });
    } else {
      setFormError(res.error || "Erreur lors de la modification de l'utilisateur.");
    }
  };

  const handleToggleStatus = async (user) => {
    if (actionBusy) return;
    setActionBusy(true);
    const currentStatus = user.isActive === true;
    const res = await toggleUserStatus(user.id || user.uid, currentStatus);
    setActionBusy(false);
    if (!res.success) showToast(res.error, 'error');
    if (res.success) {
      showToast(`Compte de ${user.displayName} ${res.newStatus ? 'activé' : 'désactivé'}.`, res.newStatus ? 'success' : 'warning');
    }
    if (res.success) await loadUsersPage({ page: userPage });
  };

  const handleOpenPasswordModal = (user) => {
    setPasswordModalUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowModalPassword(false);
    setPasswordModalError('');
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordModalSubmitting || !passwordModalUser) return;
    setPasswordModalError('');

    if (!newPassword || newPassword.length < 6) {
      setPasswordModalError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordModalError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setPasswordModalSubmitting(true);
    const res = await setUserPasswordByAdmin({
      uid: passwordModalUser.id || passwordModalUser.uid,
      newPassword
    });
    setPasswordModalSubmitting(false);

    if (res.success) {
      showToast(`Mot de passe mis à jour avec succès pour ${passwordModalUser.displayName || 'l’utilisateur'}.`, 'success');
      setPasswordModalUser(null);
    } else {
      setPasswordModalError(res.error || 'Erreur lors de la modification du mot de passe.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser || actionBusy) return;
    setActionBusy(true);
    const res = await deleteUserDoc(deleteConfirmUser.id || deleteConfirmUser.uid);
    setActionBusy(false);
    if (res.success) {
      showToast(`Compte de ${deleteConfirmUser.displayName} supprimé.`, 'warning');
      setDeleteConfirmUser(null);
      await loadUsersPage({ page: userPage });
    } else {
      showToast(res.error || 'Erreur lors de la désactivation.', 'error');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex-center" style={{ minHeight: '60vh' }}>
        <div className="glass-card" style={{ maxWidth: '440px', padding: '32px', textAlign: 'center' }}>
          <ShieldAlert size={48} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>Accès Restreint</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Seul l'Administrateur Principal a l'autorisation de gérer les utilisateurs et leurs permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadError && <p role="alert" className="glass-card p-4 text-red-600">{loadError}</p>}
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-500 inline-flex items-center justify-center">
              <Users size={22} />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Gestion des Utilisateurs & Droits
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Créez des comptes, définissez les permissions page par page et contrôlez les accès de votre équipe.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreate}
            className="btn-modern primary flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <UserPlus size={18} />
            <span>Nouvel Utilisateur</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Comptes</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{users.length}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actifs</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              {users.filter(u => u.isActive === true).length}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inactifs</p>
            <h3 className="text-2xl font-black text-rose-500 mt-1">
              {users.filter(u => u.isActive !== true).length}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <XCircle size={20} />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Administrateurs</p>
            <h3 className="text-2xl font-black text-brand-600 mt-1">
              {users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou identifiant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-premium pl-10 pr-4 py-2 text-sm w-full"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Filter size={14} />
            <span>Rôle :</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input-premium py-1.5 px-3 text-xs"
          >
            <option value="ALL">Tous les rôles</option>
            <option value="admin">Administrateur</option>
            <option value="director">Direction</option>
            <option value="secretary">Secrétariat</option>
            <option value="instructor">{educationText("Formateur")}</option>
            <option value="custom">Personnalisé</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-premium py-1.5 px-3 text-xs"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actifs uniquement</option>
            <option value="INACTIVE">Inactifs uniquement</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm">Chargement des utilisateurs...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-base font-bold text-slate-600 dark:text-slate-300">Aucun utilisateur trouvé</p>
            <p className="text-xs mt-1">Modifiez vos filtres ou créez un nouveau compte utilisateur.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Utilisateur</th>
                  <th className="py-3 px-4">Rôle</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Permissions</th>
                  <th className="py-3 px-4">Dernier accès</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredUsers.map((user) => {
                  const rolePreset = ROLE_PRESETS[user.role === 'super_admin' ? 'admin' : user.role] || ROLE_PRESETS.custom;
                  const isActive = user.isActive === true;
                  const isCurrentLoggedUser = (adminUser?.uid && (user.id === adminUser.uid || user.uid === adminUser.uid));

                  // Count active permissions
                  const perms = user.permissions || {};
                  const editCount = Object.values(perms).filter(v => v === 'edit').length;
                  const viewCount = Object.values(perms).filter(v => v === 'view').length;

                  return (
                    <tr key={user.id || user.uid} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm"
                            style={{ backgroundColor: rolePreset.color || '#3b82f6' }}
                          >
                            {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                              {user.displayName || 'Utilisateur'}
                              {isCurrentLoggedUser && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                  Vous
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <UserRound size={12} />
                              <span>{getLoginIdentifier(user.email)}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{ 
                            backgroundColor: `${rolePreset.color}15`, 
                            color: rolePreset.color,
                            border: `1px solid ${rolePreset.color}30`
                          }}
                        >
                          <ShieldCheck size={12} />
                          {educationText(rolePreset.label)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={actionBusy || isCurrentLoggedUser || ['admin', 'super_admin'].includes(user.role)}
                          title={isCurrentLoggedUser ? "Vous ne pouvez pas suspendre votre propre compte" : "Cliquer pour changer le statut"}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all ${
                            isActive 
                              ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                          } ${isCurrentLoggedUser ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                        >
                          {isActive ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Actif
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              {user.isActive === false ? 'Suspendu' : 'À configurer'}
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        {user.role === 'admin' ? (
                          <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                            <Sparkles size={13} /> Accès total
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold" title={educationText("Modules avec droit d'écriture")}>
                              {editCount} écriture
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 font-semibold" title={educationText("Modules en lecture seule")}>
                              {viewCount} lecture
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {user.lastLogin ? (
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>{(user.lastLogin?.toDate?.() || new Date(user.lastLogin)).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span>Jamais connecté</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-primary transition-colors"
                            title="Modifier les droits"
                          >
                            <SlidersHorizontal size={16} />
                          </button>

                          <button
                            onClick={() => handleOpenPasswordModal(user)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-amber-500 transition-colors"
                            title="Changer le mot de passe"
                          >
                            <KeyRound size={16} />
                          </button>

                          {!isCurrentLoggedUser && !['admin', 'super_admin'].includes(user.role) && (
                            <button
                              onClick={() => setDeleteConfirmUser(user)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                              title="Désactiver les accès"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && users.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-1 text-sm text-slate-500">
          <span>Page {userPage} · {users.length} comptes chargés</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-modern secondary flex items-center gap-1"
              disabled={userPage === 1}
              onClick={() => loadUsersPage({ page: userPage - 1 })}
            >
              <ChevronLeft size={15} /> Précédent
            </button>
            <button
              type="button"
              className="btn-modern secondary flex items-center gap-1"
              disabled={!hasNextUserPage}
              onClick={() => loadUsersPage({ page: userPage + 1 })}
            >
              Suivant <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card max-w-2xl w-full p-6 shadow-2xl my-8 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Créer un Nouvel Utilisateur</h3>
                    <p className="text-xs text-slate-400">Définissez ses identifiants et sa matrice de permissions.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Nom & Prénom *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="input-premium w-full py-2 px-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Nom d'utilisateur *
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input-premium w-full py-2 px-3 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Mot de passe initial *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Au moins 6 caractères"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input-premium w-full py-2 pl-3 pr-10 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Role Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Rôle de base (Préremplit les permissions)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(ROLE_PRESETS).map(([key, role]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleRoleChange(key)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          formData.role === key
                            ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-bold text-xs" style={{ color: role.color }}>
                          {educationText(role.label)}
                        </div>
                        <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {key === 'admin' ? 'Total' : key === 'secretary' ? 'Saisie & Suivi' : key === 'instructor' ? 'Notes & Présences' : 'Sur-mesure'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Granular Permissions Matrix */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-900/30">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Matrice des Permissions Page par Page
                      </h4>
                      <p className="text-[11px] text-slate-400">Ajustez finement les droits pour chaque écran.</p>
                    </div>

                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleSetAllPermissions('view')}
                        className="px-2 py-1 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 font-semibold"
                      >
                        Tout Voir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllPermissions('edit')}
                        className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 font-semibold"
                      >
                        Tout Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllPermissions('none')}
                        className="px-2 py-1 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-semibold"
                      >
                        Tout Refuser
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                    {MODULE_CATEGORIES.map(category => {
                      const categoryModules = APP_MODULES.filter(m => m.category === category);
                      if (categoryModules.length === 0) return null;

                      return (
                        <div key={category} className="space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {category}
                          </div>
                          <div className="grid grid-cols-1 gap-1">
                            {categoryModules.map(mod => {
                              const isUsersModule = mod.id === 'users';
                              const currentLevel = formData.permissions?.[mod.id] || 'none';

                              return (
                                <div
                                  key={mod.id}
                                  className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 text-xs"
                                >
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {educationText(mod.label)}
                                  </span>

                                  {isUsersModule ? (
                                    <span className="text-[10px] font-bold text-slate-400 italic">
                                      {formData.role === 'admin' ? 'Accès Super Admin' : 'Réservé Admin'}
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={['admin', 'super_admin'].includes(formData.role)} onClick={() => handlePermissionChange(mod.id, 'none')}
                                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                          currentLevel === 'none'
                                            ? 'bg-rose-500 text-white shadow-xs'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        Aucun
                                      </button>
                                      <button
                                        type="button"
                                        disabled={['admin', 'super_admin'].includes(formData.role)} onClick={() => handlePermissionChange(mod.id, 'view')}
                                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                          currentLevel === 'view'
                                            ? 'bg-blue-500 text-white shadow-xs'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        Voir
                                      </button>
                                      <button
                                        type="button"
                                        disabled={['admin', 'super_admin'].includes(formData.role)} onClick={() => handlePermissionChange(mod.id, 'edit')}
                                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                          currentLevel === 'edit'
                                            ? 'bg-emerald-500 text-white shadow-xs'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        Modifier
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="btn-modern secondary"
                    disabled={formSubmitting}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="btn-modern primary"
                    disabled={formSubmitting}
                  >
                    {formSubmitting ? 'Création...' : 'Créer l’utilisateur'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Edit User Permissions */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card max-w-2xl w-full p-6 shadow-2xl my-8 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <SlidersHorizontal size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Modifier les Droits : {editingUser.displayName}
                    </h3>
                    <p className="text-xs text-slate-400">{getLoginIdentifier(editingUser.email)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nom & Prénom
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="input-premium w-full py-2 px-3 text-sm"
                  />
                </div>

                {/* Role Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Rôle
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(ROLE_PRESETS).map(([key, role]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleRoleChange(key)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          formData.role === key
                            ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-bold text-xs" style={{ color: role.color }}>
                          {educationText(role.label)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Granular Permissions Matrix */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-900/30">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Permissions Personnalisées
                      </h4>
                      <p className="text-[11px] text-slate-400">Modifiez chaque permission pour cet utilisateur.</p>
                    </div>

                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleSetAllPermissions('view')}
                        className="px-2 py-1 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 font-semibold"
                      >
                        Tout Voir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllPermissions('edit')}
                        className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 font-semibold"
                      >
                        Tout Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllPermissions('none')}
                        className="px-2 py-1 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-semibold"
                      >
                        Tout Refuser
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                    {MODULE_CATEGORIES.map(category => {
                      const categoryModules = APP_MODULES.filter(m => m.category === category);
                      if (categoryModules.length === 0) return null;

                      return (
                        <div key={category} className="space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {category}
                          </div>
                          <div className="grid grid-cols-1 gap-1">
                            {categoryModules.map(mod => {
                              const isUsersModule = mod.id === 'users';
                              const currentLevel = formData.permissions?.[mod.id] || 'none';

                              return (
                                <div
                                  key={mod.id}
                                  className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 text-xs"
                                >
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {educationText(mod.label)}
                                  </span>

                                  {isUsersModule ? (
                                    <span className="text-[10px] font-bold text-slate-400 italic">
                                      {formData.role === 'admin' ? 'Accès Super Admin' : 'Réservé Admin'}
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={['admin', 'super_admin'].includes(formData.role)} onClick={() => handlePermissionChange(mod.id, 'none')}
                                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                          currentLevel === 'none'
                                            ? 'bg-rose-500 text-white shadow-xs'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        Aucun
                                      </button>
                                      <button
                                        type="button"
                                        disabled={['admin', 'super_admin'].includes(formData.role)} onClick={() => handlePermissionChange(mod.id, 'view')}
                                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                          currentLevel === 'view'
                                            ? 'bg-blue-500 text-white shadow-xs'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        Voir
                                      </button>
                                      <button
                                        type="button"
                                        disabled={['admin', 'super_admin'].includes(formData.role)} onClick={() => handlePermissionChange(mod.id, 'edit')}
                                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                                          currentLevel === 'edit'
                                            ? 'bg-emerald-500 text-white shadow-xs'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        Modifier
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="btn-modern secondary"
                    disabled={formSubmitting}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="btn-modern primary"
                    disabled={formSubmitting}
                  >
                    {formSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Change Password Manually */}
      <AnimatePresence>
        {passwordModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card max-w-md w-full p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Changer le mot de passe
                    </h3>
                    <p className="text-xs text-slate-400">
                      Saisie manuelle directe (aucun lien envoyé).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {passwordModalUser.displayName}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Identifiant : <span className="font-semibold text-slate-600 dark:text-slate-300">{getLoginIdentifier(passwordModalUser.email)}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {ROLE_PRESETS[passwordModalUser.role]?.label || passwordModalUser.role}
                </span>
              </div>

              {passwordModalError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{passwordModalError}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nouveau mot de passe *
                  </label>
                  <div className="relative">
                    <input
                      type={showModalPassword ? 'text' : 'password'}
                      required
                      placeholder="Au moins 6 caractères"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-premium w-full py-2 pl-3 pr-10 text-sm"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassword(!showModalPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showModalPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Confirmer le mot de passe *
                  </label>
                  <input
                    type={showModalPassword ? 'text' : 'password'}
                    required
                    placeholder="Confirmer le nouveau mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-premium w-full py-2 px-3 text-sm"
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPasswordModalUser(null)}
                    className="btn-modern secondary flex-1"
                    disabled={passwordModalSubmitting}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={passwordModalSubmitting}
                    className="btn-modern primary flex-1"
                  >
                    {passwordModalSubmitting ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Delete Confirm */}
      <AnimatePresence>
        {deleteConfirmUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card max-w-md w-full p-6 shadow-2xl text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Désactiver cet utilisateur ?
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Êtes-vous sûr de vouloir désactiver le compte de <strong>{deleteConfirmUser.displayName}</strong> ({deleteConfirmUser.email}) ?
                Ses accès seront bloqués. Son identité et son historique seront conservés.
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUser(null)}
                  className="btn-modern secondary flex-1"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={actionBusy} onClick={handleDeleteUser}
                  className="btn-modern danger flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Désactiver
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
