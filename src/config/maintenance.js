/**
 * Configuration du mode maintenance et du compte à rebours
 */

export const MAINTENANCE_CONFIG = {
  // Activer ou désactiver le mode maintenance
  enabled: true,

  // Durée totale de la maintenance en millisecondes (5 heures)
  durationMs: 5 * 60 * 60 * 1000,

  // Début et fin de la maintenance programmée
  startTime: '2026-09-10T12:55:00.000Z',
  targetEndTime: '2026-09-10T17:55:00.000Z',

  // Clé secrète pour débloquer l'accès en cas d'urgence administrative
  // Usage : ajouter ?bypass=ipfp2026 dans l'URL ou utiliser le bouton d'accès d'urgence
  bypassKey: 'ipfp2026',
  storageKey: 'ipfp_maintenance_bypass',
};

/**
 * Vérifie si le mode maintenance est actuellement actif
 */
export const isMaintenanceActive = () => {
  return Boolean(MAINTENANCE_CONFIG.enabled);
};

/**
 * Vérifie si la session actuelle dispose d'un contournement autorisé
 * @param {string} searchString - ex: window.location.search
 */
export const isMaintenanceBypassed = (searchString = '') => {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Vérification par paramètre d'URL (?bypass=ipfp2026 ou ?admin_bypass=ipfp2026)
    const params = new URLSearchParams(searchString || window.location.search);
    const bypassParam = params.get('bypass') || params.get('admin_bypass');

    if (bypassParam === MAINTENANCE_CONFIG.bypassKey) {
      sessionStorage.setItem(MAINTENANCE_CONFIG.storageKey, 'true');
      return true;
    }

    // 2. Vérification dans le sessionStorage
    const stored = sessionStorage.getItem(MAINTENANCE_CONFIG.storageKey);
    if (stored === 'true') {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

/**
 * Active ou désactive le contournement dans la session
 */
export const setMaintenanceBypass = (enable = true) => {
  if (typeof window === 'undefined') return;
  try {
    if (enable) {
      sessionStorage.setItem(MAINTENANCE_CONFIG.storageKey, 'true');
    } else {
      sessionStorage.removeItem(MAINTENANCE_CONFIG.storageKey);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
};

/**
 * Calcule le temps restant jusqu'à la fin de la maintenance
 */
export const getRemainingTime = (customTargetTime) => {
  const target = customTargetTime 
    ? new Date(customTargetTime).getTime()
    : new Date(MAINTENANCE_CONFIG.targetEndTime).getTime();

  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      isCompleted: true,
      progressPercent: 100,
    };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const start = new Date(MAINTENANCE_CONFIG.startTime).getTime();
  const totalDuration = target - start;
  const elapsed = Math.max(0, now - start);
  const progressPercent = totalDuration > 0
    ? Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)))
    : 0;

  return {
    hours,
    minutes,
    seconds,
    totalMs: diff,
    isCompleted: false,
    progressPercent,
  };
};
