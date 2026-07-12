/**
 * ============================================================================
 * scheduleGenerator.js — Moteur de génération d'emplois du temps
 * ============================================================================
 *
 * Module utilitaire pur (pas de React, pas de Firebase).
 * Gère la construction du pool de séances, la détection des cours communs,
 * la génération par placement glouton sous contraintes, et la validation.
 *
 * Exports :
 *   DAYS, DEFAULT_CONFIG,
 *   buildSessionPool, detectMergeGroups, generateSchedule,
 *   validateSchedule, generateTimeSlots, formatTime
 */

// ─── Compteur global pour les IDs temporaires ────────────────────────────────
let _idCounter = 0;

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Jours ouvrables de la semaine */
export const DAYS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

/** Configuration par défaut du calendrier */
export const DEFAULT_CONFIG = {
  days: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  startHour: 8,
  endHour: 20,
  slotMinutes: 90, // 1h30
  breakStart: 12,  // Début de la pause déjeuner
  breakEnd: 14,    // Fin de la pause déjeuner
  maxHoursPerDay: 8,
};

// ─── Helpers internes ────────────────────────────────────────────────────────

/**
 * Formate une heure en chaîne "HH:mm"
 * @param {number} hours   — Heures (0-23)
 * @param {number} minutes — Minutes (0-59)
 * @returns {string} Chaîne formatée "HH:mm"
 */
export function formatTime(hours, minutes) {
  const h = String(Math.floor(hours)).padStart(2, '0');
  const m = String(Math.floor(minutes || 0)).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Construit une clé unique pour identifier un groupe (diplôme + filière + année)
 * @param {string} diploma
 * @param {string} filiere
 * @param {string} annee
 * @returns {string}
 */
function buildGroupKey(diploma, filiere, annee) {
  return `${diploma}||${filiere}||${annee}`;
}

/**
 * Parse une chaîne horaire "HH:mm" en minutes depuis minuit
 * @param {string} timeStr — ex. "08:30"
 * @returns {number} Minutes depuis minuit
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Vérifie si deux plages horaires se chevauchent
 * @param {string} time1 — "HH:mm-HH:mm"
 * @param {string} time2 — "HH:mm-HH:mm"
 * @returns {boolean}
 */
function timesOverlap(time1, time2) {
  const [start1, end1] = time1.split('-').map(timeToMinutes);
  const [start2, end2] = time2.split('-').map(timeToMinutes);
  return start1 < end2 && start2 < end1;
}

// ─── 1. Construction du pool de séances ──────────────────────────────────────

/**
 * Construit le pool de séances à planifier à partir des groupes sélectionnés,
 * du semestre, des enseignants et du catalogue de modules.
 *
 * @param {Array<{diploma: string, filiere: string, annee: string}>} selectedGroups
 *   Les groupes pour lesquels on génère l'emploi du temps.
 * @param {'S1'|'S2'} semester — Semestre courant
 * @param {Array<{id: string, name: string, subjects: string[], groups: string[], years: string[], diplomas: string[]}>} teachers
 *   Liste des enseignants avec leurs affectations.
 * @param {Array} moduleCatalog — Catalogue de configurations de modules (contexte)
 * @param {function(string, string, string): string[]} getModulesForFiliere
 *   Fonction qui renvoie la liste des modules pour un (diplôme, filière, année).
 * @returns {Array<SessionRequest>} Pool de séances à planifier
 */
export function buildSessionPool(
  selectedGroups,
  semester,
  teachers,
  moduleCatalog,
  getModulesForFiliere,
  defaultDuration = 90
) {
  const sessions = [];

  for (const group of selectedGroups) {
    const { diploma, filiere, annee } = group;
    const groupKey = buildGroupKey(diploma, filiere, annee);

    // Récupérer les modules pour ce groupe et ce semestre
    let modules = [];
    if (typeof getModulesForFiliere === 'function') {
      modules = getModulesForFiliere(diploma, filiere, annee) || [];
    }

    for (const moduleName of modules) {
      // Trouver l'enseignant affecté à ce module pour ce groupe
      const matchingTeacher = findTeacherForModule(
        teachers,
        moduleName,
        diploma,
        filiere,
        annee
      );

      // Chercher la config du module dans le catalogue (pour la durée, etc.)
      const moduleConfig = findModuleConfig(moduleCatalog, moduleName, diploma, filiere);

      // Durée par défaut : config globale (ex: 1h30 ou 2h)
      const duration = moduleConfig?.duration || defaultDuration;

      // Nombre de séances par semaine (par défaut 1)
      const sessionsPerWeek = moduleConfig?.sessionsPerWeek || 1;

      for (let i = 0; i < sessionsPerWeek; i++) {
        sessions.push({
          id: `session_${++_idCounter}`,
          groupKey,
          diploma,
          filiere,
          annee,
          module: moduleName,
          // Stocker le module par semestre pour compatibilité Firestore
          moduleS1: semester === 'S1' ? moduleName : '',
          moduleS2: semester === 'S2' ? moduleName : '',
          teacherId: matchingTeacher?.id || '',
          teacherName: matchingTeacher?.name || 'Non affecté',
          duration,
          semester,
        });
      }
    }
  }

  return sessions;
}

/**
 * Cherche l'enseignant correspondant à un module pour un groupe donné
 * @param {Array} teachers
 * @param {string} moduleName
 * @param {string} diploma
 * @param {string} filiere
 * @param {string} annee
 * @returns {object|null}
 */
function findTeacherForModule(teachers, moduleName, diploma, filiere, annee) {
  if (!teachers || !Array.isArray(teachers)) return null;

  // Recherche exacte : enseignant qui enseigne ce module pour ce diplôme
  for (const teacher of teachers) {
    const teachesModule =
      teacher.subjects &&
      teacher.subjects.some(
        (s) => s.toLowerCase().trim() === moduleName.toLowerCase().trim()
      );

    const matchesDiploma =
      !teacher.diplomas ||
      teacher.diplomas.length === 0 ||
      teacher.diplomas.includes(diploma);

    const matchesGroup =
      !teacher.groups ||
      teacher.groups.length === 0 ||
      teacher.groups.includes(filiere);

    const matchesYear =
      !teacher.years ||
      teacher.years.length === 0 ||
      teacher.years.includes(annee);

    if (teachesModule && matchesDiploma && matchesGroup && matchesYear) {
      return teacher;
    }
  }

  // Recherche souple : enseignant qui enseigne ce module (sans filtre groupe)
  for (const teacher of teachers) {
    const teachesModule =
      teacher.subjects &&
      teacher.subjects.some(
        (s) => s.toLowerCase().trim() === moduleName.toLowerCase().trim()
      );

    if (teachesModule) {
      return teacher;
    }
  }

  return null;
}

/**
 * Cherche la configuration d'un module dans le catalogue
 * @param {Array} catalog
 * @param {string} moduleName
 * @param {string} diploma
 * @param {string} filiere
 * @returns {object|null}
 */
function findModuleConfig(catalog, moduleName, diploma, filiere) {
  if (!catalog || !Array.isArray(catalog)) return null;

  return catalog.find((m) => {
    const nameMatch =
      m.name?.toLowerCase().trim() === moduleName.toLowerCase().trim() ||
      m.module?.toLowerCase().trim() === moduleName.toLowerCase().trim();
    // Filtre optionnel par diplôme/filière
    const diplomaMatch = !m.diploma || m.diploma === diploma;
    const filiereMatch = !m.filiere || m.filiere === filiere;
    return nameMatch && diplomaMatch && filiereMatch;
  }) || null;
}

// ─── 2. Détection des cours communs (merge groups) ───────────────────────────

/**
 * Détecte automatiquement les cours communs :
 * même enseignant + même module + même année = cours commun.
 *
 * Fusionne ces séances en une seule entrée avec `mergedGroups[]`
 * pour qu'elles soient placées au même créneau.
 *
 * @param {Array<SessionRequest>} sessionPool — Pool de séances brutes
 * @returns {Array<MergedSession>} Pool fusionné
 */
export function detectMergeGroups(sessionPool) {
  if (!sessionPool || sessionPool.length === 0) return [];

  // Clé de fusion : teacherId + module + annee
  // (même enseignant donne le même module à la même année → cours commun)
  const mergeMap = new Map();

  for (const session of sessionPool) {
    // On ne fusionne que si un enseignant est affecté
    if (!session.teacherId) {
      // Séance sans enseignant : pas de fusion possible
      const soloKey = `solo_${session.id}`;
      mergeMap.set(soloKey, [session]);
      continue;
    }

    const mergeKey = `${session.teacherId}||${session.module}||${session.annee}`;

    if (!mergeMap.has(mergeKey)) {
      mergeMap.set(mergeKey, []);
    }
    mergeMap.get(mergeKey).push(session);
  }

  const mergedPool = [];

  for (const [, group] of mergeMap) {
    if (group.length === 1) {
      // Séance unique — pas de fusion
      mergedPool.push({
        ...group[0],
        mergedGroups: null,
        isMerged: false,
      });
    } else {
      // Cours commun détecté — fusion
      // On garde la première séance comme référence et on ajoute les groupes fusionnés
      const representative = { ...group[0] };
      const mergedGroups = group.map((s) => ({
        groupKey: s.groupKey,
        diploma: s.diploma,
        filiere: s.filiere,
        annee: s.annee,
      }));

      mergedPool.push({
        ...representative,
        mergedGroups,
        isMerged: true,
        // Liste des clés de groupes pour la vérification de conflits
        allGroupKeys: group.map((s) => s.groupKey),
      });
    }
  }

  return mergedPool;
}

// ─── 3. Génération des créneaux horaires ─────────────────────────────────────

/**
 * Génère tous les créneaux horaires possibles à partir de la configuration.
 *
 * @param {object} config — Configuration (DEFAULT_CONFIG par défaut)
 * @returns {Array<{day: string, start: string, end: string, time: string}>}
 */
export function generateTimeSlots(config = DEFAULT_CONFIG) {
  const {
    days = DAYS,
    startHour = 8,
    endHour = 20,
    slotMinutes = 90,
    breakStart = 12,
    breakEnd = 14,
  } = config;

  const slots = [];

  for (const day of days) {
    let currentMinutes = startHour * 60;
    const endMinutes = endHour * 60;

    while (currentMinutes + slotMinutes <= endMinutes) {
      const slotEnd = currentMinutes + slotMinutes;

      // Vérifier que le créneau ne chevauche pas la pause déjeuner
      const breakStartMinutes = breakStart * 60;
      const breakEndMinutes = breakEnd * 60;

      const overlapsBreak =
        currentMinutes < breakEndMinutes && slotEnd > breakStartMinutes;

      if (!overlapsBreak) {
        const startH = Math.floor(currentMinutes / 60);
        const startM = currentMinutes % 60;
        const endH = Math.floor(slotEnd / 60);
        const endM = slotEnd % 60;

        const startStr = formatTime(startH, startM);
        const endStr = formatTime(endH, endM);

        slots.push({
          day,
          start: startStr,
          end: endStr,
          time: `${startStr}-${endStr}`,
        });
      }

      // Avancer au créneau suivant
      // Si on est juste avant la pause, sauter après la pause
      if (currentMinutes < breakStartMinutes && currentMinutes + slotMinutes > breakStartMinutes) {
        currentMinutes = breakEndMinutes;
      } else {
        currentMinutes += slotMinutes;
      }
    }
  }

  return slots;
}

// ─── 4. Génération de l'emploi du temps (algorithme glouton) ─────────────────

/**
 * Génère l'emploi du temps par placement glouton sous contraintes.
 *
 * Algorithme :
 *   1. Trier les séances par niveau de contrainte (fusionnées d'abord,
 *      puis enseignants les plus chargés)
 *   2. Pour chaque séance, itérer tous les créneaux (jour, heure)
 *   3. Vérifier les contraintes : pas de conflit groupe, pas de conflit
 *      enseignant, dans les bornes horaires
 *   4. Placer dans le meilleur créneau (préférer l'adjacence pour minimiser
 *      les trous dans la journée)
 *   5. Si aucun créneau valide, ajouter à la liste « non planifié »
 *
 * @param {Array<MergedSession>} mergedPool — Pool fusionné de séances
 * @param {object} config — Configuration (DEFAULT_CONFIG par défaut)
 * @returns {{
 *   scheduled: Array<ScheduleEntry>,
 *   unplanned: Array<ScheduleEntry>,
 *   stats: {totalSessions: number, placedSessions: number, mergedSessions: number, hoursByGroup: object, hoursByTeacher: object}
 * }}
 */
export function generateSchedule(mergedPool, config = DEFAULT_CONFIG) {
  if (!mergedPool || mergedPool.length === 0) {
    return {
      scheduled: [],
      unplanned: [],
      stats: {
        totalSessions: 0,
        placedSessions: 0,
        mergedSessions: 0,
        hoursByGroup: {},
        hoursByTeacher: {},
      },
    };
  }

  // Générer les créneaux disponibles
  const timeSlots = generateTimeSlots(config);
  const maxHoursPerDay = config.maxHoursPerDay || DEFAULT_CONFIG.maxHoursPerDay;

  // ── Étape 1 : Trier par niveau de contrainte ──

  // Compter la charge de chaque enseignant pour trier par occupation
  const teacherLoad = new Map();
  for (const session of mergedPool) {
    if (session.teacherId) {
      teacherLoad.set(
        session.teacherId,
        (teacherLoad.get(session.teacherId) || 0) + 1
      );
    }
  }

  const sortedPool = [...mergedPool].sort((a, b) => {
    // Les séances fusionnées (cours communs) passent en premier
    const aMerged = a.isMerged ? 1 : 0;
    const bMerged = b.isMerged ? 1 : 0;
    if (bMerged !== aMerged) return bMerged - aMerged;

    // Ensuite, les enseignants les plus chargés passent en premier
    const aLoad = teacherLoad.get(a.teacherId) || 0;
    const bLoad = teacherLoad.get(b.teacherId) || 0;
    if (bLoad !== aLoad) return bLoad - aLoad;

    // En dernier recours, tri par nom de module pour la stabilité
    return (a.module || '').localeCompare(b.module || '');
  });

  // ── Structures de suivi des placements ──

  // Enseignant déjà occupé : Map<"teacherId||day||time", true>
  const teacherBusy = new Map();

  // Groupe déjà occupé : Map<"groupKey||day||time", true>
  const groupBusy = new Map();

  // Heures par groupe par jour : Map<"groupKey||day", minutes>
  const groupDayMinutes = new Map();

  // Heures par enseignant par jour : Map<"teacherId||day", minutes>
  const teacherDayMinutes = new Map();

  // Séances placées par groupe et jour (pour calcul d'adjacence)
  // Map<"groupKey||day", Array<{start: number, end: number}>>
  const groupDaySlots = new Map();

  const scheduled = [];
  const unplanned = [];

  // Compteurs statistiques
  let mergedSessionsCount = 0;
  const hoursByGroup = {};
  const hoursByTeacher = {};

  // ── Étape 2-4 : Placement de chaque séance ──

  for (const session of sortedPool) {
    const duration = session.duration || config.slotMinutes || 90;
    const groupKeys = session.isMerged
      ? session.allGroupKeys
      : [session.groupKey];

    let bestSlot = null;
    let bestScore = -Infinity;

    // Parcourir tous les créneaux possibles
    for (const slot of timeSlots) {
      // Vérifier la durée du créneau vs la durée de la séance
      const slotDuration =
        timeToMinutes(slot.end) - timeToMinutes(slot.start);
      if (slotDuration < duration) continue;

      // Construire le créneau effectif (ajuster la fin si le créneau est plus long)
      const effectiveEnd = timeToMinutes(slot.start) + duration;
      const effectiveEndStr = formatTime(
        Math.floor(effectiveEnd / 60),
        effectiveEnd % 60
      );
      const effectiveTime = `${slot.start}-${effectiveEndStr}`;

      // ── Vérification des contraintes ──

      // Contrainte 1 : Conflit enseignant
      if (session.teacherId) {
        const teacherKey = `${session.teacherId}||${slot.day}||${effectiveTime}`;
        if (teacherBusy.has(teacherKey)) continue;

        // Vérifier aussi le chevauchement avec d'autres créneaux de cet enseignant
        if (hasTimeConflict(teacherBusy, session.teacherId, slot.day, effectiveTime)) {
          continue;
        }
      }

      // Contrainte 2 : Conflit groupe
      let groupConflict = false;
      for (const gk of groupKeys) {
        if (hasTimeConflict(groupBusy, gk, slot.day, effectiveTime)) {
          groupConflict = true;
          break;
        }
      }
      if (groupConflict) continue;

      // Contrainte 3 : Limite d'heures par jour pour chaque groupe
      let dayLimitExceeded = false;
      for (const gk of groupKeys) {
        const dayKey = `${gk}||${slot.day}`;
        const currentDayMinutes = groupDayMinutes.get(dayKey) || 0;
        if (currentDayMinutes + duration > maxHoursPerDay * 60) {
          dayLimitExceeded = true;
          break;
        }
      }
      if (dayLimitExceeded) continue;

      // Contrainte 4 : Limite d'heures par jour pour l'enseignant
      if (session.teacherId) {
        const teacherDayKey = `${session.teacherId}||${slot.day}`;
        const currentTeacherDayMin = teacherDayMinutes.get(teacherDayKey) || 0;
        if (currentTeacherDayMin + duration > maxHoursPerDay * 60) {
          continue;
        }
      }

      // ── Calcul du score de qualité du créneau ──

      let score = 0;

      // Bonus : adjacence avec les séances déjà placées du même groupe
      // (minimiser les trous dans la journée)
      for (const gk of groupKeys) {
        const daySlotKey = `${gk}||${slot.day}`;
        const existingSlots = groupDaySlots.get(daySlotKey) || [];

        if (existingSlots.length > 0) {
          const slotStart = timeToMinutes(slot.start);
          const slotEndMin = slotStart + duration;

          // Vérifier l'adjacence (un créneau se termine quand l'autre commence)
          for (const existing of existingSlots) {
            if (existing.end === slotStart || slotEndMin === existing.start) {
              score += 10; // Bonus fort pour l'adjacence directe
            } else {
              // Pénalité proportionnelle au gap
              const gap = Math.min(
                Math.abs(existing.end - slotStart),
                Math.abs(slotEndMin - existing.start)
              );
              if (gap <= 30) {
                score += 5; // Petit bonus si proche (≤30 min)
              }
            }
          }

          // Bonus léger pour placer les séances le même jour (compacité)
          score += 2;
        } else {
          // Bonus léger pour les créneaux du matin (préférence pédagogique)
          const slotStart = timeToMinutes(slot.start);
          if (slotStart < 12 * 60) {
            score += 1;
          }
        }
      }

      // Léger bonus pour les premiers jours de la semaine (répartition)
      const dayIndex = (config.days || DAYS).indexOf(slot.day);
      score -= dayIndex * 0.1;

      // Comparer avec le meilleur créneau trouvé
      if (score > bestScore) {
        bestScore = score;
        bestSlot = { ...slot, effectiveTime, duration };
      }
    }

    // ── Placement ou report ──

    if (bestSlot) {
      // Marquer les occupations
      const effectiveTime = bestSlot.effectiveTime;
      const slotStartMin = timeToMinutes(bestSlot.start);

      if (session.teacherId) {
        markBusy(teacherBusy, session.teacherId, bestSlot.day, effectiveTime);

        const teacherDayKey = `${session.teacherId}||${bestSlot.day}`;
        teacherDayMinutes.set(
          teacherDayKey,
          (teacherDayMinutes.get(teacherDayKey) || 0) + duration
        );
      }

      for (const gk of groupKeys) {
        markBusy(groupBusy, gk, bestSlot.day, effectiveTime);

        const dayKey = `${gk}||${bestSlot.day}`;
        groupDayMinutes.set(
          dayKey,
          (groupDayMinutes.get(dayKey) || 0) + duration
        );

        // Enregistrer le créneau pour le calcul d'adjacence
        const daySlotKey = `${gk}||${bestSlot.day}`;
        if (!groupDaySlots.has(daySlotKey)) {
          groupDaySlots.set(daySlotKey, []);
        }
        groupDaySlots.get(daySlotKey).push({
          start: slotStartMin,
          end: slotStartMin + duration,
        });
      }

      // Créer les entrées de l'emploi du temps
      if (session.isMerged && session.mergedGroups) {
        // Cours commun : créer UNE entrée par groupe fusionné
        // (même jour/heure mais différent diplôme/filière/annee pour Firestore)
        mergedSessionsCount++;

        for (const mg of session.mergedGroups) {
          scheduled.push({
            day: bestSlot.day,
            time: effectiveTime,
            module: session.module,
            moduleS1: session.moduleS1 || '',
            moduleS2: session.moduleS2 || '',
            teacherId: session.teacherId,
            teacherName: session.teacherName,
            diploma: mg.diploma,
            filiere: mg.filiere,
            annee: mg.annee,
            type: 'Cours commun',
            room: '',
            mergedGroups: session.mergedGroups.map((g) => g.filiere),
            _genId: 'gen_' + ++_idCounter,
          });

          // Statistiques heures par groupe
          const gk = mg.groupKey || buildGroupKey(mg.diploma, mg.filiere, mg.annee);
          hoursByGroup[gk] = (hoursByGroup[gk] || 0) + duration / 60;
        }
      } else {
        // Séance simple
        scheduled.push({
          day: bestSlot.day,
          time: effectiveTime,
          module: session.module,
          moduleS1: session.moduleS1 || '',
          moduleS2: session.moduleS2 || '',
          teacherId: session.teacherId,
          teacherName: session.teacherName,
          diploma: session.diploma,
          filiere: session.filiere,
          annee: session.annee,
          type: 'Cours',
          room: '',
          mergedGroups: null,
          _genId: 'gen_' + ++_idCounter,
        });

        hoursByGroup[session.groupKey] =
          (hoursByGroup[session.groupKey] || 0) + duration / 60;
      }

      // Statistiques heures par enseignant
      if (session.teacherId) {
        hoursByTeacher[session.teacherId] =
          (hoursByTeacher[session.teacherId] || 0) + duration / 60;
      }
    } else {
      // Aucun créneau valide trouvé — séance non planifiée
      if (session.isMerged && session.mergedGroups) {
        for (const mg of session.mergedGroups) {
          unplanned.push({
            day: '',
            time: '',
            module: session.module,
            moduleS1: session.moduleS1 || '',
            moduleS2: session.moduleS2 || '',
            teacherId: session.teacherId,
            teacherName: session.teacherName,
            diploma: mg.diploma,
            filiere: mg.filiere,
            annee: mg.annee,
            type: 'Cours commun',
            room: '',
            mergedGroups: session.mergedGroups.map((g) => g.filiere),
            _genId: 'gen_' + ++_idCounter,
          });
        }
      } else {
        unplanned.push({
          day: '',
          time: '',
          module: session.module,
          moduleS1: session.moduleS1 || '',
          moduleS2: session.moduleS2 || '',
          teacherId: session.teacherId,
          teacherName: session.teacherName,
          diploma: session.diploma,
          filiere: session.filiere,
          annee: session.annee,
          type: 'Cours',
          room: '',
          mergedGroups: null,
          _genId: 'gen_' + ++_idCounter,
        });
      }
    }
  }

  return {
    scheduled,
    unplanned,
    stats: {
      totalSessions: mergedPool.length,
      placedSessions: mergedPool.length - unplanned.length,
      mergedSessions: mergedSessionsCount,
      hoursByGroup,
      hoursByTeacher,
    },
  };
}

/**
 * Vérifie s'il y a un conflit temporel pour une entité (enseignant ou groupe)
 * à un jour donné avec un créneau donné.
 *
 * @param {Map} busyMap — Map des créneaux occupés
 * @param {string} entityId — ID de l'entité (enseignant ou groupe)
 * @param {string} day — Jour
 * @param {string} time — Créneau "HH:mm-HH:mm"
 * @returns {boolean} true si conflit détecté
 */
function hasTimeConflict(busyMap, entityId, day, time) {
  // Parcourir toutes les entrées de la map pour cette entité et ce jour
  const prefix = `${entityId}||${day}||`;

  for (const [key] of busyMap) {
    if (key.startsWith(prefix)) {
      const existingTime = key.substring(prefix.length);
      if (timesOverlap(existingTime, time)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Marque un créneau comme occupé dans la map
 * @param {Map} busyMap
 * @param {string} entityId
 * @param {string} day
 * @param {string} time
 */
function markBusy(busyMap, entityId, day, time) {
  const key = `${entityId}||${day}||${time}`;
  busyMap.set(key, true);
}

// ─── 5. Validation de l'emploi du temps ──────────────────────────────────────

/**
 * Valide un emploi du temps en détectant les conflits.
 *
 * Types de conflits détectés :
 *   - Conflit enseignant : même enseignant à deux endroits en même temps
 *   - Conflit groupe : même groupe à deux cours en même temps
 *   - Conflit salle : même salle utilisée par deux cours en même temps
 *
 * @param {Array<ScheduleEntry>} entries — Entrées de l'emploi du temps
 * @returns {{
 *   teacherConflicts: Array<{entry1: ScheduleEntry, entry2: ScheduleEntry, teacherId: string, day: string, time: string}>,
 *   groupConflicts: Array<{entry1: ScheduleEntry, entry2: ScheduleEntry, groupKey: string, day: string, time: string}>,
 *   roomConflicts: Array<{entry1: ScheduleEntry, entry2: ScheduleEntry, room: string, day: string, time: string}>
 * }}
 */
export function validateSchedule(entries) {
  const teacherConflicts = [];
  const groupConflicts = [];
  const roomConflicts = [];

  if (!entries || entries.length === 0) {
    return { teacherConflicts, groupConflicts, roomConflicts };
  }

  // Filtrer les entrées valides (avec jour et heure)
  const validEntries = entries.filter((e) => e.day && e.time);

  for (let i = 0; i < validEntries.length; i++) {
    for (let j = i + 1; j < validEntries.length; j++) {
      const e1 = validEntries[i];
      const e2 = validEntries[j];

      // Les entrées doivent être le même jour pour avoir un conflit
      if (e1.day !== e2.day) continue;

      // Vérifier le chevauchement temporel
      if (!timesOverlap(e1.time, e2.time)) continue;

      // ── Conflit enseignant ──
      if (
        e1.teacherId &&
        e2.teacherId &&
        e1.teacherId === e2.teacherId
      ) {
        // Exclure les cours communs (même enseignant au même créneau est normal)
        const isSameMergedCourse =
          e1.module === e2.module &&
          e1.time === e2.time &&
          (e1.type === 'Cours commun' || e2.type === 'Cours commun');

        if (!isSameMergedCourse) {
          teacherConflicts.push({
            entry1: e1,
            entry2: e2,
            teacherId: e1.teacherId,
            teacherName: e1.teacherName || e2.teacherName,
            day: e1.day,
            time: e1.time,
          });
        }
      }

      // ── Conflit groupe ──
      const groupKey1 = e1.groupKey || buildGroupKey(e1.diploma, e1.filiere, e1.annee);
      const groupKey2 = e2.groupKey || buildGroupKey(e2.diploma, e2.filiere, e2.annee);

      if (groupKey1 === groupKey2) {
        // Exclure les doublons de cours communs (même module, même créneau)
        const isSameMergedCourse =
          e1.module === e2.module &&
          e1.time === e2.time &&
          (e1.type === 'Cours commun' || e2.type === 'Cours commun');

        if (!isSameMergedCourse) {
          groupConflicts.push({
            entry1: e1,
            entry2: e2,
            groupKey: groupKey1,
            day: e1.day,
            time: e1.time,
          });
        }
      }

      // ── Conflit salle ──
      if (
        e1.room &&
        e2.room &&
        e1.room === e2.room
      ) {
        // Deux cours différents dans la même salle au même moment
        const isSameMergedCourse =
          e1.module === e2.module &&
          e1.time === e2.time &&
          e1.teacherId === e2.teacherId;

        if (!isSameMergedCourse) {
          roomConflicts.push({
            entry1: e1,
            entry2: e2,
            room: e1.room,
            day: e1.day,
            time: e1.time,
          });
        }
      }
    }
  }

  return { teacherConflicts, groupConflicts, roomConflicts };
}
