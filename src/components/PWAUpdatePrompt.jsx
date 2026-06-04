import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Sparkles } from 'lucide-react';

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;
const REFRESH_DELAY_SECONDS = 8;

const PWAUpdatePrompt = () => {
  const reloadingRef = React.useRef(false);
  const [showUpdateNotice, setShowUpdateNotice] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(REFRESH_DELAY_SECONDS);

  const showReloadNotice = React.useCallback(() => {
    if (reloadingRef.current) return;
    setSecondsLeft(REFRESH_DELAY_SECONDS);
    setShowUpdateNotice(true);
  }, []);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload() {
      showReloadNotice();
    },
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      const checkForUpdate = async () => {
        if (!navigator.onLine || reloadingRef.current) return;

        try {
          const response = await fetch(swUrl, { cache: 'no-store' });
          if (response.status === 200) {
            await registration.update();
          }
        } catch {
          // Ignore transient network errors; the next interval will retry.
        }
      };

      checkForUpdate();
      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
    },
  });

  const reloadApp = React.useCallback(async () => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;

    await updateServiceWorker(true);
    setTimeout(() => window.location.reload(), 350);
  }, [updateServiceWorker]);

  React.useEffect(() => {
    if (needRefresh) {
      showReloadNotice();
    }
  }, [needRefresh, showReloadNotice]);

  React.useEffect(() => {
    if (!showUpdateNotice) return undefined;

    if (secondsLeft <= 0) {
      reloadApp();
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft(current => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [reloadApp, secondsLeft, showUpdateNotice]);

  return (
    <AnimatePresence>
      {showUpdateNotice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            role="status"
            aria-live="polite"
            style={{
              background: '#ffffff',
              border: '1px solid rgba(176,104,185,0.3)',
              borderRadius: '24px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
              padding: '40px 32px',
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '28px',
            }}
          >
            <div style={{
              position: 'relative',
              width: '110px',
              height: '110px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {/* Outer pulsing ring */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '50%',
                border: '2px solid var(--primary-light)',
                opacity: 0.6,
                animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
              }} />
              {/* Center counter circle */}
              <div style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'var(--primary-ultra-light)',
                border: '3px solid var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                fontWeight: '900',
                color: 'var(--primary)',
                boxShadow: '0 10px 25px rgba(176, 104, 185, 0.15)',
                zIndex: 2,
              }}>
                {secondsLeft}
              </div>
            </div>

            <div>
              <h2 style={{
                fontSize: '22px',
                fontWeight: '800',
                color: '#111827',
                margin: '0 0 10px 0',
                letterSpacing: '-0.01em',
              }}>
                Nouvelle version disponible !
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#4b5563',
                lineHeight: '1.5',
                margin: 0,
              }}>
                Une mise à jour de l'application a été déployée. Pour éviter tout dysfonctionnement, la page s'actualisera automatiquement.
              </p>
            </div>

            <button
              type="button"
              onClick={reloadApp}
              className="btn-modern primary"
              style={{
                width: '100%',
                padding: '14px 28px',
                borderRadius: '16px',
                fontSize: '15px',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(176, 104, 185, 0.25)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              <RefreshCw size={16} />
              Actualiser maintenant
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PWAUpdatePrompt;
