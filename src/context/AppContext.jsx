import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  getDoc,
  where,
  limit,
  writeBatch,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from './ToastContext';
import {
  GRADE_ACADEMIC_YEARS_FIELD,
  getGradeBucketForWrite,
  sanitizeGradeKey,
} from '../utils/gradeSync';
import { getStudentAttendanceWriteTarget } from '../utils/attendanceKeys';
import { getScheduleModuleForSemester, normalizeSemester } from '../utils/scheduleSemester';
import {
  STUDENT_STATUS,
  getAvailableAcademicYears,
  getPaymentAcademicYear,
  getStudentCurrentAcademicYear,
  INITIAL_OPERATIONAL_ACADEMIC_YEAR,
  isActiveStudent,
  isStudentCurrentlyInAcademicYear,
  validateAcademicYear,
  validateAcademicYearTransition,
} from '../utils/studentStatus';
import { getNextStudyYear, isKnownStudyYear } from '../data/modules';

const AppContext = createContext();
const ACCESS_LOG_LIMIT = 5;
const RECEIPT_COUNTERS_COLLECTION = 'receipt_counters';
const STUDENT_RECEIPT_PREFIX = 'FD';

const getReceiptNumberValue = (receiptNumber = '', prefix = '') => {
  const match = String(receiptNumber).match(/^([A-Z]+)(\d+)$/);
  return match?.[1] === prefix ? parseInt(match[2], 10) || 0 : 0;
};

export const useApp = () => useContext(AppContext);

// ──────────────────────────────────────────────────────────
// Cache sessionStorage (TTL 30 min)
// ──────────────────────────────────────────────────────────
const CORE_CACHE_KEY = 'ipfp_v2_core_cache';
const FINANCE_CACHE_PAYMENTS_KEY = 'ipfp_v2_finance_payments';
const FINANCE_CACHE_SALARIES_KEY = 'ipfp_v2_finance_salaries';
const FINANCE_CACHE_EXPENSES_KEY = 'ipfp_v2_finance_expenses';
const CORE_CACHE_TTL = 6 * 60 * 60 * 1000;
const FINANCE_CACHE_TTL = 60 * 60 * 1000;
const ACTIVE_SEMESTER_KEY = 'ipfp_active_semester';
const OPERATIONAL_ACADEMIC_YEAR_KEY = 'ipfp_operational_academic_year_v1';
const pendingLoads = new Map();

const readCachedOperationalAcademicYear = () => {
  try {
    const stored = localStorage.getItem(OPERATIONAL_ACADEMIC_YEAR_KEY);
    return validateAcademicYear(stored) ? stored : INITIAL_OPERATIONAL_ACADEMIC_YEAR;
  } catch {
    return INITIAL_OPERATIONAL_ACADEMIC_YEAR;
  }
};
const makeToken = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join('');
};
const readCache = (key, ttl) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > ttl) return null;
    return parsed.data;
  } catch { return null; }
};
const writeCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Storage can be unavailable or full; remote data remains authoritative.
  }
};
const mergeById = (current, incoming) => {
  const map = new Map((current || []).map(item => [item.id, item]));
  incoming.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
};

const getTeacherAttendanceSlotKey = (record = {}) => {
  const safeTime = (record.timeSlot || '').replace(/[^0-9]/g, '') || 'x';
  return `${record.teacherId || ''}_${record.date || ''}_${safeTime}`;
};

const getTimeSlotDuration = (timeStr = '') => {
  if (!timeStr) return 0;
  const match = String(timeStr).match(/(\d{1,2})[h:]?(\d{2})?\s*[-–—]\s*(\d{1,2})[h:]?(\d{2})?/i);
  if (!match) return 0;
  const h1 = parseInt(match[1] || 0, 10);
  const m1 = parseInt(match[2] || 0, 10);
  const h2 = parseInt(match[3] || 0, 10);
  const m2 = parseInt(match[4] || 0, 10);
  const duration = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
  return Number.isFinite(duration) ? Math.max(0, Math.round(duration * 100) / 100) : 0;
};

const getMonthBounds = (monthIndex, year) => {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const pad = (value) => String(value).padStart(2, '0');
  const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return { start: toISO(start), end: toISO(end) };
};

const ACCESS_LOG_SESSION_KEY = 'ipfp_access_logged_this_session';

const getBrowserName = (userAgent = '') => {
  if (/Edg\//i.test(userAgent)) return 'Microsoft Edge';
  if (/OPR\//i.test(userAgent)) return 'Opera';
  if (/Firefox\//i.test(userAgent)) return 'Firefox';
  if (/CriOS\//i.test(userAgent)) return 'Chrome iOS';
  if (/Chrome\//i.test(userAgent)) return 'Chrome';
  if (/Safari\//i.test(userAgent)) return 'Safari';
  return 'Navigateur inconnu';
};

const getOsName = (userAgent = '') => {
  if (/Windows NT/i.test(userAgent)) return 'Windows';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Mac OS X|Macintosh/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'OS inconnu';
};

const getDeviceType = (userAgent = '') => {
  if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent)) return 'Tablette';
  if (/Mobi|Android|iPhone|iPod/i.test(userAgent)) return 'Mobile';
  return 'Ordinateur';
};

const getLocalDateParts = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  };
};

const fetchPublicIp = async () => {
  if (typeof fetch === 'undefined' || typeof AbortController === 'undefined') return 'Non disponible';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!response.ok) return 'Non disponible';
    const data = await response.json();
    return data?.ip || 'Non disponible';
  } catch {
    return 'Non disponible';
  } finally {
    clearTimeout(timeoutId);
  }
};

const buildAccessLogPayload = async ({ path = '', accessType = 'app' } = {}) => {
  const now = new Date();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const browser = getBrowserName(userAgent);
  const os = getOsName(userAgent);
  const deviceType = getDeviceType(userAgent);
  const { date, time } = getLocalDateParts(now);
  const screenSize = typeof window !== 'undefined' && window.screen
    ? `${window.screen.width}x${window.screen.height}`
    : '';

  return {
    ipAddress: await fetchPublicIp(),
    deviceName: [os, browser, deviceType].filter(Boolean).join(' - '),
    browser,
    os,
    deviceType,
    screenSize,
    userAgent,
    path: path || (typeof window !== 'undefined' ? window.location.pathname : ''),
    hostname: typeof window !== 'undefined' ? window.location.hostname : '',
    accessType,
    date,
    time,
    loggedAt: now.toISOString(),
    createdAt: serverTimestamp()
  };
};

export const AppProvider = ({ children }) => {
  const { showToast: originalShowToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  
  useEffect(() => {
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(20));
    return onSnapshot(q, snapshot => {
      setNotifications(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    }, error => {
      console.error("Erreur lecture activité récente:", error);
    });
  }, []);

  const markNotificationAsRead = useCallback(async (id) => {
    try {
      await updateDoc(doc(db, 'activity_logs', id), { read: true });
    } catch (e) {
      console.error("Erreur markRead:", e);
    }
  }, []);

  const clearNotifications = useCallback(async () => {
    if (notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, 'activity_logs', n.id));
      });
      await batch.commit();
    } catch (e) {
      console.error("Erreur clearNotifications:", e);
    }
  }, [notifications]);

  const showToast = useCallback(async (msg, type = 'info') => {
    originalShowToast(msg, type);
    if ((type === 'success' || type === 'warning') && !msg.toLowerCase().includes('connexion') && !msg.toLowerCase().includes('déconnexion')) {
      try {
        await addDoc(collection(db, 'activity_logs'), {
          message: msg,
          type,
          timestamp: Date.now(),
          read: false
        });
      } catch (err) {
        console.error("Erreur enregistrement log:", err);
      }
    }
  }, [originalShowToast]);

  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [grades, setGrades] = useState({});
  const [studentAttendance, setStudentAttendance] = useState([]);
  const [teacherAttendance, setTeacherAttendance] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [payments, setPayments] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [modules, setModules] = useState([]);
  const [continuousTrainings, setContinuousTrainings] = useState([]);
  const [continuousTrainingTypes, setContinuousTrainingTypes] = useState([]);
  const [ctStudents, setCtStudents] = useState([]);
  const [ctSessions, setCtSessions] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [activeSemester, setActiveSemesterState] = useState(() => {
    try { return normalizeSemester(localStorage.getItem(ACTIVE_SEMESTER_KEY)); } catch { return 'S1'; }
  });
  // The operational year is server-backed and changes only through closure/undo.
  const [operationalAcademicYear, setOperationalAcademicYearState] = useState(readCachedOperationalAcademicYear);
  const [archivedAcademicYears, setArchivedAcademicYears] = useState([]);
  // The active year is only the local year currently being viewed.
  const [activeAcademicYear, setActiveAcademicYearState] = useState(readCachedOperationalAcademicYear);
  const operationalAcademicYearRef = useRef(operationalAcademicYear);
  const [loading, setLoading] = useState(true);
  const studentAttendanceKeysRef = useRef(new Set());
  const teacherAttendanceKeysRef = useRef(new Set());
  const financeLoadedRef = useRef(false);
  const accessLoggedRef = useRef(false);

  // Modal de confirmation global
  const [confirmState, setConfirmState] = useState({
    isOpen: false, title: '', message: '', type: 'danger', confirmText: '', cancelText: '', resolve: null
  });

  const confirmAction = (options) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: options.title || 'Confirmation',
        message: options.message || 'Êtes-vous sûr de vouloir continuer ?',
        type: options.type || 'danger',
        confirmText: options.confirmText || '',
        cancelText: options.cancelText || '',
        resolve
      });
    });
  };

  const handleConfirm = () => {
    if (confirmState.resolve) confirmState.resolve(true);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    if (confirmState.resolve) confirmState.resolve(false);
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('eco_auth') === 'true';
  });

  const [isDirectorAuth, setIsDirectorAuth] = useState(() => {
    return sessionStorage.getItem('ipfp_director_auth') === 'true';
  });

  useEffect(() => {
    const clearDirectorSession = () => {
      sessionStorage.removeItem('ipfp_director_auth');
    };
    window.addEventListener('beforeunload', clearDirectorSession);
    return () => window.removeEventListener('beforeunload', clearDirectorSession);
  }, []);

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'app');
    let bootstrapInProgress = false;

    const unsubscribe = onSnapshot(settingsRef, snapshot => {
      const settings = snapshot.exists() ? snapshot.data() : {};
      const hasOperationalAcademicYear = validateAcademicYear(settings?.operationalAcademicYear);
      const nextOperationalAcademicYear = hasOperationalAcademicYear
        ? settings.operationalAcademicYear
        : INITIAL_OPERATIONAL_ACADEMIC_YEAR;
      const nextArchivedAcademicYears = Array.isArray(settings?.archivedAcademicYears)
        ? settings.archivedAcademicYears.filter(year =>
            validateAcademicYear(year) && year < nextOperationalAcademicYear
          )
        : [];
      const previousOperationalAcademicYear = operationalAcademicYearRef.current;
      const nextSemester = normalizeSemester(settings?.activeSemester);

      operationalAcademicYearRef.current = nextOperationalAcademicYear;
      setActiveSemesterState(nextSemester);
      setOperationalAcademicYearState(nextOperationalAcademicYear);
      setArchivedAcademicYears(nextArchivedAcademicYears);
      setActiveAcademicYearState(currentYear => (
        currentYear === previousOperationalAcademicYear ||
        !validateAcademicYear(currentYear) ||
        currentYear > nextOperationalAcademicYear
          ? nextOperationalAcademicYear
          : currentYear
      ));
      try {
        localStorage.setItem(ACTIVE_SEMESTER_KEY, nextSemester);
        localStorage.setItem(OPERATIONAL_ACADEMIC_YEAR_KEY, nextOperationalAcademicYear);
      } catch {
        // Storage can be unavailable in restrictive browser modes.
      }

      if (!hasOperationalAcademicYear && (isAuthenticated || isDirectorAuth) && !bootstrapInProgress) {
        bootstrapInProgress = true;
        runTransaction(db, async transaction => {
          const currentSnapshot = await transaction.get(settingsRef);
          const currentSettings = currentSnapshot.exists() ? currentSnapshot.data() : {};
          if (validateAcademicYear(currentSettings?.operationalAcademicYear)) return;
          const bootstrapArchives = Array.isArray(currentSettings?.archivedAcademicYears)
            ? currentSettings.archivedAcademicYears.filter(year =>
                validateAcademicYear(year) && year < INITIAL_OPERATIONAL_ACADEMIC_YEAR
              )
            : [];
          transaction.set(settingsRef, {
            operationalAcademicYear: INITIAL_OPERATIONAL_ACADEMIC_YEAR,
            archivedAcademicYears: bootstrapArchives,
            academicYearUpdatedAt: serverTimestamp(),
          }, { merge: true });
        }).catch(error => {
          console.warn("Impossible d'initialiser l'année académique active:", error);
        }).finally(() => {
          bootstrapInProgress = false;
        });
      }
    }, error => {
      console.warn('Impossible de charger les paramètres actifs:', error);
    });

    return unsubscribe;
  }, [isAuthenticated, isDirectorAuth]);

  const setActiveSemester = useCallback(async (semester) => {
    const nextSemester = normalizeSemester(semester);
    setActiveSemesterState(nextSemester);
    try {
      localStorage.setItem(ACTIVE_SEMESTER_KEY, nextSemester);
    } catch {
      // Storage can be unavailable in restrictive browser modes.
    }
    try {
      await setDoc(doc(db, 'settings', 'app'), {
        activeSemester: nextSemester,
        updatedAt: serverTimestamp()
      }, { merge: true });
      showToast(`Semestre ${nextSemester} active.`, 'success');
    } catch (error) {
      console.warn('Impossible de synchroniser le semestre actif:', error);
      showToast(`Semestre ${nextSemester} active localement.`, 'warning');
    }
  }, [showToast]);

  const getActiveScheduleModule = useCallback((session = {}) => {
    return getScheduleModuleForSemester(session, activeSemester, modules);
  }, [activeSemester, modules]);

  const setActiveAcademicYear = useCallback((year) => {
    if (!validateAcademicYear(year)) return;
    setActiveAcademicYearState(year);
  }, []);

  const availableAcademicYearsList = useMemo(
    () => getAvailableAcademicYears(
      students,
      payments,
      operationalAcademicYear,
      archivedAcademicYears
    ),
    [students, payments, operationalAcademicYear, archivedAcademicYears]
  );

  // ──────────────────────────────────────────────────────────
  // OPTIMISATION FIREBASE (QUOTA) : Chargement ciblé et unique
  // Remplacement des `onSnapshot` par `getDocs` pour réduire drastiquement
  // les lectures de documents facturées par Firebase.
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const path = window.location.pathname;
        const isTeacherPortal = path.startsWith('/portal/') || path.startsWith('/teacher/');
        const isStudentPortal = path.startsWith('/results/');

        if (isAuthenticated || isDirectorAuth) {
          // 1. Restore local cache immediately, then refresh from Firebase.
          const cached = readCache(CORE_CACHE_KEY, CORE_CACHE_TTL);
          if (cached && isMounted && Array.isArray(cached.students)) {
            setStudents(cached.students || []);
            setTeachers(cached.teachers || []);
            setGrades(cached.grades || {});
            setSchedules(cached.schedules || []);
            setModules(cached.modules || []);
            setLoading(false);
          }

          // 2. Core admin refresh only: no attendance or finance reads here.
          const coreLoadKey = 'admin-core';
          if (!pendingLoads.has(coreLoadKey)) {
            pendingLoads.set(coreLoadKey, Promise.all([
              getDocs(query(collection(db, 'students'), orderBy('createdAt', 'desc'))),
              getDocs(query(collection(db, 'teachers'), orderBy('createdAt', 'desc'))),
              getDocs(collection(db, 'grades')),
              getDocs(query(collection(db, 'schedules'), orderBy('createdAt', 'desc'))),
              getDocs(query(collection(db, 'modules'), orderBy('name', 'asc')))
            ]).then(([stuSnap, teaSnap, graSnap, schSnap, modSnap]) => {
              const gradesData = {}; graSnap.docs.forEach(d => { gradesData[d.id] = d.data(); });
              const data = {
                students: stuSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                teachers: teaSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                grades: gradesData,
                schedules: schSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                modules: modSnap.docs.map(d => ({ id: d.id, ...d.data() }))
              };
              writeCache(CORE_CACHE_KEY, data);
              return data;
            }).finally(() => {
              pendingLoads.delete(coreLoadKey);
            }));
          }

          const coreData = await pendingLoads.get(coreLoadKey);
          
          if (!isMounted) return;

          setStudents(coreData.students || []);
          setTeachers(coreData.teachers || []);
          setGrades(coreData.grades || {});
          setSchedules(coreData.schedules || []);
          setModules(coreData.modules || []);

          Promise.all([
            getDocs(query(collection(db, 'continuousTrainings'), orderBy('createdAt', 'desc'))),
            getDocs(collection(db, 'continuousTrainingTypes')),
            getDocs(query(collection(db, 'ctStudents'), orderBy('createdAt', 'desc'))),
            getDocs(query(collection(db, 'ctSessions'), orderBy('createdAt', 'desc')))
          ]).then(([ctSnap, ctTypeSnap, ctsSnap, ctSesSnap]) => {
            if (!isMounted) return;
            setContinuousTrainings(ctSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setContinuousTrainingTypes(
              ctTypeSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' }))
            );
            setCtStudents(ctsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setCtSessions(ctSesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          }).catch(error => console.warn('Impossible de charger les formations continues:', error));

        } else if (isStudentPortal) {
          // 2. Portail Stagiaire: Chargement EXCLUSIF des données de ce stagiaire
          const token = path.split('/').pop();
          const stuQuery = query(collection(db, 'students'), where('token', '==', token));
          const stuSnap = await getDocs(stuQuery);
          let studentDoc = stuSnap.docs[0];
          if (!studentDoc) {
            const directDoc = await getDoc(doc(db, 'students', token));
            if (directDoc.exists()) studentDoc = directDoc;
          }

          if (studentDoc && isMounted) {
            const studentData = studentDoc.data();
            const currentStudent = { id: studentDoc.id, ...studentData };
            let portalStudents = [currentStudent];
            if (studentData.major) {
              const classSnap = await getDocs(query(collection(db, 'students'), where('major', '==', studentData.major)));
              portalStudents = classSnap.docs
                .map(item => ({ id: item.id, ...item.data() }))
                .filter(student =>
                  student.diploma === studentData.diploma &&
                  student.major === studentData.major &&
                  student.year === studentData.year
                );
              if (!portalStudents.some(student => student.id === studentDoc.id)) portalStudents.unshift(currentStudent);
            }
            setStudents(portalStudents);

            const gradesData = {};
            const studentIds = portalStudents.map(student => student.id).filter(Boolean);
            for (let i = 0; i < studentIds.length; i += 10) {
              const gradeSnap = await getDocs(query(collection(db, 'grades'), where('__name__', 'in', studentIds.slice(i, i + 10))));
              gradeSnap.docs.forEach(item => { gradesData[item.id] = item.data(); });
            }
            setGrades(gradesData);

            const modSnap = await getDocs(query(collection(db, 'modules'), orderBy('name', 'asc')));
            setModules(modSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        } else if (isTeacherPortal) {
          // 3. Portail Formateur: Chargement ciblé pour le formateur
          const token = path.split('/').pop();
          const [tSnap1, tSnap2] = await Promise.all([
            getDocs(query(collection(db, 'teachers'), where('tokenGrades', '==', token))),
            getDocs(query(collection(db, 'teachers'), where('tokenAttendance', '==', token)))
          ]);
          
          let teacherDoc = tSnap1.docs[0] || tSnap2.docs[0];
          if (!teacherDoc) {
            const directDoc = await getDoc(doc(db, 'teachers', token));
            if (directDoc.exists()) teacherDoc = directDoc;
          }

          if (teacherDoc && isMounted) {
            const teacherData = teacherDoc.data();
            setTeachers([{ id: teacherDoc.id, ...teacherData }]);
            
            // Schedules: only this teacher's sessions
            const schSnap = await getDocs(query(collection(db, 'schedules'), where('teacherId', '==', teacherDoc.id)));
            setSchedules(schSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            // Students: only from the teacher's assigned groups
            const groups = teacherData.groups || [];
            let allStudents = [];
            if (groups.length > 0) {
              for (let i = 0; i < groups.length; i += 10) {
                const batch = groups.slice(i, i + 10);
                const stuSnap = await getDocs(query(collection(db, 'students'), where('major', 'in', batch)));
                allStudents = allStudents.concat(stuSnap.docs.map(d => ({ id: d.id, ...d.data() })));
              }
            }
            setStudents(allStudents);

            // Grades: only for the loaded students
            const gradesData = {};
            if (allStudents.length > 0) {
              const studentIds = allStudents.map(s => s.id);
              for (let i = 0; i < studentIds.length; i += 10) {
                const batch = studentIds.slice(i, i + 10);
                const graSnap = await getDocs(query(collection(db, 'grades'), where('__name__', 'in', batch)));
                graSnap.docs.forEach(d => { gradesData[d.id] = d.data(); });
              }
            }
            setGrades(gradesData);

            const modSnap = await getDocs(query(collection(db, 'modules'), orderBy('name', 'asc')));
            setModules(modSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        } else {
          setTeacherAttendance([]);
          setPayments([]);
          setSalaries([]);
          setStudentAttendance([]);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, [isAuthenticated, isDirectorAuth]);

  // Sync cache on mutations (debounced to batch rapid changes)
  const coreCacheRef = useRef({ students, teachers, grades, schedules, modules });
  coreCacheRef.current = { students, teachers, grades, schedules, modules };
  useEffect(() => {
    if (loading || !(isAuthenticated || isDirectorAuth)) return;
    const timer = setTimeout(() => {
      writeCache(CORE_CACHE_KEY, coreCacheRef.current);
    }, 500);
    return () => clearTimeout(timer);
  }, [students, teachers, grades, schedules, modules, loading, isAuthenticated, isDirectorAuth]);

  useEffect(() => {
    if (!isAuthenticated && !isDirectorAuth) {
      localStorage.removeItem(FINANCE_CACHE_PAYMENTS_KEY);
      localStorage.removeItem(FINANCE_CACHE_SALARIES_KEY);
      localStorage.removeItem(FINANCE_CACHE_EXPENSES_KEY);
      financeLoadedRef.current = false;
    }
  }, [isAuthenticated, isDirectorAuth]);

  useEffect(() => {
    localStorage.setItem('eco_auth', isAuthenticated);
  }, [isAuthenticated]);

  useEffect(() => {
    sessionStorage.setItem('ipfp_director_auth', isDirectorAuth);
  }, [isDirectorAuth]);

  const login = (password) => {
    const adminPass = import.meta.env.VITE_ADMIN_PASSWORD;
    const directorPass = import.meta.env.VITE_DIRECTOR_PASSWORD;
    const cleanPassword = password.trim();

    if (cleanPassword === adminPass || cleanPassword === directorPass) {
      setIsAuthenticated(true);
      if (cleanPassword === directorPass) {
        setIsDirectorAuth(true);
      }
      showToast('Connexion réussie', 'success');
      return true;
    }
    showToast('Mot de passe incorrect', 'error');
    return false;
  };

  const loginDirector = (password) => {
    const cleanPassword = password.trim();

    if (cleanPassword === import.meta.env.VITE_DIRECTOR_PASSWORD) {
      setIsDirectorAuth(true);
      showToast('Accès Direction autorisé', 'success');
      return true;
    }
    showToast('Mot de passe incorrect', 'error');
    return false;
  };

  const logoutDirector = () => {
    setIsDirectorAuth(false);
    showToast('Déconnexion direction effectuée');
  };
  
  const logout = () => {
    setIsAuthenticated(false);
    showToast('Déconnexion effectuée');
  };

  const logAppAccess = useCallback(async (context = {}) => {
    if (accessLoggedRef.current) return;

    try {
      if (sessionStorage.getItem(ACCESS_LOG_SESSION_KEY) === 'true') {
        accessLoggedRef.current = true;
        return;
      }
      sessionStorage.setItem(ACCESS_LOG_SESSION_KEY, 'true');
    } catch {
      // sessionStorage can be unavailable in private browsing.
    }

    accessLoggedRef.current = true;

    try {
      const newLog = await buildAccessLogPayload(context);
      const docRef = await addDoc(collection(db, 'access_logs'), newLog);
      setAccessLogs(prev => [{ id: docRef.id, ...newLog }, ...prev].slice(0, ACCESS_LOG_LIMIT));
    } catch (error) {
      console.error('Error logging app access:', error);
    }
  }, []);

  const loadAccessLogs = useCallback(async () => {
    try {
      const snapshot = await getDocs(query(collection(db, 'access_logs'), orderBy('loggedAt', 'desc'), limit(ACCESS_LOG_LIMIT)));
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAccessLogs(data);
      return data;
    } catch (error) {
      console.error('Error loading access logs:', error);
      showToast('Erreur de chargement du journal des accès', 'error');
      return [];
    }
  }, [showToast]);

  // --- STAGIAIRES ---
  const addStudent = async (studentData) => {
    const token = makeToken(32);
    const academicYear = validateAcademicYear(studentData.academicYear)
      ? studentData.academicYear
      : operationalAcademicYear;
    const newStudent = { ...studentData, academicYear, token, createdAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, 'students'), newStudent);
    setStudents(prev => [{ id: docRef.id, ...newStudent }, ...prev]);
    showToast(`Nouveau stagiaire ajouté : ${studentData.lastName}.`, 'success');
    return token;
  };

  const updateStudent = async (id, data) => {
    await updateDoc(doc(db, 'students', id), data);
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    showToast(`Profil stagiaire mis à jour.`, 'success');
  };

  const promoteAcademicYear = async ({ fromAcademicYear = '', toAcademicYear = '' } = {}) => {
    // Improvement #1: Validate academic year format
    if (!validateAcademicYearTransition(fromAcademicYear, toAcademicYear)) {
      showToast('Format d\u2019ann\u00e9e invalide. Utilisez le format AAAA-AAAA (ex: 2025-2026).', 'error');
      return { promotedCount: 0, graduatedCount: 0, error: 'INVALID_FORMAT' };
    }
    if (fromAcademicYear !== operationalAcademicYearRef.current) {
      showToast(`L'année active est ${operationalAcademicYearRef.current}. Rechargez la clôture avant de continuer.`, 'error');
      return { promotedCount: 0, graduatedCount: 0, error: 'STALE_OPERATIONAL_YEAR' };
    }

    const closedAt = new Date().toISOString();
    const candidates = (students || [])
      .filter(isActiveStudent)
      .filter(student => isStudentCurrentlyInAcademicYear(
        student,
        fromAcademicYear,
        operationalAcademicYearRef.current
      ))
      .filter(s => isKnownStudyYear(s.diploma, s.year));

    if (candidates.length === 0) {
      showToast('Aucun stagiaire actif \u00e0 promouvoir.', 'info');
      return { promotedCount: 0, graduatedCount: 0, error: 'NO_CANDIDATES' };
    }

    // Improvement #3: Detect double closure
    const alreadyClosed = candidates.some(s =>
      Array.isArray(s.classHistory) &&
      s.classHistory.some(h => h.academicYear === fromAcademicYear)
    );
    if (alreadyClosed) {
      showToast(`L\u2019ann\u00e9e ${fromAcademicYear} a d\u00e9j\u00e0 \u00e9t\u00e9 cl\u00f4tur\u00e9e pour certains stagiaires.`, 'error');
      return { promotedCount: 0, graduatedCount: 0, error: 'ALREADY_CLOSED' };
    }

    const settingsRef = doc(db, 'settings', 'app');
    const proposedOperationId = `academic-year-${Date.now()}-${makeToken(8)}`;
    let operationId;
    try {
      operationId = await runTransaction(db, async transaction => {
        const settingsSnapshot = await transaction.get(settingsRef);
        const settings = settingsSnapshot.exists() ? settingsSnapshot.data() : {};
        const serverAcademicYear = validateAcademicYear(settings?.operationalAcademicYear)
          ? settings.operationalAcademicYear
          : INITIAL_OPERATIONAL_ACADEMIC_YEAR;

        if (serverAcademicYear !== fromAcademicYear) {
          const staleError = new Error(`L'année active est ${serverAcademicYear}.`);
          staleError.code = 'STALE_OPERATIONAL_YEAR';
          staleError.serverAcademicYear = serverAcademicYear;
          throw staleError;
        }

        const pendingClosure = settings?.academicYearClosure;
        if (pendingClosure?.status === 'in_progress') {
          if (
            pendingClosure.fromAcademicYear === fromAcademicYear &&
            pendingClosure.toAcademicYear === toAcademicYear &&
            pendingClosure.operationId
          ) {
            return pendingClosure.operationId;
          }
          const busyError = new Error('Une autre clôture est déjà en cours.');
          busyError.code = 'ACADEMIC_YEAR_CLOSURE_IN_PROGRESS';
          throw busyError;
        }

        transaction.set(settingsRef, {
          academicYearClosure: {
            status: 'in_progress',
            operationId: proposedOperationId,
            fromAcademicYear,
            toAcademicYear,
            startedAt: serverTimestamp(),
          },
        }, { merge: true });
        return proposedOperationId;
      });
    } catch (error) {
      if (error?.code === 'STALE_OPERATIONAL_YEAR') {
        showToast(`L'année active est ${error.serverAcademicYear}. Rechargez la clôture avant de continuer.`, 'error');
        return { promotedCount: 0, graduatedCount: 0, error: 'STALE_OPERATIONAL_YEAR' };
      }
      if (error?.code === 'ACADEMIC_YEAR_CLOSURE_IN_PROGRESS') {
        showToast('Une autre clôture académique est déjà en cours.', 'error');
        return { promotedCount: 0, graduatedCount: 0, error: 'CLOSURE_IN_PROGRESS' };
      }
      throw error;
    }

    const updates = candidates.map(student => {
      const studentGradeDocument = grades[student.id] || {};
      const archivedGrades = getGradeBucketForWrite(studentGradeDocument, fromAcademicYear);
      const historyEntry = {
        academicYear: fromAcademicYear,
        diploma: student.diploma || '',
        major: student.major || '',
        year: student.year || '',
        status: student.status || STUDENT_STATUS.ACTIVE,
        closedAt,
        operationId,
      };
      const classHistory = [...(Array.isArray(student.classHistory) ? student.classHistory : []), historyEntry];
      const newToken = makeToken(32);

      const nextStudyYear = getNextStudyYear(student.diploma, student.year);
      if (!nextStudyYear) {
        return {
          id: student.id,
          localData: {
            status: STUDENT_STATUS.LAUREAT,
            academicYear: fromAcademicYear,
            graduationAcademicYear: fromAcademicYear,
            graduatedAt: closedAt,
            classHistory,
            token: newToken,
          },
          firestoreData: {
            status: STUDENT_STATUS.LAUREAT,
            academicYear: fromAcademicYear,
            graduationAcademicYear: fromAcademicYear,
            graduatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            classHistory,
            token: newToken,
          },
          type: 'graduated',
          archivedGrades,
        };
      }

      return {
        id: student.id,
        localData: {
          year: nextStudyYear,
          status: STUDENT_STATUS.ACTIVE,
          academicYear: toAcademicYear,
          previousAcademicYear: fromAcademicYear,
          promotedFromYear: student.year,
          promotedAt: closedAt,
          classHistory,
          token: newToken,
        },
        firestoreData: {
          year: nextStudyYear,
          status: STUDENT_STATUS.ACTIVE,
          academicYear: toAcademicYear,
          previousAcademicYear: fromAcademicYear,
          promotedFromYear: student.year,
          promotedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          classHistory,
          token: newToken,
        },
        type: 'promoted',
        archivedGrades,
      };
    });

    const promotedCount = updates.filter(item => item.type === 'promoted').length;
    const graduatedCount = updates.filter(item => item.type === 'graduated').length;
    const nextArchivedAcademicYears = Array.from(new Set([
      ...availableAcademicYearsList.filter(year => year < toAcademicYear),
      fromAcademicYear,
    ])).sort((a, b) => b.localeCompare(a));
    const receiptCounterReset = {
      value: 0,
      academicYear: toAcademicYear,
      resetAt: serverTimestamp(),
      resetByOperationId: operationId,
    };

    // Improvement #9: Progressive batch processing with error handling
    let processedIds = [];
    try {
      // A candidate can generate two writes (student + grade snapshot), so
      // keep each batch safely below Firestore's 500-write limit.
      for (let i = 0; i < updates.length; i += 225) {
        const chunk = updates.slice(i, i + 225);
        const isFinalChunk = i + 225 >= updates.length;
        const batch = writeBatch(db);
        chunk.forEach(({ id, firestoreData, archivedGrades }) => {
          batch.update(doc(db, 'students', id), firestoreData);
          if (Object.keys(archivedGrades || {}).length > 0) {
            batch.set(doc(db, 'grades', id), {
              [GRADE_ACADEMIC_YEARS_FIELD]: {
                [fromAcademicYear]: archivedGrades,
              },
            }, { merge: true });
          }
        });
        if (isFinalChunk) {
          batch.set(
            doc(db, RECEIPT_COUNTERS_COLLECTION, 'payment_FD'),
            { ...receiptCounterReset, prefix: STUDENT_RECEIPT_PREFIX },
            { merge: true }
          );
          batch.set(
            doc(db, RECEIPT_COUNTERS_COLLECTION, 'salary_F'),
            { ...receiptCounterReset, prefix: 'F' },
            { merge: true }
          );
          batch.set(settingsRef, {
            operationalAcademicYear: toAcademicYear,
            archivedAcademicYears: nextArchivedAcademicYears,
            academicYearUpdatedAt: serverTimestamp(),
            lastAcademicYearOperationId: operationId,
            academicYearClosure: {
              status: 'completed',
              operationId,
              fromAcademicYear,
              toAcademicYear,
              completedAt: serverTimestamp(),
            },
          }, { merge: true });
        }
        await batch.commit();
        // Update local state progressively after each successful batch
        const chunkIds = chunk.map(c => c.id);
        processedIds = [...processedIds, ...chunkIds];
        const chunkMap = new Map(chunk.map(item => [item.id, item.localData]));
        setStudents(prev => prev.map(student => chunkMap.has(student.id) ? { ...student, ...chunkMap.get(student.id) } : student));
        setGrades(prev => {
          const next = { ...prev };
          chunk.forEach(({ id, archivedGrades }) => {
            if (Object.keys(archivedGrades || {}).length === 0) return;
            const studentGradeDocument = prev[id] || {};
            next[id] = {
              ...studentGradeDocument,
              [GRADE_ACADEMIC_YEARS_FIELD]: {
                ...(studentGradeDocument[GRADE_ACADEMIC_YEARS_FIELD] || {}),
                [fromAcademicYear]: archivedGrades,
              },
            };
          });
          return next;
        });
      }
    } catch (err) {
      console.error('Erreur batch cl\u00f4ture:', err);
      if (processedIds.length > 0) {
        showToast(`Erreur partielle : ${processedIds.length}/${updates.length} stagiaires mis \u00e0 jour. Relancez la m\u00eame cl\u00f4ture pour terminer.`, 'error');
      }
      throw err;
    }

    localStorage.removeItem(CORE_CACHE_KEY);

    operationalAcademicYearRef.current = toAcademicYear;
    setOperationalAcademicYearState(toAcademicYear);
    setArchivedAcademicYears(nextArchivedAcademicYears);
    setActiveAcademicYear(toAcademicYear);
    try { localStorage.setItem(OPERATIONAL_ACADEMIC_YEAR_KEY, toAcademicYear); } catch { /* ignore */ }

    // Improvement #7: Build breakdown by filière
    const breakdown = {};
    updates.forEach(({ id, type }) => {
      const student = candidates.find(s => s.id === id);
      if (!student) return;
      const key = `${student.diploma || 'N/A'} - ${student.major || 'N/A'}`;
      if (!breakdown[key]) breakdown[key] = { promoted: 0, graduated: 0 };
      breakdown[key][type === 'promoted' ? 'promoted' : 'graduated']++;
    });

    // Improvement #8: Log operation in Firestore
    try {
      await addDoc(collection(db, 'operations'), {
        type: 'academic_year_closure',
        operationId,
        fromAcademicYear,
        toAcademicYear,
        promotedCount,
        graduatedCount,
        totalAffected: updates.length,
        promotedIds: updates.filter(u => u.type === 'promoted').map(u => u.id),
        graduatedIds: updates.filter(u => u.type === 'graduated').map(u => u.id),
        breakdown,
        receiptCountersReset: true,
        performedAt: serverTimestamp(),
        closedAt,
      });
    } catch (logErr) {
      console.error('Erreur journalisation:', logErr);
    }

    showToast(`${promotedCount} stagiaire(s) promu(s), ${graduatedCount} laur\u00e9at(s) archiv\u00e9(s). Les num\u00e9ros de re\u00e7us ont \u00e9t\u00e9 r\u00e9initialis\u00e9s.`, 'success');
    return { promotedCount, graduatedCount, operationId, breakdown, receiptCountersReset: true };
  };

  // Improvement #6: Undo last promotion
  const undoLastPromotion = async (operationId) => {
    if (!operationId) {
      showToast('Aucune op\u00e9ration \u00e0 annuler.', 'info');
      return;
    }

    const affected = (students || []).filter(s =>
      Array.isArray(s.classHistory) &&
      s.classHistory.length > 0 &&
      s.classHistory[s.classHistory.length - 1].operationId === operationId
    );

    if (affected.length === 0) {
      showToast('Aucun stagiaire trouv\u00e9 pour cette op\u00e9ration.', 'info');
      return;
    }

    const undoUpdates = affected.map(student => {
      const lastEntry = student.classHistory[student.classHistory.length - 1];
      const restoredHistory = student.classHistory.slice(0, -1);

      const restoreData = {
        year: lastEntry.year,
        status: lastEntry.status || STUDENT_STATUS.ACTIVE,
        academicYear: lastEntry.academicYear || '',
        classHistory: restoredHistory,
      };

      // Clean up promotion/graduation fields
      const cleanFields = {
        graduationAcademicYear: '',
        graduatedAt: '',
        previousAcademicYear: '',
        promotedFromYear: '',
        promotedAt: '',
      };

      return {
        id: student.id,
        localData: { ...restoreData, ...cleanFields },
        firestoreData: { ...restoreData, ...cleanFields, updatedAt: serverTimestamp() },
      };
    });

    const restoredOperationalAcademicYear = affected[0].classHistory[affected[0].classHistory.length - 1].academicYear;
    const restoredArchivedAcademicYears = availableAcademicYearsList
      .filter(year => year < restoredOperationalAcademicYear);

    for (let i = 0; i < undoUpdates.length; i += 450) {
      const batch = writeBatch(db);
      undoUpdates.slice(i, i + 450).forEach(({ id, firestoreData }) => {
        batch.update(doc(db, 'students', id), firestoreData);
      });
      if (i + 450 >= undoUpdates.length) {
        batch.set(doc(db, 'settings', 'app'), {
          operationalAcademicYear: restoredOperationalAcademicYear,
          archivedAcademicYears: restoredArchivedAcademicYears,
          academicYearUpdatedAt: serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
    }

    const updateMap = new Map(undoUpdates.map(item => [item.id, item.localData]));
    setStudents(prev => prev.map(student => updateMap.has(student.id) ? { ...student, ...updateMap.get(student.id) } : student));
    setOperationalAcademicYearState(restoredOperationalAcademicYear);
    setArchivedAcademicYears(restoredArchivedAcademicYears);
    setActiveAcademicYear(restoredOperationalAcademicYear);
    try { localStorage.setItem(OPERATIONAL_ACADEMIC_YEAR_KEY, restoredOperationalAcademicYear); } catch { /* ignore */ }
    localStorage.removeItem(CORE_CACHE_KEY);

    showToast(`${affected.length} stagiaire(s) restaur\u00e9(s) \u00e0 leur \u00e9tat pr\u00e9c\u00e9dent.`, 'success');
    return { restoredCount: affected.length };
  };

  const deleteStudent = async (id) => {
    await deleteDoc(doc(db, 'students', id));
    setStudents(prev => prev.filter(s => s.id !== id));
    showToast(`Stagiaire supprimé.`, 'warning');
  };

  // --- FORMATEURS ---
  const addTeacher = async (teacherData) => {
    const tokenGrades = makeToken(32);
    const tokenAttendance = makeToken(32);
    const newTeacher = { ...teacherData, tokenGrades, tokenAttendance, createdAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, 'teachers'), newTeacher);
    setTeachers(prev => [{ id: docRef.id, ...newTeacher }, ...prev]);
    showToast(`Nouveau formateur ajouté : ${teacherData.name}.`, 'success');
    return { tokenGrades, tokenAttendance };
  };

  const updateTeacher = async (id, data) => {
    await updateDoc(doc(db, 'teachers', id), data);
    setTeachers(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    showToast(`Profil formateur mis à jour.`, 'success');
  };

  const deleteTeacher = async (id) => {
    await deleteDoc(doc(db, 'teachers', id));
    setTeachers(prev => prev.filter(t => t.id !== id));
    showToast(`Formateur supprimé.`, 'warning');
  };

  const migrateTeacherTokens = async () => {
    const batch = [];
    const updatedTeachers = [];
    teachers.forEach(t => {
      if (!t.tokenGrades || !t.tokenAttendance) {
        const tokenGrades = makeToken(32);
        const tokenAttendance = makeToken(32);
        batch.push(updateDoc(doc(db, 'teachers', t.id), { tokenGrades, tokenAttendance }));
        updatedTeachers.push({ ...t, tokenGrades, tokenAttendance });
      } else {
        updatedTeachers.push(t);
      }
    });
    if (batch.length > 0) {
      await Promise.all(batch);
      setTeachers(updatedTeachers);
      showToast(`${batch.length} formateurs mis à jour avec de nouveaux jetons.`, 'success');
    }
  };

  // --- EMPLOI DU TEMPS ---
  const addSchedule = async (scheduleData) => {
    const newSchedule = { ...scheduleData, createdAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, 'schedules'), newSchedule);
    setSchedules(prev => [{ id: docRef.id, ...newSchedule }, ...prev]);
    showToast(`Séance de ${scheduleData.module} ajoutée.`, 'success');
  };

  const updateSchedule = async (id, data) => {
    await updateDoc(doc(db, 'schedules', id), data);
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    showToast(`Séance de ${data.module} mise à jour.`, 'success');
  };

  const deleteSchedule = async (id) => {
    await deleteDoc(doc(db, 'schedules', id));
    setSchedules(prev => prev.filter(s => s.id !== id));
    showToast(`Séance supprimée.`, 'warning');
  };

  const clearAllSchedules = async () => {
    const snapshot = await getDocs(collection(db, 'schedules'));
    const ids = snapshot.docs.map(item => item.id);
    if (ids.length === 0) {
      showToast('Aucune séance à supprimer.', 'info');
      return;
    }
    for (let i = 0; i < ids.length; i += 450) {
      const batch = writeBatch(db);
      ids.slice(i, i + 450).forEach(id => {
        batch.delete(doc(db, 'schedules', id));
      });
      await batch.commit();
    }
    setSchedules([]);
    showToast(`Emploi du temps vidé.`, 'warning');
  };

  // --- NOTES ---
  const resolveGradeAcademicYear = (studentId, academicYear = '') =>
    academicYear || getStudentCurrentAcademicYear(
      (students || []).find(student => student.id === studentId),
      operationalAcademicYear
    );

  const updateGrades = async (studentId, subject, gradeData, academicYear = '') => {
    const safeSubject = sanitizeGradeKey(subject);
    const resolvedAcademicYear = resolveGradeAcademicYear(studentId, academicYear);
    const currentStudentGrades = grades[studentId] || {};
    const nextGradeBucket = {
      ...getGradeBucketForWrite(currentStudentGrades, resolvedAcademicYear),
      [safeSubject]: gradeData,
    };
    const gradeRef = doc(db, 'grades', studentId);
    await setDoc(gradeRef, {
      [GRADE_ACADEMIC_YEARS_FIELD]: {
        [resolvedAcademicYear]: nextGradeBucket
      }
    }, { merge: true });
    
    setGrades(prev => {
      const currentStudentGrades = prev[studentId] || {};
      const currentAcademicYears = currentStudentGrades[GRADE_ACADEMIC_YEARS_FIELD] || {};
      return {
        ...prev,
        [studentId]: {
          ...currentStudentGrades,
          [GRADE_ACADEMIC_YEARS_FIELD]: {
            ...currentAcademicYears,
            [resolvedAcademicYear]: nextGradeBucket,
          },
        }
      };
    });
    showToast('Notes enregistrées', 'success');
  };

  const batchUpdateGrades = async (updates) => {
    const batch = writeBatch(db);
    const newGrades = { ...grades };
    
    updates.forEach(({studentId, subject, gradeData, academicYear}) => {
      const safeSubject = sanitizeGradeKey(subject);
      const resolvedAcademicYear = resolveGradeAcademicYear(studentId, academicYear);
      const currentStudentGrades = newGrades[studentId] || {};
      const nextGradeBucket = {
        ...getGradeBucketForWrite(currentStudentGrades, resolvedAcademicYear),
        [safeSubject]: gradeData,
      };
      const gradeRef = doc(db, 'grades', studentId);
      batch.set(gradeRef, {
        [GRADE_ACADEMIC_YEARS_FIELD]: {
          [resolvedAcademicYear]: nextGradeBucket
        }
      }, { merge: true });

      const currentAcademicYears = currentStudentGrades[GRADE_ACADEMIC_YEARS_FIELD] || {};
      newGrades[studentId] = {
        ...currentStudentGrades,
        [GRADE_ACADEMIC_YEARS_FIELD]: {
          ...currentAcademicYears,
          [resolvedAcademicYear]: nextGradeBucket,
        },
      };
    });
    
    await batch.commit();
    setGrades(newGrades);
    showToast('Notes enregistrées avec succès', 'success');
  };

  // --- PRESENCES ---
  const updateStudentAttendance = async (studentId, moduleId, date, status, comment, formateurId = 'admin', timeSlot = '', recordId = '') => {
    const { canonicalId, previousId } = getStudentAttendanceWriteTarget(studentId, moduleId, date, timeSlot, recordId);
    if (!status) {
      const docId = recordId || canonicalId;
      await deleteDoc(doc(db, 'attendance_stagiaires', docId));
      setStudentAttendance(prev => prev.filter(record => record.id !== docId));
      return;
    }
    const newRecord = { studentId, moduleId, date, status, comment: comment || '', formateurId, timeSlot: timeSlot || '', timestamp: serverTimestamp() };

    if (previousId) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'attendance_stagiaires', canonicalId), newRecord, { merge: true });
      batch.delete(doc(db, 'attendance_stagiaires', previousId));
      await batch.commit();
    } else {
      await setDoc(doc(db, 'attendance_stagiaires', canonicalId), newRecord, { merge: true });
    }

    setStudentAttendance(prev => {
      const withoutPreviousVersions = prev.filter(record =>
        record.id !== canonicalId && (!previousId || record.id !== previousId)
      );
      return [...withoutPreviousVersions, { id: canonicalId, ...newRecord }];
    });
  };

  const loadAttendanceForSession = useCallback(async (moduleId, date) => {
    if (!moduleId || !date) return;
    const cacheKey = `${moduleId}:${date}`;
    if (studentAttendanceKeysRef.current.has(cacheKey)) return;
    try {
      const q = query(collection(db, 'attendance_stagiaires'), where('moduleId', '==', moduleId), where('date', '==', date));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudentAttendance(prev => mergeById(prev, data));
      studentAttendanceKeysRef.current.add(cacheKey);
    } catch (e) {
      console.error("Error loading session attendance:", e);
      showToast('Erreur de chargement des présences', 'error');
    }
  }, [showToast]);

  const loadStudentAttendanceForMonth = useCallback(async (monthIndex, year) => {
    const { start, end } = getMonthBounds(monthIndex, year);
    const cacheKey = `student-month:${year}-${monthIndex}`;
    if (studentAttendanceKeysRef.current.has(cacheKey)) return;
    try {
      const snapshot = await getDocs(query(
        collection(db, 'attendance_stagiaires'),
        where('date', '>=', start),
        where('date', '<=', end)
      ));
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudentAttendance(prev => {
        const withoutMonth = prev.filter(a => !a.date || a.date < start || a.date > end);
        return mergeById(withoutMonth, data);
      });
      studentAttendanceKeysRef.current.add(cacheKey);
    } catch (e) {
      console.error("Error loading monthly student attendance:", e);
      showToast('Erreur de chargement des présences mensuelles', 'error');
    }
  }, [showToast]);

  const loadTeacherAttendanceForDate = useCallback(async (date) => {
    if (!date) return;
    const cacheKey = `date:${date}`;
    if (teacherAttendanceKeysRef.current.has(cacheKey)) return;

    try {
      const snapshot = await getDocs(query(collection(db, 'attendance_formateurs'), where('date', '==', date)));
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeacherAttendance(prev => mergeById(prev, data));
      teacherAttendanceKeysRef.current.add(cacheKey);
    } catch (e) {
      console.error("Error loading teacher attendance:", e);
      showToast('Erreur de chargement des présences formateurs', 'error');
    }
  }, [showToast]);

  const loadTeacherAttendanceForMonth = useCallback(async (monthIndex, year, { force = false } = {}) => {
    const { start, end } = getMonthBounds(monthIndex, year);
    const cacheKey = `month:${year}-${monthIndex}`;
    if (teacherAttendanceKeysRef.current.has(cacheKey) && !force) return;

    try {
      const snapshot = await getDocs(query(
        collection(db, 'attendance_formateurs'),
        where('date', '>=', start),
        where('date', '<=', end)
      ));
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeacherAttendance(prev => {
        const withoutMonth = prev.filter(record => !record.date || record.date < start || record.date > end);
        return mergeById(withoutMonth, data);
      });
      teacherAttendanceKeysRef.current.add(cacheKey);
    } catch (e) {
      console.error("Error loading monthly teacher attendance:", e);
      showToast('Erreur de chargement des vacations mensuelles', 'error');
    }
  }, [showToast]);

  const updateTeacherAttendance = async (teacherId, date, status, comment, hours = 0, moduleId = '', timeSlot = '') => {
    const safeModule = (moduleId || 'global').replace(/[^a-zA-Z0-9]/g, '_');
    const safeTime = (timeSlot || '').replace(/[^0-9]/g, '') || 'x';
    const docId = `${teacherId}_${safeModule}_${safeTime}_${date}`;
    const parsedHours = Number(hours);
    const safeHours = Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : getTimeSlotDuration(timeSlot);
    const data = { teacherId, date, status, hours: status === 'present' ? safeHours : 0, comment: comment || '', moduleId: moduleId || '', timeSlot: timeSlot || '', timestamp: serverTimestamp() };
    
    await setDoc(doc(db, 'attendance_formateurs', docId), data, { merge: true });
    
    setTeacherAttendance(prev => {
      const updatedRecord = { id: docId, ...data };
      const updatedSlotKey = getTeacherAttendanceSlotKey(updatedRecord);
      const deduped = prev.filter(a => a.id === docId || getTeacherAttendanceSlotKey(a) !== updatedSlotKey);
      const existingIdx = deduped.findIndex(a => a.id === docId);
      if (existingIdx >= 0) {
        const updated = [...deduped];
        updated[existingIdx] = updatedRecord;
        return updated;
      }
      return [...deduped, updatedRecord];
    });
    showToast('Présence formateur enregistrée', 'success');
  };

  // --- FINANCES ---
  const loadFinancialData = useCallback(async ({ force = false } = {}) => {
    if (financeLoadedRef.current && !force) return;

    const cachedPayments = readCache(FINANCE_CACHE_PAYMENTS_KEY, FINANCE_CACHE_TTL);
    const cachedSalaries = readCache(FINANCE_CACHE_SALARIES_KEY, FINANCE_CACHE_TTL);
    const cachedExpenses = readCache(FINANCE_CACHE_EXPENSES_KEY, FINANCE_CACHE_TTL);
    if (cachedPayments && cachedSalaries && cachedExpenses && !force) {
      setPayments(cachedPayments);
      setSalaries(cachedSalaries);
      setExpenses(cachedExpenses);
    }

    const financeLoadKey = 'finance';
    if (!pendingLoads.has(financeLoadKey)) {
      pendingLoads.set(financeLoadKey, Promise.all([
        getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'salaries'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'expenses'), orderBy('createdAt', 'desc')))
      ]).then(async ([paySnap, salSnap, expSnap]) => {
        const paymentBackfill = [];
        const payments = paySnap.docs.map(paymentDoc => {
          const payment = { id: paymentDoc.id, ...paymentDoc.data() };
          const academicYear = getPaymentAcademicYear(payment);
          if (academicYear && payment.academicYear !== academicYear) {
            paymentBackfill.push({ ref: paymentDoc.ref, academicYear });
          }
          return academicYear ? { ...payment, academicYear } : payment;
        });
        const salaries = salSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        try {
          for (let i = 0; i < paymentBackfill.length; i += 450) {
            const batch = writeBatch(db);
            paymentBackfill.slice(i, i + 450).forEach(({ ref, academicYear }) => {
              batch.update(ref, { academicYear });
            });
            await batch.commit();
          }
        } catch (migrationError) {
          // Reading and filtering still work from the normalized in-memory data.
          console.warn('Impossible de compléter les années académiques des anciens paiements:', migrationError);
        }
        writeCache(FINANCE_CACHE_PAYMENTS_KEY, payments);
        writeCache(FINANCE_CACHE_SALARIES_KEY, salaries);
        writeCache(FINANCE_CACHE_EXPENSES_KEY, expenses);
        return { payments, salaries, expenses };
      }).finally(() => {
        pendingLoads.delete(financeLoadKey);
      }));
    }

    try {
      const data = await pendingLoads.get(financeLoadKey);
      setPayments(data.payments || []);
      setSalaries(data.salaries || []);
      setExpenses(data.expenses || []);
      financeLoadedRef.current = true;
    } catch (e) {
      console.error("Error loading finance data:", e);
      showToast('Erreur de chargement financier', 'error');
    }
  }, [showToast]);

  const addPayment = async (paymentData) => {
    const prefix = STUDENT_RECEIPT_PREFIX;
    const existingFloor = Math.max(
      payments.length,
      ...payments.map(payment => getReceiptNumberValue(payment.receiptNumber, prefix))
    );
    const paymentRef = doc(collection(db, 'payments'));
    const counterRef = doc(db, RECEIPT_COUNTERS_COLLECTION, 'payment_FD');
    let newPayment;

    await runTransaction(db, async transaction => {
      const counterSnapshot = await transaction.get(counterRef);
      const counterData = counterSnapshot.exists() ? counterSnapshot.data() : {};
      const currentValue = Number(counterData?.value) || 0;
      const nextValue = counterSnapshot.exists() ? currentValue + 1 : existingFloor + 1;
      const academicYear = getPaymentAcademicYear(paymentData) || counterData?.academicYear || '';
      newPayment = {
        ...paymentData,
        academicYear,
        receiptNumber: `${prefix}${String(nextValue).padStart(4, '0')}`,
        receiptAcademicYear: counterData?.academicYear || academicYear,
        createdAt: serverTimestamp()
      };
      transaction.set(counterRef, { value: nextValue, updatedAt: serverTimestamp() }, { merge: true });
      transaction.set(paymentRef, newPayment);
    });

    setPayments(prev => [{ id: paymentRef.id, ...newPayment }, ...prev]);
    localStorage.removeItem(FINANCE_CACHE_PAYMENTS_KEY);
    showToast('Paiement enregistré', 'success');
    return { id: paymentRef.id, ...newPayment };
  };

  const updatePayment = async (id, data) => {
    const currentPayment = payments.find(payment => payment.id === id) || {};
    const academicYear = getPaymentAcademicYear({ ...currentPayment, ...data });
    const normalizedData = academicYear ? { ...data, academicYear } : data;
    await updateDoc(doc(db, 'payments', id), normalizedData);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...normalizedData } : p));
    localStorage.removeItem(FINANCE_CACHE_PAYMENTS_KEY);
    showToast('Paiement mis à jour', 'success');
  };

  const deletePayment = async (id) => {
    await deleteDoc(doc(db, 'payments', id));
    setPayments(prev => prev.filter(p => p.id !== id));
    localStorage.removeItem(FINANCE_CACHE_PAYMENTS_KEY);
    showToast('Paiement supprimé', 'warning');
  };

  const addSalary = async (salaryData) => {
    const prefix = 'F';
    const existingFloor = Math.max(
      salaries.length,
      ...salaries.map(salary => getReceiptNumberValue(salary.receiptNumber, prefix))
    );
    const salaryRef = doc(collection(db, 'salaries'));
    const counterRef = doc(db, RECEIPT_COUNTERS_COLLECTION, 'salary_F');
    let newSalary;

    await runTransaction(db, async transaction => {
      const counterSnapshot = await transaction.get(counterRef);
      const counterData = counterSnapshot.exists() ? counterSnapshot.data() : {};
      const currentValue = Number(counterData?.value) || 0;
      const nextValue = counterSnapshot.exists() ? currentValue + 1 : existingFloor + 1;
      newSalary = {
        ...salaryData,
        receiptNumber: `F${String(nextValue).padStart(4, '0')}`,
        receiptAcademicYear: counterData?.academicYear || salaryData.academicYear || '',
        createdAt: serverTimestamp()
      };
      transaction.set(counterRef, { value: nextValue, updatedAt: serverTimestamp() }, { merge: true });
      transaction.set(salaryRef, newSalary);
    });

    setSalaries(prev => [{ id: salaryRef.id, ...newSalary }, ...prev]);
    localStorage.removeItem(FINANCE_CACHE_SALARIES_KEY);
    showToast('Salaire enregistré', 'success');
    return { id: salaryRef.id, ...newSalary };
  };

  const updateSalary = async (id, data) => {
    await updateDoc(doc(db, 'salaries', id), data);
    setSalaries(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    localStorage.removeItem(FINANCE_CACHE_SALARIES_KEY);
    showToast('Salaire mis à jour', 'success');
  };

  const deleteSalary = async (id) => {
    await deleteDoc(doc(db, 'salaries', id));
    setSalaries(prev => prev.filter(s => s.id !== id));
    localStorage.removeItem(FINANCE_CACHE_SALARIES_KEY);
    showToast('Salaire supprimé', 'warning');
  };

  const addExpense = async (expenseData) => {
    const newExpense = { ...expenseData, createdAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, 'expenses'), newExpense);
    setExpenses(prev => [{ id: docRef.id, ...newExpense }, ...prev]);
    localStorage.removeItem(FINANCE_CACHE_EXPENSES_KEY);
    showToast('Charge enregistrée', 'success');
  };

  const deleteExpense = async (id) => {
    await deleteDoc(doc(db, 'expenses', id));
    setExpenses(prev => prev.filter(e => e.id !== id));
    localStorage.removeItem(FINANCE_CACHE_EXPENSES_KEY);
    showToast('Charge supprimée', 'warning');
  };

  // --- MODULES ---
  const addModule = async (moduleData) => {
    const newModule = { ...moduleData, createdAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, 'modules'), newModule);
    setModules(prev => [{ id: docRef.id, ...newModule }, ...prev]);
    showToast(`Nouveau module ajouté : ${moduleData.name}.`, 'success');
  };

  const updateModule = async (id, data) => {
    await updateDoc(doc(db, 'modules', id), data);
    setModules(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
    showToast(`Module mis à jour.`, 'success');
  };

  const reorderModules = async (orderUpdates = []) => {
    const validUpdates = (orderUpdates || [])
      .filter(item => item?.id && Number.isInteger(Number(item.order)) && Number(item.order) > 0)
      .map(item => ({ id: item.id, order: Number(item.order) }));

    if (validUpdates.length === 0) return;

    const batch = writeBatch(db);
    validUpdates.forEach(({ id, order }) => {
      batch.update(doc(db, 'modules', id), { order });
    });
    await batch.commit();

    const orderById = new Map(validUpdates.map(item => [item.id, item.order]));
    setModules(prev => prev.map(module =>
      orderById.has(module.id) ? { ...module, order: orderById.get(module.id) } : module
    ));
    showToast('Ordre des modules enregistre automatiquement.', 'success');
  };

  const deleteModule = async (id) => {
    await deleteDoc(doc(db, 'modules', id));
    setModules(prev => prev.filter(m => m.id !== id));
    showToast(`Module supprimé.`, 'warning');
  };

  // --- FORMATIONS CONTINUES ---
  const addContinuousTraining = async (data) => {
    const docRef = await addDoc(collection(db, 'continuousTrainings'), { ...data, createdAt: serverTimestamp() });
    setContinuousTrainings(prev => [{ id: docRef.id, ...data }, ...prev]);
    showToast(`Formation continue créée : ${data.name || 'Sans nom'}`, 'success');
  };
  const updateContinuousTraining = async (id, data) => {
    const current = continuousTrainings.find(item => item.id === id);
    await updateDoc(doc(db, 'continuousTrainings', id), data);
    setContinuousTrainings(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    showToast(`Formation continue mise à jour : ${data.name || current?.name || 'Sans nom'}`, 'success');
  };
  const deleteContinuousTraining = async (id) => {
    const current = continuousTrainings.find(item => item.id === id);
    await deleteDoc(doc(db, 'continuousTrainings', id));
    setContinuousTrainings(prev => prev.filter(item => item.id !== id));
    showToast(`Formation continue supprimée : ${current?.name || 'Sans nom'}`, 'warning');
  };
  const sortContinuousTrainingTypes = items =>
    [...items].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' }));
  const addContinuousTrainingType = async (data) => {
    const name = String(data?.name || '').trim();
    const payload = { name, createdAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, 'continuousTrainingTypes'), payload);
    setContinuousTrainingTypes(prev => sortContinuousTrainingTypes([{ id: docRef.id, name }, ...prev]));
    showToast(`Type de formation continue ajouté : ${name}`, 'success');
  };
  const renameContinuousTrainingType = async ({ id, oldName, name }) => {
    const nextName = String(name || '').trim();
    const batch = writeBatch(db);
    let hasWrites = false;

    if (id) {
      batch.update(doc(db, 'continuousTrainingTypes', id), { name: nextName, updatedAt: serverTimestamp() });
      hasWrites = true;
    }

    if (oldName && oldName !== nextName) {
      const trainingSnap = await getDocs(query(collection(db, 'continuousTrainings'), where('type', '==', oldName)));
      trainingSnap.docs.forEach(trainingDoc => {
        batch.update(trainingDoc.ref, { type: nextName });
        hasWrites = true;
      });
    }

    if (hasWrites) await batch.commit();
    if (id) setContinuousTrainingTypes(prev => sortContinuousTrainingTypes(prev.map(item => item.id === id ? { ...item, name: nextName } : item)));
    if (oldName && oldName !== nextName) {
      setContinuousTrainings(prev => prev.map(item => item.type === oldName ? { ...item, type: nextName } : item));
    }
    showToast(`Type de formation continue modifié : ${nextName}`, 'success');
  };
  const deleteContinuousTrainingType = async (id) => {
    const current = continuousTrainingTypes.find(item => item.id === id);
    await deleteDoc(doc(db, 'continuousTrainingTypes', id));
    setContinuousTrainingTypes(prev => prev.filter(item => item.id !== id));
    showToast(`Type de formation continue supprimé : ${current?.name || 'Sans nom'}`, 'warning');
  };
  const addCtStudent = async (data) => {
    const docRef = await addDoc(collection(db, 'ctStudents'), { ...data, createdAt: serverTimestamp() });
    setCtStudents(prev => [{ id: docRef.id, ...data }, ...prev]);
    showToast(`Stagiaire ajouté en formation continue : ${`${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Sans nom'}`, 'success');
  };
  const updateCtStudent = async (id, data) => {
    const current = ctStudents.find(item => item.id === id);
    await updateDoc(doc(db, 'ctStudents', id), data);
    setCtStudents(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    const studentName = `${data.firstName || current?.firstName || ''} ${data.lastName || current?.lastName || ''}`.trim();
    showToast(`Stagiaire de formation continue mis à jour : ${studentName || 'Sans nom'}`, 'success');
  };
  const deleteCtStudent = async (id) => {
    const current = ctStudents.find(item => item.id === id);
    await deleteDoc(doc(db, 'ctStudents', id));
    setCtStudents(prev => prev.filter(item => item.id !== id));
    const studentName = `${current?.firstName || ''} ${current?.lastName || ''}`.trim();
    showToast(`Stagiaire de formation continue supprimé : ${studentName || 'Sans nom'}`, 'warning');
  };
  const addCtSession = async (data) => {
    const docRef = await addDoc(collection(db, 'ctSessions'), { ...data, createdAt: serverTimestamp() });
    setCtSessions(prev => [{ id: docRef.id, ...data }, ...prev]);
    const trainingName = continuousTrainings.find(training => training.id === data.trainingId)?.name || 'Formation continue';
    showToast(`Séance de formation continue planifiée : ${trainingName}`, 'success');
  };
  const updateCtSession = async (id, data) => {
    const current = ctSessions.find(item => item.id === id);
    await updateDoc(doc(db, 'ctSessions', id), data);
    setCtSessions(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    const trainingName = continuousTrainings.find(training => training.id === (data.trainingId || current?.trainingId))?.name || 'Formation continue';
    showToast(`Séance de formation continue modifiée : ${trainingName}`, 'success');
  };
  const deleteCtSession = async (id) => {
    const current = ctSessions.find(item => item.id === id);
    await deleteDoc(doc(db, 'ctSessions', id));
    setCtSessions(prev => prev.filter(item => item.id !== id));
    const trainingName = continuousTrainings.find(training => training.id === current?.trainingId)?.name || 'Formation continue';
    showToast(`Séance de formation continue supprimée : ${trainingName}`, 'warning');
  };

  return (
    <AppContext.Provider value={{
      students, teachers, grades, isAuthenticated, isDirectorAuth, loading,
      login, logout, loginDirector, logoutDirector,
      addStudent, addTeacher, updateStudent, promoteAcademicYear, undoLastPromotion, updateTeacher, deleteStudent, deleteTeacher, updateGrades, batchUpdateGrades,
      studentAttendance, teacherAttendance, updateStudentAttendance, updateTeacherAttendance,
      loadAttendanceForSession, loadStudentAttendanceForMonth, loadTeacherAttendanceForDate, loadTeacherAttendanceForMonth,
      schedules, addSchedule, updateSchedule, deleteSchedule, clearAllSchedules, migrateTeacherTokens,
      payments, salaries, expenses, loadFinancialData, addPayment, updatePayment, deletePayment, addSalary, updateSalary, deleteSalary, addExpense, deleteExpense,
      modules, addModule, updateModule, deleteModule, reorderModules,
      continuousTrainings, addContinuousTraining, updateContinuousTraining, deleteContinuousTraining,
      continuousTrainingTypes, addContinuousTrainingType, renameContinuousTrainingType, deleteContinuousTrainingType,
      ctStudents, addCtStudent, updateCtStudent, deleteCtStudent,
      ctSessions, addCtSession, updateCtSession, deleteCtSession,
      accessLogs, logAppAccess, loadAccessLogs,
      activeSemester, setActiveSemester, getActiveScheduleModule,
      activeAcademicYear, setActiveAcademicYear, operationalAcademicYear, availableAcademicYearsList,
      confirmAction, notifications, markNotificationAsRead, clearNotifications
    }}>
      {children}
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </AppContext.Provider>
  );
};
