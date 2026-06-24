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
        <div className="app-modal-overlay app-update-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 10, 25, 0.45)',
          backdropFilter: 'blur(10px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 15 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            role="status"
            aria-live="polite"
            className="app-modal-surface app-update-modal"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(250, 248, 255, 0.85))',
              border: '1px solid rgba(124, 58, 237, 0.16)',
              borderRadius: '28px',
              boxShadow: '0 32px 70px rgba(76, 29, 149, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              padding: '40px 32px',
              maxWidth: '430px',
              width: '100%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <span 
              style={{ 
                color: 'var(--primary)', 
                fontWeight: '900', 
                fontSize: '10px', 
                background: 'rgba(124, 58, 237, 0.08)',
                padding: '5px 14px',
                borderRadius: '100px',
                border: '1px solid rgba(124, 58, 237, 0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              <Sparkles size={11} /> Mise à jour PWA
            </span>

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
                border: '2.5px solid rgba(124, 58, 237, 0.35)',
                animation: 'update-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
              }} />
              {/* Center counter circle */}
              <div style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '38px',
                fontWeight: '950',
                color: '#ffffff',
                boxShadow: '0 12px 30px rgba(124, 58, 237, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                zIndex: 2,
              }}>
                {secondsLeft}
              </div>
            </div>

            <div>
              <h2 style={{
                fontSize: '21px',
                fontWeight: '950',
                color: 'var(--text-primary)',
                margin: '0 0 8px 0',
                letterSpacing: '-0.02em',
              }}>
                Nouvelle version en ligne
              </h2>
              <p style={{
                fontSize: '13.5px',
                color: 'var(--text-secondary)',
                lineHeight: '1.55',
                margin: 0,
                fontWeight: '600'
              }}>
                Une mise à jour importante est disponible. L'application va s'actualiser automatiquement afin de charger la dernière version.
              </p>
            </div>

            <button
              type="button"
              onClick={reloadApp}
              className="app-update-action-button"
            >
              <span className="app-update-action-icon" aria-hidden="true">
                <RefreshCw size={15} />
              </span>
              <span className="app-update-action-copy">
                <span>Actualiser</span>
                <strong>immédiatement</strong>
              </span>
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PWAUpdatePrompt;
