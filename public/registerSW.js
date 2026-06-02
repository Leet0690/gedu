(() => {
  if (!('serviceWorker' in navigator)) return;

  const updateInterval = 5 * 60 * 1000;
  const refreshDelaySeconds = 8;
  let reloading = false;
  let noticeShown = false;

  const reloadOnce = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  const showReloadNotice = () => {
    if (noticeShown || reloading) return;
    noticeShown = true;

    let secondsLeft = refreshDelaySeconds;
    const container = document.createElement('div');
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:24px',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'display:flex',
      'align-items:center',
      'gap:14px',
      'max-width:calc(100vw - 32px)',
      'width:max-content',
      'padding:14px 18px',
      'border-radius:16px',
      'background:#ffffff',
      'border:1px solid rgba(176,104,185,0.25)',
      'box-shadow:0 8px 32px rgba(0,0,0,0.14)',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'color:#1f2937',
    ].join(';');

    const content = document.createElement('div');
    content.style.cssText = 'min-width:0';

    const title = document.createElement('p');
    title.textContent = 'Nouvelle version disponible';
    title.style.cssText = 'margin:0;font-size:13px;font-weight:800;white-space:nowrap';

    const message = document.createElement('p');
    message.style.cssText = 'margin:2px 0 0;font-size:12px;color:#6b7280;white-space:nowrap';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Maintenant';
    button.style.cssText = [
      'flex-shrink:0',
      'padding:7px 14px',
      'border-radius:999px',
      'border:0',
      'background:#b068b9',
      'color:#ffffff',
      'font-size:12px',
      'font-weight:800',
      'cursor:pointer',
    ].join(';');
    button.addEventListener('click', reloadOnce);

    const updateMessage = () => {
      message.textContent = `La page va se rafraichir automatiquement dans ${secondsLeft}s.`;
    };

    content.append(title, message);
    container.append(content, button);
    document.body.appendChild(container);
    updateMessage();

    const timer = window.setInterval(() => {
      secondsLeft -= 1;
      updateMessage();

      if (secondsLeft <= 0) {
        window.clearInterval(timer);
        reloadOnce();
      }
    }, 1000);
  };

  const watchWorker = (worker) => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated' && navigator.serviceWorker.controller) {
        showReloadNotice();
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

  navigator.serviceWorker.addEventListener('controllerchange', showReloadNotice);
})();
