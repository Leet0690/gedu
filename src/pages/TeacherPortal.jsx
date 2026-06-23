import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { ALL_STUDY_YEARS, getClassCode, getModulesForStudent, MODULES_DATA } from '../data/modules';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { 
  UserRound, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  AlertTriangle,
  Wifi, 
  CloudUpload, 
  Save, 
  X, 
  ChevronRight, 
  Users, 
  BookOpen, 
  CalendarDays,
  CalendarX,
  Presentation,
  UserCheck,
  Award,
  ArrowRight,
  RefreshCw,
  Heart,
  SlidersHorizontal
} from 'lucide-react';
import { FilterSelect } from '../components/ui/FilterSelect';
import { isActiveStudent } from '../utils/studentStatus';
import { makeStudentAttendanceDocId } from '../utils/attendanceKeys';

const APP_VERSION = '2.5.1';
const VERSION_KEY = 'ipfp_app_version';

const readStoredAppVersion = () => {
  try {
    return localStorage.getItem(VERSION_KEY);
  } catch {
    return APP_VERSION;
  }
};

const rememberCurrentAppVersion = () => {
  try {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
  } catch {
    // Storage can be unavailable in restrictive browser modes.
  }
};

const isModuleVisibleForScope = (moduleSemester, activeSemester, includeAllSemesters) => {
  return includeAllSemesters || [activeSemester, 'Annuel'].includes(moduleSemester || 'S1');
};

/* ── Components ── */
const GradeInput = ({ value, onChange, placeholder = '—' }) => {
  const num = parseFloat(value);
  const isInvalid = value !== '' && value !== undefined && !isNaN(num) && (num < 0 || num > 20);
  return (
    <input type="number" step="0.25" className="input-premium"
      style={{ 
        width: '64px', textAlign: 'center', fontWeight: '800', padding: '6px 4px', fontSize: '13px', margin: '0 auto',
        border: isInvalid ? '2px solid var(--danger)' : undefined,
        backgroundColor: isInvalid ? 'var(--danger-ultra-light)' : undefined,
        color: isInvalid ? 'var(--danger)' : undefined
      }}
      placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  );
};

const getGroupAbbreviation = (filiere, annee) => getClassCode('', filiere, annee);
const normalizeTimeSlot = (value = '') => String(value || '').replace(/[^0-9]/g, '') || 'x';
const safeModuleKey = (value = '') => String(value || 'global').replace(/[^a-zA-Z0-9]/g, '_');
const makeTeacherAttendanceDocId = (teacherId, moduleId, timeSlot, date) =>
  `${teacherId}_${safeModuleKey(moduleId)}_${normalizeTimeSlot(timeSlot)}_${date}`;
const calcDuration = (timeStr = '') => {
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
const getRecordTimestamp = (record) => {
  if (!record?.timestamp) return 0;
  if (typeof record.timestamp.toMillis === 'function') return record.timestamp.toMillis();
  if (typeof record.timestamp.seconds === 'number') return record.timestamp.seconds * 1000;
  return 0;
};

const TeacherPortal = () => {
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const { teachers, students, updateGrades, batchUpdateGrades, grades, loading, studentAttendance, updateStudentAttendance, schedules, updateTeacherAttendance, loadAttendanceForSession, teacherAttendance, loadTeacherAttendanceForDate, confirmAction, modules: allModules = [], activeSemester, getActiveScheduleModule } = useApp();
  const { showToast } = useToast();
  
  const teacher = useMemo(() => {
    return teachers.find(t => t.tokenGrades === teacherId || t.tokenAttendance === teacherId || t.id === teacherId);
  }, [teachers, teacherId]);

  const accessMode = useMemo(() => {
    if (!teacher) return null;
    if (teacher.tokenAttendance === teacherId) return 'attendance';
    if (teacher.tokenGrades === teacherId) return 'grades';
    return 'full'; 
  }, [teacher, teacherId]);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedDiploma, setSelectedDiploma] = useState('');
  const [filterYear, setFilterYear] = useState('1ère année');
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('attendance');
  const [localGrades, setLocalGrades] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showUnmarkedWarning, setShowUnmarkedWarning] = useState(false);
  const [completedSessionIds, setCompletedSessionIds] = useState(new Set());
  const [showVersionBanner, setShowVersionBanner] = useState(() => {
    const storedVersion = readStoredAppVersion();
    if (!storedVersion) {
      rememberCurrentAppVersion();
      return false;
    }
    return storedVersion !== APP_VERSION;
  });
  const firstUnmarkedRef = useRef(null);
  const autoSavedTeacherSessionsRef = useRef(new Set());

  const dayOfWeek = useMemo(() => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[new Date(selectedDate).getDay()];
  }, [selectedDate]);

  const todaysSessions = useMemo(() => {
    if (!teacher) return [];
    const unfiltered = (schedules || []).filter(s => s.teacherId === teacher.id && s.day === dayOfWeek);
    
    // Deduplicate sessions that are exactly identical (same time, same filiere, same annee, same module)
    const unique = [];
    const seen = new Set();
    unfiltered.forEach(s => {
      const displayModule = getActiveScheduleModule(s);
      if (!displayModule) return; // Skip if no module scheduled for active semester
      const key = `${s.time}_${s.filiere}_${s.annee}_${displayModule}`.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ ...s, displayModule });
      }
    });
    return unique;
  }, [teacher, schedules, dayOfWeek, getActiveScheduleModule]);

  // Load teacher attendance for today to detect if already done
  useEffect(() => {
    if (teacher && selectedDate && accessMode === 'attendance') {
      loadTeacherAttendanceForDate(selectedDate);
    }
  }, [teacher, selectedDate, accessMode, loadTeacherAttendanceForDate]);

  const getSessionModule = useCallback((session) => {
    return session?.displayModule || getActiveScheduleModule(session) || '';
  }, [getActiveScheduleModule]);

  const getTeacherRecordForSession = useCallback((session) => {
    if (!teacher || !session) return null;
    const sessionModule = getSessionModule(session);
    const docId = makeTeacherAttendanceDocId(teacher.id, sessionModule, session.time, selectedDate);
    const exact = teacherAttendance.find(record => record.id === docId);
    if (exact) return exact;

    const rowSlot = normalizeTimeSlot(session.time);
    const candidates = teacherAttendance.filter(record =>
      record.teacherId === teacher.id &&
      record.date === selectedDate &&
      normalizeTimeSlot(record.timeSlot) === rowSlot
    );
    if (!candidates.length) return null;
    return candidates.reduce((latest, record) =>
      getRecordTimestamp(record) >= getRecordTimestamp(latest) ? record : latest
    , candidates[0]);
  }, [teacher, teacherAttendance, selectedDate, getSessionModule]);

  // Helper: check if ALL students of a given session's group have student attendance records
  const isSessionStudentAttendanceComplete = useCallback((session) => {
    if (!session || !teacher) return false;
    const sessionModule = getSessionModule(session);
    if (!sessionModule) return false;
    const groupStudents = students
      .filter(isActiveStudent)
      .filter(s => s.major === session.filiere && s.year === session.annee);
    if (groupStudents.length === 0) return false;
    return groupStudents.every(s => {
      const docId = makeStudentAttendanceDocId(s.id, sessionModule, selectedDate, session.time);
      const record = studentAttendance.find(a => a.id === docId);
      return record && ['present', 'absent'].includes(record.status);
    });
  }, [teacher, students, studentAttendance, selectedDate, getSessionModule]);

  useEffect(() => {
    if (!teacher || todaysSessions.length === 0 || accessMode !== 'attendance') return;
    todaysSessions.forEach(session => {
      if (!isSessionStudentAttendanceComplete(session)) return;
      if (getTeacherRecordForSession(session)) return;

      const sessionModule = getSessionModule(session);
      if (!sessionModule) return;
      const autoSaveKey = makeTeacherAttendanceDocId(teacher.id, sessionModule, session.time, selectedDate);
      if (autoSavedTeacherSessionsRef.current.has(autoSaveKey)) return;

      autoSavedTeacherSessionsRef.current.add(autoSaveKey);
      updateTeacherAttendance(
        teacher.id,
        selectedDate,
        'present',
        `Appel stagiaires complété: ${sessionModule}`,
        calcDuration(session.time) || 4,
        sessionModule,
        session.time || ''
      ).catch(() => {
        autoSavedTeacherSessionsRef.current.delete(autoSaveKey);
        showToast("Erreur lors de l'enregistrement de la présence formateur.", 'error');
      });
    });
  }, [teacher, todaysSessions, selectedDate, accessMode, isSessionStudentAttendanceComplete, getTeacherRecordForSession, getSessionModule, updateTeacherAttendance, showToast]);

  // Sync completedSessionIds with DB records
  // A session is "completed" if:
  //   - Teacher declared absent for this slot (teacher attendance record with status 'absent'), OR
  //   - ALL students of this session's group have a student attendance record
  useEffect(() => {
    if (!teacher || todaysSessions.length === 0 || accessMode !== 'attendance') return;
    const completed = new Set();
    todaysSessions.forEach(session => {
      const record = getTeacherRecordForSession(session);
      if (record && ['present', 'absent'].includes(record.status)) {
        completed.add(session.id);
      }
    });
    setCompletedSessionIds(prev => {
      const isIdentical = prev.size === completed.size && [...completed].every(id => prev.has(id));
      if (isIdentical) return prev;
      return completed;
    });
  }, [teacher, todaysSessions, accessMode, getTeacherRecordForSession]);

  // Check if attendance was already submitted today
  // All sessions must be completed (student attendance done for each group, or teacher absent)
  const alreadyDoneToday = useMemo(() => {
    if (!teacher || todaysSessions.length === 0 || accessMode !== 'attendance') return false;
    return todaysSessions.every(session => {
      const record = getTeacherRecordForSession(session);
      return record && ['present', 'absent'].includes(record.status);
    });
  }, [teacher, todaysSessions, accessMode, getTeacherRecordForSession]);

  const [selectedSessionId, setSelectedSessionId] = useState('');
  const currentSession = useMemo(() => {
    if (selectedSessionId) return todaysSessions.find(s => s.id === selectedSessionId);
    return null;
  }, [todaysSessions, selectedSessionId]);
  const includeAllSemestersForGrades = activeTab === 'grades' || accessMode === 'grades';

  const sessionDuration = useMemo(() => {
    return calcDuration(currentSession?.time) || 4;
  }, [currentSession]);

  const currentAttendanceModule = useMemo(() => {
    return currentSession ? getSessionModule(currentSession) : selectedSubject;
  }, [currentSession, getSessionModule, selectedSubject]);

  React.useEffect(() => {
    if (accessMode === 'attendance') setActiveTab('attendance');
    else if (accessMode === 'grades') setActiveTab('grades');
  }, [accessMode]);

  React.useEffect(() => {
    if (currentSession) {
      const sessionModule = getSessionModule(currentSession);
      setSelectedGroup(currentSession.filiere);
      setSelectedSubject(sessionModule);
      setFilterYear(currentSession.annee);
      const matchingModule = (allModules || []).find(m =>
        m.major === currentSession.filiere &&
        m.year === currentSession.annee &&
        m.name === sessionModule
      );
      if (matchingModule?.diploma) {
        setSelectedDiploma(matchingModule.diploma);
        return;
      }
      for (const dip in MODULES_DATA) {
        if (MODULES_DATA[dip][currentSession.filiere]) {
          setSelectedDiploma(dip);
          break;
        }
      }
    }
  }, [currentSession, allModules, getSessionModule]);

  React.useEffect(() => {
    if (activeTab === 'attendance' && currentAttendanceModule && selectedDate) {
      loadAttendanceForSession(currentAttendanceModule, selectedDate);
    }
  }, [activeTab, currentAttendanceModule, selectedDate, loadAttendanceForSession]);

  const availableDiplomas = useMemo(() => {
    if (!teacher) return [];
    const teacherSubjects = teacher.subjects || [teacher.subject] || [];
    return Array.from(new Set((allModules || [])
      .filter(m =>
        teacherSubjects.includes(m.name) &&
        isModuleVisibleForScope(m.semester, activeSemester, includeAllSemestersForGrades)
      )
      .map(m => m.diploma)
      .filter(Boolean)));
  }, [teacher, allModules, activeSemester, includeAllSemestersForGrades]);

  const availableYears = useMemo(() => {
    if (!teacher || !selectedDiploma) return [];
    const teacherYears = teacher.years || ALL_STUDY_YEARS;
    const teacherSubjects = teacher.subjects || [teacher.subject] || [];
    return teacherYears.filter(y =>
      (allModules || []).some(m =>
        m.diploma === selectedDiploma &&
        m.year === y &&
        isModuleVisibleForScope(m.semester, activeSemester, includeAllSemestersForGrades) &&
        teacherSubjects.includes(m.name)
      )
    );
  }, [teacher, selectedDiploma, allModules, activeSemester, includeAllSemestersForGrades]);

  const filteredGroups = useMemo(() => {
    if (!teacher || !selectedDiploma || !filterYear) return [];
    const teacherGroups = teacher.groups || [];
    const teacherSubjects = teacher.subjects || [teacher.subject] || [];
    return teacherGroups.filter(g =>
      (allModules || []).some(m =>
        m.diploma === selectedDiploma &&
        m.major === g &&
        m.year === filterYear &&
        isModuleVisibleForScope(m.semester, activeSemester, includeAllSemestersForGrades) &&
        teacherSubjects.includes(m.name)
      )
    );
  }, [teacher, selectedDiploma, filterYear, allModules, activeSemester, includeAllSemestersForGrades]);

  const filteredSubjects = useMemo(() => {
    if (!teacher || !selectedDiploma || !selectedGroup || !filterYear) return [];
    const teacherSubjects = teacher.subjects || [teacher.subject] || [];
    return Array.from(new Set((allModules || [])
      .filter(m =>
        m.diploma === selectedDiploma &&
        m.major === selectedGroup &&
        m.year === filterYear &&
        isModuleVisibleForScope(m.semester, activeSemester, includeAllSemestersForGrades) &&
        teacherSubjects.includes(m.name)
      )
      .map(m => m.name)));
  }, [teacher, selectedDiploma, selectedGroup, filterYear, allModules, activeSemester, includeAllSemestersForGrades]);

  React.useEffect(() => {
    if (availableDiplomas.length > 0 && (!selectedDiploma || !availableDiplomas.includes(selectedDiploma))) setSelectedDiploma(availableDiplomas[0]);
  }, [availableDiplomas, selectedDiploma]);

  React.useEffect(() => {
    if (availableYears.length > 0 && (!filterYear || !availableYears.includes(filterYear))) setFilterYear(availableYears[0]);
  }, [availableYears, filterYear]);

  React.useEffect(() => {
    if ((activeTab === 'grades' || !currentSession) && filteredGroups.length > 0 && (!selectedGroup || !filteredGroups.includes(selectedGroup))) setSelectedGroup(filteredGroups[0]);
  }, [filteredGroups, selectedGroup, activeTab, currentSession]);

  React.useEffect(() => {
    if ((activeTab === 'grades' || !currentSession) && filteredSubjects.length > 0 && (!selectedSubject || !filteredSubjects.includes(selectedSubject))) setSelectedSubject(filteredSubjects[0]);
  }, [filteredSubjects, selectedSubject, activeTab, currentSession]);

  const relevantStudents = useMemo(() => {
    if (activeTab === 'attendance' && !currentSession) return [];
    const filtered = students
      .filter(isActiveStudent)
      .filter(s => s.major === selectedGroup && s.year === filterYear && (!selectedDiploma || s.diploma === selectedDiploma));
    
    // Anti-doublons : empêche l'affichage multiple si la DB contient des erreurs
    const uniqueStudents = [];
    const seen = new Set();
    filtered.forEach(s => {
      const key = s.regNo ? s.regNo.trim() : `${s.firstName?.toLowerCase()?.trim()}_${s.lastName?.toLowerCase()?.trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueStudents.push(s);
      }
    });
    return uniqueStudents;
  }, [students, selectedGroup, filterYear, selectedDiploma, activeTab, currentSession]);

  useEffect(() => {
    const lg = {};
    relevantStudents.forEach(s => {
      lg[s.id] = grades[s.id]?.[selectedSubject?.replace(/\./g, '_')] || { c1: '', c2: '', c3: '', efcfp: '', efcft: '' };
    });
    setLocalGrades(lg);
  }, [relevantStudents, selectedSubject, grades]);

  const allAttended = useMemo(() => {
    if (!currentSession || !relevantStudents || relevantStudents.length === 0 || !currentAttendanceModule) return false;
    return relevantStudents.every(s => {
      const docId = makeStudentAttendanceDocId(s.id, currentAttendanceModule, selectedDate, currentSession.time);
      const record = studentAttendance.find(a => a.id === docId);
      return record && ['present', 'absent'].includes(record.status);
    });
  }, [currentSession, relevantStudents, currentAttendanceModule, selectedDate, studentAttendance]);

  // Track if ALL sessions for the day are completed
  const allSessionsCompleted = useMemo(() => {
    if (todaysSessions.length === 0) return false;
    return todaysSessions.every(session => completedSessionIds.has(session.id));
  }, [todaysSessions, completedSessionIds]);

  const unmarkedStudents = useMemo(() => {
    if (!currentSession || !currentAttendanceModule || !relevantStudents.length) return [];
    return relevantStudents.filter(s => {
      const docId = makeStudentAttendanceDocId(s.id, currentAttendanceModule, selectedDate, currentSession.time);
      const record = studentAttendance.find(a => a.id === docId);
      return !record || !['present', 'absent'].includes(record.status);
    });
  }, [currentSession, relevantStudents, currentAttendanceModule, selectedDate, studentAttendance]);

  useEffect(() => {
    if (allAttended) setShowUnmarkedWarning(false);
  }, [allAttended]);

  useEffect(() => {
    if (showUnmarkedWarning && firstUnmarkedRef.current) {
      firstUnmarkedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showUnmarkedWarning]);

  React.useEffect(() => {
    if (activeTab === 'attendance' && !allAttended) {
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = "Veuillez terminer l'appel avant de quitter.";
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [activeTab, allAttended]);

  if (loading && teachers.length === 0) {
    return (
      <div className="max-w-container section-padding">
        <TableSkeleton rows={12} />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="flex-center" style={{ minHeight: '80vh', padding: '32px' }}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-premium" style={{ padding: '64px', textAlign: 'center', maxWidth: '440px' }}>
          <AlertCircle size={64} style={{ color: 'var(--danger)', marginBottom: '24px' }} />
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900', marginBottom: '12px' }}>Accès Invalide</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: '32px' }}>Ce lien est expiré ou incorrect. Veuillez contacter l'administration.</p>
          <button onClick={() => navigate('/')} className="btn-modern primary" style={{ width: '100%', justifyContent: 'center' }}>Retour à l'accueil</button>
        </motion.div>
      </div>
    );
  }

  // Show "already done" screen if attendance was already taken today
  if (alreadyDoneToday && activeTab === 'attendance' && !isFinished && !attendanceSuccess) {
    // Compute present/absent breakdown
    let donePresent = 0, doneAbsent = 0, totalH = 0;
    const countedSlots = new Set();
    todaysSessions.forEach(s => {
      const safeTime = normalizeTimeSlot(s.time);
      const record = getTeacherRecordForSession(s);
      if (record?.status === 'present') {
        donePresent++;
        if (!countedSlots.has(safeTime)) {
          countedSlots.add(safeTime);
          totalH += Number(record.hours) > 0 ? Number(record.hours) : (calcDuration(s.time) || 4);
        }
      } else if (record?.status === 'absent') {
        doneAbsent++;
      }
    });
    return (
      <div className="flex-center" style={{ minHeight: '100vh', padding: '24px', position: 'relative' }}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="glass-premium" style={{ padding: '48px 36px', textAlign: 'center', maxWidth: '440px', width: '100%', borderRadius: 'var(--radius-3xl)', boxShadow: 'var(--shadow-xl)', border: '1px solid rgba(176, 104, 185, 0.15)' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 300 }} style={{ width: '88px', height: '88px', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: 'var(--shadow-glow)' }}>
            <CheckCircle2 size={44} />
          </motion.div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: '900', marginBottom: '10px', color: 'var(--text-primary)' }}>Présence déjà enregistrée</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', lineHeight: '1.7', marginBottom: '24px' }}>
            L'appel pour le <strong>{new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> a déjà été validé.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.5)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)' }}>📚 Séances totales</span>
              <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--primary)' }}>{todaysSessions.length}</span>
            </div>
            {donePresent > 0 && (
              <div style={{ padding: '12px 16px', background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#15803d' }}>✅ Séances présent</span>
                <span style={{ fontSize: '14px', fontWeight: '900', color: '#16a34a' }}>{donePresent}</span>
              </div>
            )}
            {doneAbsent > 0 && (
              <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.12)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#dc2626' }}>❌ Séances absent</span>
                <span style={{ fontSize: '14px', fontWeight: '900', color: '#dc2626' }}>{doneAbsent}</span>
              </div>
            )}
            <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.5)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)' }}>⏰ Heures de vacation</span>
              <span style={{ fontSize: '14px', fontWeight: '900', color: '#16a34a' }}>{formatHours(totalH)}</span>
            </div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-faint)', fontWeight: '600' }}>Si vous pensez qu'il y a une erreur, veuillez contacter l'administration.</p>
        </motion.div>
      </div>
    );
  }

  const handleValidateSession = async () => {
    if (!currentSession || !allAttended) {
      setShowUnmarkedWarning(true);
      return;
    }
    const sessionModule = getSessionModule(currentSession) || selectedSubject;
    const existingTeacherRecord = getTeacherRecordForSession(currentSession);
    if (!existingTeacherRecord) {
      await updateTeacherAttendance(teacher.id, selectedDate, 'present', `Appel validé: ${sessionModule}`, sessionDuration, sessionModule, currentSession?.time || '');
    }
    const nextCompleted = new Set(completedSessionIds);
    nextCompleted.add(currentSession.id);
    setCompletedSessionIds(nextCompleted);
    showToast(`Séance "${sessionModule}" validée.`, 'success');

    // Move to next uncompleted session using updated set
    const nextSession = todaysSessions.find(s => s.id !== currentSession.id && !nextCompleted.has(s.id));
    if (nextSession) {
      setSelectedSessionId(nextSession.id);
    }
  };

  const handleDeclareAbsent = async () => {
    if (!currentSession) return;
    const sessionLabel = `${currentSession.time} — ${getGroupAbbreviation(currentSession.filiere, currentSession.annee)}`;
    const confirmed = await confirmAction({
      title: "Déclarer votre absence ?",
      message: `Vous confirmez être absent pour la séance de ${sessionLabel}. Aucun pointage stagiaire ne sera effectué pour cette séance.`,
      type: "warning"
    });
    if (!confirmed) return;

    const sessionModule = getSessionModule(currentSession) || selectedSubject;
    await updateTeacherAttendance(
      teacher.id, selectedDate, 'absent',
      'Formateur absent (auto-déclaration)',
      0, sessionModule, currentSession.time
    );

    const nextCompleted = new Set(completedSessionIds);
    nextCompleted.add(currentSession.id);
    setCompletedSessionIds(nextCompleted);
    showToast(`Absence déclarée pour "${sessionModule}".`, 'info');

    // Move to next uncompleted session using updated set
    const nextSession = todaysSessions.find(s => s.id !== currentSession.id && !nextCompleted.has(s.id));
    if (nextSession) {
      setSelectedSessionId(nextSession.id);
    }
  };

  const handleFinalValidation = async () => {
    if (!allSessionsCompleted) return;
    if (await confirmAction({ title: "Valider toutes les séances ?", message: `Vous avez complété ${todaysSessions.length} séance(s). Cette action finalisera votre journée.`, type: "warning" })) {
      setAttendanceSuccess(true);
      showToast("Journée validée avec succès.", 'success');
      setTimeout(() => setIsFinished(true), 1200);
    }
  };

  const handleForceRefresh = async () => {
    rememberCurrentAppVersion();
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
      window.location.reload(true);
    } catch (e) {
      rememberCurrentAppVersion();
      window.location.reload(true);
    }
  };

  const handleGradeChange = (studentId, field, value) => {
    if (!selectedSubject) return;
    setLocalGrades(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { c1: '', c2: '', c3: '', efcfp: '', efcft: '' }),
        [field]: value
      }
    }));
  };

  const handleSaveGrades = async () => {
    let hasInvalid = false;
    relevantStudents.forEach(student => {
      const g = localGrades[student.id] || {};
      ['c1', 'c2', 'c3', 'efcfp', 'efcft'].forEach(field => {
        if (g[field] !== '' && g[field] !== undefined) {
          const num = parseFloat(g[field]);
          if (num < 0 || num > 20) hasInvalid = true;
        }
      });
    });
    if (hasInvalid) return showToast("Certaines notes sont invalides.", 'error');
    if (!selectedSubject) return;

    const updates = relevantStudents.map(student => ({
      studentId: student.id,
      subject: selectedSubject,
      gradeData: localGrades[student.id] || { c1: '', c2: '', c3: '', efcfp: '', efcft: '' }
    }));

    if (updates.length > 0) {
      await batchUpdateGrades(updates);
    }

    showToast("Notes enregistrées avec succès.", 'success');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  const handleAttendanceChange = async (studentId, status) => {
    if (!currentAttendanceModule || !currentSession) return;
    const docId = makeStudentAttendanceDocId(studentId, currentAttendanceModule, selectedDate, currentSession.time);
    const record = studentAttendance.find(a => a.id === docId);
    await updateStudentAttendance(studentId, currentAttendanceModule, selectedDate, status, record?.comment || '', teacher.id, currentSession.time);
  };

  const handleClearAttendance = async (studentId) => {
    if (!currentAttendanceModule || !currentSession) return;
    const docId = makeStudentAttendanceDocId(studentId, currentAttendanceModule, selectedDate, currentSession.time);
    const record = studentAttendance.find(a => a.id === docId);
    await updateStudentAttendance(studentId, currentAttendanceModule, selectedDate, '', record?.comment || '', teacher.id, currentSession.time);
  };

  const handleAttendanceComment = async (studentId, comment) => {
    if (!currentAttendanceModule || !currentSession) return;
    const docId = makeStudentAttendanceDocId(studentId, currentAttendanceModule, selectedDate, currentSession.time);
    let record = studentAttendance.find(a => a.id === docId);
    await updateStudentAttendance(studentId, currentAttendanceModule, selectedDate, record?.status || 'present', comment, teacher.id, currentSession.time);
  };

  const calcMoyenneCC = (g) => {
    if (!g || g.c1 === '' || g.c2 === '') return null;
    const c1 = parseFloat(g.c1), c2 = parseFloat(g.c2);
    if (g.c3 !== '' && g.c3 !== undefined && g.c3 !== null) {
      const c3 = parseFloat(g.c3);
      if (!isNaN(c3)) return (c1 + c2 + c3) / 3;
    }
    return (c1 + c2) / 2;
  };

  if (isFinished) {
    // Compute present/absent breakdown for finished screen
    let finishedPresent = 0, finishedAbsent = 0;
    const countedFinishedSlots = new Set();
    let totalDuration = 0;
    todaysSessions.forEach(s => {
      const safeTime = normalizeTimeSlot(s.time);
      const record = getTeacherRecordForSession(s);
      if (record?.status === 'absent') {
        finishedAbsent++;
      } else {
        finishedPresent++;
        if (!countedFinishedSlots.has(safeTime)) {
          countedFinishedSlots.add(safeTime);
          totalDuration += Number(record?.hours) > 0 ? Number(record.hours) : (calcDuration(s.time) || 4);
        }
      }
    });
    const summaryParts = [];
    if (finishedPresent > 0) summaryParts.push(`${finishedPresent} présente(s)`);
    if (finishedAbsent > 0) summaryParts.push(`${finishedAbsent} absente(s)`);
    return (
      <div className="flex-center" style={{ minHeight: '100vh', padding: '24px' }}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="glass-premium" style={{ padding: '48px 36px', textAlign: 'center', maxWidth: '440px', width: '100%', borderRadius: 'var(--radius-3xl)', boxShadow: 'var(--shadow-xl)', border: '1px solid rgba(176, 104, 185, 0.15)' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.08, type: 'spring', stiffness: 300 }} style={{ width: '96px', height: '96px', background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', boxShadow: '0 12px 40px rgba(22, 163, 74, 0.35)' }}>
            <Heart size={48} />
          </motion.div>
          <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12 }} style={{ fontSize: 'var(--text-xl)', fontWeight: '900', marginBottom: '12px', color: 'var(--text-primary)' }}>Merci, {teacher.name.split(' ')[0]} !</motion.h1>
          <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.16 }} style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', lineHeight: '1.7', marginBottom: '28px' }}>
            Votre journée a été enregistrée avec succès.<br/>
            <strong>{todaysSessions.length} séance(s)</strong> ({summaryParts.join(', ')}) — <strong>{formatHours(totalDuration)}</strong> de vacation transmise(s).
          </motion.p>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {finishedAbsent > 0 && (
              <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.12)', borderRadius: '14px', fontSize: '13px', color: '#dc2626', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <CalendarX size={16} /> {finishedAbsent} séance(s) déclarée(s) absente(s)
              </div>
            )}
            <div style={{ padding: '14px 20px', background: 'rgba(255, 255, 255, 0.5)', border: '1px solid var(--border-light)', borderRadius: '14px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '650' }}>
              📅 {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <button onClick={() => window.close()} className="btn-modern primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', borderRadius: '14px' }}>Fermer la page <ArrowRight size={18} style={{ marginLeft: '8px' }} /></button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-container section-padding">
      {/* Version / Cache Refresh Banner */}
      {showVersionBanner && (
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 'var(--space-4)', padding: '14px 18px', borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(176,104,185,0.08))', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '200px' }}>
            <RefreshCw size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Mise à jour disponible</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Une nouvelle version est disponible. Rafraîchissez pour éviter les erreurs.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={handleForceRefresh} style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', background: '#6366f1', color: 'white', border: 'none', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={13} /> Rafraîchir
            </button>
            <button onClick={() => { setShowVersionBanner(false); rememberCurrentAppVersion(); }} className="close-button close-button-sm" aria-label="Fermer le message" title="Fermer">
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Main Header */}
      <motion.div className="grade-premium-header" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 'var(--space-6)', minHeight: 'auto', padding: '28px 32px' }}>
        <div className="grade-premium-header-icon" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}>
          <Presentation size={24} style={{ color: 'white' }} />
        </div>
        <div className="grade-premium-header-copy" style={{ flex: 1 }}>
          <span className="grade-premium-eyebrow" style={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: '800' }}>ESPACE ENSEIGNANT</span>
          <h1>
            {teacher.name}
            <span style={{ fontSize: '11px', fontWeight: '850', padding: '3px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.35)', backdropFilter: 'blur(8px)' }}>
              Session Active
            </span>
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Suivi des présences journalières et saisie des évaluations académiques.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', zIndex: 10 }}>
          {accessMode === 'full' && (
            <div className="modern-tabs-container" style={{ background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '4px', borderRadius: 'var(--radius-xl)' }}>
              <button onClick={() => setActiveTab('attendance')} className={`modern-tab ${activeTab === 'attendance' ? 'active' : ''}`} style={{ color: activeTab === 'attendance' ? 'var(--primary)' : 'white', fontWeight: '800', padding: '8px 20px', borderRadius: 'var(--radius-lg)' }}>Présences</button>
              <button onClick={() => setActiveTab('grades')} className={`modern-tab ${activeTab === 'grades' ? 'active' : ''}`} style={{ color: activeTab === 'grades' ? 'var(--primary)' : 'white', fontWeight: '800', padding: '8px 20px', borderRadius: 'var(--radius-lg)' }}>Notes</button>
            </div>
          )}
        </div>
        <div className="grade-premium-header-orb" aria-hidden="true" style={{ color: 'rgba(255, 255, 255, 0.08)' }}>
          <Award size={130} />
        </div>
      </motion.div>

      {/* Session Context Bar */}
      {activeTab === 'attendance' && todaysSessions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card" style={{ padding: 'var(--space-4) var(--space-6)', marginBottom: 'var(--space-6)', border: '1px solid rgba(176, 104, 185, 0.15)', background: 'rgba(255, 255, 255, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          
          {currentSession ? (
            <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
              <SessionStat label="Séance" value={dayOfWeek} icon={CalendarDays} />
              <SessionStat label="Horaire" value={currentSession.time} icon={Clock} />
              <SessionStat label="Groupe" value={getGroupAbbreviation(currentSession.filiere, currentSession.annee)} icon={Users} />
              <SessionStat label="Module" value={currentAttendanceModule || getSessionModule(currentSession)} icon={BookOpen} />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--primary)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-ultra-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Presentation size={20} />
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '850', color: 'var(--text-primary)', margin: 0 }}>Sélectionnez votre séance</p>
                <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', margin: '2px 0 0' }}>{todaysSessions.length} séance(s) prévue(s) aujourd'hui</p>
              </div>
            </div>
          )}

          <div style={{ minWidth: '240px' }}>
            <FilterSelect
              value={selectedSessionId}
              onChange={setSelectedSessionId}
              options={[
                { label: "-- Choisir la séance --", value: "" },
                ...todaysSessions.map(s => ({
                  label: `${s.time} - ${getGroupAbbreviation(s.filiere, s.annee)} - ${s.displayModule || s.module}`,
                  value: s.id
                }))
              ]}
              style={{ width: '100%', background: 'white' }}
            />
          </div>
        </motion.div>
      )}

      {/* Header controls for Attendance */}
      {activeTab === 'attendance' && currentSession && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card" style={{ padding: '16px 24px', marginBottom: 'var(--space-6)', border: '1px solid rgba(176, 104, 185, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'rgba(255,255,255,0.8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '800', color: '#6d28d9', background: 'rgba(124, 58, 237, 0.08)', borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Users size={13} /> {relevantStudents.length} Stagiaires
            </span>
            <span style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '800', color: allAttended ? 'var(--success)' : 'var(--warning)', background: allAttended ? 'rgba(22, 163, 74, 0.08)' : 'rgba(217, 119, 6, 0.08)', borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {allAttended ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {allAttended ? 'Appel complet' : `${unmarkedStudents.length} non pointé(s)`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {!completedSessionIds.has(currentSession.id) && (
              <>
                <button onClick={handleDeclareAbsent} className="btn-modern" style={{ padding: '10px 18px', background: 'rgba(220,38,38,0.05)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.18)', borderRadius: 'var(--radius-lg)', fontSize: '12px', fontWeight: '800' }}>
                  <CalendarX size={15} style={{ marginRight: '6px' }} /> Déclarer mon absence
                </button>
                <button onClick={handleValidateSession} disabled={!allAttended} className={`btn-modern ${allAttended ? 'primary' : 'secondary'}`} style={{ padding: '10px 20px', opacity: allAttended ? 1 : 0.5, cursor: allAttended ? 'pointer' : 'not-allowed' }}>
                  <CheckCircle2 size={16} style={{ marginRight: '6px' }} />
                  Valider la séance ({completedSessionIds.size + 1}/{todaysSessions.length})
                </button>
              </>
            )}
            {completedSessionIds.has(currentSession.id) && (
              <span style={{ padding: '10px 20px', fontSize: '12px', fontWeight: '800', color: '#15803d', background: 'rgba(22,163,74,0.08)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(22,163,74,0.2)' }}>
                <CheckCircle2 size={15} /> Séance validée
              </span>
            )}
            {allSessionsCompleted && (
              <button onClick={handleFinalValidation} className="btn-modern primary" style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                <Award size={18} style={{ marginRight: '8px' }} /> Finaliser la journée
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Header controls for Grades */}
      {activeTab === 'grades' && relevantStudents.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card" style={{ padding: '16px 24px', marginBottom: 'var(--space-6)', border: '1px solid rgba(176, 104, 185, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'rgba(255,255,255,0.8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '800', color: '#6d28d9', background: 'rgba(124, 58, 237, 0.08)', borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Award size={13} /> Saisie de Notes
            </span>
            {selectedSubject && (
              <span style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '800', color: 'var(--primary)', background: 'var(--primary-ultra-light)', borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={13} /> {selectedSubject}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={handleSaveGrades} className="btn-modern primary" style={{ padding: '10px 22px' }}>
              <CloudUpload size={16} style={{ marginRight: '8px' }} /> Enregistrer les notes
            </button>
          </div>
        </motion.div>
      )}

      {/* Controls Bar for Grades Filters */}
      {activeTab === 'grades' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)', border: '1px solid rgba(176, 104, 185, 0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--primary-ultra-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SlidersHorizontal size={15} />
            </div>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: '850', color: 'var(--text-primary)', margin: 0 }}>Filtres d'évaluation</h2>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Ciblez un groupe et un module pour saisir les notes.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <div style={fGroup}><label style={lbl}>Niveau</label><FilterSelect value={selectedDiploma} onChange={setSelectedDiploma} options={availableDiplomas.map(d => ({ label: d, value: d }))} /></div>
            <div style={fGroup}><label style={lbl}>Année</label><FilterSelect value={filterYear} onChange={setFilterYear} options={availableYears.map(y => ({ label: y, value: y }))} /></div>
            <div style={fGroup}><label style={lbl}>Filière</label><FilterSelect value={selectedGroup} onChange={setSelectedGroup} options={filteredGroups.map(g => ({ label: g, value: g }))} /></div>
            <div style={fGroup}><label style={lbl}>Module</label><FilterSelect value={selectedSubject} onChange={setSelectedSubject} options={filteredSubjects.map(sub => ({ label: sub, value: sub }))} /></div>
          </div>
        </motion.div>
      )}

      {/* Unmarked warning banner */}
      <AnimatePresence>
        {showUnmarkedWarning && !allAttended && activeTab === 'attendance' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ marginBottom: 'var(--space-4)', padding: '16px 20px', borderRadius: 'var(--radius-xl)', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.18)', display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#dc2626' }}>
                  {unmarkedStudents.length} stagiaire{unmarkedStudents.length > 1 ? 's' : ''} n'ont pas encore été marqué{unmarkedStudents.length > 1 ? 's' : ''} — l'appel ne peut pas être validé.
                </span>
              </div>
              <button onClick={() => setShowUnmarkedWarning(false)} className="close-button close-button-sm" aria-label="Fermer l'alerte" title="Fermer">
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {unmarkedStudents.map(s => (
                <span key={s.id} style={{ fontSize: '11px', fontWeight: '800', padding: '4px 12px', borderRadius: 'var(--radius-pill)', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)', color: '#dc2626' }}>
                  {s.lastName} {s.firstName}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Table */}
      <div className="glass-card grade-premium-table-shell" style={{ border: '1px solid rgba(176, 104, 185, 0.15)', background: 'rgba(255,255,255,0.9)', overflow: 'hidden' }}>
        {activeTab === 'attendance' && !currentSession ? (
          <EmptyState title="Séance non sélectionnée" message={todaysSessions.length > 0 ? "Choisissez une séance dans la barre supérieure pour commencer l'appel." : `Aucune séance n'est planifiée pour vous ce ${dayOfWeek}.`} icon="calendar" />
        ) : relevantStudents.length === 0 ? (
          <EmptyState title="Liste vide" message="Aucun stagiaire trouvé pour ce groupe." icon="users" />
        ) : !currentAttendanceModule ? (
          <EmptyState title="Module manquant" message="Sélectionnez un module pour afficher la liste." icon="book-open" />
        ) : activeTab === 'grades' ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="grade-premium-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>#</th>
                  <th style={thStyle}>Stagiaire</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>C1</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>C2</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>C3</th>
                  <th style={{ ...thStyle, textAlign: 'center', background: 'rgba(124, 58, 237, 0.05)', color: '#6d28d9', fontWeight: '900' }}>Moy CC</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>EFCFP</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>EFCFT</th>
                </tr>
              </thead>
              <tbody>
                {relevantStudents.map((s, idx) => {
                  const g = localGrades[s.id] || { c1: '', c2: '', c3: '', efcfp: '', efcft: '' };
                  const moyCC = calcMoyenneCC(g);
                  return (
                    <tr key={s.id} className="grade-premium-table-row" style={{ background: idx % 2 === 0 ? 'white' : 'var(--bg-subtle)' }}>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-faint)' }}>{idx + 1}</span>
                      </td>
                      <td style={tdStyle}>
                        <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{s.lastName} {s.firstName}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Matricule: {s.regNo} · {s.year}</p>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.c1} onChange={(v) => handleGradeChange(s.id, 'c1', v)} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.c2} onChange={(v) => handleGradeChange(s.id, 'c2', v)} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.c3 || ''} onChange={(v) => handleGradeChange(s.id, 'c3', v)} placeholder="opt." /></td>
                      <td style={{ ...tdStyle, textAlign: 'center', background: 'rgba(124, 58, 237, 0.025)' }}><span style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '14px' }}>{moyCC !== null ? moyCC.toFixed(2) : '—'}</span></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.efcfp} onChange={(v) => handleGradeChange(s.id, 'efcfp', v)} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.efcft} onChange={(v) => handleGradeChange(s.id, 'efcft', v)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="grade-premium-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '750px' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>#</th>
                  <th style={thStyle}>Stagiaire</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: '260px' }}>Appel</th>
                  <th style={thStyle}>Commentaire / Note d'observation</th>
                </tr>
              </thead>
              <tbody>
                {(() => { let firstUnmarkedAssigned = false; return relevantStudents.map((s, idx) => {
                  const docId = makeStudentAttendanceDocId(s.id, currentAttendanceModule, selectedDate, currentSession?.time);
                  const record = studentAttendance.find(a => a.id === docId);
                  const status = record?.status || '';
                  const comment = record?.comment || '';
                  const isUnmarked = showUnmarkedWarning && !['present', 'absent'].includes(status);
                  const isFirstUnmarked = isUnmarked && !firstUnmarkedAssigned && (firstUnmarkedAssigned = true);
                  return (
                    <tr key={s.id} ref={isFirstUnmarked ? firstUnmarkedRef : null} className="grade-premium-table-row" style={{ background: isUnmarked ? 'rgba(220,38,38,0.05)' : (idx % 2 === 0 ? 'white' : 'var(--bg-subtle)'), borderLeft: isUnmarked ? '3px solid rgba(220,38,38,0.5)' : '3px solid transparent' }}>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: isUnmarked ? '#dc2626' : 'var(--text-faint)' }}>{idx + 1}</span>
                      </td>
                      <td style={tdStyle}>
                        <p style={{ fontSize: '13px', fontWeight: '800', color: isUnmarked ? '#dc2626' : 'var(--text-primary)' }}>{s.lastName} {s.firstName}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Matricule: {s.regNo}</p>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '4px', alignItems: 'center' }}>
                          <StatusBtn active={status === 'present'} color="#16a34a" onClick={() => handleAttendanceChange(s.id, 'present')}>Présent</StatusBtn>
                          <StatusBtn active={status === 'absent'} color="#dc2626" onClick={() => handleAttendanceChange(s.id, 'absent')}>Absent</StatusBtn>
                          {status && (
                            <button onClick={() => handleClearAttendance(s.id)} style={{ marginLeft: '4px', padding: '4px', border: 'none', borderRadius: '50%', background: 'rgba(0,0,0,0.04)', cursor: 'pointer', color: 'var(--text-faint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px' }} title="Effacer">
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <input type="text" className="input-premium" placeholder="Écrire une observation..." style={{ width: '100%', fontSize: '12px', background: 'rgba(255, 255, 255, 0.6)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '6px 10px' }} value={comment} onChange={(e) => handleAttendanceComment(s.id, e.target.value)} />
                      </td>
                    </tr>
                  );
                }); })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const SessionStat = ({ label, value, icon: Icon }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <div style={{ padding: '8px', background: 'var(--primary-ultra-light)', borderRadius: 'var(--radius-lg)', color: 'var(--primary)', boxShadow: 'var(--shadow-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} /></div>
    <div>
      <p style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)', margin: '2px 0 0' }}>{value}</p>
    </div>
  </div>
);

const StatusBtn = ({ active, color, children, onClick }) => (
  <motion.button 
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick} 
    style={{ 
      padding: '6px 16px', 
      border: 'none', 
      borderRadius: 'var(--radius-lg)', 
      fontSize: '11px', 
      fontWeight: '800', 
      cursor: 'pointer', 
      transition: 'background 0.2s, color 0.2s, box-shadow 0.2s', 
      background: active ? color : 'transparent', 
      color: active ? 'white' : 'var(--text-muted)',
      boxShadow: active ? '0 4px 12px ' + color + '30' : 'none'
    }}
  >
    {children}
  </motion.button>
);

const formatHours = (h) => {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

const fGroup = { display: 'flex', flexDirection: 'column', gap: '6px' };
const lbl = { fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const thStyle = { padding: '16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-light)' };
const tdStyle = { padding: '16px', borderBottom: '1px solid var(--border-light)' };

export default TeacherPortal;
