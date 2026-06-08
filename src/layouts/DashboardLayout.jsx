import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import Logo from '../components/Logo';
import { SemesterToggle } from '../components/SemesterToggle';
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
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  School,
  WifiOff,
  Wand2,
<<<<<<< HEAD
  ArrowUp,
  GraduationCap
=======
  
>>>>>>> 4061257ff9d461b0c9e2868ec1e40941f3c13e49
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
      { to: "/", icon: Home, label: "Tableau de bord", color: "text-blue-500" },
    ]
  },
  {
    label: "Pôle Académique",
    icon: Library,
    color: "text-violet-500",
    items: [
      { to: "/admin/modules", icon: Boxes, label: "Modules", color: "text-violet-500" },
      { to: "/admin/grades", icon: PenTool, label: "Notes", color: "text-amber-500" },
      { to: "/admin/reports", icon: LineChart, label: "Rapports", color: "text-emerald-500" },
      { to: "/admin/schedules", icon: CalendarDays, label: "Emplois du Temps", color: "text-orange-500" },
      { to: "/admin/schedule-generation", icon: Wand2, label: "Génération (EDT)", color: "text-fuchsia-500" },
    ]
  },
  {
    label: "Suivi de Présence",
    icon: ClipboardList,
    color: "text-rose-500",
    items: [
      { to: "/admin/attendance-students", icon: UserX, label: "Absences Stagiaires", color: "text-rose-500" },
      { to: "/admin/attendance-teachers", icon: UserCheck, label: "Présences Formateurs", color: "text-teal-500" },
    ]
  },
  {
    label: "Administration",
    icon: Settings,
    color: "text-indigo-500",
    items: [
      { to: "/admin/students", icon: Users, label: "Stagiaires", color: "text-sky-500" },
      { to: "/admin/teachers", icon: Presentation, label: "Formateurs", color: "text-indigo-500" },
      { to: "/admin/finance", icon: Wallet, label: "Finance", color: "text-green-600" },
      { to: "/admin/continuous", icon: GraduationCap, label: "Formations Continues", color: "text-purple-500" },
    ]
  }
];

const SidebarCategory = ({ cat, isSidebarOpen, renderNavLink, location, isMobile }) => {
  if (cat.items.length === 1) {
    return renderNavLink(cat.items[0]);
  }
  
  const isAnyActive = cat.items.some(item => location.pathname === item.to);
  const [open, setOpen] = React.useState(isAnyActive);
  
  React.useEffect(() => {
    if (isAnyActive) setOpen(true);
  }, [isAnyActive]);

  if (!isSidebarOpen && !isMobile) {
    return cat.items.map(item => renderNavLink(item));
  }

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider transition-colors hover:text-slate-800"
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
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-1 flex flex-col gap-1 ml-[18px] border-l-2 border-slate-100 pl-3 py-1">
              {cat.items.map((item, i) => (
                <motion.div
                  key={item.to}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  transition={{ duration: 0.2, delay: i * 0.04, ease: 'easeOut' }}
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
  const { logout, notifications, markNotificationAsRead, clearNotifications, activeSemester, setActiveSemester } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const location = useLocation();
  const scrollRef = useRef(null);
  const sidebarRef = useRef(null);
  const isOnline = useOnlineStatus();

  // Click outside to close sidebar (Desktop)
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Ignore on mobile (handled by overlay)
      if (window.innerWidth < 1024) return;
      // Ignore if clicking inside sidebar
      if (sidebarRef.current && sidebarRef.current.contains(e.target)) return;
      // Ignore if clicking the toggle button
      if (e.target.closest('.desktop-menu-btn')) return;
      
      // Close sidebar if open
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

  const unreadCount = (notifications || []).filter(n => !n.read).length;

  const renderNavLink = (item, isMobile = false) => {
    const isActive = location.pathname === item.to;
    const isCollapsed = !isMobile && !isSidebarOpen;
    
    return (
      <Link 
        key={item.to} 
        to={item.to}
        onClick={() => isMobile && setIsMobileMenuOpen(false)}
        className={`group relative flex items-center rounded-full text-sm font-medium transition-all duration-200 ${
          isCollapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-3 px-3 py-2 w-full'
        } ${
          isActive 
            ? 'text-white' 
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        {isActive && (
          <motion.div
            layoutId="activeNavBubble"
            className="absolute inset-0 rounded-full bg-primary shadow-md shadow-primary/30"
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
    <div className="flex min-h-screen bg-transparent font-sans text-foreground">
      
      {/* Desktop Sidebar (Simple) */}
      <motion.aside
        ref={sidebarRef}
        className="desktop-sidebar border-r border-slate-200 bg-white"
        initial={false}
        animate={{ width: isSidebarOpen ? '260px' : '72px' }}
        transition={{ duration: 0.2 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 40,
        }}
      >
        <div className="flex h-[64px] items-center border-b border-slate-200 px-5" style={{ justifyContent: isSidebarOpen ? 'space-between' : 'center', padding: isSidebarOpen ? '0 20px' : '0' }}>
          <Link to="/" className="flex items-center">
            <Logo size={isSidebarOpen ? 28 : 32} showText={isSidebarOpen} />
          </Link>
        </div>

        <nav className={`no-scrollbar flex flex-1 flex-col gap-1 p-4 ${isSidebarOpen ? 'overflow-y-auto' : 'overflow-visible'}`}>
          {NAV_CATEGORIES.map((cat, ci) => (
            <SidebarCategory key={ci} cat={cat} isSidebarOpen={isSidebarOpen} renderNavLink={renderNavLink} location={location} isMobile={false} />
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 shrink-0">
           <button 
             onClick={logout} 
             className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
             style={{ justifyContent: isSidebarOpen ? 'flex-start' : 'center' }}
           >
             <Power className="h-4 w-4" />
             {isSidebarOpen && <span>Déconnexion</span>}
           </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#faf8fc' }}>
        
        {/* Simple Flat Header */}
        <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6" style={{ zIndex: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Desktop toggler */}
            <button 
              className="desktop-menu-btn"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label={isSidebarOpen ? "Réduire le menu" : "Développer le menu"}
              style={{
                width: '36px', height: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                background: 'var(--white)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                transition: 'all 0.2s', boxShadow: 'var(--shadow-xs)'
              }}
            >
             <ChevronLeft 
                size={18} 
                style={{ transform: isSidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }} 
              />
            </button>

            {/* Mobile toggler */}
            <button 
              className="mobile-menu-btn"
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Offline badge */}
            <AnimatePresence>
              {!isOnline && (
                <motion.div
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

            {/* Semester Toggle Component */}
            {activeSemester && setActiveSemester && (
              <SemesterToggle activeSemester={activeSemester} onChange={setActiveSemester} compact />
            )}

            {/* User Profile Mini */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '16px', borderLeft: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', maxWidth: '180px', alignItems: 'center' }}>
                <span style={{ 
                  fontSize: '10.5px', 
                  fontWeight: '900', 
                  textTransform: 'uppercase',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #eab308 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '0.02em',
                  lineHeight: '1.3'
                }}>
                  Institut polytechnique de la formation professionnelle privée
                </span>
                <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '1px' }}>
                  Espace Direction
                </span>
              </div>
              <div style={{ 
                width: '38px', height: '38px', borderRadius: '12px', 
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(234, 179, 8, 0.15) 100%)', 
                border: '1px solid rgba(139, 92, 246, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                color: '#8b5cf6', flexShrink: 0 
              }}>
                <School size={18} />
              </div>
            </div>
          </div>
        </header>

        {/* Content Scroll Area */}
        <main ref={scrollRef} onScroll={handleMainScroll} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px' }}>
          <div className="max-w-container" style={{ 
            padding: 0, 
            maxWidth: isSidebarOpen ? '1200px' : '100%', 
            transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
          }}>
            <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.4 }}
            >
              {children}
            </motion.div>
            
            <footer style={{ textAlign: 'center', padding: '48px 0 24px', marginTop: '40px' }}>
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
            style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 90 }}
          >
            <button 
              onClick={scrollToTop}
              className="btn-modern primary"
              style={{ width: '44px', height: '44px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', boxShadow: '0 8px 24px rgba(79, 70, 229, 0.25)' }}
            >
              <ArrowUp size={20} />
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
            className="fixed inset-y-0 left-0 z-[101] flex w-[280px] flex-col border-r border-slate-200 bg-white shadow-xl"
          >
            <div className="flex h-[64px] shrink-0 items-center justify-between border-b border-slate-200 px-5">
               <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center">
                 <Logo size={28} showText={true} />
              </Link>
              <button onClick={() => setIsMobileMenuOpen(false)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="no-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              {NAV_CATEGORIES.map((cat, ci) => (
                <SidebarCategory key={ci} cat={cat} isSidebarOpen={true} renderNavLink={(item) => renderNavLink(item, true)} location={location} isMobile={true} />
              ))}
            </nav>
            <div className="border-t border-slate-200 p-4 shrink-0">
              <button 
                onClick={() => { logout(); setIsMobileMenuOpen(false); }} 
                className="flex w-full items-center justify-center gap-2 rounded-md bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
              >
                <Power className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
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
