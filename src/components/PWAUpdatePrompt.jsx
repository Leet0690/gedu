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
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '14px 18px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-card)',
            border: '1px solid rgba(176,104,185,0.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            maxWidth: 'calc(100vw - 32px)',
            width: 'max-content',
          }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            flexShrink: 0,
            borderRadius: '50%',
            background: 'var(--primary-ultra-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sparkles size={17} style={{ color: 'var(--primary)' }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>
              Nouvelle version disponible
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0', whiteSpace: 'nowrap' }}>
              La page va se rafraichir automatiquement dans {secondsLeft}s.
            </p>
          </div>

          <button
            type="button"
            onClick={reloadApp}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            <RefreshCw size={13} />
            Maintenant
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAUpdatePrompt;
