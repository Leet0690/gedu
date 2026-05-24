import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { getModulesForStudent, MODULES_DATA } from '../data/modules';
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
  Heart
} from 'lucide-react';

const APP_VERSION = '2.5.0';
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

const getGroupAbbreviation = (filiere, annee) => {
  let diplomaAbbr = "";
  let majorAbbr = "";
  for (const dip in MODULES_DATA) {
    if (MODULES_DATA[dip][filiere]) {
      diplomaAbbr = dip.includes('Spécialisé') ? "TS" : "T";
      break;
    }
  }
  if (filiere.includes('Développement')) majorAbbr = "DI";
  else if (filiere.includes('Gestion Informatisée')) majorAbbr = "GI";
  else if (filiere.includes('Logistique')) majorAbbr = "GTL";
  else if (filiere.includes('Entreprises')) majorAbbr = "GE";
  else majorAbbr = filiere.split(' ').map(w => w[0]).join('').toUpperCase();
  const yearNum = annee.includes('1') ? "1" : "2";
  return diplomaAbbr + majorAbbr + yearNum;
};

const TeacherPortal = () => {
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const { teachers, students, updateGrades, grades, loading, studentAttendance, updateStudentAttendance, schedules, updateTeacherAttendance, loadAttendanceForSession, teacherAttendance, loadTeacherAttendanceForDate, confirmAction, modules: allModules = [], activeSemester, getActiveScheduleModule } = useApp();
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

  // Check if attendance was already submitted today
  const alreadyDoneToday = useMemo(() => {
    if (!teacher || todaysSessions.length === 0 || accessMode !== 'attendance') return false;
    // Check if ALL sessions have a 'present' teacher attendance record for today
    return todaysSessions.every(session => {
      const safeModule = (getActiveScheduleModule(session) || 'global').replace(/[^a-zA-Z0-9]/g, '_');
      const safeTime = (session.time || '').replace(/[^0-9]/g, '') || 'x';
      const docId = `${teacher.id}_${safeModule}_${safeTime}_${selectedDate}`;
      const record = teacherAttendance.find(a => a.id === docId);
      return record && record.status === 'present';
    });
  }, [teacher, todaysSessions, teacherAttendance, selectedDate, accessMode, getActiveScheduleModule]);

  const [selectedSessionId, setSelectedSessionId] = useState('');
  const currentSession = useMemo(() => {
    if (selectedSessionId) return todaysSessions.find(s => s.id === selectedSessionId);
    return null;
  }, [todaysSessions, selectedSessionId]);
  const includeAllSemestersForGrades = activeTab === 'grades' || accessMode === 'grades';

  const sessionDuration = useMemo(() => {
    if (!currentSession || !currentSession.time) return 4;
    try {
      const [start, end] = currentSession.time.split('-');
      const [h1, m1] = start.split(':').map(Number);
      const [h2, m2] = end.split(':').map(Number);
      const diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
      return Math.max(0, Math.round((diffMinutes / 60) * 100) / 100);
    } catch (e) { return 4; }
  }, [currentSession]);

  React.useEffect(() => {
    if (accessMode === 'attendance') setActiveTab('attendance');
    else if (accessMode === 'grades') setActiveTab('grades');
  }, [accessMode]);

  React.useEffect(() => {
    if (currentSession) {
      const sessionModule = getActiveScheduleModule(currentSession);
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
  }, [currentSession, allModules, getActiveScheduleModule]);

  React.useEffect(() => {
    if (activeTab === 'attendance' && selectedSubject && selectedDate) {
      loadAttendanceForSession(selectedSubject, selectedDate);
    }
  }, [activeTab, selectedSubject, selectedDate, loadAttendanceForSession]);

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
    const teacherYears = teacher.years || ['1ère année', '2ème année'];
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
    const filtered = students.filter(s => s.major === selectedGroup && s.year === filterYear && (!selectedDiploma || s.diploma === selectedDiploma));
    
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

  const allAttended = useMemo(() => {
    if (!currentSession || !relevantStudents || relevantStudents.length === 0 || !selectedSubject) return false;
    return relevantStudents.every(s => {
      const docId = `${s.id}_${selectedSubject.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedDate}`;
      const record = studentAttendance.find(a => a.id === docId);
      return record && ['present', 'absent'].includes(record.status);
    });
  }, [relevantStudents, selectedSubject, selectedDate, studentAttendance]);

  // Track if ALL sessions for the day are completed
  const allSessionsCompleted = useMemo(() => {
    if (todaysSessions.length === 0) return false;
    return todaysSessions.every(session => completedSessionIds.has(session.id));
  }, [todaysSessions, completedSessionIds]);

  const unmarkedStudents = useMemo(() => {
    if (!selectedSubject || !relevantStudents.length) return [];
    return relevantStudents.filter(s => {
      const docId = `${s.id}_${selectedSubject.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedDate}`;
      const record = studentAttendance.find(a => a.id === docId);
      return !record || !['present', 'absent'].includes(record.status);
    });
  }, [relevantStudents, selectedSubject, selectedDate, studentAttendance]);

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
    // Deduplicate time slots for display
    const uniqueTimeSlots = new Map();
    todaysSessions.forEach(s => {
      const timeKey = (s.time || '').replace(/[^0-9]/g, '');
      if (!uniqueTimeSlots.has(timeKey)) {
        try {
          const [start, end] = s.time.split('-');
          const [h1, m1] = start.split(':').map(Number);
          const [h2, m2] = end.split(':').map(Number);
          uniqueTimeSlots.set(timeKey, Math.max(0, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60));
        } catch { uniqueTimeSlots.set(timeKey, 0); }
      }
    });
    const totalH = Array.from(uniqueTimeSlots.values()).reduce((s, h) => s + h, 0);
    return (
      <div className="flex-center" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4ff 0%, #f8f0fa 100%)', padding: '24px' }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }} style={{ padding: '48px 32px', textAlign: 'center', maxWidth: '420px', width: '100%', background: 'white', borderRadius: '28px', boxShadow: '0 16px 48px rgba(0,0,0,0.06)' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 300 }} style={{ width: '88px', height: '88px', background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 12px 36px rgba(99,102,241,0.3)' }}>
            <CheckCircle2 size={44} />
          </motion.div>
          <h1 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '10px', color: 'var(--text-primary)' }}>Présence déjà enregistrée</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.7', marginBottom: '24px' }}>
            L'appel pour le <strong>{new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> a déjà été validé.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg-subtle)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>📚 Séances validées</span>
              <span style={{ fontSize: '15px', fontWeight: '900', color: 'var(--primary)' }}>{todaysSessions.length}</span>
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--bg-subtle)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>⏰ Heures de vacation</span>
              <span style={{ fontSize: '15px', fontWeight: '900', color: '#16a34a' }}>{formatHours(totalH)}</span>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-faint)', fontWeight: '600' }}>Si vous pensez qu'il y a une erreur, veuillez contacter l'administration.</p>
        </motion.div>
      </div>
    );
  }

  const handleValidateSession = async () => {
    if (!currentSession || !allAttended) {
      setShowUnmarkedWarning(true);
      return;
    }
    // Mark this session as completed
    setCompletedSessionIds(prev => new Set([...prev, currentSession.id]));

    // Build the docId that updateTeacherAttendance would produce
    const safeModule = (selectedSubject || 'global').replace(/[^a-zA-Z0-9]/g, '_');
    const safeTime = (currentSession.time || '').replace(/[^0-9]/g, '') || 'x';
    const wouldBeDocId = `${teacher.id}_${safeModule}_${safeTime}_${selectedDate}`;

    // Check if a session with the SAME docId (same module + same time) was already validated
    // If so, skip the DB write entirely to avoid overwriting the correct hours
    const alreadyRecordedSameDocId = todaysSessions.some(s => {
      if (s.id === currentSession.id || !completedSessionIds.has(s.id)) return false;
      const sModule = (s.module || 'global').replace(/[^a-zA-Z0-9]/g, '_');
      const sTime = (s.time || '').replace(/[^0-9]/g, '') || 'x';
      return `${teacher.id}_${sModule}_${sTime}_${selectedDate}` === wouldBeDocId;
    });

    if (!alreadyRecordedSameDocId) {
      await updateTeacherAttendance(teacher.id, selectedDate, 'present', `Appel validé: ${selectedSubject}`, sessionDuration, selectedSubject, currentSession?.time || '');
    }
    showToast(`Séance "${selectedSubject}" validée.`, 'success');

    // Move to next uncompleted session
    const nextSession = todaysSessions.find(s => s.id !== currentSession.id && !completedSessionIds.has(s.id));
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
    const current = grades[studentId]?.[selectedSubject.replace(/\./g, '_')] || { c1: '', c2: '', c3: '', efcfp: '', efcft: '' };
    updateGrades(studentId, selectedSubject, { ...current, [field]: value });
  };

  const handleSaveGrades = async () => {
    let hasInvalid = false;
    relevantStudents.forEach(student => {
      const g = grades[student.id]?.[selectedSubject.replace(/\./g, '_')] || {};
      ['c1', 'c2', 'c3', 'efcfp', 'efcft'].forEach(field => {
        if (g[field] !== '' && g[field] !== undefined) {
          const num = parseFloat(g[field]);
          if (num < 0 || num > 20) hasInvalid = true;
        }
      });
    });
    if (hasInvalid) return showToast("Certaines notes sont invalides.", 'error');
    setSuccess(true);
    showToast(`Notes synchronisées pour ${selectedSubject}.`, 'success');
    setTimeout(() => setSuccess(false), 2500);
  };

  const handleAttendanceChange = async (studentId, status) => {
    if (!selectedSubject) return;
    const safeModule = selectedSubject.replace(/[^a-zA-Z0-9]/g, '_');
    const docId = `${studentId}_${safeModule}_${selectedDate}`;
    const record = studentAttendance.find(a => a.id === docId);
    await updateStudentAttendance(studentId, selectedSubject, selectedDate, status, record?.comment || '', teacher.id);

    const unmarkedStudents = relevantStudents.filter(s => {
      if (s.id === studentId) return false;
      const sDocId = `${s.id}_${safeModule}_${selectedDate}`;
      const sRecord = studentAttendance.find(a => a.id === sDocId);
      return !sRecord?.status;
    });
    if (unmarkedStudents.length > 0) {
      await Promise.all(
        unmarkedStudents.map(s =>
          updateStudentAttendance(s.id, selectedSubject, selectedDate, 'absent', '', teacher.id)
        )
      );
    }
  };

  const handleClearAttendance = async (studentId) => {
    if (!selectedSubject) return;
    const docId = `${studentId}_${selectedSubject.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedDate}`;
    const record = studentAttendance.find(a => a.id === docId);
    await updateStudentAttendance(studentId, selectedSubject, selectedDate, '', record?.comment || '', teacher.id);
  };

  const handleAttendanceComment = async (studentId, comment) => {
    if (!selectedSubject) return;
    const docId = `${studentId}_${selectedSubject.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedDate}`;
    let record = studentAttendance.find(a => a.id === docId);
    await updateStudentAttendance(studentId, selectedSubject, selectedDate, record?.status || 'present', comment, teacher.id);
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
    // Deduplicate time slots: sessions at the same time count as one
    const uniqueTimeSlots = new Map();
    todaysSessions.forEach(s => {
      const timeKey = (s.time || '').replace(/[^0-9]/g, '');
      if (!uniqueTimeSlots.has(timeKey)) {
        try {
          const [start, end] = s.time.split('-');
          const [h1, m1] = start.split(':').map(Number);
          const [h2, m2] = end.split(':').map(Number);
          uniqueTimeSlots.set(timeKey, Math.max(0, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60));
        } catch { uniqueTimeSlots.set(timeKey, 0); }
      }
    });
    const totalDuration = Array.from(uniqueTimeSlots.values()).reduce((sum, h) => sum + h, 0);
    return (
      <div className="flex-center" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8f0fa 0%, #e8f5e9 100%)' }}>
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} style={{ padding: '48px 36px', textAlign: 'center', maxWidth: '420px', width: '100%', background: 'white', borderRadius: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 300 }} style={{ width: '96px', height: '96px', background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', boxShadow: '0 12px 40px rgba(22, 163, 74, 0.35)' }}>
            <Heart size={48} />
          </motion.div>
          <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }} style={{ fontSize: '26px', fontWeight: '900', marginBottom: '12px', color: 'var(--text-primary)' }}>Merci, {teacher.name.split(' ')[0]} !</motion.h1>
          <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }} style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.7', marginBottom: '28px' }}>
            Votre journée a été enregistrée avec succès.<br/>
            <strong>{todaysSessions.length} séance(s)</strong> validée(s) — <strong>{formatHours(totalDuration)}</strong> de vacation transmise(s) à l'administration.
          </motion.p>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55 }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '14px 20px', background: 'var(--bg-subtle)', borderRadius: '14px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
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
      {/* Session Context Bar */}
      {activeTab === 'attendance' && todaysSessions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card" style={{ padding: 'var(--space-4) var(--space-6)', marginBottom: 'var(--space-6)', background: 'var(--primary-ultra-light)', border: '1px solid var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          
          {currentSession ? (
            <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
              <SessionStat label="Séance" value={dayOfWeek} icon={CalendarDays} />
              <SessionStat label="Horaire" value={currentSession.time} icon={Clock} />
              <SessionStat label="Groupe" value={getGroupAbbreviation(currentSession.filiere, currentSession.annee)} icon={Users} />
              <SessionStat label="Module" value={selectedSubject || getActiveScheduleModule(currentSession)} icon={BookOpen} />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--primary)' }}>
              <Presentation size={24} />
              <div>
                <p style={{ fontSize: '14px', fontWeight: '800' }}>Sélectionnez votre séance</p>
                <p style={{ fontSize: '11px', fontWeight: '600', opacity: 0.8 }}>{todaysSessions.length} séance(s) prévue(s) aujourd'hui</p>
              </div>
            </div>
          )}

          <div style={{ minWidth: '240px' }}>
            <select className="input-premium" style={{ width: '100%', background: 'white' }} value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)}>
              <option value="">-- Choisir la séance --</option>
              {todaysSessions.map(s => <option key={s.id} value={s.id}>{s.time} - {getGroupAbbreviation(s.filiere, s.annee)} - {s.displayModule || s.module}</option>)}
            </select>
          </div>
        </motion.div>
      )}

      {/* Main Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-xl)', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow)' }}>
            <Presentation size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: '900', color: 'var(--text-primary)' }}>{teacher.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <Wifi size={10} style={{ color: 'var(--success)' }} />
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session Active</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
          {accessMode === 'full' && (
            <div className="modern-tabs-container">
              <button onClick={() => setActiveTab('attendance')} className={`modern-tab ${activeTab === 'attendance' ? 'active' : ''}`}>Présences</button>
              <button onClick={() => setActiveTab('grades')} className={`modern-tab ${activeTab === 'grades' ? 'active' : ''}`}>Notes</button>
            </div>
          )}
          
          {activeTab === 'grades' ? (
            <button onClick={handleSaveGrades} className="btn-modern primary" style={{ padding: '12px 24px' }}>
              <CloudUpload size={18} style={{ marginRight: '8px' }} /> Enregistrer les notes
            </button>
          ) : (
            todaysSessions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                {currentSession && (
                  <button onClick={handleValidateSession} disabled={!allAttended} className={`btn-modern ${allAttended ? 'primary' : 'secondary'}`} style={{ padding: '10px 20px', opacity: allAttended ? 1 : 0.5, cursor: allAttended ? 'pointer' : 'not-allowed' }}>
                    <CheckCircle2 size={16} style={{ marginRight: '6px' }} />
                    {completedSessionIds.has(currentSession.id) ? '✓ Séance validée' : `Valider cette séance (${completedSessionIds.size}/${todaysSessions.length})`}
                  </button>
                )}
                {allSessionsCompleted && (
                  <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={handleFinalValidation} className="btn-modern primary" style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #16a34a, #22c55e)', border: 'none' }}>
                    <Award size={18} style={{ marginRight: '8px' }} /> Finaliser la journée ({todaysSessions.length}/{todaysSessions.length})
                  </motion.button>
                )}
              </div>
            )
          )}
        </div>
      </motion.div>

      {/* Controls Bar */}
      {activeTab === 'grades' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <div style={fGroup}><label style={lbl}>Niveau</label><select className="input-premium" value={selectedDiploma} onChange={(e) => setSelectedDiploma(e.target.value)}>{availableDiplomas.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
            <div style={fGroup}><label style={lbl}>Année</label><select className="input-premium" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
            <div style={fGroup}><label style={lbl}>Filière</label><select className="input-premium" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>{filteredGroups.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
            <div style={fGroup}><label style={lbl}>Module</label><select className="input-premium" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>{filteredSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}</select></div>
          </div>
        </motion.div>
      )}

      {/* Unmarked warning banner */}
      <AnimatePresence>
        {showUnmarkedWarning && !allAttended && activeTab === 'attendance' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ marginBottom: 'var(--space-4)', padding: '16px 20px', borderRadius: 'var(--radius-xl)', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', display: 'flex', flexDirection: 'column', gap: '12px' }}
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
                <span key={s.id} style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.20)', color: '#dc2626' }}>
                  {s.lastName} {s.firstName}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {activeTab === 'attendance' && !currentSession ? (
          <EmptyState title="Séance non sélectionnée" message={todaysSessions.length > 0 ? "Choisissez une séance dans la barre supérieure pour commencer l'appel." : `Aucune séance n'est planifiée pour vous ce ${dayOfWeek}.`} icon="calendar" />
        ) : relevantStudents.length === 0 ? (
          <EmptyState title="Liste vide" message="Aucun stagiaire trouvé pour ce groupe." icon="users" />
        ) : !selectedSubject ? (
          <EmptyState title="Module manquant" message="Sélectionnez un module pour afficher la liste." icon="book-open" />
        ) : activeTab === 'grades' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={th}>Stagiaire</th>
                  <th style={thCenter}>C1</th>
                  <th style={thCenter}>C2</th>
                  <th style={thCenter}>C3</th>
                  <th style={{ ...thCenter, background: 'rgba(0,0,0,0.02)' }}>Moy CC</th>
                  <th style={thCenter}>EFCFP</th>
                  <th style={thCenter}>EFCFT</th>
                </tr>
              </thead>
              <tbody>
                {relevantStudents.map((s, idx) => {
                  const g = grades[s.id]?.[selectedSubject.replace(/\./g, '_')] || {};
                  const moyCC = calcMoyenneCC(g);
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'white' : 'var(--bg-subtle)' }}>
                      <td style={td}>
                        <p style={{ fontSize: '13px', fontWeight: '800' }}>{s.lastName} {s.firstName}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.regNo} · {s.year}</p>
                      </td>
                      <td style={tdCenter}><GradeInput value={g.c1} onChange={(v) => handleGradeChange(s.id, 'c1', v)} /></td>
                      <td style={tdCenter}><GradeInput value={g.c2} onChange={(v) => handleGradeChange(s.id, 'c2', v)} /></td>
                      <td style={tdCenter}><GradeInput value={g.c3 || ''} onChange={(v) => handleGradeChange(s.id, 'c3', v)} placeholder="opt." /></td>
                      <td style={{ ...tdCenter, background: 'rgba(0,0,0,0.01)' }}><span style={{ fontWeight: '800' }}>{moyCC !== null ? moyCC.toFixed(2) : '—'}</span></td>
                      <td style={tdCenter}><GradeInput value={g.efcfp} onChange={(v) => handleGradeChange(s.id, 'efcfp', v)} /></td>
                      <td style={tdCenter}><GradeInput value={g.efcft} onChange={(v) => handleGradeChange(s.id, 'efcft', v)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '750px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={th}>Stagiaire</th>
                  <th style={{ ...th, textAlign: 'center', width: '260px' }}>Appel</th>
                  <th style={th}>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {(() => { let firstUnmarkedAssigned = false; return relevantStudents.map((s, idx) => {
                  const docId = `${s.id}_${selectedSubject.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedDate}`;
                  const record = studentAttendance.find(a => a.id === docId);
                  const status = record?.status || '';
                  const comment = record?.comment || '';
                  const isUnmarked = showUnmarkedWarning && !['present', 'absent'].includes(status);
                  const isFirstUnmarked = isUnmarked && !firstUnmarkedAssigned && (firstUnmarkedAssigned = true);
                  return (
                    <tr key={s.id} ref={isFirstUnmarked ? firstUnmarkedRef : null} style={{ borderBottom: '1px solid var(--border-light)', background: isUnmarked ? 'rgba(220,38,38,0.06)' : (idx % 2 === 0 ? 'white' : 'var(--bg-subtle)'), borderLeft: isUnmarked ? '3px solid rgba(220,38,38,0.5)' : '3px solid transparent', transition: 'background 0.25s, border-color 0.25s' }}>
                      <td style={td}>
                        <p style={{ fontSize: '13px', fontWeight: '800', color: isUnmarked ? '#dc2626' : 'var(--text-primary)' }}>{s.lastName} {s.firstName}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Matricule: {s.regNo}</p>
                      </td>
                      <td style={tdCenter}>
                        <div style={{ display: 'inline-flex', background: 'var(--bg-page)', borderRadius: 'var(--radius-xl)', padding: '4px', alignItems: 'center' }}>
                          <StatusBtn active={status === 'present'} color="var(--success)" onClick={() => handleAttendanceChange(s.id, 'present')}>Présent</StatusBtn>
                          <StatusBtn active={status === 'absent'} color="var(--danger)" onClick={() => handleAttendanceChange(s.id, 'absent')}>Absent</StatusBtn>
                          {status && <button onClick={() => handleClearAttendance(s.id)} style={{ marginLeft: '2px', padding: '4px 6px', border: 'none', borderRadius: 'var(--radius-md)', background: 'transparent', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', alignItems: 'center' }} title="Effacer"><X size={13} /></button>}
                        </div>
                      </td>
                      <td style={td}>
                        <input type="text" className="input-premium" placeholder="Note..." style={{ width: '100%', fontSize: '12px', background: 'transparent', border: '1px solid transparent' }} value={comment} onChange={(e) => handleAttendanceComment(s.id, e.target.value)} />
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
    <div style={{ padding: '6px', background: 'white', borderRadius: 'var(--radius-lg)', color: 'var(--primary)', boxShadow: 'var(--shadow-xs)' }}><Icon size={14} /></div>
    <div>
      <p style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)' }}>{value}</p>
    </div>
  </div>
);

const StatusBtn = ({ active, color, children, onClick }) => (
  <button onClick={onClick} style={{ padding: '6px 14px', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: '11px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s', background: active ? color : 'transparent', color: active ? 'white' : 'var(--text-muted)' }}>{children}</button>
);

const formatHours = (h) => {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

const fGroup = { display: 'flex', flexDirection: 'column', gap: '6px' };
const lbl = { fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const th = { padding: '16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' };
const thCenter = { ...th, textAlign: 'center' };
const td = { padding: '16px' };
const tdCenter = { ...td, textAlign: 'center' };

export default TeacherPortal;
