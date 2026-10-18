import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  ShieldAlert, 
  RefreshCw, 
  Lock, 
  Database, 
  Server, 
  CheckCircle2, 
  AlertCircle,
  KeyRound
} from 'lucide-react';
import Logo from '../components/Logo';
import { institutionConfig } from '../config/institution';
import { 
  MAINTENANCE_CONFIG, 
  getRemainingTime, 
  setMaintenanceBypass 
} from '../config/maintenance';

const MaintenancePage = () => {
  const [timeLeft, setTimeLeft] = useState(() => getRemainingTime());
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminError, setAdminError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mettre à jour le compte à rebours chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getRemainingTime());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeLeft(getRemainingTime());
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const handleAdminBypassSubmit = (e) => {
    e.preventDefault();
    if (adminCode.trim() === MAINTENANCE_CONFIG.bypassKey) {
      setMaintenanceBypass(true);
      window.location.href = window.location.pathname;
    } else {
      setAdminError('Code de contournement incorrect.');
    }
  };

  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#0f172a',
      backgroundImage: `
        radial-gradient(at 0% 0%, rgba(var(--primary-rgb), 0.22) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(var(--accent-rgb), 0.12) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(30, 41, 59, 0.7) 0px, transparent 100%)
      `,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      boxSizing: 'border-box',
      fontFamily: 'var(--font-sans, Inter, sans-serif)',
      color: '#f8fafc'
    }}>
      {/* Conteneur principal */}
      <div style={{
        width: '100%',
        maxWidth: '780px',
        backgroundColor: 'rgba(30, 41, 59, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: 'clamp(24px, 5vw, 48px)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(var(--primary-rgb), 0.15)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Accent supérieur coloré */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent) 50%, var(--primary) 100%)'
        }} />

        {/* En-tête : Logo & Badge */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '16px',
            display: 'inline-flex',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <Logo size={36} showText={true} />
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fbbf24',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: '700',
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#f59e0b',
              borderRadius: '50%',
              display: 'inline-block',
              boxShadow: '0 0 8px #f59e0b',
              animation: 'pulse 1.8s infinite'
            }} />
            Intervention technique programmée
          </div>
        </div>

        {/* Titre & Description */}
        <h1 style={{
          fontSize: 'clamp(24px, 4vw, 36px)',
          fontWeight: '900',
          letterSpacing: '-0.03em',
          color: '#ffffff',
          marginBottom: '14px',
          lineHeight: 1.2
        }}>
          Plateforme Temporairement en Maintenance
        </h1>

        <p style={{
          fontSize: 'clamp(14px, 2vw, 16px)',
          color: '#94a3b8',
          lineHeight: '1.65',
          maxWidth: '620px',
          margin: '0 auto 36px auto'
        }}>
          {institutionConfig.name} effectue une mise à niveau complète de son infrastructure serveur.
          L'accès à l'ensemble des services (espace formateurs, consultation des bulletins et administration) sera rétabli automatiquement dès la fin du compte à rebours.
        </p>

        {/* SECTION COMPTE À REBOURS (5 HEURES) */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '24px 20px',
          marginBottom: '32px',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#cbd5e1',
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}>
            <Clock size={16} style={{ color: 'var(--accent)' }} />
            <span>Réouverture estimée dans</span>
          </div>

          {timeLeft.isCompleted ? (
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '12px',
              color: '#4ade80'
            }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '18px', fontWeight: '800' }}>Maintenance terminée !</div>
              <div style={{ fontSize: '14px', color: '#cbd5e1', marginTop: '4px' }}>
                La plateforme est prête. Cliquez sur actualiser pour y accéder.
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'clamp(8px, 2vw, 16px)',
              flexWrap: 'nowrap'
            }}>
              {/* HEURES */}
              <div style={{
                backgroundColor: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(var(--primary-rgb), 0.3)',
                borderRadius: '16px',
                padding: 'clamp(12px, 3vw, 20px)',
                minWidth: 'clamp(70px, 18vw, 110px)',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{
                  fontSize: 'clamp(28px, 6vw, 48px)',
                  fontWeight: '900',
                  color: '#ffffff',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1
                }}>
                  {pad(timeLeft.hours)}
                </div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginTop: '8px'
                }}>
                  Heures
                </div>
              </div>

              {/* Séparateur */}
              <div style={{
                fontSize: 'clamp(24px, 5vw, 40px)',
                fontWeight: '900',
                color: '#64748b',
                lineHeight: 1
              }}>:</div>

              {/* MINUTES */}
              <div style={{
                backgroundColor: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(var(--primary-rgb), 0.3)',
                borderRadius: '16px',
                padding: 'clamp(12px, 3vw, 20px)',
                minWidth: 'clamp(70px, 18vw, 110px)',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{
                  fontSize: 'clamp(28px, 6vw, 48px)',
                  fontWeight: '900',
                  color: '#ffffff',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1
                }}>
                  {pad(timeLeft.minutes)}
                </div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginTop: '8px'
                }}>
                  Minutes
                </div>
              </div>

              {/* Séparateur */}
              <div style={{
                fontSize: 'clamp(24px, 5vw, 40px)',
                fontWeight: '900',
                color: '#64748b',
                lineHeight: 1
              }}>:</div>

              {/* SECONDES */}
              <div style={{
                backgroundColor: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(var(--accent-rgb), 0.35)',
                borderRadius: '16px',
                padding: 'clamp(12px, 3vw, 20px)',
                minWidth: 'clamp(70px, 18vw, 110px)',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{
                  fontSize: 'clamp(28px, 6vw, 48px)',
                  fontWeight: '900',
                  color: 'var(--accent)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1
                }}>
                  {pad(timeLeft.seconds)}
                </div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginTop: '8px'
                }}>
                  Secondes
                </div>
              </div>
            </div>
          )}

          {/* Barre de progression */}
          <div style={{ marginTop: '20px' }}>
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '999px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                height: '100%',
                width: `${timeLeft.progressPercent}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                borderRadius: '999px',
                transition: 'width 1s ease'
              }} />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: '#64748b',
              marginTop: '8px'
            }}>
              <span>Fenêtre planifiée : 5 heures</span>
              <span>Progression : {timeLeft.progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* Détails des opérations en cours */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '32px',
          textAlign: 'left'
        }}>
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <Database size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>Base de Données</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Sauvegarde et contrôle d'intégrité</div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <Server size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>Serveurs & Cache</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Optimisation de charge et vitesse</div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <ShieldAlert size={18} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>Sécurité & Chiffrement</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Mise à jour des certificats</div>
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: isRefreshing ? 'wait' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.3)'
            }}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Actualisation...' : 'Actualiser la page'}</span>
          </button>

          <button
            onClick={() => {
              setShowAdminDialog(!showAdminDialog);
              setAdminError('');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'transparent',
              color: '#64748b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Lock size={14} />
            <span>Accès Administrateur</span>
          </button>
        </div>

        {/* Formulaire de contournement administrateur */}
        {showAdminDialog && (
          <form 
            onSubmit={handleAdminBypassSubmit}
            style={{
              marginTop: '24px',
              padding: '16px',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              borderRadius: '14px',
              border: '1px solid rgba(var(--primary-rgb), 0.3)',
              maxWidth: '380px',
              marginLeft: 'auto',
              marginRight: 'auto',
              textAlign: 'left'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#f1f5f9',
              marginBottom: '10px'
            }}>
              <KeyRound size={15} style={{ color: 'var(--accent)' }} />
              <span>Déblocage réservé à l'administrateur</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                placeholder="Code de déblocage"
                value={adminCode}
                onChange={(e) => {
                  setAdminCode(e.target.value);
                  setAdminError('');
                }}
                autoFocus
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: '#ffffff',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--primary-dark)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Valider
              </button>
            </div>

            {adminError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#f87171',
                fontSize: '12px',
                marginTop: '8px'
              }}>
                <AlertCircle size={13} />
                <span>{adminError}</span>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Pied de page */}
      <div style={{
        marginTop: '24px',
        fontSize: '12px',
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 1.5
      }}>
        © {new Date().getFullYear()} {institutionConfig.shortName} — {institutionConfig.name} • Tous droits réservés
      </div>
    </div>
  );
};

export default MaintenancePage;
