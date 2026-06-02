(() => {
  if (!('serviceWorker' in navigator)) return;

  const updateInterval = 5 * 60 * 1000;
  let reloading = false;

  const reloadOnce = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  const watchWorker = (worker) => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated' && navigator.serviceWorker.controller) {
        reloadOnce();
      }
    });
  };

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      registration.addEventListener('updatefound', () => watchWorker(registration.installing));

      setInterval(() => {
        if (navigator.onLine) {
          registration.update();
        }
      }, updateInterval);
    } catch {
      // Ignore registration errors; the React updater will also try when the app loads.
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);
})();
