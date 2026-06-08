import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { FILIERES, getModulesForFiliere, getStudyYearsForDiploma, getStudyYearsForMajor } from '../data/modules';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { DatePicker } from '../components/ui';
import { FilterSelect } from '../components/ui/FilterSelect';
import { isActiveStudent } from '../utils/studentStatus';
import {
  UserCheck, FileSpreadsheet, Search, CheckCircle2,
  XCircle, X, Clock, Users, Filter, Download, CalendarRange,
  ChevronLeft, ChevronRight, AlertTriangle, CheckCheck
} from 'lucide-react';

/* ─── Monthly-view helpers ─── */
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const StatusCell = ({ status }) => {
  if (!status) return (
    <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-light)' }} />
    </div>
  );

  const cfg = {
    present: { label: 'P', bg: 'rgba(22,163,74,0.10)',  color: '#15803d', border: 'rgba(22,163,74,0.25)' },
    absent:  { label: 'A', bg: 'rgba(220,38,38,0.10)',   color: '#dc2626', border: 'rgba(220,38,38,0.25)' },
  }[status] || {};
  return (
    <div style={{ width: '28px', height: '28px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: '10px', fontWeight: '900', color: cfg.color }}>
      {cfg.label}
    </div>
  );
};

/* ─── Shared styles ─── */
const labelStyle = { fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', display: 'block' };
const filterGroupStyle = { display: 'flex', flexDirection: 'column' };
const thStyle = { padding: '16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' };
const tdStyle = { padding: '16px' };

const calcDuration = (timeStr) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2})[h:]?(\d{2})?\s*[-–—]\s*(\d{1,2})[h:]?(\d{2})?/i);
  if (!match) return 0;
  try {
    const h1 = parseInt(match[1] || 0, 10), m1 = parseInt(match[2] || 0, 10);
    const h2 = parseInt(match[3] || 0, 10), m2 = parseInt(match[4] || 0, 10);
    return Math.max(0, Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 * 100) / 100);
  } catch { return 0; }
};

const StudentAttendance = () => {
  const { students, teachers, studentAttendance, updateStudentAttendance, loadAttendanceForSession, loadStudentAttendanceForMonth, loading, schedules, teacherAttendance, updateTeacherAttendance, loadTeacherAttendanceForDate, modules: allModules = [], activeSemester = 'S1', getActiveScheduleModule } = useApp();
  const { showToast } = useToast();

  /* Tab state */
  const [view, setView] = useState('daily');

  /* ── Daily view state ── */
  const [filterDiploma, setFilterDiploma] = useState('');
  const [filterMajor, setFilterMajor] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const dayOfWeek = useMemo(() => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[new Date(selectedDate).getDay()];
  }, [selectedDate]);
  const activeStudents = useMemo(() => (students || []).filter(isActiveStudent), [students]);

  const filteredStudents = useMemo(() => {
    return activeStudents.filter(s => {
      const hasClassToday = (schedules || []).some(sc => sc.filiere === s.major && sc.annee === s.year && sc.day === dayOfWeek);
      if (!hasClassToday) return false;
      if (filterDiploma && s.diploma !== filterDiploma) return false;
      if (filterMajor && s.major !== filterMajor) return false;
      if (filterYear && s.year !== filterYear) return false;
      if (searchTerm) {
        const full = `${s.lastName} ${s.firstName}`.toLowerCase();
        if (!full.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
  }, [activeStudents, filterDiploma, filterMajor, filterYear, searchTerm, schedules, dayOfWeek]);

  const availableMajors = filterDiploma ? (FILIERES[filterDiploma] || []) : Array.from(new Set(activeStudents.map(s => s.major)));
  const availableModules = useMemo(() => {
    if (filterMajor && filterYear) {
      const scheduledModules = (schedules || [])
        .filter(sc => sc.filiere === filterMajor && sc.annee === filterYear && sc.day === dayOfWeek)
        .map(sc => getActiveScheduleModule(sc))
        .filter(Boolean);
      if (scheduledModules.length > 0) return Array.from(new Set(scheduledModules));
      const configuredModules = (allModules || [])
        .filter(m => m.diploma === filterDiploma && m.major === filterMajor && m.year === filterYear && [activeSemester, 'Annuel'].includes(m.semester || 'S1'))
        .map(m => m.name);
      if (configuredModules.length > 0) return configuredModules;
      if (filterDiploma) return getModulesForFiliere(filterDiploma, filterMajor, filterYear);
    }
    return [];
  }, [filterDiploma, filterMajor, filterYear, schedules, dayOfWeek, getActiveScheduleModule, allModules, activeSemester]);

  useEffect(() => {
    if (filterModule && availableModules.length > 0 && !availableModules.includes(filterModule)) {
      setFilterModule('');
    }
  }, [filterModule, availableModules]);

  const stats = useMemo(() => {
    let presents = 0, absents = 0;
    filteredStudents.forEach(s => {
      const docId = `${s.id}_${(filterModule || 'global').replace(/[^a-zA-Z0-9]/g, '_')}_${selectedDate}`;
      const record = studentAttendance.find(a => a.id === docId);
      if (record) {
        if (record.status === 'present') presents++;
        else if (record.status === 'absent') absents++;
      }
    });
    return { presents, absents, total: filteredStudents.length };
  }, [filteredStudents, studentAttendance, filterModule, selectedDate]);

  const multiGroupProgress = useMemo(() => {
    if (!filterModule || !filterMajor || !filterYear) return null;
    const matchingSession = (schedules || []).find(sc =>
      sc.filiere === filterMajor && sc.annee === filterYear &&
      sc.day === dayOfWeek && getActiveScheduleModule(sc) === filterModule
    );
    if (!matchingSession?.teacherId || !matchingSession?.time) return null;

    const allTeacherSessions = (schedules || []).filter(sc =>
      sc.teacherId === matchingSession.teacherId &&
      sc.time === matchingSession.time &&
      sc.day === dayOfWeek
    );
    if (allTeacherSessions.length <= 1) return null;

    const teacherName = (teachers || []).find(t => t.id === matchingSession.teacherId)?.name || '—';

    const groups = allTeacherSessions.map(session => {
      const groupStudents = activeStudents.filter(s =>
        s.major === session.filiere && s.year === session.annee
      );
      const safeModule = (getActiveScheduleModule(session) || 'global').replace(/[^a-zA-Z0-9]/g, '_');
      const marked = groupStudents.filter(s =>
        (studentAttendance || []).some(a => a.id === `${s.id}_${safeModule}_${selectedDate}` && a.status)
      ).length;
      const total = groupStudents.length;
      const done = total > 0 && marked === total;
      const isCurrent = session.filiere === filterMajor && session.annee === filterYear;
      return { label: `${session.filiere} – ${session.annee}`, marked, total, done, isCurrent };
    });

    const completedCount = groups.filter(g => g.done).length;
    return { teacherName, time: matchingSession.time, groups, completedCount, totalGroups: groups.length };
  }, [filterModule, filterMajor, filterYear, dayOfWeek, schedules, activeStudents, studentAttendance, selectedDate, teachers, getActiveScheduleModule]);

  useEffect(() => {
    if (filterModule && selectedDate) loadAttendanceForSession(filterModule, selectedDate);
  }, [filterModule, selectedDate, loadAttendanceForSession]);

  const otherTeacherSessions = useMemo(() => {
    if (!filterModule || !filterMajor || !filterYear || !dayOfWeek) return [];
    const matchingSession = (schedules || []).find(sc =>
      sc.filiere === filterMajor && sc.annee === filterYear &&
      sc.day === dayOfWeek && getActiveScheduleModule(sc) === filterModule
    );
    if (!matchingSession?.teacherId || !matchingSession?.time) return [];
    return (schedules || []).filter(sc =>
      sc.teacherId === matchingSession.teacherId &&
      sc.time === matchingSession.time &&
      sc.day === dayOfWeek &&
      !(sc.filiere === filterMajor && sc.annee === filterYear)
    );
  }, [filterModule, filterMajor, filterYear, dayOfWeek, schedules]);

  useEffect(() => {
    if (otherTeacherSessions.length > 0 && selectedDate) {
      otherTeacherSessions.forEach(session => {
        loadAttendanceForSession(getActiveScheduleModule(session), selectedDate);
      });
    }
  }, [otherTeacherSessions, selectedDate, loadAttendanceForSession, getActiveScheduleModule]);

  useEffect(() => {
    if (selectedDate) loadTeacherAttendanceForDate(selectedDate);
  }, [selectedDate, loadTeacherAttendanceForDate]);

  const autoMarkTeacherIfReady = useCallback(async (matchingSession, extraRecords = []) => {
    if (!matchingSession?.teacherId || !matchingSession?.time) return;

    const allTeacherSessions = (schedules || []).filter(sc =>
      sc.teacherId === matchingSession.teacherId &&
      sc.time === matchingSession.time &&
      sc.day === dayOfWeek
    );

    const combinedAttendance = [...(studentAttendance || []), ...extraRecords];

    const allGroupsComplete = allTeacherSessions.every(session => {
      const groupStudents = activeStudents.filter(s =>
        s.major === session.filiere && s.year === session.annee
      );
      if (groupStudents.length === 0) return true;
      const safeModule = (getActiveScheduleModule(session) || 'global').replace(/[^a-zA-Z0-9]/g, '_');
      return groupStudents.every(s => {
        const docId = `${s.id}_${safeModule}_${selectedDate}`;
        return combinedAttendance.some(a => a.id === docId && a.status);
      });
    });

    if (!allGroupsComplete) return;

    const matchingModule = getActiveScheduleModule(matchingSession);
    const safeModule = (matchingModule || 'global').replace(/[^a-zA-Z0-9]/g, '_');
    const safeTime = (matchingSession.time || '').replace(/[^0-9]/g, '') || 'x';
    const teacherDocId = `${matchingSession.teacherId}_${safeModule}_${safeTime}_${selectedDate}`;
    const existingTeacherRecord = (teacherAttendance || []).find(a => a.id === teacherDocId);
    if (!existingTeacherRecord) {
      const duration = calcDuration(matchingSession.time);
      await updateTeacherAttendance(matchingSession.teacherId, selectedDate, 'present', '', duration, matchingModule, matchingSession.time);
    }
  }, [schedules, activeStudents, studentAttendance, teacherAttendance, dayOfWeek, selectedDate, updateTeacherAttendance, getActiveScheduleModule]);

  const handleStatusChange = async (studentId, status) => {
    if (!filterModule) { showToast("Veuillez d'abord sélectionner un module.", 'warning'); return; }
    try {
      const safeModule = filterModule.replace(/[^a-zA-Z0-9]/g, '_');
      const docId = `${studentId}_${safeModule}_${selectedDate}`;
      const record = studentAttendance.find(a => a.id === docId);
      await updateStudentAttendance(studentId, filterModule, selectedDate, status, record?.comment || '', 'admin');

      const unmarkedStudents = filteredStudents.filter(s => {
        if (s.id === studentId) return false;
        const sDocId = `${s.id}_${safeModule}_${selectedDate}`;
        const sRecord = studentAttendance.find(a => a.id === sDocId);
        return !sRecord?.status;
      });
      if (unmarkedStudents.length > 0) {
        await Promise.all(
          unmarkedStudents.map(s =>
            updateStudentAttendance(s.id, filterModule, selectedDate, 'absent', '', 'admin')
          )
        );
      }

      const matchingSession = (schedules || []).find(sc =>
        sc.filiere === filterMajor &&
        sc.annee === filterYear &&
        sc.day === dayOfWeek &&
        getActiveScheduleModule(sc) === filterModule
      );
      const extraRecords = [
        { id: docId, studentId, status },
        ...unmarkedStudents.map(s => ({
          id: `${s.id}_${safeModule}_${selectedDate}`,
          studentId: s.id,
          status: 'absent'
        }))
      ];
      await autoMarkTeacherIfReady(matchingSession, extraRecords);
    } catch { showToast("Erreur lors de l'enregistrement.", 'error'); }
  };

  const [bulkLoading, setBulkLoading] = useState(false);

  const handleMarkAllPresent = async () => {
    if (!filterModule) { showToast("Veuillez d'abord sélectionner un module.", 'warning'); return; }
    if (!filteredStudents.length) return;
    setBulkLoading(true);
    try {
      const safeModule = filterModule.replace(/[^a-zA-Z0-9]/g, '_');
      await Promise.all(
        filteredStudents.map(student => {
          const docId = `${student.id}_${safeModule}_${selectedDate}`;
          const record = studentAttendance.find(a => a.id === docId);
          return updateStudentAttendance(student.id, filterModule, selectedDate, 'present', record?.comment || '', 'admin');
        })
      );

      const matchingSession = (schedules || []).find(sc =>
        sc.filiere === filterMajor &&
        sc.annee === filterYear &&
        sc.day === dayOfWeek &&
        getActiveScheduleModule(sc) === filterModule
      );
      const extraRecords = filteredStudents.map(s => ({
        id: `${s.id}_${safeModule}_${selectedDate}`,
        studentId: s.id,
        status: 'present'
      }));
      await autoMarkTeacherIfReady(matchingSession, extraRecords);

      showToast(`${filteredStudents.length} stagiaire(s) marqué(s) présent(s).`, 'success');
    } catch { showToast("Erreur lors de l'enregistrement groupé.", 'error'); }
    finally { setBulkLoading(false); }
  };

  const handleClearStatus = async (studentId) => {
    if (!filterModule) return;
    const record = studentAttendance.find(a => a.id === `${studentId}_${filterModule.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedDate}`);
    await updateStudentAttendance(studentId, filterModule, selectedDate, '', record?.comment || '', 'admin');
  };

  const handleCommentChange = async (studentId, comment) => {
    if (!filterModule) return;
    const docId = `${studentId}_${(filterModule).replace(/[^a-zA-Z0-9]/g, '_')}_${selectedDate}`;
    const record = studentAttendance.find(a => a.id === docId);
    await updateStudentAttendance(studentId, filterModule, selectedDate, record?.status || 'present', comment, 'admin');
  };

  const exportDailyCSV = () => {
    if (!filteredStudents.length) return showToast('Aucune donnée.', 'info');
    const headers = "\uFEFFStagiaire,Matricule,Module,Date,Statut,Commentaire\n";
    const rows = filteredStudents.map(s => {
      const docId = `${s.id}_${(filterModule || 'global').replace(/[^a-zA-Z0-9]/g, '_')}_${selectedDate}`;
      const r = studentAttendance.find(a => a.id === docId) || {};
      return `"${s.lastName} ${s.firstName}","${s.regNo}","${filterModule}","${selectedDate}","${r.status || 'non défini'}","${r.comment || ''}"`;
    }).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Absences_Stagiaires_${selectedDate}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  /* ── Monthly view state ── */
  const now = new Date();
  const [mMonth, setMMonth] = useState(now.getMonth());
  const [mYear, setMYear] = useState(now.getFullYear());
  const [mFilterFiliere, setMFilterFiliere] = useState('');
  const [mFilterAnnee, setMFilterAnnee] = useState('');
  const [mSearch, setMSearch] = useState('');
  const allFilieres = useMemo(() => Array.from(new Set(Object.values(FILIERES).flat())), []);
  const availableYears = useMemo(() => { const y = now.getFullYear(); return [y - 1, y, y + 1]; }, []);

  useEffect(() => {
    if (view === 'monthly') loadStudentAttendanceForMonth(mMonth, mYear);
  }, [view, mMonth, mYear, loadStudentAttendanceForMonth]);

  const daysInMonth = useMemo(() => new Date(mYear, mMonth + 1, 0).getDate(), [mMonth, mYear]);
  const mDays = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const pad = (n) => String(n).padStart(2, '0');
  const monthPrefix = `${mYear}-${pad(mMonth + 1)}`;

  const mFilteredStudents = useMemo(() =>
    activeStudents.filter(s => {
      if (mFilterFiliere && s.major !== mFilterFiliere) return false;
      if (mFilterAnnee && s.year !== mFilterAnnee) return false;
      if (mSearch) {
        const full = `${s.lastName} ${s.firstName}`.toLowerCase();
        if (!full.includes(mSearch.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '')),
    [activeStudents, mFilterFiliere, mFilterAnnee, mSearch]
  );

  const monthColumns = useMemo(() => {
    if (!mFilterFiliere || !mFilterAnnee) return [];
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const colsMap = new Map();

    mDays.forEach(d => {
      const dateObj = new Date(mYear, mMonth, d);
      const weekday = dayNames[dateObj.getDay()];
      const dateStr = `${monthPrefix}-${pad(d)}`;
      
      const daySchedules = (schedules || []).filter(sc => 
         sc.filiere === mFilterFiliere && sc.annee === mFilterAnnee && sc.day === weekday
      ).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      
      daySchedules.forEach(sc => {
        const displayModule = getActiveScheduleModule(sc);
        const safeModule = (displayModule || 'global').replace(/[^a-zA-Z0-9]/g, '_');
        const key = `${dateStr}_${safeModule}`;
        if (!colsMap.has(key)) {
          colsMap.set(key, { d, dateStr, weekday, module: displayModule, time: sc.time, safeModule, isScheduled: true, key });
        }
      });
    });

    (studentAttendance || []).forEach(a => {
      if (a.date?.startsWith(monthPrefix)) {
        const student = mFilteredStudents.find(s => s.id === a.studentId);
        if (student) {
          const attendanceModule = a.moduleId || a.module || 'global';
          const safeModule = attendanceModule.replace(/[^a-zA-Z0-9]/g, '_');
          const key = `${a.date}_${safeModule}`;
          if (!colsMap.has(key)) {
            const dStr = a.date.split('-')[2];
            if (dStr) {
              const d = parseInt(dStr, 10);
              const dateObj = new Date(mYear, mMonth, d);
              const weekday = dayNames[dateObj.getDay()];
              colsMap.set(key, { d, dateStr: a.date, weekday, module: attendanceModule || 'Général', time: '—', safeModule, isScheduled: false, key });
            }
          }
        }
      }
    });

    return Array.from(colsMap.values()).sort((a, b) => {
      if (a.d !== b.d) return a.d - b.d;
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [mDays, mYear, mMonth, monthPrefix, schedules, mFilterFiliere, mFilterAnnee, studentAttendance, mFilteredStudents, getActiveScheduleModule]);

  const mGridData = useMemo(() => mFilteredStudents.map(student => {
    const byColumn = {};
    let totalPresent = 0;
    let totalAbsent = 0;

    monthColumns.forEach(col => {
      const docId = `${student.id}_${col.safeModule}_${col.dateStr}`;
      const record = studentAttendance.find(a => a.id === docId);
      
      if (record) {
         byColumn[col.key] = record.status;
         if (record.status === 'present') totalPresent++;
         else if (record.status === 'absent') totalAbsent++;
      } else {
         byColumn[col.key] = null;
      }
    });
    return { student, byColumn, counts: { present: totalPresent, absent: totalAbsent } };
  }), [mFilteredStudents, monthColumns, studentAttendance]);

  const mGlobalStats = useMemo(() => {
    const t = { present: 0, absent: 0 };
    mGridData.forEach(({ counts }) => { t.present += counts.present; t.absent += counts.absent; });
    return t;
  }, [mGridData]);

  const exportMonthlyCSV = () => {
    if (!mFilterFiliere || !mFilterAnnee) {
       return showToast("Veuillez sélectionner une filière et une année pour exporter.", "warning");
    }
    const dayHeaders = monthColumns.map(c => `${pad(c.d)}/${pad(mMonth + 1)} ${c.module} (${c.time})`).join(',');
    const header = `\uFEFFNom,Prénom,Matricule,${dayHeaders},Séances Présentes,Séances Absentes\n`;
    const rows = mGridData.map(({ student, byColumn, counts }) => {
      const cells = monthColumns.map(c => {
        const st = byColumn[c.key];
        return st ? st[0].toUpperCase() : '-';
      }).join(',');
      return `"${student.lastName}","${student.firstName}","${student.regNo || ''}",${cells},${counts.present},${counts.absent}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Presences_Stagiaires_${mFilterFiliere.replace(/[^a-zA-Z0-9]/g, '_')}_${MONTHS[mMonth]}_${mYear}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const prevMonth = () => { if (mMonth === 0) { setMMonth(11); setMYear(y => y - 1); } else setMMonth(m => m - 1); };
  const nextMonth = () => { if (mMonth === 11) { setMMonth(0); setMYear(y => y + 1); } else setMMonth(m => m + 1); };

  /* ── Alerts view state ── */
  const [alertThreshold, setAlertThreshold] = useState(10);

  const flaggedStudents = useMemo(() => {
    if (!studentAttendance || studentAttendance.length === 0 || activeStudents.length === 0) return [];
    const byStudent = {};
    studentAttendance.forEach(a => {
      if (!byStudent[a.studentId]) byStudent[a.studentId] = { total: 0, absences: 0 };
      byStudent[a.studentId].total++;
      if (a.status === 'absent') byStudent[a.studentId].absences++;
    });
    return activeStudents
      .filter(s => {
        const rec = byStudent[s.id];
        if (!rec || rec.total === 0) return false;
        return (rec.absences / rec.total) * 100 >= alertThreshold;
      })
      .map(s => {
        const rec = byStudent[s.id];
        return { ...s, absenceRate: Math.round((rec.absences / rec.total) * 100), absences: rec.absences, total: rec.total };
      })
      .sort((a, b) => b.absenceRate - a.absenceRate);
  }, [studentAttendance, activeStudents, alertThreshold]);

  return (
    <div className="max-w-container section-padding">
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '900', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <UserCheck size={28} style={{ color: 'var(--primary)' }} /> Absences Stagiaires
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Feuilles d'appel et suivi de l'assiduité.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-6)', width: 'fit-content' }}>
        {[
          { key: 'daily',   label: 'Appel Quotidien', icon: UserCheck },
          { key: 'monthly', label: 'Vue Mensuelle',    icon: CalendarRange },
          { key: 'alerts',  label: 'Alertes Absentéisme', icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setView(key)} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '8px 18px', borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '700', transition: 'all 0.2s',
            background: view === key ? 'white' : 'transparent',
            color: view === key ? (key === 'alerts' ? '#dc2626' : 'var(--primary)') : 'var(--text-muted)',
            boxShadow: view === key ? 'var(--shadow-xs)' : 'none',
          }}>
            <Icon size={15} /> {label}
            {key === 'alerts' && flaggedStudents.length > 0 && (
              <span style={{ fontSize: '10px', fontWeight: '900', color: 'white', background: '#dc2626', borderRadius: '999px', padding: '1px 7px', marginLeft: '2px' }}>
                {flaggedStudents.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════ DAILY VIEW ════ */}
      {view === 'daily' && (
        <>
          <div className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ ...filterGroupStyle, flex: '1 1 220px', maxWidth: '300px' }}>
                <label style={labelStyle}>Date de l'appel</label>
                <DatePicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  title="Date de l'appel"
                  placeholder="Choisir une date"
                />
              </div>
              <div style={{ ...filterGroupStyle, flex: '1 1 160px', maxWidth: '240px' }}>
                <label style={labelStyle}>Niveau</label>
                <FilterSelect
                  value={filterDiploma}
                  onChange={(val) => { setFilterDiploma(val); setFilterMajor(''); setFilterYear(''); setFilterModule(''); }}
                  options={[
                    { label: "Choisir niveau", value: "" },
                    ...Object.keys(FILIERES).map(d => ({ label: d, value: d }))
                  ]}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ ...filterGroupStyle, flex: '1 1 160px', maxWidth: '240px' }}>
                <label style={labelStyle}>Filière</label>
                <FilterSelect
                  value={filterMajor}
                  onChange={(val) => { setFilterMajor(val); setFilterModule(''); }}
                  options={[
                    { label: "Choisir filière", value: "" },
                    ...availableMajors.map(m => ({ label: m, value: m }))
                  ]}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ ...filterGroupStyle, flex: '1 1 100px', maxWidth: '150px' }}>
                <label style={labelStyle}>Année</label>
                <FilterSelect
                  value={filterYear}
                  onChange={(val) => { setFilterYear(val); setFilterModule(''); }}
                  options={[
                    { label: "Année", value: "" },
                    ...getStudyYearsForDiploma(filterDiploma).map(year => ({ label: year, value: year }))
                  ]}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ ...filterGroupStyle, flex: '1 1 160px', maxWidth: '240px' }}>
                <label style={labelStyle}>Module</label>
                <FilterSelect
                  value={filterModule}
                  onChange={(val) => setFilterModule(val)}
                  options={[
                    { label: "Module requis", value: "" },
                    ...availableModules.map(m => ({ label: m, value: m })),
                    ...(availableModules.length === 0 ? [{ label: "Général", value: "global" }] : [])
                  ]}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {filteredStudents.length > 0 && filterModule && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'center' }}>
              <MiniStat label="Effectif" value={stats.total} />
              <MiniStat label="Présents" value={stats.presents} />
              <MiniStat label="Absents" value={stats.absents} />
              <MiniStat label="Taux" value={stats.total > 0 ? `${Math.round((stats.presents / stats.total) * 100)}%` : '—'} />
              <button
                onClick={handleMarkAllPresent}
                disabled={bulkLoading}
                className="btn-modern primary"
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', fontSize: '13px', opacity: bulkLoading ? 0.7 : 1 }}
              >
                <CheckCheck size={15} />
                {bulkLoading ? 'Enregistrement...' : 'Tous Présents'}
              </button>
            </motion.div>
          )}

          {multiGroupProgress && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: 'var(--space-4)', padding: '14px 18px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-light)', background: 'var(--bg-subtle)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <Clock size={14} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)' }}>
                  {multiGroupProgress.teacherName}
                </span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', background: 'var(--primary-ultra-light)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                  {multiGroupProgress.time}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  — {multiGroupProgress.completedCount}/{multiGroupProgress.totalGroups} groupes complétés
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {multiGroupProgress.groups.map((g, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                    border: `1px solid ${g.done ? 'rgba(22,163,74,0.3)' : g.isCurrent ? 'var(--primary)' : 'var(--border-light)'}`,
                    background: g.done ? 'rgba(22,163,74,0.08)' : g.isCurrent ? 'var(--primary-ultra-light)' : 'white',
                  }}>
                    {g.done
                      ? <CheckCircle2 size={12} style={{ color: '#16a34a', flexShrink: 0 }} />
                      : <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${g.isCurrent ? 'var(--primary)' : 'var(--border-light)'}`, flexShrink: 0 }} />
                    }
                    <span style={{ fontSize: '11px', fontWeight: '700', color: g.done ? '#15803d' : g.isCurrent ? 'var(--primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {g.label}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: g.done ? '#15803d' : 'var(--text-faint)' }}>
                      {g.marked}/{g.total}
                    </span>
                  </div>
                ))}
              </div>
              {multiGroupProgress.completedCount === multiGroupProgress.totalGroups && (
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#15803d', background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.25)', padding: '3px 10px', borderRadius: 'var(--radius-pill)', marginLeft: 'auto' }}>
                  ✓ Présence formateur enregistrée
                </span>
              )}
            </motion.div>
          )}

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            {loading ? <TableSkeleton rows={10} /> : (
              !filterDiploma || !filterMajor || !filterYear ? (
                <EmptyState title="Filtres requis" message="Sélectionnez le niveau, la filière et l'année pour voir les stagiaires." icon="filter" />
              ) : !filterModule ? (
                <EmptyState title="Module manquant" message="Veuillez sélectionner un module pour lancer l'appel." icon="mouse-pointer" />
              ) : filteredStudents.length === 0 ? (
                <EmptyState title="Aucun cours aujourd'hui" message={`Aucun cours n'est programmé le ${dayOfWeek} pour ce groupe.`} icon="calendar" />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '750px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)' }}>
                        <th style={{ ...thStyle, textAlign: 'center', width: '60px' }}>#</th>
                        <th style={thStyle}>Stagiaire</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '260px' }}>Pointage</th>
                        <th style={thStyle}>Commentaire / Motif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student, idx) => {
                        const docId = `${student.id}_${(filterModule).replace(/[^a-zA-Z0-9]/g, '_')}_${selectedDate}`;
                        const record = studentAttendance.find(a => a.id === docId);
                        const status = record?.status || '';
                        const comment = record?.comment || '';
                        return (
                          <tr key={student.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-faint)' }}>{idx + 1}</span>
                            </td>
                            <td style={tdStyle}>
                              <p style={{ fontSize: 'var(--text-sm)', fontWeight: '700', color: 'var(--text-primary)' }}>{student.lastName} {student.firstName}</p>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Matricule: {student.regNo}</p>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xl)', padding: '4px', alignItems: 'center' }}>
                                <StatusBtn active={status === 'present'} color="var(--success)" onClick={() => handleStatusChange(student.id, 'present')}>Présent</StatusBtn>
                                <StatusBtn active={status === 'absent'} color="var(--danger)" onClick={() => handleStatusChange(student.id, 'absent')}>Absent</StatusBtn>
                                {status && <button onClick={() => handleClearStatus(student.id)} style={{ marginLeft: '2px', padding: '4px 6px', border: 'none', borderRadius: 'var(--radius-md)', background: 'transparent', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', alignItems: 'center' }} title="Effacer"><X size={13} /></button>}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <input type="text" className="input-premium" placeholder="Note d'absence..."
                                style={{ width: '100%', fontSize: '12px', background: 'transparent', border: '1px solid transparent' }}
                                value={comment} onChange={(e) => handleCommentChange(student.id, e.target.value)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* ════ MONTHLY VIEW ════ */}
      {view === 'monthly' && (
        <>
          {/* Monthly filters */}
          <div className="glass-card" style={{ padding: '20px', marginBottom: 'var(--space-5)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'end' }}>
              <div style={{ flex: '1.2', minWidth: '160px' }}>
                <label style={labelStyle}>Mois</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FilterSelect
                    value={mMonth}
                    onChange={(val) => setMMonth(Number(val))}
                    options={MONTHS.map((m, i) => ({ label: m, value: i }))}
                    style={{ width: '100%', textAlign: 'center', fontWeight: '700' }}
                  />
                </div>
              </div>
              <div style={{ flex: '0.8', minWidth: '110px' }}>
                <label style={labelStyle}>Année</label>
                <FilterSelect
                  value={mYear}
                  onChange={(val) => setMYear(Number(val))}
                  options={availableYears.map(y => ({ label: String(y), value: y }))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: '1.2', minWidth: '160px' }}>
                <label style={labelStyle}>Filière</label>
                <FilterSelect
                  value={mFilterFiliere}
                  onChange={(val) => setMFilterFiliere(val)}
                  options={[
                    { label: "Toutes les filières", value: "" },
                    ...allFilieres.map(f => ({ label: f, value: f }))
                  ]}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: '0.8', minWidth: '110px' }}>
                <label style={labelStyle}>Année d'étude</label>
                <FilterSelect
                  value={mFilterAnnee}
                  onChange={(val) => setMFilterAnnee(val)}
                  options={[
                    { label: "Toutes années", value: "" },
                    ...getStudyYearsForMajor(mFilterFiliere).map(year => ({ label: year, value: year }))
                  ]}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: '1.5', minWidth: '200px' }}>
                <label style={labelStyle}>Rechercher</label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                  <input type="text" className="input-premium" style={{ width: '100%', paddingLeft: '34px' }} placeholder="Nom du stagiaire..." value={mSearch} onChange={e => setMSearch(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Monthly stats */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: '12px', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
            {[
              { label: 'Stagiaires', value: mFilteredStudents.length, color: 'var(--primary)', bg: 'var(--primary-ultra-light)' },
              { label: 'Séances Présentes', value: mGlobalStats.present, color: '#15803d', bg: 'rgba(22,163,74,0.08)' },
              { label: 'Séances Absentes', value: mGlobalStats.absent, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ padding: '12px 18px', background: bg, border: `1px solid ${color}22`, borderRadius: 'var(--radius-xl)', flex: '1 1 120px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: '900', color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '4px' }}>{label}</div>
              </div>
            ))}
          </motion.div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {[
              { label: 'Présent', code: 'P', color: '#15803d', bg: 'rgba(22,163,74,0.10)',  border: 'rgba(22,163,74,0.25)' },
              { label: 'Absent',  code: 'A', color: '#dc2626', bg: 'rgba(220,38,38,0.10)',   border: 'rgba(220,38,38,0.25)' },
              { label: 'Non renseigné', code: '·', color: 'var(--text-faint)', bg: 'transparent', border: 'transparent' },
            ].map(l => (
              <div key={l.code} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '900', color: l.color, background: l.bg, border: `1px solid ${l.border}` }}>{l.code}</div>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Monthly grid */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {!mFilterFiliere || !mFilterAnnee ? (
              <div style={{ padding: '64px', textAlign: 'center' }}>
                <Filter size={40} style={{ color: 'var(--text-faint)', margin: '0 auto 16px', display: 'block' }} />
                <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)' }}>
                  Veuillez sélectionner une Filière et une Année d'étude pour afficher la grille de pointage.
                </p>
              </div>
            ) : mFilteredStudents.length === 0 ? (
              <div style={{ padding: '64px', textAlign: 'center' }}>
                <Users size={40} style={{ color: 'var(--text-faint)', margin: '0 auto 16px', display: 'block' }} />
                <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)' }}>
                  Aucun stagiaire trouvé pour cette filière.
                </p>
              </div>
            ) : monthColumns.length === 0 ? (
              <div style={{ padding: '64px', textAlign: 'center' }}>
                <CalendarRange size={40} style={{ color: 'var(--text-faint)', margin: '0 auto 16px', display: 'block' }} />
                <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)' }}>
                  Aucune séance programmée ou pointée pour ce mois.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '44px' }} />
                    <col style={{ width: '180px' }} />
                    {monthColumns.map(col => <col key={col.key} style={{ width: '48px' }} />)}
                    <col style={{ width: '38px' }} /><col style={{ width: '38px' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)' }}>
                      <th rowSpan={2} style={mThStyle}>#</th>
                      <th rowSpan={2} style={{ ...mThStyle, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-subtle)', zIndex: 10 }}>Stagiaire</th>
                      {monthColumns.map(col => {
                        const isWeekend = col.weekday === 'Samedi' || col.weekday === 'Dimanche';
                        return (
                          <th key={col.key} style={{ ...mThStyle, padding: '8px 4px', color: isWeekend ? 'var(--primary)' : 'var(--text-primary)', background: isWeekend ? 'rgba(176,104,185,0.05)' : 'var(--bg-subtle)', borderBottom: 'none', borderRight: '1px solid var(--border-light)' }}>
                             <div style={{ fontSize: '11px', fontWeight: '900' }}>{pad(col.d)}</div>
                             <div style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text-faint)', marginTop: '2px' }}>{col.weekday.slice(0,3)}</div>
                          </th>
                        );
                      })}
                      <th rowSpan={2} style={{ ...mThStyle, color: '#15803d', background: 'rgba(22,163,74,0.06)' }}>P</th>
                      <th rowSpan={2} style={{ ...mThStyle, color: '#dc2626', background: 'rgba(220,38,38,0.06)' }}>A</th>
                    </tr>
                    <tr style={{ background: 'var(--bg-subtle)' }}>
                      {monthColumns.map(col => {
                         return (
                           <th key={`mod_${col.key}`} style={{ ...mThStyle, padding: '4px', borderRight: '1px solid var(--border-light)', verticalAlign: 'top' }}>
                             <div style={{ fontSize: '9px', color: 'var(--text-muted)', maxWidth: '40px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 auto' }} title={col.module}>
                               {col.module}
                             </div>
                             <div style={{ fontSize: '8px', color: 'var(--text-faint)', marginTop: '2px' }}>
                               {col.time}
                             </div>
                           </th>
                         );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {mGridData.map(({ student, byColumn, counts }, idx) => (
                      <tr key={student.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ ...mTdStyle, textAlign: 'center' }}><span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-faint)' }}>{idx + 1}</span></td>
                        <td style={{ ...mTdStyle, position: 'sticky', left: 0, zIndex: 5, background: idx % 2 === 0 ? 'white' : 'rgba(248,249,251,0.8)', borderRight: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '164px' }}>{student.lastName} {student.firstName}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-faint)', fontWeight: '600', marginTop: '2px' }}>{student.regNo || '—'}</div>
                        </td>
                        {monthColumns.map(col => {
                          const isWeekend = col.weekday === 'Samedi' || col.weekday === 'Dimanche';
                          return (
                            <td key={col.key} style={{ ...mTdStyle, padding: '6px 4px', textAlign: 'center', borderRight: '1px solid var(--border-light)', background: isWeekend ? 'rgba(176,104,185,0.03)' : (idx % 2 === 0 ? 'white' : 'rgba(248,249,251,0.5)') }}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}><StatusCell status={byColumn[col.key]} /></div>
                            </td>
                          );
                        })}
                        <td style={{ ...mTdStyle, textAlign: 'center', padding: '6px 4px', background: 'rgba(22,163,74,0.06)' }}><span style={{ fontSize: '12px', fontWeight: '900', color: '#15803d' }}>{counts.present}</span></td>
                        <td style={{ ...mTdStyle, textAlign: 'center', padding: '6px 4px', background: 'rgba(220,38,38,0.06)' }}><span style={{ fontSize: '12px', fontWeight: '900', color: '#dc2626' }}>{counts.absent}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-faint)' }}>{MONTHS[mMonth]} {mYear} · {monthColumns.length} séances</span>
          </div>
        </>
      )}

      {/* ════ ALERTS VIEW ════ */}
      {view === 'alerts' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-lg)', background: 'rgba(220,38,38,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={20} style={{ color: '#dc2626' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>Alertes Absentéisme</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: '600' }}>
                  Stagiaires dont le taux d'absence dépasse le seuil défini
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Seuil d'alerte :</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range" min="5" max="50" step="5"
                  value={alertThreshold}
                  onChange={e => setAlertThreshold(Number(e.target.value))}
                  style={{ width: '100px', accentColor: '#dc2626', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px', fontWeight: '900', color: '#dc2626', minWidth: '38px' }}>{alertThreshold}%</span>
              </div>
            </div>
          </div>

          {flaggedStudents.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 'var(--radius-xl)' }}>
              <CheckCircle2 size={18} style={{ color: '#15803d', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#15803d' }}>
                {studentAttendance.length === 0 ? 'Aucune donnée de présence disponible.' : `Aucun stagiaire ne dépasse le seuil de ${alertThreshold}%.`}
              </span>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: '900', color: '#dc2626', background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--radius-pill)', padding: '3px 12px' }}>
                  {flaggedStudents.length} stagiaire{flaggedStudents.length > 1 ? 's' : ''} en alerte
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {flaggedStudents.map(s => {
                  const rate = s.absenceRate;
                  const severity = rate >= 30 ? '#b91c1c' : rate >= 20 ? '#dc2626' : '#ef4444';
                  const bg = rate >= 30 ? 'rgba(185,28,28,0.07)' : 'rgba(220,38,38,0.05)';
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: bg, border: `1px solid ${severity}22`, borderRadius: 'var(--radius-lg)' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${severity}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: '900', color: severity }}>{(s.lastName || '?')[0]}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.lastName} {s.firstName}
                        </p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '2px' }}>
                          {s.major} · {s.year}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: severity, lineHeight: 1 }}>{rate}%</div>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-faint)', marginTop: '3px' }}>{s.absences} abs. / {s.total} séances</div>
                      </div>
                      <div style={{ width: '70px', height: '6px', background: 'var(--border-light)', borderRadius: '3px', flexShrink: 0, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(rate, 100)}%`, background: severity, borderRadius: '3px', transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

const StatusBtn = ({ active, color, children, onClick }) => (
  <button onClick={onClick} style={{ padding: '6px 14px', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: '11px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s', background: active ? color : 'transparent', color: active ? 'white' : 'var(--text-muted)' }}>
    {children}
  </button>
);

const MiniStat = ({ label, value }) => (
  <div style={{ padding: '12px 20px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xl)', minWidth: '100px', textAlign: 'center' }}>
    <p style={{ fontSize: 'var(--text-xl)', fontWeight: '900', lineHeight: 1 }}>{value}</p>
    <p style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>{label}</p>
  </div>
);

const mThStyle = { padding: '12px 4px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-light)' };
const mTdStyle = { padding: '10px 8px', verticalAlign: 'middle' };

export default StudentAttendance;
