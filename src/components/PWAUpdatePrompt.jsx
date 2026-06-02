import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;

const PWAUpdatePrompt = () => {
  const reloadingRef = React.useRef(false);

  const reloadApp = React.useCallback(async (updateServiceWorker) => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;

    await updateServiceWorker(true);
    setTimeout(() => window.location.reload(), 500);
  }, []);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload() {
      if (!reloadingRef.current) {
        reloadingRef.current = true;
        window.location.reload();
      }
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

  React.useEffect(() => {
    if (needRefresh) {
      reloadApp(updateServiceWorker);
    }
  }, [needRefresh, reloadApp, updateServiceWorker]);

  return null;
};

export default PWAUpdatePrompt;
