import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from './ToastContext';

const AppContext = createContext();
const ACCESS_LOG_LIMIT = 5;

export const useApp = () => useContext(AppContext);

// ──────────────────────────────────────────────────────────
// Cache sessionStorage (TTL 30 min)
// ──────────────────────────────────────────────────────────
const CORE_CACHE_KEY = 'ipfp_v2_core_cache';
const FINANCE_CACHE_KEY = 'ipfp_v2_finance_cache';
const CORE_CACHE_TTL = 6 * 60 * 60 * 1000;
const FINANCE_CACHE_TTL = 15 * 60 * 1000;
const ACTIVE_SEMESTER_KEY = 'ipfp_active_semester';
const pendingLoads = new Map();
const normalizeSemester = (semester) => semester === 'S2' ? 'S2' : 'S1';
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
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (e) { }
};
const mergeById = (current, incoming) => {
  const map = new Map((current || []).map(item => [item.id, item]));
  incoming.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
};

const getScheduleModuleForSemester = (session = {}, semester = 'S1') => {
  if (normalizeSemester(semester) === 'S2') return session.moduleS2 || session.module || '';
  return session.moduleS1 || session.module || '';
};

const getTeacherAttendanceSlotKey = (record = {}) => {
  const safeTime = (record.timeSlot || '').replace(/[^0-9]/g, '') || 'x';
  return `${record.teacherId || ''}_${record.date || ''}_${safeTime}`;
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
  const [notifications, setNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ipfp_notifications')) || []; } catch { return []; }
  });
  
  useEffect(() => { localStorage.setItem('ipfp_notifications', JSON.stringify(notifications)); }, [notifications]);

  const markNotificationAsRead = useCallback((id) => setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n)), []);
  const clearNotifications = useCallback(() => setNotifications([]), []);

  const showToast = useCallback((msg, type = 'info') => {
    originalShowToast(msg, type);
    if ((type === 'success' || type === 'warning') && !msg.toLowerCase().includes('connexion') && !msg.toLowerCase().includes('déconnexion')) {
      setNotifications(prev => [{ id: Date.now().toString() + Math.random(), message: msg, type, timestamp: Date.now(), read: false }, ...prev].slice(0, 10));
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
  const [accessLogs, setAccessLogs] = useState([]);
  const [activeSemester, setActiveSemesterState] = useState(() => {
    try { return normalizeSemester(localStorage.getItem(ACTIVE_SEMESTER_KEY)); } catch { return 'S1'; }
  });
  const [loading, setLoading] = useState(true);
  const studentAttendanceKeysRef = useRef(new Set());
  const teacherAttendanceKeysRef = useRef(new Set());
  const financeLoadedRef = useRef(false);
  const accessLoggedRef = useRef(false);

  // Modal de confirmation global
  const [confirmState, setConfirmState] = useState({ 
    isOpen: false, title: '', message: '', type: 'danger', resolve: null 
  });

  const confirmAction = (options) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: options.title || 'Confirmation',
        message: options.message || 'Êtes-vous sûr de vouloir continuer ?',
        type: options.type || 'danger',
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
    let isMounted = true;
    const loadActiveSemester = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'app'));
        if (!isMounted || !snap.exists()) return;
        const nextSemester = normalizeSemester(snap.data()?.activeSemester);
        setActiveSemesterState(nextSemester);
        try { localStorage.setItem(ACTIVE_SEMESTER_KEY, nextSemester); } catch { }
      } catch (error) {
        console.warn('Impossible de charger le semestre actif:', error);
      }
    };
    loadActiveSemester();
    return () => { isMounted = false; };
  }, []);

  const setActiveSemester = useCallback(async (semester) => {
    const nextSemester = normalizeSemester(semester);
    setActiveSemesterState(nextSemester);
    try { localStorage.setItem(ACTIVE_SEMESTER_KEY, nextSemester); } catch { }
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
    return getScheduleModuleForSemester(session, activeSemester);
  }, [activeSemester]);

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
              getDocs(query(collection(db, 'grades'), limit(500))),
              getDocs(query(collection(db, 'schedules'), orderBy('createdAt', 'desc'), limit(500))),
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
              setTimeout(() => pendingLoads.delete(coreLoadKey), 5000);
            }));
          }

          const coreData = await pendingLoads.get(coreLoadKey);
          
          if (!isMounted) return;

          setStudents(coreData.students || []);
          setTeachers(coreData.teachers || []);
          setGrades(coreData.grades || {});
          setSchedules(coreData.schedules || []);
          setModules(coreData.modules || []);

        } else if (isStudentPortal) {
          // 2. Portail Stagiaire: Chargement EXCLUSIF des données de ce stagiaire
          const token = path.split('/').pop();
          const stuQuery = query(collection(db, 'students'), where('token', '==', token));
          const stuSnap = await getDocs(stuQuery);
          let studentDoc = stuSnap.docs[0];
          
          if (!studentDoc) {
            const docSnap = await getDoc(doc(db, 'students', token));
            if (docSnap.exists()) studentDoc = docSnap;
          }

          if (studentDoc && isMounted) {
            const studentData = studentDoc.data();
            setStudents([{ id: studentDoc.id, ...studentData }]);
            const gradeSnap = await getDoc(doc(db, 'grades', studentDoc.id));
            if (gradeSnap.exists()) {
              setGrades({ [studentDoc.id]: gradeSnap.data() });
            }
            // Modules: filter by student's diploma + major (much fewer reads)
            let modQuery;
            if (studentData.diploma && studentData.major) {
              modQuery = query(collection(db, 'modules'), 
                where('diploma', '==', studentData.diploma),
                where('major', '==', studentData.major));
            } else {
              modQuery = query(collection(db, 'modules'), orderBy('name', 'asc'));
            }
            const modSnap = await getDocs(modQuery);
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
              const docSnap = await getDoc(doc(db, 'teachers', token));
              if (docSnap.exists()) teacherDoc = docSnap;
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

            // Modules: load all (small collection, needed for grade display)
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

  // Sync cache on mutations
  useEffect(() => {
    if (loading || !(isAuthenticated || isDirectorAuth)) return;
    writeCache(CORE_CACHE_KEY, {
      students, teachers, grades, schedules, modules
    });
  }, [students, teachers, grades, schedules, modules, loading, isAuthenticated, isDirectorAuth]);

  useEffect(() => {
    if (!isAuthenticated && !isDirectorAuth) {
      localStorage.removeItem(FINANCE_CACHE_KEY);
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
      const snapshot = await getDocs(query(collection(db, 'access_logs'), orderBy('loggedAt', 'desc'), limit(100)));
      const batch = writeBatch(db);
      snapshot.docs.slice(ACCESS_LOG_LIMIT).forEach(d => batch.delete(d.ref));
      if (snapshot.docs.length > ACCESS_LOG_LIMIT) await batch.commit();
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
    const newStudent = { ...studentData, token, createdAt: serverTimestamp() };
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
    const snapshot = await getDocs(query(collection(db, 'schedules')));
    await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    setSchedules([]);
    showToast(`Emploi du temps vidé.`, 'warning');
  };

  // --- NOTES ---
  const updateGrades = async (studentId, subject, gradeData) => {
    const safeSubject = subject.replace(/\./g, '_');
    const gradeRef = doc(db, 'grades', studentId);
    await setDoc(gradeRef, { [safeSubject]: gradeData }, { merge: true });
    
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [safeSubject]: gradeData
      }
    }));
    showToast('Notes enregistrées', 'success');
  };

  const batchUpdateGrades = async (updates) => {
    const batch = writeBatch(db);
    const newGrades = { ...grades };
    
    updates.forEach(({studentId, subject, gradeData}) => {
      const safeSubject = subject.replace(/\./g, '_');
      const gradeRef = doc(db, 'grades', studentId);
      batch.set(gradeRef, { [safeSubject]: gradeData }, { merge: true });
      
      if (!newGrades[studentId]) newGrades[studentId] = {};
      newGrades[studentId][safeSubject] = gradeData;
    });
    
    await batch.commit();
    setGrades(newGrades);
    showToast('Notes enregistrées avec succès', 'success');
  };

  // --- PRESENCES ---
  const updateStudentAttendance = async (studentId, moduleId, date, status, comment, formateurId = 'admin') => {
    const safeModule = moduleId.replace(/[^a-zA-Z0-9]/g, '_');
    const docId = `${studentId}_${safeModule}_${date}`;
    const newRecord = { studentId, moduleId, date, status, comment: comment || '', formateurId, timestamp: serverTimestamp() };
    
    await setDoc(doc(db, 'attendance_stagiaires', docId), newRecord, { merge: true });

    setStudentAttendance(prev => {
      const existingIdx = prev.findIndex(a => a.id === docId);
      const updatedRecord = { id: docId, ...newRecord };
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = updatedRecord;
        return updated;
      }
      return [...prev, updatedRecord];
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
      setStudentAttendance(prev => mergeById(prev, data));
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
        if (!force) return mergeById(prev, data);
        const outsideMonth = prev.filter(record => !record.date || record.date < start || record.date > end);
        return mergeById(outsideMonth, data);
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
    const data = { teacherId, date, status, hours: status === 'present' ? hours : 0, comment: comment || '', moduleId: moduleId || '', timeSlot: timeSlot || '', timestamp: serverTimestamp() };
    
    const duplicateSnapshot = await getDocs(query(
      collection(db, 'attendance_formateurs'),
      where('teacherId', '==', teacherId),
      where('date', '==', date)
    ));
    const duplicateDeletes = duplicateSnapshot.docs
      .filter(d => d.id !== docId && ((d.data().timeSlot || '').replace(/[^0-9]/g, '') || 'x') === safeTime)
      .map(d => deleteDoc(d.ref));
    if (duplicateDeletes.length > 0) await Promise.all(duplicateDeletes);

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

    const cached = readCache(FINANCE_CACHE_KEY, FINANCE_CACHE_TTL);
    if (cached && !force) {
      setPayments(cached.payments || []);
      setSalaries(cached.salaries || []);
      setExpenses(cached.expenses || []);
    }

    const financeLoadKey = 'finance';
    if (!pendingLoads.has(financeLoadKey)) {
      pendingLoads.set(financeLoadKey, Promise.all([
        getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(200))),
        getDocs(query(collection(db, 'salaries'), orderBy('createdAt', 'desc'), limit(200))),
        getDocs(query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(200)))
      ]).then(([paySnap, salSnap, expSnap]) => {
        const data = {
          payments: paySnap.docs.map(d => ({ id: d.id, ...d.data() })),
          salaries: salSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          expenses: expSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        };
        writeCache(FINANCE_CACHE_KEY, data);
        return data;
      }).finally(() => {
        setTimeout(() => pendingLoads.delete(financeLoadKey), 5000);
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
    const newPayment = { ...paymentData, createdAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, 'payments'), newPayment);
    setPayments(prev => [{ id: docRef.id, ...newPayment }, ...prev]);
    localStorage.removeItem(FINANCE_CACHE_KEY);
    showToast('Paiement enregistré', 'success');
  };

  const updatePayment = async (id, data) => {
    await updateDoc(doc(db, 'payments', id), data);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    localStorage.removeItem(FINANCE_CACHE_KEY);
    showToast('Paiement mis à jour', 'success');
  };

  const deletePayment = async (id) => {
    await deleteDoc(doc(db, 'payments', id));
    setPayments(prev => prev.filter(p => p.id !== id));
    localStorage.removeItem(FINANCE_CACHE_KEY);
    showToast('Paiement supprimé', 'warning');
  };

  const addSalary = async (salaryData) => {
    const newSalary = { ...salaryData, createdAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, 'salaries'), newSalary);
    setSalaries(prev => [{ id: docRef.id, ...newSalary }, ...prev]);
    localStorage.removeItem(FINANCE_CACHE_KEY);
    showToast('Salaire enregistré', 'success');
  };

  const updateSalary = async (id, data) => {
    await updateDoc(doc(db, 'salaries', id), data);
    setSalaries(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    localStorage.removeItem(FINANCE_CACHE_KEY);
    showToast('Salaire mis à jour', 'success');
  };

  const deleteSalary = async (id) => {
    await deleteDoc(doc(db, 'salaries', id));
    setSalaries(prev => prev.filter(s => s.id !== id));
    localStorage.removeItem(FINANCE_CACHE_KEY);
    showToast('Salaire supprimé', 'warning');
  };

  const addExpense = async (expenseData) => {
    const newExpense = { ...expenseData, createdAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, 'expenses'), newExpense);
    setExpenses(prev => [{ id: docRef.id, ...newExpense }, ...prev]);
    localStorage.removeItem(FINANCE_CACHE_KEY);
    showToast('Charge enregistrée', 'success');
  };

  const deleteExpense = async (id) => {
    await deleteDoc(doc(db, 'expenses', id));
    setExpenses(prev => prev.filter(e => e.id !== id));
    localStorage.removeItem(FINANCE_CACHE_KEY);
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

  const deleteModule = async (id) => {
    await deleteDoc(doc(db, 'modules', id));
    setModules(prev => prev.filter(m => m.id !== id));
    showToast(`Module supprimé.`, 'warning');
  };

  return (
    <AppContext.Provider value={{
      students, teachers, grades, isAuthenticated, isDirectorAuth, loading,
      login, logout, loginDirector, logoutDirector,
      addStudent, addTeacher, updateStudent, updateTeacher, deleteStudent, deleteTeacher, updateGrades, batchUpdateGrades,
      studentAttendance, teacherAttendance, updateStudentAttendance, updateTeacherAttendance,
      loadAttendanceForSession, loadStudentAttendanceForMonth, loadTeacherAttendanceForDate, loadTeacherAttendanceForMonth,
      schedules, addSchedule, updateSchedule, deleteSchedule, clearAllSchedules, migrateTeacherTokens,
      payments, salaries, expenses, loadFinancialData, addPayment, updatePayment, deletePayment, addSalary, updateSalary, deleteSalary, addExpense, deleteExpense,
      modules, addModule, updateModule, deleteModule,
      accessLogs, logAppAccess, loadAccessLogs,
      activeSemester, setActiveSemester, getActiveScheduleModule,
      confirmAction, notifications, markNotificationAsRead, clearNotifications
    }}>
      {children}
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </AppContext.Provider>
  );
};
