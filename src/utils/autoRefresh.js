import { READ_TTL_MS } from './readCoordinator.js';

export function startAutoRefresh({
  refresh,
  intervalMs = READ_TTL_MS,
  windowTarget = window,
  documentTarget = document,
  now = Date.now,
}) {
  let lastRefresh = now();
  const check = () => {
    if (documentTarget.visibilityState !== 'visible' || windowTarget.navigator.onLine === false) return;
    if (now() - lastRefresh < intervalMs) return;
    lastRefresh = now();
    refresh();
  };
  const timer = windowTarget.setInterval(check, intervalMs);
  windowTarget.addEventListener('focus', check);
  windowTarget.addEventListener('online', check);
  documentTarget.addEventListener('visibilitychange', check);
  return () => {
    windowTarget.clearInterval(timer);
    windowTarget.removeEventListener('focus', check);
    windowTarget.removeEventListener('online', check);
    documentTarget.removeEventListener('visibilitychange', check);
  };
}
