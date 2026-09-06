import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ShieldAlert, ArrowLeft, School } from 'lucide-react';
import { APP_MODULES } from '../services/userService';

const PageLoader = () => (
  <div className="app-loader-shell">
    <div className="app-loader" role="status" aria-label="Chargement">
      <span className="app-loader-ring app-loader-ring-primary" />
      <span className="app-loader-ring app-loader-ring-secondary" />
      <span className="app-loader-core">
        <School size={22} />
      </span>
    </div>
  </div>
);

export const ProtectedRoute = ({ children, pageKey, requiredLevel = 'view' }) => {
  const { isAuthenticated, hasPermission, loading, adminUser } = useAdminAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (pageKey && !hasPermission(pageKey, requiredLevel)) {
    return (
      <div className="flex-center" style={{ minHeight: '70vh', padding: '40px 20px' }}>
        <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '36px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <ShieldAlert size={32} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Accès Restreint
          </h2>

          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
            Votre compte ({adminUser?.displayName || adminUser?.email}) avec le rôle <strong>{adminUser?.role || 'Utilisateur'}</strong> ne dispose pas des droits nécessaires pour accéder à cette page.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link to={APP_MODULES.find(module => hasPermission(module.id))?.path || '/login'} className="btn-modern secondary" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>
    {pageKey && !hasPermission(pageKey, 'edit') && <div role="status" className="glass-card" style={{ padding: '12px 20px', marginBottom: 16 }}>
      Lecture seule : votre compte peut consulter cette page, mais ne peut pas enregistrer de modifications.
    </div>}
    {children}
  </>;
};

export default ProtectedRoute;
