import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ROLE_PRESETS } from '../services/userService';
import Logo from '../components/Logo';
import { SemesterToggle } from '../components/SemesterToggle';
import { AcademicYearSelector } from '../components/AcademicYearSelector';
import { preloadRoute } from '../routeLoaders';
import { isAcademicYearScopedPath } from '../utils/routeScopes';
import { 
  LayoutDashboard, 
  Home,
  Library,
  Boxes, 
  PenTool, 
  LineChart, 
  CalendarDays, 
  ClipboardList,
  UserCheck, 
  UserX,
  Users, 
  Presentation, 
  Wallet, 
  Settings, 
  Power, 
  Menu, 
  X, 
  Bell,
  RefreshCw,
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  School,
  WifiOff,
  Wand2,
  ArrowUp,
  GraduationCap,
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';

const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return isOnline;
};

const NAV_CATEGORIES = [
  {
    label: "Tableau de Bord",
    icon: LayoutDashboard,
    color: "text-blue-500",
    items: [
      { to: "/", icon: Home, label: "Tableau de bord", color: "text-blue-500", pageKey: 'dashboard' },
    ]
  },
  {
    label: "Pôle Académique",
    icon: Library,
    color: "text-violet-500",
    items: [
      { to: "/admin/modules", icon: Boxes, label: "Modules", color: "text-violet-500", pageKey: 'modules' },
      { to: "/admin/grades", icon: PenTool, label: "Notes", color: "text-amber-500", pageKey: 'grades' },
      { to: "/admin/reports", icon: LineChart, label: "Rapports", color: "text-emerald-500", pageKey: 'reports' },
      { to: "/admin/schedules", icon: CalendarDays, label: "Emplois du Temps", color: "text-orange-500", pageKey: 'schedules' },
      { to: "/admin/schedule-generation", icon: Wand2, label: "Génération (EDT)", color: "text-fuchsia-500", pageKey: 'schedule_generation' },
    ]
  },
  {
    label: "Suivi de Présence",
    icon: ClipboardList,
    color: "text-rose-500",
    items: [
      { to: "/admin/attendance-students", icon: UserX, label: "Absences Stagiaires", color: "text-rose-500", pageKey: 'attendance_students' },
      { to: "/admin/attendance-teachers", icon: UserCheck, label: "Présences Formateurs", color: "text-teal-500", pageKey: 'attendance_teachers' },
    ]
  },
  {
    label: "Administration",
    icon: Settings,
    color: "text-indigo-500",
    items: [
      { to: "/admin/students", icon: Users, label: "Stagiaires", color: "text-sky-500", pageKey: 'students' },
      { to: "/admin/teachers", icon: Presentation, label: "Formateurs", color: "text-indigo-500", pageKey: 'teachers' },
      { to: "/admin/continuous", icon: GraduationCap, label: "Formations Continues", color: "text-purple-500", pageKey: 'continuous' },
      { to: "/admin/finance", icon: Wallet, label: "Finance", color: "text-green-600", pageKey: 'finance' },
      { to: "/admin/users", icon: ShieldCheck, label: "Utilisateurs & Droits", color: "text-blue-600", pageKey: 'users' },
      { to: "/admin/logs", icon: ClipboardList, label: "Journaux d'accès", color: "text-slate-500", pageKey: 'logs' },
    ]
  }
];

const SidebarCategory = ({ cat, isSidebarOpen, renderNavLink, location, isMobile }) => {
  const isAnyActive = cat.items.some(item => location.pathname === item.to);
  const [open, setOpen] = React.useState(isAnyActive);
  
  React.useEffect(() => {
    if (isAnyActive) setOpen(true);
  }, [isAnyActive]);

  if (cat.items.length === 1) {
    return renderNavLink(cat.items[0]);
  }

  if (!isSidebarOpen && !isMobile) {
    return cat.items.map(item => renderNavLink(item));
  }



  return (
    <div className="premium-sidenav-category mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="premium-sidenav-category-trigger flex w-full items-center justify-between gap-3 px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider transition-colors hover:text-slate-800"
      >
        <div className="flex items-center gap-3">
          <cat.icon className={`h-4 w-4 ${cat.color || 'text-slate-400'}`} strokeWidth={2} />
          <span className="text-left">{cat.label}</span>
        </div>
        <ChevronDown 
          className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} 
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="premium-sidenav-category-items mt-1 flex flex-col gap-1 ml-[18px] border-l-2 border-slate-100 pl-3 py-1">
              {cat.items.map((item, i) => (
                <motion.div
                  key={item.to}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  transition={{ duration: 0.12, delay: i * 0.02, ease: 'easeOut' }}
                >
                  {renderNavLink(item)}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function DashboardLayout({ children }) {
  const { activeSemester, setActiveSemester, activeAcademicYear, setActiveAcademicYear, operationalAcademicYear, availableAcademicYearsList, refreshData, loading } = useApp();
  const { adminUser, hasPermission, logout: adminAuthLogout, changePassword } = useAdminAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const location = useLocation();
  const showAcademicYearSelector = isAcademicYearScopedPath(location.pathname);
  const scrollRef = useRef(null);
  const sidebarRef = useRef(null);
  const isOnline = useOnlineStatus();

  // Change password modal state
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    if (newPasswordInput.length < 6) {
      setPwdError("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPwdError("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    setPwdLoading(true);
    const res = await changePassword(newPasswordInput);
    setPwdLoading(false);
    if (res.success) {
      setPwdSuccess("Mot de passe mis à jour avec succès !");
      setTimeout(() => {
        setIsChangePasswordModalOpen(false);
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        setPwdSuccess('');
      }, 1500);
    } else {
      setPwdError(res.error || "Erreur lors du changement de mot de passe.");
    }
  };

  // Filter navigation items by user permissions
  const visibleNavCategories = useMemo(() => {
    return NAV_CATEGORIES.map(cat => {
      const visibleItems = cat.items.filter(item => {
        if (!item.pageKey) return true;
        return hasPermission(item.pageKey, 'view');
      });
      return {
        ...cat,
        items: visibleItems
      };
    }).filter(cat => cat.items.length > 0);
  }, [hasPermission]);

  // Click outside to close sidebar (Desktop)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (window.innerWidth < 1024) return;
      if (sidebarRef.current && sidebarRef.current.contains(e.target)) return;
      if (e.target.closest('.desktop-menu-btn')) return;
      if (isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSidebarOpen]);

  // Scroll to top on route change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  const handleMainScroll = (e) => {
    if (e.target.scrollTop > 300) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const renderNavLink = (item, isMobile = false) => {
    const isActive = location.pathname === item.to;
    const isCollapsed = !isMobile && !isSidebarOpen;
    return (
      <Link 
        key={item.to} 
        to={item.to}
        onMouseEnter={() => preloadRoute(item.to)}
        onFocus={() => preloadRoute(item.to)}
        onTouchStart={() => preloadRoute(item.to)}
        onClick={() => isMobile && setIsMobileMenuOpen(false)}
        className={`premium-sidenav-link group relative flex items-center rounded-full text-sm font-medium transition-all duration-200 ${
          isCollapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2 w-full'
        } ${
          isActive 
            ? 'is-active text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        {isActive && (
          <motion.div
            layoutId="activeNavBubble"
            className="premium-sidenav-active-bubble absolute inset-0 rounded-full bg-primary shadow-md shadow-primary/30"
            initial={false}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            style={{ zIndex: 0 }}
          />
        )}

        <div className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center transition-transform duration-200 ${isActive ? 'text-white' : item.color || 'text-slate-500'} group-hover:scale-110`}>
          <item.icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
        </div>
        
        {((!isMobile && isSidebarOpen) || isMobile) && (
          <span className="relative z-10 whitespace-nowrap transition-transform duration-200 group-hover:translate-x-1">
            {item.label}
          </span>
        )}

        {/* Tooltip for reduced menu */}
        {!isMobile && !isSidebarOpen && (
          <div className="absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 backdrop-blur-md border border-white/20 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white opacity-0 scale-90 shadow-[0_8px_20px_rgba(139,92,246,0.3)] transition-all duration-300 ease-out group-hover:ml-4 group-hover:scale-100 group-hover:opacity-100 z-[100] pointer-events-none whitespace-nowrap">
            {item.label}
          </div>
        )}
      </Link>
    );
  };

  return (
    <div className="premium-dashboard-layout flex min-h-screen bg-transparent font-sans text-foreground">
      
      {/* Desktop Sidebar (Simple) */}
      <motion.aside
        ref={sidebarRef}
        className={`premium-sidenav desktop-sidebar border-r border-slate-200 bg-white ${isSidebarOpen ? 'is-open' : 'is-collapsed'}`}
        initial={false}
        animate={{ width: isSidebarOpen ? '260px' : '72px' }}
        transition={{ duration: 0.12 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 40,
        }}
      >
        <div className="premium-sidenav-brand flex h-[64px] items-center border-b border-slate-200 px-5" style={{ justifyContent: isSidebarOpen ? 'space-between' : 'center', padding: isSidebarOpen ? '0 20px' : '0' }}>
          <Link to="/" className="premium-sidenav-logo flex items-center">
            <Logo size={isSidebarOpen ? 28 : 32} showText={isSidebarOpen} />
          </Link>
        </div>

        <nav className={`premium-sidenav-nav no-scrollbar flex flex-1 flex-col gap-1 p-4 ${isSidebarOpen ? 'overflow-y-auto' : 'overflow-visible'}`}>
          {visibleNavCategories.map((cat, ci) => (
            <SidebarCategory key={ci} cat={cat} isSidebarOpen={isSidebarOpen} renderNavLink={renderNavLink} location={location} isMobile={false} />
          ))}
        </nav>
      </motion.aside>

      {/* Main Content Area */}
      <div className="premium-layout-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* Simple Flat Header */}
        <header className="premium-topbar flex h-[64px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6" style={{ zIndex: 30 }}>
          <div className="premium-topbar-start" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Desktop toggler */}
            <button 
              className="premium-layout-toggle desktop-menu-btn"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label={isSidebarOpen ? "Réduire le menu" : "Développer le menu"}
            >
              <span className="premium-layout-toggle-glow" aria-hidden="true" />
              <span className="premium-layout-toggle-icon">
                <ChevronLeft
                  size={18}
                  style={{ transform: isSidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.16s' }}
                />
              </span>
            </button>

            {/* Mobile toggler */}
            <button 
              className="premium-layout-toggle mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Ouvrir le menu mobile"
              style={{
                width: '36px', height: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                background: 'var(--white)', color: 'var(--text-secondary)', display: 'none', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <Menu size={20} />
            </button>
          </div>

          <div className="premium-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Offline badge */}
            <AnimatePresence>
              {!isOnline && (
                <motion.div
                  className="premium-topbar-offline"
                  initial={{ opacity: 0, scale: 0.85, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.85, x: 10 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  <WifiOff size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>
                    Hors ligne
                  </span>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, animation: 'pulse 1.8s ease-in-out infinite' }} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Academic Year Selector */}
            {showAcademicYearSelector && availableAcademicYearsList && availableAcademicYearsList.length > 0 && (
              <div className="premium-topbar-semester premium-topbar-academic-year">
                <span className="premium-topbar-semester-label">Année académique</span>
                <AcademicYearSelector
                  activeYear={activeAcademicYear}
                  operationalYear={operationalAcademicYear}
                  availableYears={availableAcademicYearsList}
                  onChange={setActiveAcademicYear}
                />
              </div>
            )}

            {/* Semester Toggle Component */}
            {activeSemester && setActiveSemester && (
              <div className="premium-topbar-semester">
                <span className="premium-topbar-semester-label">Semestre actif</span>
                <SemesterToggle activeSemester={activeSemester} onChange={setActiveSemester} compact />
              </div>
            )}

            <button type="button" className="btn-modern" onClick={refreshData} disabled={loading || !isOnline}
              title="Actualiser les données depuis le serveur" aria-label="Actualiser les données">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* User Profile Mini */}
            <div className="premium-topbar-profile" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '16px', borderLeft: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', maxWidth: '160px' }}>
                <span style={{ 
                  fontSize: '12px',
                  fontWeight: '800',
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {adminUser?.displayName || 'Administrateur'}
                </span>
                <span style={{
                  fontSize: '9px',
                  color: ROLE_PRESETS[adminUser?.role]?.color || 'var(--primary)',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}>
                  {ROLE_PRESETS[adminUser?.role]?.label || (adminUser?.role === 'admin' ? 'Super Admin' : 'Utilisateur')}
                </span>
              </div>

              <div
                style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: `${ROLE_PRESETS[adminUser?.role]?.color || '#3b82f6'}15`,
                  border: `1px solid ${ROLE_PRESETS[adminUser?.role]?.color || '#3b82f6'}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: ROLE_PRESETS[adminUser?.role]?.color || '#3b82f6', flexShrink: 0,
                  fontWeight: '800', fontSize: '13px'
                }}
                title={adminUser?.email}
              >
                {(adminUser?.displayName || adminUser?.email || 'A').charAt(0).toUpperCase()}
              </div>

              {/* Change Password Button */}
              <button
                type="button"
                onClick={() => {
                  setPwdError('');
                  setPwdSuccess('');
                  setNewPasswordInput('');
                  setConfirmPasswordInput('');
                  setIsChangePasswordModalOpen(true);
                }}
                className="premium-topbar-logout"
                data-tooltip="Modifier mon mot de passe"
                aria-label="Modifier mon mot de passe"
                title="Modifier mon mot de passe"
                style={{ color: 'var(--text-muted)' }}
              >
                <KeyRound size={17} />
              </button>

              {/* Premium Logout Button */}
              <button
                type="button"
                onClick={async () => {
                  if (adminAuthLogout) await adminAuthLogout();
                }}
                className="premium-topbar-logout"
                data-tooltip="Se déconnecter"
                aria-label="Se déconnecter"
                title="Se déconnecter"
              >
                <Power size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Scroll Area */}
        <main className="premium-main-scroll" ref={scrollRef} onScroll={handleMainScroll} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px' }}>
          <div className="max-w-container" style={{ 
            padding: 0, 
            maxWidth: isSidebarOpen ? '1200px' : '100%', 
            transition: 'max-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' 
          }}>
            <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
            
            <footer className="premium-app-footer" style={{ textAlign: 'center', padding: '48px 0 24px', marginTop: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                <School size={14} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Institut Polytechnique de la Formation Professionnelle
                </span>
              </div>
              <p style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-faint)', letterSpacing: '0.08em' }}>IPFP Manager · 2026</p>
            </footer>
          </div>
        </main>
      </div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="premium-scrolltop-wrap"
          >
            <button 
              onClick={scrollToTop}
              className="premium-scrolltop-button"
              type="button"
              aria-label="Retour en haut"
              title="Retour en haut"
            >
              <span className="premium-scrolltop-glow" aria-hidden="true" />
              <ArrowUp size={20} strokeWidth={2.8} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100 }}
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Drawer Panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.2 }}
            className="premium-sidenav premium-mobile-sidenav fixed inset-y-0 left-0 z-[101] flex w-[280px] flex-col border-r border-slate-200 bg-white shadow-xl"
          >
            <div className="premium-sidenav-brand flex h-[64px] shrink-0 items-center justify-between border-b border-slate-200 px-5">
               <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center">
                 <Logo size={28} showText={true} />
              </Link>
              <button onClick={() => setIsMobileMenuOpen(false)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="premium-sidenav-nav no-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              {visibleNavCategories.map((cat, ci) => (
                <SidebarCategory key={ci} cat={cat} isSidebarOpen={true} renderNavLink={(item) => renderNavLink(item, true)} location={location} isMobile={true} />
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Change Password */}
      <AnimatePresence>
        {isChangePasswordModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card max-w-md w-full p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Modifier mon Mot de Passe
                    </h3>
                    <p className="text-xs text-slate-400">{adminUser?.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangePasswordModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {pwdError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{pwdError}</span>
                </div>
              )}

              {pwdSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2">
                  <ShieldCheck size={16} />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      placeholder="Minimum 6 caractères"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="input-premium w-full py-2 pl-3 pr-10 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Confirmer le nouveau mot de passe
                  </label>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    placeholder="Répétez le mot de passe"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className="input-premium w-full py-2 px-3 text-sm"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsChangePasswordModalOpen(false)}
                    className="btn-modern secondary text-xs"
                    disabled={pwdLoading}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="btn-modern primary text-xs"
                    disabled={pwdLoading}
                  >
                    {pwdLoading ? 'Mise à jour...' : 'Mettre à jour'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 1024px) {
          .desktop-menu-btn { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .desktop-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  );
}
