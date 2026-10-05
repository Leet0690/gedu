import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import Logo from '../components/Logo';
import AdminTopbar from '../components/AdminTopbar';
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
  X, 
  ChevronDown, 
  School,
  Wand2,
  ArrowUp,
  GraduationCap,
  ShieldCheck,
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
    color: "text-brand-500",
    items: [
      { to: "/admin/modules", icon: Boxes, label: "Modules", color: "text-brand-500", pageKey: 'modules' },
      { to: "/admin/grades", icon: PenTool, label: "Notes", color: "text-amber-500", pageKey: 'grades' },
      { to: "/admin/reports", icon: LineChart, label: "Rapports", color: "text-emerald-500", pageKey: 'reports' },
      { to: "/admin/schedules", icon: CalendarDays, label: "Emplois du Temps", color: "text-orange-500", pageKey: 'schedules' },
      // { to: "/admin/schedule-generation", icon: Wand2, label: "Génération (EDT)", color: "text-brand-500", pageKey: 'schedule_generation' },
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
    color: "text-brand-500",
    items: [
      { to: "/admin/students", icon: Users, label: "Stagiaires", color: "text-sky-500", pageKey: 'students' },
      { to: "/admin/teachers", icon: Presentation, label: "Formateurs", color: "text-brand-500", pageKey: 'teachers' },
      { to: "/admin/continuous", icon: GraduationCap, label: "Formations Continues", color: "text-brand-500", pageKey: 'continuous' },
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
  const { activeSemester, setActiveSemester, activeAcademicYear, setActiveAcademicYear, operationalAcademicYear, availableAcademicYearsList } = useApp();
  const { adminUser, hasPermission, logout: adminAuthLogout } = useAdminAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const location = useLocation();
  const showAcademicYearSelector = isAcademicYearScopedPath(location.pathname);
  const scrollRef = useRef(null);
  const sidebarRef = useRef(null);
  const isOnline = useOnlineStatus();

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
          <div className="premium-nav-tooltip absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-lg backdrop-blur-md border border-white/20 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white opacity-0 scale-90 shadow-elevated transition-all duration-300 ease-out group-hover:ml-4 group-hover:scale-100 group-hover:opacity-100 z-[100] pointer-events-none whitespace-nowrap">
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
          <Link to="/" className="premium-sidenav-logo flex items-center" aria-label="IPFPP — Accueil">
            <Logo size={44} showText={isSidebarOpen} onDark />
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
        
        <AdminTopbar
          pageTitle={visibleNavCategories.flatMap(category => category.items).find(item => item.to === location.pathname)?.label}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(previous => !previous)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          isOnline={isOnline}
          showAcademicYearSelector={showAcademicYearSelector}
          activeAcademicYear={activeAcademicYear}
          operationalAcademicYear={operationalAcademicYear}
          availableAcademicYearsList={availableAcademicYearsList}
          onAcademicYearChange={setActiveAcademicYear}
          activeSemester={activeSemester}
          onSemesterChange={setActiveSemester}
          adminUser={adminUser}
          onLogout={adminAuthLogout}
        />

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
              <p style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-faint)', letterSpacing: '0.08em' }}>IPFPP Manager · 2026</p>
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
                 <Logo size={44} showText={true} onDark />
              </Link>
              <button aria-label="Fermer le menu" onClick={() => setIsMobileMenuOpen(false)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
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
