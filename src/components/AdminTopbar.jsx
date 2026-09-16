import { ChevronLeft, LogOut, Menu, WifiOff } from 'lucide-react';
import { AcademicYearSelector } from './AcademicYearSelector';
import { SemesterToggle } from './SemesterToggle';
import { ROLE_PRESETS } from '../services/userService';
import './AdminTopbar.css';

export default function AdminTopbar({
  pageTitle, isSidebarOpen, onToggleSidebar, onOpenMobileMenu, isOnline,
  showAcademicYearSelector, activeAcademicYear, operationalAcademicYear,
  availableAcademicYearsList, onAcademicYearChange, activeSemester, onSemesterChange,
  adminUser, onLogout,
}) {
  return (
    <header className="admin-toolbar">
      <div className="admin-toolbar-start">
        <button type="button" className="admin-toolbar-menu desktop-menu-btn" onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Réduire le menu' : 'Développer le menu'} aria-expanded={isSidebarOpen}>
          <ChevronLeft size={18} style={{ transform: isSidebarOpen ? undefined : 'rotate(180deg)' }} />
        </button>
        <button type="button" className="admin-toolbar-menu mobile-menu-btn" onClick={onOpenMobileMenu} aria-label="Ouvrir le menu mobile">
          <Menu size={19} />
        </button>
        <div className="admin-toolbar-title">
          <span>Espace de gestion</span>
          <strong>{pageTitle || 'IPFP'}</strong>
        </div>
      </div>

      <div className="admin-toolbar-filters" role="group" aria-label="Période académique">
        {showAcademicYearSelector && availableAcademicYearsList?.length > 0 && (
          <div className="admin-toolbar-field">
            <span className="admin-toolbar-label">Année académique</span>
            <AcademicYearSelector activeYear={activeAcademicYear} operationalYear={operationalAcademicYear}
              availableYears={availableAcademicYearsList} onChange={onAcademicYearChange} />
          </div>
        )}
        {activeSemester && onSemesterChange && (
          <div className="admin-toolbar-field">
            <span className="admin-toolbar-label">Semestre</span>
            <SemesterToggle activeSemester={activeSemester} onChange={onSemesterChange} compact />
          </div>
        )}
      </div>

      <div className="admin-toolbar-session">
        {!isOnline && <span className="admin-toolbar-offline" role="status" title="Hors ligne"><WifiOff size={16} /><span>Hors ligne</span></span>}
        <div className="admin-toolbar-user">
          <span className="admin-toolbar-avatar" aria-hidden="true">{(adminUser?.displayName || adminUser?.email || 'A').charAt(0).toUpperCase()}</span>
          <div>
            <strong>{adminUser?.displayName || 'Administrateur'}</strong>
            <span>{ROLE_PRESETS[adminUser?.role]?.label || 'Utilisateur'}</span>
          </div>
        </div>
        <button type="button" className="admin-toolbar-logout" onClick={onLogout} aria-label="Se déconnecter" title="Se déconnecter">
          <LogOut size={17} /><span>Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
