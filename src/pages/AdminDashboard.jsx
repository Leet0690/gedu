import './DashboardStats.css';
import './DirectoryColors.css';
import { useAdminAuth } from '../context/AdminAuthContext';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  flexRender, getCoreRowModel, useReactTable, getFilteredRowModel, getPaginationRowModel,
} from '@tanstack/react-table';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { generateBulletinGlobal } from '../utils/pdfGenerator';
import { parseScore } from '../utils/gradeCalculations';
import { getGradeByModuleName, getGradesForAcademicYear, getStudentGradeModules } from '../utils/gradeSync';
import {
  ALL_STUDY_YEARS,
  FILIERES,
  getClassCode,
  getModulesForStudent,
  getModulesForFiliere,
  getStudyYearsForDiploma,
  getStudyYearsForDiplomas,
  getStudyYearsForMajor,
  isKnownStudyYear,
  getDiplomaForMajor
} from '../data/modules';
import { FilterSelect } from '../components/ui/FilterSelect';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import ClosureDecisions from '../components/ClosureDecisions';
import ClosureDecisionEditor from '../components/ClosureDecisionEditor';
import { getClosureOutcome, getClosureDecisionOptions } from '../utils/academicYearClosure';
import { getPortalBaseUrl } from '../config/institution';
import {
  STUDENT_STATUS,
  getAcademicYearTransition,
  getCalendarYearForAcademicMonth,
  getStudentStatusLabel,
  isActiveStudent,
  validateAcademicYearTransition,
  getStudentPreviousYearBalance,
  getStudentStudyCycleRange,
  getStudentAcademicSnapshot,
  getStudentCurrentAcademicYear,
  isStudentCurrentlyInAcademicYear,
  INITIAL_OPERATIONAL_ACADEMIC_YEAR,
  filterSchedulesForAcademicYear
} from '../utils/studentStatus';
import { calculateStudentAttendanceRate, isFinalAttendanceStatus } from '../utils/attendanceKeys';
import { 
  Plus, 
  Search, 
  CalendarPlus, 
  Clock, 
  Users as UsersIcon, 
  Download, 
  Filter, 
  X,
  FileText,
  UserPlus,
  RotateCw,
  Lock,
  LineChart,
  GraduationCap,
  Eye,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Share2,
  Fingerprint,
  Book,
  Calendar,
  Link as LinkIcon,
  Copy,
  Info,
  UserCheck,
  User,
  Activity,
  Bell,
  BookOpen,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  ChevronsLeft,
  ChevronsRight,
  Undo2,
  Presentation,
  CalendarCheck,
  BarChart3,
  School,
  ArrowUpRight
} from 'lucide-react';

const labelStyle = { fontSize: 'var(--text-xs)', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '2px' };
const selectStyle = { cursor: 'pointer', paddingRight: '36px' };

const getGroupAbbreviation = (filiere, annee) => getClassCode('', filiere, annee);

const DASH_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const getTodayFrench = () => {
  const jsDay = new Date().getDay();
  return DASH_DAYS[jsDay === 0 ? 6 : jsDay - 1];
};

const ACTIVITY_TIME_ZONE = 'UTC';
const ACTIVITY_TIME_ZONE_LABEL = 'GMT';

const getDateFromTimestamp = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) {
    return Number.isNaN(timestamp.getTime()) ? null : timestamp;
  }
  if (typeof timestamp === 'number') {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof timestamp.toDate === 'function') {
    const date = timestamp.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof timestamp.seconds === 'number') {
    const date = new Date(timestamp.seconds * 1000 + Math.floor((timestamp.nanoseconds || 0) / 1000000));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const formatActivityClock = (timestamp) => {
  const date = getDateFromTimestamp(timestamp);
  if (!date) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const isOlderThanOneDay = diffMs > 24 * 60 * 60 * 1000;
  const timePart = new Intl.DateTimeFormat('fr-FR', {
    timeZone: ACTIVITY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  if (isOlderThanOneDay) {
    const datePart = new Intl.DateTimeFormat('fr-FR', {
      timeZone: ACTIVITY_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
    }).format(date);
    return `${datePart} ${timePart}`;
  }
  return timePart;
};

const formatActivityDateTime = (timestamp) => {
  const date = getDateFromTimestamp(timestamp);
  if (!date) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: ACTIVITY_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const formatRelativeTime = (timestamp) => {
  const date = getDateFromTimestamp(timestamp);
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
};

const getActivityIcon = (message) => {
  const lower = String(message || '').toLowerCase();
  if (lower.includes('formation continue')) return { icon: GraduationCap, color: 'var(--primary)', bg: 'rgba(var(--primary-rgb), 0.08)' };
  if (message.includes('stagiaire') && message.includes('ajouté')) return { icon: UserPlus, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' };
  if (message.includes('formateur') && message.includes('ajouté')) return { icon: UserPlus, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' };
  if (message.includes('supprimé') || message.includes('supprimée')) return { icon: Trash2, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' };
  if (message.includes('mis à jour') || message.includes('mise à jour')) return { icon: Edit3, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  if (message.includes('Notes') || message.includes('notes')) return { icon: FileText, color: 'var(--primary)', bg: 'var(--primary-ultra-light)' };
  if (message.includes('Séance') || message.includes('séance')) return { icon: Calendar, color: 'var(--primary)', bg: 'rgba(var(--primary-rgb), 0.08)' };
  if (message.includes('Présence') || message.includes('présence') || message.includes('Absence')) return { icon: UserCheck, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' };
  if (message.includes('Salaire') || message.includes('salaire') || message.includes('Paiement') || message.includes('Charge')) return { icon: LineChart, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' };
  return { icon: Activity, color: 'var(--text-muted)', bg: 'var(--bg-subtle)' };
};

const getActivityVisual = (message = '') => {
  const lower = message.toLowerCase();
  const fallbackIcon = getActivityIcon(message)?.icon || Activity;
  if (lower.includes('formation continue')) return { icon: GraduationCap, tone: 'violet' };
  if (lower.includes('stagiaire') && lower.includes('ajout')) return { icon: UserPlus, tone: 'success' };
  if (lower.includes('formateur') && lower.includes('ajout')) return { icon: UserPlus, tone: 'info' };
  if (lower.includes('supprim')) return { icon: Trash2, tone: 'danger' };
  if (lower.includes('mis ') || lower.includes('mise ')) return { icon: Edit3, tone: 'warning' };
  if (lower.includes('note')) return { icon: FileText, tone: 'primary' };
  if (lower.includes('séance') || lower.includes('seance')) return { icon: Calendar, tone: 'violet' };
  if (lower.includes('présence') || lower.includes('presence') || lower.includes('absence')) return { icon: UserCheck, tone: 'info' };
  if (lower.includes('salaire') || lower.includes('paiement') || lower.includes('charge')) return { icon: LineChart, tone: 'success' };
  return { icon: fallbackIcon, tone: 'muted' };
};

const TodaySessionsWidget = ({ schedules, teachers, getScheduleModule, activeSemester, setActiveSemester }) => {
  const today = getTodayFrench();
  const todaySessions = useMemo(() => {
    const filtered = schedules
      .filter(s => s.day === today)
      .map(s => {
        const parts = (s.time || '').split('-');
        return { 
          ...s, 
          displayModule: getScheduleModule(s),
          start: formatTimeDash((parts[0] || '').trim()), 
          end: formatTimeDash((parts[1] || '').trim()) 
        };
      })
      .filter(s => s.displayModule);

    const groups = {};
    filtered.forEach(s => {
      const normalizedModule = (s.displayModule || s.module || '').trim().toLowerCase();
      const normalizedTime = (s.time || '').replace(/\s+/g, '');
      const normalizedTeacher = (s.teacherId || '').trim();
      const key = `${normalizedTeacher}_${s.start}_${s.end}_${normalizedModule}`;
      const abbr = getGroupAbbreviation(s.filiere, s.annee || '');
      if (!groups[key]) {
        groups[key] = { ...s, groupCodes: abbr ? [abbr] : [] };
      } else {
        if (abbr && !groups[key].groupCodes.includes(abbr)) {
          groups[key].groupCodes.push(abbr);
        }
      }
    });

    return Object.values(groups).sort((a, b) => a.start.localeCompare(b.start));
  }, [schedules, today, getScheduleModule]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14 }}
      className="glass-card home-widget home-widget-tall home-widget-sessions"
    >
      <div className="home-widget-header">
        <div className="home-widget-heading">
          <div className="home-widget-icon home-tone-primary">
            <BookOpen size={14} />
          </div>
          <div>
            <span className="home-widget-title">
              Séances d'aujourd'hui
            </span>
            <p className="home-widget-subtitle">{today}</p>
          </div>
        </div>
        <div className="home-widget-actions">
          <span className="home-widget-pill home-tone-primary">
            {todaySessions.length} séance{todaySessions.length !== 1 ? 's' : ''}
          </span>
          <button 
            onClick={() => {
              localStorage.removeItem('ipfp_v2_core_cache');
              window.location.reload();
            }} 
            className="home-icon-button"
            title="Rafraîchir les données (Vider le cache)"
          >
            <RotateCw size={12} />
          </button>
        </div>
      </div>

      {todaySessions.length === 0 ? (
        <div className="home-widget-empty">
          <Calendar size={28} className="home-widget-empty-icon" />
          <p>Aucune séance prévue aujourd'hui</p>
        </div>
      ) : (
        <div className="home-widget-list home-session-list">
          {todaySessions.map((session) => {
            const isTP = session.type === 'TP';
            const teacher = teachers.find(t => t.id === session.teacherId);
            return (
              <div
                key={session.id}
                className={`home-session-item ${isTP ? 'home-session-item-tp' : 'home-session-item-course'}`}
              >
                <div className="home-session-time">
                  <span className="home-session-time-start">
                    {session.start}
                  </span>
                  <div className="home-session-time-divider" />
                  <span className="home-session-time-end">
                    {session.end}
                  </span>
                </div>
                <div className="home-session-content">
                  <p className="home-session-module">
                    {session.displayModule || 'Module non défini'}
                  </p>
                  <div className="home-session-meta">
                    {teacher && (
                      <span className="home-session-teacher">
                        {teacher.name}
                      </span>
                    )}
                    {(session.groupCodes || []).map(abbr => (
                      <span key={abbr} className="home-session-group">
                        {abbr}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="home-session-type">
                  {session.type || 'Cours'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

const MOJIBAKE_MAP = [
  ['Ã©', 'é'], ['Ã¨', 'è'], ['Ã ', 'à'], ['Ã§', 'ç'], ['Ãª', 'ê'],
  ['Ã®', 'î'], ['Ã´', 'ô'], ['Ã¹', 'ù'], ['Ã¢', 'â'], ['Ã«', 'ë'],
  ['Ã¯', 'ï'], ['Ã¼', 'ü'], ['Ã»', 'û'], ['Â·', '·'], ['Å"', 'œ'],
];
const fixMojibake = (text) => {
  if (!text || typeof text !== 'string') return text || '';
  let fixed = text;
  for (const [bad, good] of MOJIBAKE_MAP) {
    fixed = fixed.replaceAll(bad, good);
  }
  return fixed;
};

const isProfileMaintenance = (message) => {
  const m = fixMojibake(message);
  if (m.includes('Profil utilisateur mis à jour')) return true;
  if (m.startsWith('UPDATE : users/')) return true;
  return false;
};

const ActivityFeedWidget = ({ notifications }) => {
  const { activityError } = useApp();
  const [visibleCount, setVisibleCount] = useState(10);
  const [userFilter, setUserFilter] = useState('ALL');

  const uniqueUsers = useMemo(() => {
    const map = new Map();
    (notifications || []).forEach(n => {
      if (n.userRole === 'maintenance') return;
      const name = n.userName || (n.userId ? `Utilisateur (${n.userId.slice(0, 5)})` : null);
      if (name && !map.has(n.userId || name)) {
        map.set(n.userId || name, { id: n.userId || name, name, role: n.userRole });
      }
    });
    return Array.from(map.values());
  }, [notifications]);

  const recent = useMemo(() => {
    return (notifications || [])
      .filter(n => {
        if (n.userRole === 'maintenance') return false;
        const msg = fixMojibake(n.message || '');
        if (msg.includes('Accès Direction autorisé')) return false;
        if (isProfileMaintenance(n.message)) return false;
        return true;
      })
      .filter(n => {
        if (userFilter === 'ALL') return true;
        return (n.userId || n.userName) === userFilter;
      });
  }, [notifications, userFilter]);

  const visibleActivities = useMemo(() => recent.slice(0, visibleCount), [recent, visibleCount]);
  const hasMoreActivities = visibleCount < recent.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
      className="glass-card home-widget home-widget-tall home-widget-activity"
    >
      <div className="home-widget-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div className="home-widget-heading">
          <div className="home-widget-icon home-tone-indigo">
            <Activity size={14} />
          </div>
          <div>
            <span className="home-widget-title">
              Activité récente
            </span>
            <p className="home-widget-subtitle">{activityError || '100 dernières activités accessibles'}</p>
          </div>
        </div>

        {uniqueUsers.length > 0 && (
          <div className="home-widget-filter">
            <select
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); setVisibleCount(10); }}
              className="input-premium"
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                maxWidth: '160px'
              }}
              title="Filtrer les activités par utilisateur"
            >
              <option value="ALL">Tous les membres ({notifications.length})</option>
              {uniqueUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.role ? `(${u.role})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="home-widget-empty">
          <Bell size={28} className="home-widget-empty-icon" />
          <p>Aucune activité récente</p>
        </div>
      ) : (
        <div className="home-widget-list home-activity-list">
          {visibleActivities.map((notif) => {
            const cleanMessage = fixMojibake(notif.message);
            const { icon: Icon, tone } = getActivityVisual(cleanMessage);
            const activityClock = formatActivityClock(notif.timestamp);
            const activityDateTime = formatActivityDateTime(notif.timestamp);
            return (
              <div
                key={notif.id}
                className={`home-activity-item ${notif.read ? '' : 'home-activity-item-unread'}`}
              >
                <div className={`home-activity-icon home-tone-${tone}`}>
                  <Icon size={13} />
                </div>
                <div className="home-activity-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      color: 'var(--primary)',
                      background: 'rgba(59, 130, 246, 0.1)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      letterSpacing: '0.02em'
                    }}>
                      {notif.userName || 'Auteur non renseigné'}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                      {notif.source === 'server' ? 'Événement serveur' : 'Événement application'}
                    </span>
                    {notif.userRole && (
                      <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
                        • {notif.userRole}
                      </span>
                    )}
                  </div>
                  <p className="home-activity-message">
                    {cleanMessage}
                  </p>
                </div>
                <span className="home-activity-time" title={activityDateTime ? `${activityDateTime} ${ACTIVITY_TIME_ZONE_LABEL}` : undefined}>
                  {activityClock ? `${activityClock} ${ACTIVITY_TIME_ZONE_LABEL}` : formatRelativeTime(notif.timestamp)}
                </span>
              </div>
            );
          })}
          {hasMoreActivities && (
            <button
              onClick={() => setVisibleCount((count) => count + 10)}
              className="home-load-more-button"
            >
              Charger plus
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};

const SEVERITY_CONFIG = {
  urgent: { color: '#dc2626', bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.18)', icon: AlertCircle },
  warning: { color: '#d97706', bg: 'rgba(217,119,6,0.07)', border: 'rgba(217,119,6,0.2)', icon: AlertTriangle },
  info: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.07)', border: 'rgba(14,165,233,0.18)', icon: Info },
};

const PendingTasksWidget = ({ students, teachers, grades, teacherAttendance, allModules, activeSemester, operationalAcademicYear }) => {
  const tasks = useMemo(() => {
    const items = [];
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const groupMap = {};
    (students || []).forEach(s => {
      if (!s.diploma || !s.major || !s.year) return;
      const key = `${s.diploma}||${s.major}||${s.year}`;
      if (!groupMap[key]) groupMap[key] = { diploma: s.diploma, major: s.major, year: s.year, students: [] };
      groupMap[key].students.push(s);
    });

    Object.values(groupMap).forEach(({ diploma, major, year, students: gs }) => {
      const label = getGroupAbbreviation(major, year);
      const currentYear = operationalAcademicYear || '2025-2026';
      const yearScoped = (allModules || []).filter(m => !m.academicYear || m.academicYear === currentYear);
      const candidates = yearScoped.length > 0 ? yearScoped : (allModules || []);
      const configuredModules = Array.from(new Set(candidates
        .filter(m => m.diploma === diploma && m.major === major && m.year === year && [activeSemester, 'Annuel'].includes(m.semester || 'S1'))
        .map(m => m.name)
        .filter(Boolean)));
      const mods = configuredModules.length > 0 ? configuredModules : getModulesForFiliere(diploma, major, year);
      if (mods.length === 0) return;
      let entered = 0;
      const total = gs.length * mods.length;
      gs.forEach(s => {
        const studentGrades = getGradesForAcademicYear(
          grades[s.id] || {},
          getStudentCurrentAcademicYear(s, operationalAcademicYear)
        );
        mods.forEach(m => {
          const g = getGradeByModuleName(studentGrades, m);
          if (['c1', 'c2', 'c3', 'efcfp', 'efcft'].some(field => parseScore(g?.[field]) !== null)) entered++;
        });
      });
      const pct = total > 0 ? Math.round((entered / total) * 100) : 0;
      if (pct === 0) {
        items.push({ severity: 'urgent', type: 'grades', typeLabel: 'Notes', text: `Aucune note saisie — groupe ${label}`, sub: `${gs.length} stagiaire${gs.length > 1 ? 's' : ''} concerné${gs.length > 1 ? 's' : ''}`, link: '/admin/grades' });
      } else if (pct < 50) {
        items.push({ severity: 'warning', type: 'grades', typeLabel: 'Notes', text: `Notes incomplètes — groupe ${label}`, sub: `Seulement ${pct}% des notes saisies`, link: '/admin/grades' });
      }
    });

    const teachersWithAttendance = new Set(
      (teacherAttendance || []).filter(a => a.date?.startsWith(currentMonth)).map(a => a.teacherId)
    );
    const missingTeachers = (teachers || []).filter(t => !teachersWithAttendance.has(t.id));
    if (missingTeachers.length > 0) {
      const names = missingTeachers.slice(0, 2).map(t => t.name || 'Formateur').join(', ');
      items.push({
        severity: 'warning',
        type: 'attendance',
        typeLabel: 'Présences',
        text: `${missingTeachers.length} formateur${missingTeachers.length > 1 ? 's' : ''} sans présence ce mois`,
        sub: names + (missingTeachers.length > 2 ? ` +${missingTeachers.length - 2} autre${missingTeachers.length - 2 > 1 ? 's' : ''}` : ''),
        link: '/admin/monthly-attendance-teachers',
      });
    }

    const incompleteStudents = (students || []).filter(s => !s.diploma || !s.major || !s.year);
    if (incompleteStudents.length > 0) {
      items.push({ severity: 'info', type: 'profile', typeLabel: 'Profils', text: `${incompleteStudents.length} profil${incompleteStudents.length > 1 ? 's' : ''} stagiaire incomplet${incompleteStudents.length > 1 ? 's' : ''}`, sub: 'Niveau, filière ou année manquant', link: '/admin/students' });
    }

    return items;
  }, [students, teachers, grades, teacherAttendance, allModules, activeSemester, operationalAcademicYear]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="glass-card home-widget home-widget-tall home-widget-tasks">
      <div className="home-widget-header">
        <div className="home-widget-heading">
          <div className="home-widget-icon home-tone-danger">
            <CheckCircle size={14} />
          </div>
          <div>
            <span className="home-widget-title">
              À faire
            </span>
            <p className="home-widget-subtitle">Tâches en attente</p>
          </div>
        </div>
        <span className={`home-widget-pill ${tasks.length > 0 ? 'home-tone-danger' : 'home-tone-success'}`}>
          {tasks.length > 0 ? `${tasks.length} tâche${tasks.length > 1 ? 's' : ''}` : 'Tout est à jour'}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="home-widget-empty home-widget-empty-success">
          <CheckCircle size={32} />
          <p>Tout est à jour !</p>
          <span>Aucune action requise pour le moment</span>
        </div>
      ) : (
        <div className="home-widget-list home-task-list">
          {tasks.map((task, i) => {
            const { icon: Icon } = SEVERITY_CONFIG[task.severity];
            return (
              <Link key={i} to={task.link} className="home-task-link">
                <motion.div whileHover={{ x: 3 }} className={`home-task-card home-task-${task.type}`}>
                  <div className="home-task-icon">
                    <Icon size={14} />
                  </div>
                  <div className="home-task-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <p className="home-task-title" style={{ margin: 0 }}>{task.text}</p>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: '850',
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.6)',
                        border: '1px solid currentColor',
                        color: 'var(--task-color)',
                        display: 'inline-block',
                        lineHeight: 1.2
                      }}>
                        {task.typeLabel}
                      </span>
                    </div>
                    <p className="home-task-subtitle">{task.sub}</p>
                  </div>
                  <ArrowRight size={12} className="home-task-arrow" />
                </motion.div>
              </Link>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

const GradesBreakdownWidget = ({ students, grades, allModules, activeSemester, operationalAcademicYear }) => {
  const groups = useMemo(() => {
    const map = {};
    (students || []).forEach(s => {
      if (!s.diploma || !s.major || !s.year) return;
      const key = `${s.diploma}||${s.major}||${s.year}`;
      if (!map[key]) map[key] = { diploma: s.diploma, major: s.major, year: s.year, count: 0, total: 0, entered: 0 };
      const g = map[key];
      g.count++;
      const currentYear = operationalAcademicYear || '2025-2026';
      const yearScoped = (allModules || []).filter(m => !m.academicYear || m.academicYear === currentYear);
      const candidates = yearScoped.length > 0 ? yearScoped : (allModules || []);
      const configuredModules = Array.from(new Set(candidates
        .filter(m => m.diploma === s.diploma && m.major === s.major && m.year === s.year && [activeSemester, 'Annuel'].includes(m.semester || 'S1'))
        .map(m => m.name)
        .filter(Boolean)));
      const mods = configuredModules.length > 0 ? configuredModules : getModulesForStudent(s);
      g.total += mods.length;
      const studentGrades = getGradesForAcademicYear(
        grades[s.id] || {},
        getStudentCurrentAcademicYear(s, operationalAcademicYear)
      );
      mods.forEach(m => {
        const gr = getGradeByModuleName(studentGrades, m);
        if (['c1', 'c2', 'c3', 'efcfp', 'efcft'].some(field => parseScore(gr?.[field]) !== null)) g.entered++;
      });
    });
    return Object.values(map).map(g => ({
      ...g,
      label: getGroupAbbreviation(g.major, g.year),
      pct: g.total > 0 ? Math.round((g.entered / g.total) * 100) : 0,
    })).sort((a, b) => a.pct - b.pct);
  }, [students, grades, allModules, activeSemester, operationalAcademicYear]);

  const overall = useMemo(() => {
    if (groups.length === 0) return 0;
    const t = groups.reduce((s, g) => s + g.total, 0);
    const e = groups.reduce((s, g) => s + g.entered, 0);
    return t > 0 ? Math.round((e / t) * 100) : 0;
  }, [groups]);

  const pctTone = (p) => p >= 75 ? 'success' : p >= 50 ? 'warning' : 'danger';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
      className="glass-card home-widget home-widget-tall home-widget-grades">
      <div className="home-widget-header">
        <div className="home-widget-heading">
          <div className="home-widget-icon home-tone-warning">
            <TrendingUp size={14} />
          </div>
          <div>
            <span className="home-widget-title">
              Saisie des Notes
            </span>
            <p className="home-widget-subtitle">Par groupe</p>
          </div>
        </div>
        <div className={`home-grade-overall home-tone-${pctTone(overall)}`}>
          <span>{overall}%</span>
          <p>global</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="home-widget-empty">
          Aucun stagiaire enregistré
        </div>
      ) : (
        <div className="home-widget-list home-grade-list">
          {groups.map((g) => (
            <div key={g.label} className={`home-grade-row home-tone-${pctTone(g.pct)}`}>
              <div className="home-grade-row-header">
                <div className="home-grade-row-meta">
                  <span className="home-grade-group">{g.label}</span>
                </div>
                <span className="home-grade-percent">{g.pct}%</span>
              </div>
              <div className="home-grade-track">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${g.pct}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut', delay: 0.12 }}
                  className="home-grade-fill"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

const DAY_ABBREVIATIONS = {
  Lundi: 'LUN',
  Mardi: 'MAR',
  Mercredi: 'MER',
  Jeudi: 'JEU',
  Vendredi: 'VEN',
  Samedi: 'SAM',
  Dimanche: 'DIM'
};
const DASH_START = 8;
const DASH_END = 19;
const DASH_HOURS = Array.from({ length: DASH_END - DASH_START + 1 }, (_, i) => DASH_START + i);
const DASH_PX = 80;

const formatTimeDash = (timeStr) => {
  if (!timeStr) return '';
  const cleaned = timeStr.replace(/h/gi, ':').trim();
  const parts = cleaned.split(':');
  if (parts.length < 2) return cleaned;
  return `${parts[0].trim().padStart(2, '0')}:${parts[1].trim().padStart(2, '0')}`;
};

const parseTimeRangeDash = (timeStr = '') => {
  const parts = timeStr.split('-');
  if (parts.length >= 2) return { 
    start: formatTimeDash(parts[0].trim()), 
    end: formatTimeDash(parts[1].trim()) 
  };
  return { start: '08:00', end: '10:00' };
};

const timeToPxDash = (t = '08:00') => {
  const [h, m] = t.split(':').map(Number);
  return ((h - DASH_START) * 60 + (m || 0)) * (DASH_PX / 60);
};

const getDeterministicEventStyles = (moduleName = '') => {
  let hash = 0;
  const str = moduleName || 'non defini';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return {
    '--event-bg': `linear-gradient(135deg, hsla(${hue}, 85%, 96%, 0.95) 0%, hsla(${hue}, 85%, 98%, 0.8) 100%)`,
    '--event-border': `hsla(${hue}, 60%, 75%, 0.8)`,
    '--event-color': `hsl(${hue}, 60%, 40%)`,
    '--event-text': `hsl(${hue}, 70%, 20%)`,
    '--event-rail': `linear-gradient(180deg, hsl(${hue}, 75%, 48%) 0%, hsl(${hue}, 75%, 32%) 100%)`
  };
};

const getDayColors = (day = '') => {
  const normalized = day.trim().toLowerCase();
  if (normalized.includes('lun')) {
    return { bg: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.08) 0%, rgba(var(--primary-rgb), 0.02) 100%)', text: 'var(--primary)', border: 'rgba(var(--primary-rgb), 0.2)' };
  }
  if (normalized.includes('mar')) {
    return { bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)', text: '#059669', border: 'rgba(16, 185, 129, 0.2)' };
  }
  if (normalized.includes('mer')) {
    return { bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)', text: '#d97706', border: 'rgba(245, 158, 11, 0.2)' };
  }
  if (normalized.includes('jeu')) {
    return { bg: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.08) 0%, rgba(var(--primary-rgb), 0.02) 100%)', text: 'var(--primary)', border: 'rgba(var(--primary-rgb), 0.2)' };
  }
  if (normalized.includes('ven')) {
    return { bg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(244, 63, 94, 0.02) 100%)', text: '#e11d48', border: 'rgba(244, 63, 94, 0.2)' };
  }
  if (normalized.includes('sam')) {
    return { bg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(14, 165, 233, 0.02) 100%)', text: '#0284c7', border: 'rgba(14, 165, 233, 0.2)' };
  }
  return { bg: 'linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(20, 184, 166, 0.02) 100%)', text: '#0d9488', border: 'rgba(20, 184, 166, 0.2)' };
};

const getHourColors = (hour) => {
  const hue = ((hour - 8) * 30) % 360;
  return {
    bg: `linear-gradient(180deg, hsla(${hue}, 85%, 97%, 0.95) 0%, hsla(${hue}, 85%, 99%, 0.7) 100%)`,
    text: `hsl(${hue}, 70%, 35%)`,
    border: `hsla(${hue}, 60%, 80%, 0.5)`,
    accent: `hsl(${hue}, 75%, 45%)`
  };
};

const ScheduleCalendar = ({ realSchedules, teachers, activeSemester, setActiveSemester, getScheduleModule, academicCatalog }) => {
  const catalogFilieres = academicCatalog?.filieres || FILIERES;
  const diplomas = useMemo(() => Object.keys(catalogFilieres), [catalogFilieres]);
  const defaultDiploma = diplomas.includes('Technicien Spécialisé') ? 'Technicien Spécialisé' : diplomas[0];
  const [selectedDiploma, setSelectedDiploma] = useState(defaultDiploma);

  const availableFilieres = useMemo(() => catalogFilieres[selectedDiploma] || [], [catalogFilieres, selectedDiploma]);
  const [selectedFiliere, setSelectedFiliere] = useState(() => {
    const defaultFilieres = catalogFilieres[defaultDiploma] || [];
    return defaultFilieres.includes('Développement Informatique') ? 'Développement Informatique' : defaultFilieres[0];
  });

  const availableStudyYears = useMemo(() => academicCatalog?.years?.[selectedDiploma] || getStudyYearsForDiploma(selectedDiploma), [academicCatalog, selectedDiploma]);
  const [selectedAnnee, setSelectedAnnee] = useState(availableStudyYears[0]);

  const groupLabel = useMemo(() => getGroupAbbreviation(selectedFiliere, selectedAnnee), [selectedFiliere, selectedAnnee]);
  const filteredSessions = useMemo(
    () => realSchedules.filter(s => 
      (s.diploma || getDiplomaForMajor(s.filiere)) === selectedDiploma &&
      s.filiere === selectedFiliere &&
      s.annee === selectedAnnee
    ),
    [realSchedules, selectedDiploma, selectedFiliere, selectedAnnee]
  );

  const today = getTodayFrench();
  const topScrollRef = useRef(null);
  const mainScrollRef = useRef(null);

  const handleTopScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) {
      mainScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleMainScroll = () => {
    if (topScrollRef.current && mainScrollRef.current) {
      topScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="glass-card home-widget home-schedule-card home-widget-schedule">
      {/* Header row */}
      <div className="home-schedule-header">
        <div className="home-schedule-title-group">
          <span className="home-widget-title">
            Emploi du temps
          </span>
          <div className="home-schedule-filters">
            <FilterSelect 
              className="home-filter-select home-filter-select-level" 
              value={selectedDiploma} 
              onChange={val => { 
                const nextFiliere = (catalogFilieres[val] || [])[0] || '';
                setSelectedDiploma(val); 
                setSelectedFiliere(nextFiliere);
                setSelectedAnnee((academicCatalog?.years?.[val] || getStudyYearsForDiploma(val))[0]);
              }} 
              options={diplomas.map(d => ({ label: d, value: d }))} 
            />
            <FilterSelect 
              className="home-filter-select home-filter-select-major" 
              value={selectedFiliere} 
              onChange={val => { 
                setSelectedFiliere(val); 
                setSelectedAnnee((academicCatalog?.years?.[selectedDiploma] || getStudyYearsForDiploma(selectedDiploma))[0]);
              }} 
              options={availableFilieres.map(f => ({ label: f, value: f }))} 
            />
            <FilterSelect 
              className="home-filter-select home-filter-select-year" 
              value={selectedAnnee} 
              onChange={val => setSelectedAnnee(val)} 
              options={availableStudyYears.map(a => ({ label: a, value: a }))} 
            />
          </div>
        </div>
        <div className="home-schedule-actions">
          <span className="home-widget-pill home-tone-primary">
            {groupLabel}
          </span>
          <span className="home-widget-pill home-tone-warning">
            {filteredSessions.length} séances {activeSemester}
          </span>
          <Link to="/admin/schedules" className="btn-modern home-manage-link">
            <CalendarPlus size={12} /> Gérer
          </Link>
        </div>
      </div>

      {/* Top Sync Scrollbar */}
      <div 
        ref={topScrollRef} 
        onScroll={handleTopScroll} 
        className="top-scrollbar-container"
      >
        <div style={{ width: `${90 + DASH_HOURS.length * DASH_PX}px`, height: '1px' }} />
      </div>

      {/* Time Grid (Inverted Axes) */}
      <div ref={mainScrollRef} onScroll={handleMainScroll} className="home-schedule-scroll">
        <div className="home-schedule-grid-inverted">
          {/* Columns Header Row (Hours) */}
          <div className="home-schedule-header-row">
            <div className="home-schedule-corner-inverted">Jour / Heure</div>
            <div className="home-schedule-hours-row">
              {DASH_HOURS.map(hour => {
                const colors = getHourColors(hour);
                return (
                  <div 
                    key={hour} 
                    className="home-schedule-hour-col-header" 
                    style={{ 
                      width: `${DASH_PX}px`,
                      background: colors.bg,
                      borderBottom: `2.5px solid ${colors.accent}`,
                      borderRight: `1px solid ${colors.border}`
                    }}
                  >
                    <span style={{ color: colors.text }}>{hour.toString().padStart(2, '0')}:00</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows (Days) */}
          <div className="home-schedule-rows-container" style={{ position: 'relative' }}>
            {/* Watermark */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '110px',
              fontWeight: '900',
              color: 'rgba(var(--primary-rgb), 0.09)',
              zIndex: 2,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              letterSpacing: '0.08em',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              {groupLabel}
            </div>
            {DASH_DAYS.map(day => {
              const daySessions = filteredSessions
                .filter(s => s.day === day)
                .map(s => { const { start, end } = parseTimeRangeDash(s.time); return { ...s, start, end }; })
                .filter(s => getScheduleModule(s))
                .sort((a, b) => a.start.localeCompare(b.start));

              const colors = getDayColors(day);
              return (
                <div key={day} className="home-schedule-day-row">
                  {/* Day label (sticky col) */}
                  <div 
                    className="home-schedule-day-label-col"
                    style={{
                      background: colors.bg,
                      borderRightColor: colors.border,
                      borderLeft: `4px solid ${colors.text}`
                    }}
                  >
                    <span className="home-schedule-day-name" style={{ color: colors.text }}>
                      {DAY_ABBREVIATIONS[day] || day.slice(0, 3).toUpperCase()}
                    </span>
                    {daySessions.length > 0 && (
                      <span className="home-schedule-day-count" style={{ backgroundColor: colors.text, color: '#ffffff' }}>
                        {daySessions.length}
                      </span>
                    )}
                  </div>

                  {/* Day Timeline body */}
                  <div className="home-schedule-day-timeline" style={{ width: `${DASH_HOURS.length * DASH_PX}px` }}>
                    {/* Hour grid lines (vertical columns) */}
                    {DASH_HOURS.map(hour => (
                      <div key={hour} className="home-schedule-hour-vertical-line" style={{ left: `${(hour - DASH_START) * DASH_PX}px` }} />
                    ))}
                    {/* Half-hour lines (dashed) */}
                    {DASH_HOURS.map(hour => (
                      <div key={`h-${hour}`} className="home-schedule-half-vertical-line" style={{ left: `${(hour - DASH_START) * DASH_PX + DASH_PX / 2}px` }} />
                    ))}

                    {daySessions.length === 0 && (
                      <div className="home-schedule-free">
                        <span>Libre</span>
                      </div>
                    )}

                    {daySessions.map(session => {
                      const left = timeToPxDash(session.start);
                      const width = Math.max(timeToPxDash(session.end) - left, DASH_PX * 0.7);
                      const isTP = session.type === 'TP';
                      const teacher = teachers.find(t => t.id === session.teacherId);
                      const moduleName = getScheduleModule(session) || '';
                      const eventStyles = getDeterministicEventStyles(moduleName);
                      return (
                        <motion.div
                          key={session.id}
                          whileHover={{ scale: 1.02, zIndex: 10 }}
                          className={`home-schedule-event ${isTP ? 'home-schedule-event-tp' : 'home-schedule-event-course'} ${day === today ? 'home-schedule-event-today' : ''}`}
                          style={{
                            position: 'absolute',
                            left: `${left + 4}px`,
                            width: `${width - 8}px`,
                            top: '6px',
                            bottom: '6px',
                            height: 'auto',
                            ...eventStyles
                          }}
                        >
                          <div className="home-schedule-event-rail-horizontal" />
                          <div className="home-schedule-event-time">
                            <Clock size={8} />
                            <span>
                              {session.start}–{session.end}
                            </span>
                          </div>
                          <div className="home-schedule-event-title">
                            {getScheduleModule(session) || 'Module non défini'}
                          </div>
                          {teacher && (
                            <div className="home-schedule-event-teacher">
                              <User size={7} />
                              <span>
                                {teacher.name}
                              </span>
                            </div>
                          )}

                          {/* Hover Tooltip */}
                          <div className={`schedule-tooltip ${['Vendredi', 'Samedi', 'Dimanche'].includes(day) ? 'tooltip-above' : ''}`}>
                            <div style={{ fontWeight: '800', fontSize: '10px', marginBottom: '4px', borderBottom: '1px solid var(--event-border)', paddingBottom: '3px', color: 'var(--event-color)' }}>
                              {moduleName || 'Module non défini'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--event-text)', opacity: 0.95, fontSize: '9px' }}>
                              <div>🕒 {session.start} – {session.end} ({session.type || 'Cours'})</div>
                              {teacher && <div>👤 {teacher.name}</div>}
                              {session.room && <div>📍 Salle : {session.room}</div>}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const AdminDashboard = () => {
  const { hasPermission, isAdmin } = useAdminAuth();
  const { students, teachers, payments, grades, schedules, modules: allModules, academicCatalog, addStudent, addTeacher, deleteStudent, deleteTeacher, updateStudent, promoteAcademicYear, undoLastPromotion, updateStudentClosureDecision, updateTeacher, studentAttendance, teacherAttendance, loadStudentAttendanceForMonth, loadTeacherAttendanceForMonth, migrateTeacherTokens, loading, confirmAction, notifications, activeSemester, setActiveSemester, getActiveScheduleModule, activeAcademicYear, operationalAcademicYear, availableAcademicYearsList, institution } = useApp();
  const { showToast } = useToast();
  const location = useLocation();
  const isDashboard = location.pathname === '/';
  const dashboardMonthIndex = new Date().getMonth();
  const currentCalendarYear = new Date().getFullYear();
  const dashboardDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const attendanceCalendarYear = getCalendarYearForAcademicMonth(activeAcademicYear, dashboardMonthIndex) || currentCalendarYear;
  const attendanceMonthKey = `${attendanceCalendarYear}-${String(dashboardMonthIndex + 1).padStart(2, '0')}`;
  const teacherAttendanceMonthKey = `${currentCalendarYear}-${String(dashboardMonthIndex + 1).padStart(2, '0')}`;

  // Load the equivalent calendar month for the selected academic year.
  useEffect(() => {
    if (!isDashboard) return;
    loadStudentAttendanceForMonth(dashboardMonthIndex, attendanceCalendarYear);
  }, [attendanceCalendarYear, dashboardMonthIndex, isDashboard, loadStudentAttendanceForMonth]);

  useEffect(() => {
    if (!isDashboard) return;
    loadTeacherAttendanceForMonth(dashboardMonthIndex, currentCalendarYear);
  }, [currentCalendarYear, dashboardMonthIndex, isDashboard, loadTeacherAttendanceForMonth]);
  
  const [localActiveTab, setLocalActiveTab] = useState('students');
  const activeTab = location.pathname.includes('teacher') ? 'teachers' 
                 : location.pathname.includes('student') ? 'students' 
                 : localActiveTab;

  useEffect(() => {
    setGlobalFilter('');
    setCategoryFilter('');
    setDiplomaFilter('');
    setYearFilter('');
    setModuleFilter('');
  }, [activeTab]);

  const [globalFilter, setGlobalFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [diplomaFilter, setDiplomaFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  // Sync local academic year filter with global selector
  useEffect(() => { setAcademicYearFilter(activeAcademicYear); }, [activeAcademicYear]);

  // Modal state
  const [modalMode, setModalMode] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editModuleSearch, setEditModuleSearch] = useState('');
  
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [promotionForm, setPromotionForm] = useState(() => getAcademicYearTransition(operationalAcademicYear));
  const [isPromotingAcademicYear, setIsPromotingAcademicYear] = useState(false);
  const [promotionResult, setPromotionResult] = useState(null);
  const [promotionDecisions, setPromotionDecisions] = useState({});
  useEffect(() => { setPromotionDecisions({}); }, [operationalAcademicYear]);

  // Add student & teacher form states and helper handlers
  const [addStudentForm, setAddStudentForm] = useState({
    firstName: '', lastName: '', major: '', regNo: '', diploma: '', year: '',
    academicYear: operationalAcademicYear
  });
  const [addTeacherForm, setAddTeacherForm] = useState({
    name: '', diplomas: [], subjects: [], groups: [], years: [], hourlyRate: 0
  });
  const [addTeacherModuleSearch, setAddTeacherModuleSearch] = useState('');

  const toggleAddTeacherDiploma = (dip) => {
    setAddTeacherForm(prev => {
      const currentDiplomas = prev.diplomas || [];
      const isSelected = currentDiplomas.includes(dip);
      const newDiplomas = isSelected ? currentDiplomas.filter(d => d !== dip) : [...currentDiplomas, dip];
      const allowedYears = Array.from(new Set(newDiplomas.flatMap(diploma => academicCatalog?.years?.[diploma] || getStudyYearsForDiploma(diploma))));
      const allowedGroups = new Set(newDiplomas.flatMap(diploma => academicCatalog?.filieres?.[diploma] || FILIERES[diploma] || []));
      return {
        ...prev,
        diplomas: newDiplomas,
        groups: (prev.groups || []).filter(group => allowedGroups.has(group)),
        years: (prev.years || []).filter(year => allowedYears.includes(year)),
        subjects: newDiplomas.length === 0 ? [] : (prev.subjects || [])
      };
    });
  };

  const toggleAddTeacherYear = (year) => {
    setAddTeacherForm(prev => ({
      ...prev,
      years: (prev.years || []).includes(year) ? (prev.years || []).filter(y => y !== year) : [...(prev.years || []), year]
    }));
  };

  const toggleAddTeacherGroup = (filiere) => {
    setAddTeacherForm(prev => ({
      ...prev,
      groups: (prev.groups || []).includes(filiere) ? (prev.groups || []).filter(g => g !== filiere) : [...(prev.groups || []), filiere]
    }));
  };

  const toggleAddTeacherSubject = (mod) => {
    setAddTeacherForm(prev => ({
      ...prev,
      subjects: (prev.subjects || []).includes(mod) ? (prev.subjects || []).filter(s => s !== mod) : [...(prev.subjects || []), mod]
    }));
  };

  const toggleFiliereAllAdd = (year, filiere, modules) => {
    const allSelected = modules.every(m => (addTeacherForm.subjects || []).includes(m));
    if (allSelected) {
      setAddTeacherForm(prev => ({ ...prev, subjects: (prev.subjects || []).filter(s => !modules.includes(s)) }));
    } else {
      setAddTeacherForm(prev => ({ ...prev, subjects: [...new Set([...(prev.subjects || []), ...modules])] }));
    }
  };

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    try {
      const enrollmentAcademicYear = addStudentForm.academicYear || operationalAcademicYear;
      if (enrollmentAcademicYear !== operationalAcademicYear) {
        const confirmed = await confirmAction({
          title: 'Inscription dans une année archivée',
          message: `Le stagiaire sera inscrit dans l'année ${enrollmentAcademicYear}. Cette action alimente une archive. Continuer ?`,
          type: 'warning',
          confirmText: 'Confirmer l’inscription',
          cancelText: 'Annuler'
        });
        if (!confirmed) return;
      }
      const trimmedData = {
        ...addStudentForm,
        firstName: addStudentForm.firstName.trim(),
        lastName: addStudentForm.lastName.trim(),
        academicYear: enrollmentAcademicYear
      };
      await addStudent(trimmedData);
      showToast('Stagiaire inscrit avec succès.', 'success');
      setAddStudentForm({ firstName: '', lastName: '', major: '', regNo: '', diploma: '', year: '', academicYear: operationalAcademicYear });
      closeModal();
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'inscription.", 'error');
    }
  };

  const handleAddTeacherSubmit = async (e) => {
    e.preventDefault();
    if ((addTeacherForm.diplomas || []).length === 0) return showToast('Sélectionnez au moins un diplôme.', 'warning');
    if ((addTeacherForm.subjects || []).length === 0) return showToast('Sélectionnez au moins un module.', 'warning');
    if ((addTeacherForm.groups || []).length === 0) return showToast('Sélectionnez au moins une filière.', 'warning');
    if ((addTeacherForm.years || []).length === 0) return showToast('Sélectionnez au moins un niveau.', 'warning');
    try {
      await addTeacher(addTeacherForm);
      showToast('Formateur enregistré avec succès.', 'success');
      setAddTeacherForm({ name: '', diplomas: [], subjects: [], groups: [], years: [], hourlyRate: 0 });
      closeModal();
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'enregistrement.", 'error');
    }
  };

  // QR modal state
  const [qrModal, setQrModal] = useState(null); // { title, links: [{ label, url, color }] }
  const openQR = useCallback((title, links) => setQrModal({ title, links }), []);
  const closeQR = useCallback(() => setQrModal(null), []);

  const BASE = getPortalBaseUrl(institution);

  const activeStudents = useMemo(() => (students || []).filter(isActiveStudent), [students]);
  const promotionPreview = useMemo(() => {
    const eligible = activeStudents
      .filter(student => isStudentCurrentlyInAcademicYear(
        student,
        promotionForm.fromAcademicYear,
        operationalAcademicYear
      ))
      .filter(s => academicCatalog?.years?.[s.diploma]?.includes(s.year) || isKnownStudyYear(s.diploma, s.year));
    const filiereBreakdown = {};
    const counts = { promoted: 0, graduated: 0, repeated: 0, withdrawn: 0, pending: 0 };
    eligible.forEach(student => {
      if (!getClosureDecisionOptions(student).some(option => option.value === promotionDecisions[student.id] && !option.disabled)) { counts.pending++; return; }
      const outcome = getClosureOutcome(student, promotionDecisions[student.id]);
      counts[outcome]++;
      const key = `${student.diploma || 'N/A'} - ${student.major || 'N/A'}`;
      if (!filiereBreakdown[key]) filiereBreakdown[key] = { promoted: 0, graduated: 0, repeated: 0, withdrawn: 0 };
      filiereBreakdown[key][outcome]++;
    });
    return { ...counts, total: eligible.length, eligible, filiereBreakdown };
  }, [academicCatalog, activeStudents, operationalAcademicYear, promotionForm.fromAcademicYear, promotionDecisions]);
  const isYearFormatValid = useMemo(() => validateAcademicYearTransition(promotionForm.fromAcademicYear, promotionForm.toAcademicYear), [promotionForm]);

  const allDiplomas = useMemo(() => academicCatalog?.diplomas || Object.keys(FILIERES), [academicCatalog]);
  const availableYears = useMemo(
    () => diplomaFilter ? (academicCatalog?.years?.[diplomaFilter] || getStudyYearsForDiploma(diplomaFilter)) : Array.from(new Set(Object.values(academicCatalog?.years || {}).flat() || ALL_STUDY_YEARS)),
    [academicCatalog, diplomaFilter]
  );
  const availableMajors = useMemo(() => {
    if (!diplomaFilter) return Array.from(new Set(Object.values(academicCatalog?.filieres || FILIERES).flat()));
    return academicCatalog?.filieres?.[diplomaFilter] || FILIERES[diplomaFilter] || [];
  }, [academicCatalog, diplomaFilter]);
  const getStudentActiveModules = useCallback((student) => {
    const studentYear = getStudentCurrentAcademicYear(student, operationalAcademicYear);
    const configuredModules = getStudentGradeModules(allModules || [], student, studentYear);
    return configuredModules.length > 0 ? configuredModules : getModulesForStudent(student);
  }, [allModules, operationalAcademicYear]);

  // Edit helper functions
  const toggleDiplomaEdit = (dip) => {
    setEditFormData(prev => {
      const currentDiplomas = prev.diplomas || (prev.diploma ? [prev.diploma] : []);
      const isSelected = currentDiplomas.includes(dip);
      const newDiplomas = isSelected ? currentDiplomas.filter(d => d !== dip) : [...currentDiplomas, dip];
      const allowedYears = Array.from(new Set(newDiplomas.flatMap(diploma => academicCatalog?.years?.[diploma] || getStudyYearsForDiploma(diploma))));
      const allowedGroups = new Set(newDiplomas.flatMap(diploma => academicCatalog?.filieres?.[diploma] || FILIERES[diploma] || []));
      return {
        ...prev,
        diploma: undefined, 
        diplomas: newDiplomas,
        groups: (prev.groups || []).filter(group => allowedGroups.has(group)),
        years: (prev.years || []).filter(year => allowedYears.includes(year)),
        subjects: newDiplomas.length === 0 ? [] : prev.subjects
      };
    });
  };

  const toggleYearEdit = (year) => {
    setEditFormData(prev => ({
      ...prev,
      years: (prev.years || []).includes(year) ? (prev.years || []).filter(y => y !== year) : [...(prev.years || []), year]
    }));
  };

  const toggleGroupEdit = (filiere) => {
    setEditFormData(prev => ({
      ...prev,
      groups: (prev.groups || []).includes(filiere) ? (prev.groups || []).filter(g => g !== filiere) : [...(prev.groups || []), filiere]
    }));
  };

  const toggleSubjectEdit = (mod) => {
    setEditFormData(prev => ({
      ...prev,
      subjects: (prev.subjects || []).includes(mod) ? (prev.subjects || []).filter(s => s !== mod) : [...(prev.subjects || []), mod]
    }));
  };

  const toggleFiliereAllEdit = (year, filiere, modules) => {
    const allSelected = modules.every(m => (editFormData.subjects || []).includes(m));
    if (allSelected) {
      setEditFormData(prev => ({ ...prev, subjects: (prev.subjects || []).filter(s => !modules.includes(s)) }));
    } else {
      setEditFormData(prev => ({ ...prev, subjects: [...new Set([...(prev.subjects || []), ...modules])] }));
    }
  };

  const openDetails = useCallback((item) => {
    setSelectedItem(item);
    setModalMode('details');
  }, []);

  const openEdit = useCallback((item) => {
    setSelectedItem(item);
    setEditFormData({ ...item });
    setModalMode('edit');
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setSelectedItem(null);
    setEditFormData({});
  }, []);

  const handleDelete = useCallback(async (item) => {
    if (await confirmAction({ 
      title: "Supprimer ?", 
      message: `Êtes-vous sûr de vouloir supprimer ${item.lastName ? `${item.lastName} ${item.firstName}` : item.name} ? Cette action est irréversible.`,
      type: "danger"
    })) {
      if (activeTab === 'students') deleteStudent(item.id);
      else deleteTeacher(item.id);
    }
  }, [activeTab, deleteStudent, deleteTeacher, confirmAction, showToast]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleUpdate = useCallback(async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const finalData = { ...editFormData };
      if (!finalData.diplomas && finalData.diploma) {
        finalData.diplomas = [finalData.diploma];
      }
      delete finalData.diploma;

      if (activeTab === 'students') {
        await updateStudent(selectedItem.id, finalData);
      } else {
        await updateTeacher(selectedItem.id, finalData);
      }
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        closeModal();
      }, 1500);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'enregistrement.", 'error');
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, selectedItem, editFormData, updateStudent, updateTeacher, closeModal, showToast]);

  const handlePromoteAcademicYear = useCallback(async () => {
    if (promotionPreview.total === 0) {
      showToast('Aucun stagiaire actif \u00e0 cl\u00f4turer.', 'info');
      return;
    }
    if (promotionPreview.pending > 0) {
      showToast('Choisissez une décision pour chaque stagiaire.', 'error');
      return;
    }
    if (!isYearFormatValid) {
      showToast('Format d\u2019ann\u00e9e invalide.', 'error');
      return;
    }
    const confirmed = await confirmAction({
      title: "Cl\u00f4turer l'ann\u00e9e scolaire ?",
      message: `Une sauvegarde complète sera créée. ${promotionPreview.promoted} stagiaire(s) passeront à l'année suivante, ${promotionPreview.graduated} deviendront lauréats, ${promotionPreview.repeated} redoubleront et ${promotionPreview.withdrawn} seront marqués en abandon. Tous les dossiers et résultats seront conservés dans les archives de ${promotionForm.fromAcademicYear}.`,
      type: 'warning'
    });
    if (!confirmed) return;

    setIsPromotingAcademicYear(true);
    try {
      const result = await promoteAcademicYear({
        fromAcademicYear: promotionForm.fromAcademicYear,
        toAcademicYear: promotionForm.toAcademicYear,
        decisions: promotionDecisions,
      });
      if (result.error) return;
      setPromotionResult(result);
    } catch (err) {
      console.error(err);
      showToast("Erreur pendant la cl\u00f4ture de l'ann\u00e9e scolaire.", 'error');
    } finally {
      setIsPromotingAcademicYear(false);
    }
  }, [confirmAction, promoteAcademicYear, promotionForm, promotionPreview, promotionDecisions, isYearFormatValid, showToast]);

  const handleUndoPromotion = useCallback(async () => {
    if (!promotionResult?.operationId) return;
    const confirmed = await confirmAction({
      title: 'Annuler la cl\u00f4ture ?',
      message: 'Cette action restaurera tous les stagiaires \u00e0 leur \u00e9tat pr\u00e9c\u00e9dent. Voulez-vous continuer ?',
      type: 'warning'
    });
    if (!confirmed) return;
    setIsPromotingAcademicYear(true);
    try {
      await undoLastPromotion(promotionResult.operationId);
      setPromotionResult(null);
      setPromotionModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de l\u2019annulation.', 'error');
    } finally {
      setIsPromotingAcademicYear(false);
    }
  }, [confirmAction, undoLastPromotion, promotionResult, showToast]);

  const exportCSV = () => {
    let data = tableData;
    if (data.length === 0) return showToast('Aucune donnée.', 'info');
    const headers = activeTab === 'students' ? "\uFEFFNom,Prénom,Matricule,Niveau,Filière,Année,Statut\n" : "\uFEFFNom,Module,Statut\n";
    const rows = data.map(item => {
      if (activeTab === 'students') return `"${item.lastName}","${item.firstName}","${item.regNo}","${item.diploma || ''}","${item.major}","${item.year || ''}","${getStudentStatusLabel(item.__sourceStudent || item)}"`;
      return `"${item.name || ''}","${item.subject || ''}","ACTIF"`;
    }).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${institution?.shortName || 'EFP'}_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast('Exportation réussie', 'success');
  };

  const tableData = useMemo(() => {
    let data = activeTab === 'students'
      ? (students || []).map(student => {
          const snapshot = academicYearFilter
            ? getStudentAcademicSnapshot(student, academicYearFilter, operationalAcademicYear)
            : getStudentAcademicSnapshot(student, '', operationalAcademicYear);
          return snapshot ? { ...snapshot, __sourceStudent: student } : null;
        }).filter(Boolean)
      : (teachers || []);
    if (activeTab === 'students' && statusFilter) data = data.filter(item => (item.__sourceStudent?.status || STUDENT_STATUS.ACTIVE) === statusFilter);
    if (diplomaFilter) data = data.filter(item => activeTab === 'students' ? item.diploma === diplomaFilter : (item.diplomas || []).includes(diplomaFilter));
    if (yearFilter) {
      if (yearFilter === 'Lauréat') {
        data = data.filter(item => activeTab === 'students' ? item.graduationAcademicYear === academicYearFilter : false);
      } else {
        data = data.filter(item => activeTab === 'students' ? item.year === yearFilter : (item.years || []).includes(yearFilter));
      }
    }
    if (categoryFilter) data = data.filter(item => activeTab === 'students' ? item.major === categoryFilter : (item.groups || []).includes(categoryFilter));
    if (activeTab === 'teachers' && moduleFilter) data = data.filter(item => (item.subjects || [item.subject]).includes(moduleFilter));
    return data;
  }, [activeTab, students, teachers, categoryFilter, diplomaFilter, yearFilter, academicYearFilter, moduleFilter, operationalAcademicYear, statusFilter]);

  const columns = useMemo(() => [
    {
      accessorKey: 'avatar', header: '',
      cell: ({ row }) => (
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-ultra-light)', color: 'var(--primary)', fontWeight: '700', fontSize: '14px', border: '1px solid var(--border-light)', flexShrink: 0 }}>
          {activeTab === 'students' ? (row.original.lastName?.[0] || '?') : (row.original.name?.[0] || '?')}
        </div>
      ),
    },
    {
      accessorKey: activeTab === 'students' ? 'lastName' : 'name', header: 'Identité',
      cell: ({ row }) => (
        <div style={{ minWidth: 0 }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeTab === 'students' ? `${row.original.lastName} ${row.original.firstName}` : row.original.name}
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span className={`badge-status ${isActiveStudent(row.original.__sourceStudent || row.original) ? 'success' : 'warning'}`} style={{ fontSize: '9px' }}>
              {getStudentStatusLabel(row.original.__sourceStudent || row.original)}
            </span>
            <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
              {activeTab === 'students' ? row.original.major : (row.original.subjects || [row.original.subject]).slice(0, 2).join(', ')}
            </span>
            {activeTab === 'students' && (
              <span style={{
                fontSize: '9px', fontWeight: '700', color: 'var(--primary)',
                background: 'var(--primary-ultra-light)', border: '1px solid rgba(var(--primary-rgb), 0.25)',
                borderRadius: '4px', padding: '1px 6px'
              }}>
                Cycle {getStudentStudyCycleRange(row.original, operationalAcademicYear)}
              </span>
            )}
            {activeTab === 'students' && getStudentPreviousYearBalance(row.original, payments || []).hasUnpaid && (
              <span style={{
                fontSize: '9px', fontWeight: '800', color: '#b45309',
                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: '4px', padding: '1px 6px'
              }}>
                Arriérés 1ère année ({getStudentPreviousYearBalance(row.original, payments || []).unpaidCount} mois)
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'ref', header: 'Référence',
      cell: ({ row }) => (
        <div>
          <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
            {activeTab === 'students' ? 'Matricule' : 'Modules'}
          </p>
          <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {activeTab === 'students' ? row.original.regNo : `${(row.original.subjects || [row.original.subject]).length} module(s)`}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'token', header: activeTab === 'students' ? 'Lien' : 'Liens Formateur',
      cell: ({ row }) => {
        if (activeTab === 'students') {
          const tokenForLink = row.original.token || row.original.id;
          const fullLink = BASE + `/results/${tokenForLink}`;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', maxWidth: '260px' }}
              onClick={(e) => { e.stopPropagation(); openQR(`${row.original.lastName} ${row.original.firstName}`, [{ label: 'Résultats', url: fullLink, color: 'var(--primary)' }]); }}
              title="Voir le QR code">
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary-ultra-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LinkIcon size={12} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: '500', fontFamily: 'monospace', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullLink}</span>
            </div>
          );
        } else {
          const linkAtt   = BASE + `/portal/${row.original.tokenAttendance}`;
          const linkNotes = BASE + `/portal/${row.original.tokenGrades}`;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); openQR(row.original.name, [{ label: 'Absences', url: linkAtt, color: 'var(--primary)' }]); }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'var(--primary-ultra-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserCheck size={10} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--primary)' }}>Absences</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); openQR(row.original.name, [{ label: 'Notes', url: linkNotes, color: '#a06208' }]); }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'rgba(var(--accent-rgb), 0.1)', color: '#a06208', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={10} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#a06208' }}>Notes</span>
              </div>
            </div>
          );
        }
      },
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end' }}>
          {activeTab === 'students' && <ActionBtn icon={Share2} title="QR Code" color="var(--primary)" onClick={() => {
            const tokenForLink = row.original.token || row.original.id;
            openQR(`${row.original.lastName} ${row.original.firstName}`, [{ label: 'Résultats', url: BASE + `/results/${tokenForLink}`, color: 'var(--primary)' }]);
          }} />}
          <ActionBtn icon={Eye} title="Détails" onClick={() => openDetails(row.original)} />
          {activeTab === 'students' && isAdmin && (row.original.__sourceStudent || row.original).classHistory?.at(-1)?.operationId && (
            <ActionBtn icon={GraduationCap} title="Modifier la décision après clôture" onClick={() => openDetails(row.original)} />
          )}
          <ActionBtn disabled={!hasPermission(activeTab, 'edit')} icon={Edit3} title="Modifier le profil actuel" onClick={() => openEdit(row.original.__sourceStudent || row.original)} />
          {activeTab === 'students' && <ActionBtn icon={Download} title="Bulletin" onClick={() => {
            const academicYear = row.original.academicYear || academicYearFilter;
            const resolvedGrades = getGradesForAcademicYear(grades[row.original.id] || {}, academicYear);
            generateBulletinGlobal(
              row.original,
              { [row.original.id]: resolvedGrades },
              getStudentActiveModules(row.original),
              { academicYear }
            );
          }} />}
          <ActionBtn disabled={!hasPermission(activeTab, 'edit')} icon={Trash2} title="Supprimer" color="#dc2626" onClick={() => handleDelete(row.original.__sourceStudent || row.original)} />
        </div>
      ),
    },
  ], [activeTab, academicYearFilter, openDetails, openEdit, handleDelete, grades, getStudentActiveModules, openQR, operationalAcademicYear, payments, hasPermission, isAdmin]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const currentMonthName = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][new Date().getMonth()];

  const activeYearStudents = useMemo(() => {
    return (students || [])
      .map(student => (activeAcademicYear
        ? getStudentAcademicSnapshot(student, activeAcademicYear, operationalAcademicYear)
        : student))
      .filter(Boolean);
  }, [students, activeAcademicYear, operationalAcademicYear]);

  const activeYearSchedules = useMemo(() => {
    return filterSchedulesForAcademicYear(
      schedules,
      activeAcademicYear,
      INITIAL_OPERATIONAL_ACADEMIC_YEAR
    );
  }, [schedules, activeAcademicYear]);

  const activeYearStudentIds = useMemo(
    () => new Set(activeYearStudents.map(student => student.id)),
    [activeYearStudents]
  );

  const studentAttendanceRate = useMemo(
    () => calculateStudentAttendanceRate(studentAttendance, activeYearStudentIds, attendanceMonthKey),
    [activeYearStudentIds, attendanceMonthKey, studentAttendance]
  );

  const teacherAttendanceRate = useMemo(() => {
    const scopedRecords = (teacherAttendance || []).filter(record =>
      String(record.date || '').startsWith(teacherAttendanceMonthKey) &&
      isFinalAttendanceStatus(record.status)
    );
    if (scopedRecords.length === 0) return null;
    const presents = scopedRecords.filter(record => record.status === 'present').length;
    return Math.round((presents / scopedRecords.length) * 100);
  }, [teacherAttendance, teacherAttendanceMonthKey]);

  return (
    <div className={`max-w-container section-padding admin-dashboard-shell ${isDashboard ? 'home-dashboard-page' : 'directory-premium-page'} ${!isDashboard ? `directory-premium-${activeTab}` : ''}`}>
      
      {!isDashboard && (
        <div className="directory-premium-header">
          <div className="directory-premium-header-icon">
            {activeTab === 'students' ? <UsersIcon size={24} /> : <Presentation size={24} />}
          </div>
          <div className="directory-premium-header-copy">
            <span className="directory-premium-eyebrow">{activeTab === 'students' ? 'Gestion des apprenants' : 'Gestion pédagogique'}</span>
            <h1>
              {activeTab === 'students' ? 'Liste des Stagiaires' : 'Liste des Formateurs'}
            </h1>
            <p>
              {activeTab === 'teachers' ? 'Votre équipe pédagogique, ses modules et ses portails en un seul endroit.' : 'Vos stagiaires, leurs parcours et leurs dossiers en un seul endroit.'}
            </p>
          </div>
          <div className="directory-premium-header-actions">
            {activeTab === 'students' && isAdmin && (
              <button className="btn-modern" style={{ background: 'rgba(15,23,42,0.04)', color: 'var(--text-primary)' }} onClick={() => {
                setPromotionForm(getAcademicYearTransition(operationalAcademicYear));
                setPromotionModalOpen(true);
              }}>
                <GraduationCap size={14} style={{ marginRight: '6px' }} /> Cl&ocirc;turer l&apos;ann&eacute;e
              </button>
            )}
            <button
              disabled={!hasPermission(activeTab, 'edit')}
              onClick={() => {
                if (activeTab === 'students') {
                  setAddStudentForm({ firstName: '', lastName: '', major: '', regNo: '', diploma: '', year: '', academicYear: operationalAcademicYear });
                  setModalMode('add-student');
                } else {
                  setModalMode('add-teacher');
                }
              }}
              className="btn-modern primary"
            >
              <Plus size={14} style={{ marginRight: '6px' }} /> {activeTab === 'teachers' ? 'Ajouter un formateur' : 'Ajouter un stagiaire'}
            </button>
          </div>
          <div className="directory-premium-header-orb" aria-hidden="true">
            {activeTab === 'students' ? <GraduationCap size={112} /> : <Presentation size={112} />}
          </div>
        </div>
      )}

      {isDashboard && (
        <div className="home-dashboard-stack">
          <section className="gedu-dashboard-intro" aria-labelledby="gedu-dashboard-title">
            <div className="gedu-dashboard-intro-copy">
              <span className="gedu-dashboard-eyebrow">
                <span className="gedu-dashboard-eyebrow-dot" aria-hidden="true" />
                Centre de pilotage
              </span>
              <h1 id="gedu-dashboard-title">Pilotez votre établissement avec clarté.</h1>
              <p>
                Une vue simple de vos apprenants, de votre équipe et de l’activité pédagogique.
              </p>
              <div className="gedu-dashboard-meta">
                <span><Calendar size={14} /> {dashboardDate}</span>
                <span><CalendarCheck size={14} /> Année {activeAcademicYear || operationalAcademicYear}</span>
              </div>
            </div>
            <div className="gedu-dashboard-intro-identity">
              <div className="gedu-dashboard-intro-mark" aria-hidden="true"><School size={24} /></div>
              <div>
                <span>Établissement actif</span>
                <strong>{institution?.shortName || 'EFP'}</strong>
                <small>{institution?.typeLabel || 'Formation professionnelle'}</small>
              </div>
            </div>
          </section>

          <nav className="gedu-quick-actions" aria-label="Actions rapides">
            <Link to="/admin/students" className="gedu-quick-action">
              <span className="gedu-quick-action-icon gedu-quick-action-icon--emerald"><UsersIcon size={17} /></span>
              <span><strong>Ajouter un stagiaire</strong><small>Créer un dossier</small></span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link to="/admin/grades" className="gedu-quick-action">
              <span className="gedu-quick-action-icon gedu-quick-action-icon--amber"><FileText size={17} /></span>
              <span><strong>Suivre les notes</strong><small>Évaluer les modules</small></span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link to="/admin/schedules" className="gedu-quick-action">
              <span className="gedu-quick-action-icon gedu-quick-action-icon--violet"><Calendar size={17} /></span>
              <span><strong>Organiser les cours</strong><small>Voir les emplois du temps</small></span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link to="/admin/reports" className="gedu-quick-action">
              <span className="gedu-quick-action-icon gedu-quick-action-icon--sage"><LineChart size={17} /></span>
              <span><strong>Ouvrir les rapports</strong><small>Décider avec les données</small></span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </nav>

          <div className="home-stats-grid">
            <StatCard delay={0.05} icon={UsersIcon} tone="primary" value={activeYearStudents.length} label="Stagiaires" detail="Effectif inscrit" />
            <StatCard delay={0.1} icon={Presentation} tone="warning" value={(teachers || []).length} label="Formateurs" detail="Équipe pédagogique" />
            <StatCard delay={0.15} icon={CalendarCheck} tone="success" value={studentAttendanceRate === null ? '—' : `${studentAttendanceRate}%`} label="Présence stagiaires" detail={`${currentMonthName} ${attendanceCalendarYear}`} />
            <StatCard delay={0.2} icon={BarChart3} tone="info" value={teacherAttendanceRate === null ? '—' : `${teacherAttendanceRate}%`} label="Présence formateurs" detail={`${currentMonthName} ${attendanceCalendarYear}`} />
          </div>

          {/* New Requested Order in Grid format to keep dimensions */}
          <div className="home-dashboard-widget-grid">
            <TodaySessionsWidget schedules={activeYearSchedules} teachers={teachers || []} getScheduleModule={getActiveScheduleModule} activeSemester={activeSemester} setActiveSemester={setActiveSemester} />
            <GradesBreakdownWidget students={activeYearStudents} grades={grades || {}} allModules={allModules || []} activeSemester={activeSemester} operationalAcademicYear={operationalAcademicYear} />
          </div>

          <div className="home-dashboard-widget-grid">
            <PendingTasksWidget students={activeYearStudents} teachers={teachers || []} grades={grades || {}} teacherAttendance={teacherAttendance || []} allModules={allModules || []} activeSemester={activeSemester} operationalAcademicYear={operationalAcademicYear} />
            <ActivityFeedWidget notifications={notifications || []} />
          </div>

          <ScheduleCalendar realSchedules={activeYearSchedules} teachers={teachers || []} activeSemester={activeSemester} setActiveSemester={setActiveSemester} getScheduleModule={getActiveScheduleModule} academicCatalog={academicCatalog} />
        </div>
      )}

      {!isDashboard && (
        <>
          {activeTab === 'teachers' && (
            <div className="directory-overview-grid" aria-label="Vue d'ensemble de l'équipe pédagogique">
              <div className="directory-overview-card directory-overview-team">
                <Presentation size={23} aria-hidden="true" />
                <div><span>Équipe pédagogique</span><strong>{(teachers || []).length}</strong><p>Formateurs enregistrés</p></div>
              </div>
              <div className="directory-overview-card directory-overview-modules">
                <FileText size={23} aria-hidden="true" />
                <div><span>Modules enseignés</span><strong>{new Set((teachers || []).flatMap(teacher => teacher.subjects || [teacher.subject]).filter(Boolean)).size}</strong><p>Modules distincts attribués</p></div>
              </div>
              <div className="directory-overview-card directory-overview-results">
                <Search size={23} aria-hidden="true" />
                <div><span>Résultats de recherche</span><strong>{table.getFilteredRowModel().rows.length}</strong><p>Formateurs correspondant aux filtres</p></div>
              </div>
            </div>
          )}
          {activeTab === 'students' && (
            <div className="directory-overview-grid" aria-label="Vue d'ensemble des stagiaires">
              <div className="directory-overview-card directory-overview-team">
                <UsersIcon size={23} aria-hidden="true" />
                <div><span>Stagiaires inscrits</span><strong>{activeYearStudents.length}</strong><p>Année {activeAcademicYear || operationalAcademicYear}</p></div>
              </div>
              <div className="directory-overview-card directory-overview-modules">
                <GraduationCap size={23} aria-hidden="true" />
                <div><span>Filières représentées</span><strong>{new Set(activeYearStudents.map(student => student.major).filter(Boolean)).size}</strong><p>Parcours des stagiaires inscrits</p></div>
              </div>
              <div className="directory-overview-card directory-overview-results">
                <Search size={23} aria-hidden="true" />
                <div><span>Résultats de recherche</span><strong>{!statusFilter && !(diplomaFilter && yearFilter && categoryFilter) ? '—' : table.getFilteredRowModel().rows.length}</strong><p>{!statusFilter && !(diplomaFilter && yearFilter && categoryFilter) ? 'Sélectionnez vos filtres pour afficher la liste' : 'Stagiaires correspondant aux filtres'}</p></div>
              </div>
            </div>
          )}
          <div className={`glass-card directory-premium-filter-card app-filter-grid ${activeTab === 'students' ? 'app-filter-grid--6' : 'app-filter-grid--4'}`} style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div>
              <label style={labelStyle}>Recherche</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ color: 'var(--text-faint)', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input className="input-premium" style={{ width: '100%', paddingLeft: '36px', fontSize: '13px' }} placeholder="Rechercher…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} />
              </div>
            </div>

            {activeTab === 'students' && (
              <div>
                <label style={labelStyle}>Année académique</label>
                <FilterSelect
                  style={{ width: '100%', fontSize: '13px', padding: '9px 12px' }}
                  value={academicYearFilter}
                  onChange={(val) => setAcademicYearFilter(val)}
                  placeholder="Toutes années académiques"
                  options={[
                    { value: '', label: 'Toutes les années académiques' },
                    ...availableAcademicYearsList.map(y => ({ value: y, label: `Année ${y}` }))
                  ]}
                />
              </div>
            )}

            {activeTab === 'students' && (
              <div>
                <label style={labelStyle}>Statut du dossier</label>
                <FilterSelect style={{ width: '100%', fontSize: '13px', padding: '9px 12px' }} value={statusFilter} onChange={value => {
                  setStatusFilter(value);
                  if (value === STUDENT_STATUS.WITHDRAWN || value === STUDENT_STATUS.LAUREAT) {
                    setAcademicYearFilter(''); setDiplomaFilter(''); setYearFilter(''); setCategoryFilter('');
                  }
                }} options={[
                  { value: '', label: 'Tous les statuts' },
                  { value: STUDENT_STATUS.ACTIVE, label: 'Actifs' },
                  { value: STUDENT_STATUS.LAUREAT, label: 'Lauréats' },
                  { value: STUDENT_STATUS.WITHDRAWN, label: 'Abandons — dossiers conservés' },
                ]} />
              </div>
            )}

            <div>
              <label style={labelStyle}>Niveau</label>
              <FilterSelect
                style={{ width: '100%', fontSize: '13px', padding: '9px 12px' }}
                value={diplomaFilter}
                onChange={(val) => { setDiplomaFilter(val); setCategoryFilter(''); setYearFilter(''); }}
                placeholder={activeTab === 'students' ? "Choisir le niveau..." : "Tous niveaux"}
                options={activeTab === 'students'
                  ? [
                      { value: '', label: 'Choisir le niveau...' }, 
                      ...allDiplomas.map(d => ({ value: d, label: d }))
                    ]
                  : [{ value: '', label: 'Tous niveaux' }, ...allDiplomas.map(d => ({ value: d, label: d }))]
                }
              />
            </div>

            <div>
              <label style={labelStyle}>Année</label>
              <FilterSelect
                style={{ width: '100%', fontSize: '13px', padding: '9px 12px' }}
                value={yearFilter}
                onChange={(val) => setYearFilter(val)}
                disabled={activeTab === 'students' && !diplomaFilter}
                placeholder={activeTab === 'students' ? (diplomaFilter ? "Choisir l'année..." : "Sélectionner niveau") : "Toutes années"}
                options={activeTab === 'students'
                  ? [
                      { value: '', label: diplomaFilter ? "Choisir l'année..." : "Sélectionner niveau d'abord" }, 
                      ...availableYears.map(y => ({ value: y, label: y })),
                      ...(academicYearFilter !== operationalAcademicYear ? [{ label: "Lauréat (Diplômés)", value: "Lauréat" }] : [])
                    ]
                  : [{ value: '', label: 'Toutes années' }, ...availableYears.map(y => ({ value: y, label: y }))]
                }
              />
            </div>

            <div>
              <label style={labelStyle}>Filière</label>
              <FilterSelect
                style={{ width: '100%', fontSize: '13px', padding: '9px 12px' }}
                value={categoryFilter}
                onChange={(val) => setCategoryFilter(val)}
                disabled={activeTab === 'students' && !diplomaFilter}
                placeholder={activeTab === 'students' ? (diplomaFilter ? "Choisir la filière..." : "Sélectionner niveau") : "Toutes filières"}
                options={activeTab === 'students'
                  ? [{ value: '', label: diplomaFilter ? "Choisir la filière..." : "Sélectionner niveau d'abord" }, ...availableMajors.map(m => ({ value: m, label: m }))]
                  : [{ value: '', label: 'Toutes filières' }, ...availableMajors.map(m => ({ value: m, label: m }))]
                }
              />
            </div>

          </div>

          {activeTab === 'students' && !statusFilter && !(diplomaFilter && yearFilter && categoryFilter) ? (
            <div className="directory-filter-prompt" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 24px',
              textAlign: 'center',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-2xl)',
              border: '1px dashed var(--border-light)',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-6)'
            }}>
              <Filter size={48} style={{ color: 'var(--primary)', marginBottom: '16px', opacity: 0.8 }} />
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
                Sélectionnez vos filtres
              </h3>
              <p style={{ fontSize: '13px', maxWidth: '360px', lineHeight: '1.5' }}>
                Veuillez choisir un niveau, une année d'étude et une filière ci-dessus pour afficher la liste des stagiaires.
              </p>
            </div>
          ) : (
            <>
              <div className="directory-premium-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-6)' }}>
                {loading ? (
                  <TableSkeleton rows={8} />
                ) : (
                  <>
                    <AnimatePresence mode="popLayout">
                      {table.getRowModel().rows.map((row, idx) => (
                        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.03 } }} exit={{ opacity: 0, scale: 0.97 }} key={row.id} className="dashboard-grid-row">
                          {row.getVisibleCells().map(cell => <div key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>)}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {table.getRowModel().rows.length === 0 && (
                      <EmptyState title="Aucun résultat" message="Nous n'avons trouvé personne correspondant à vos filtres." icon="search" />
                    )}
                  </>
                )}
              </div>

              {table.getPageCount() > 1 && (
                <Pagination
                  currentPage={table.getState().pagination.pageIndex + 1}
                  totalPages={table.getPageCount()}
                  totalItems={table.getFilteredRowModel().rows.length}
                  itemsPerPage={table.getState().pagination.pageSize}
                  onPageChange={(p) => table.setPageIndex(p - 1)}
                  onItemsPerPageChange={(s) => table.setPageSize(s)}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Modal Section */}
      <AnimatePresence>
        {modalMode && (
          <div className="app-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div className="app-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)' }} onClick={closeModal}></motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-premium directory-premium-dialog app-modal-surface"
              style={{
                width: '100%',
                maxWidth: modalMode === 'add-teacher' || (modalMode === 'edit' && activeTab === 'teachers') ? '580px' :
                          modalMode === 'add-student' || (modalMode === 'edit' && activeTab === 'students') ? '540px' : '500px',
                padding: '20px',
                borderRadius: 'var(--radius-3xl)',
                position: 'relative',
                zIndex: 101,
                boxShadow: 'var(--shadow-xl)',
                maxHeight: '92vh',
                overflowY: 'auto'
              }}>
              
              <button onClick={closeModal} className="close-button" aria-label="Fermer la fenêtre" title="Fermer" style={{ position: 'absolute', right: '20px', top: '20px' }}>
                <X size={20} />
              </button>

              {modalMode === 'edit' && selectedItem && (
                <form onSubmit={handleUpdate}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>Modifier {activeTab === 'students' ? 'le stagiaire' : 'le formateur'}</h2>
                    {saveSuccess && <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} style={{ color: 'var(--success)', fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} /> Enregistré
                    </motion.span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {activeTab === 'students' ? (
                      <>
                        <div className="form-grid">
                          <div style={fGroup}>
                            <label style={lbl}>Nom</label>
                            <input required className="input-premium" value={editFormData.lastName || ''} onChange={e => setEditFormData({...editFormData, lastName: e.target.value})} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={lbl}>Prénom</label>
                            <input required className="input-premium" value={editFormData.firstName || ''} onChange={e => setEditFormData({...editFormData, firstName: e.target.value})} />
                          </div>
                        </div>
                        <div className="form-grid">
                          <div style={fGroup}>
                            <label style={lbl}>Niveau</label>
                            <FilterSelect value={editFormData.diploma || ''} onChange={val => setEditFormData({...editFormData, diploma: val, major: '', year: ''})} options={allDiplomas.map(d => ({ value: d, label: d }))} />
                          </div>
                          <div style={fGroup}>
                            <label style={lbl}>Année</label>
                            <FilterSelect value={editFormData.year || ''} onChange={val => setEditFormData({...editFormData, year: val})} options={(academicCatalog?.years?.[editFormData.diploma] || getStudyYearsForDiploma(editFormData.diploma)).map(year => ({ value: year, label: year }))} />
                          </div>
                        </div>
                        <div className="form-grid">
                          <div style={fGroup}>
                            <label style={lbl}>Filière</label>
                            <FilterSelect value={editFormData.major || ''} onChange={val => setEditFormData({...editFormData, major: val})} options={(academicCatalog?.filieres?.[editFormData.diploma] || FILIERES[editFormData.diploma] || []).map(f => ({ value: f, label: f }))} />
                          </div>
                          <div style={fGroup}>
                            <label style={lbl}>Matricule</label>
                            <input className="input-premium" value={editFormData.regNo || ''} onChange={e => setEditFormData({...editFormData, regNo: e.target.value})} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="form-grid">
                          <div style={fGroup}>
                            <label style={lbl}>Nom Complet</label>
                            <input required className="input-premium" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                          </div>
                          <div style={fGroup}>
                            <label style={lbl}>Tarif (DH)</label>
                            <input type="number" required className="input-premium" value={editFormData.hourlyRate || ''} onChange={e => setEditFormData({...editFormData, hourlyRate: parseFloat(e.target.value) || 0})} />
                          </div>
                        </div>
                        
                        <div className="form-grid">
                          <div style={fGroup}>
                            <label style={lbl}>Diplômes assignés</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {allDiplomas.map(dip => (
                                <SelectionTag key={dip} active={(editFormData.diplomas || []).includes(dip)} onClick={() => toggleDiplomaEdit(dip)} label={dip} />
                              ))}
                            </div>
                          </div>

                          <div style={fGroup}>
                            <label style={lbl}>Niveaux</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {Array.from(new Set((editFormData.diplomas || []).flatMap(diploma => academicCatalog?.years?.[diploma] || getStudyYearsForDiploma(diploma)))).map(y => (
                                <SelectionTag key={y} active={(editFormData.years || []).includes(y)} onClick={() => toggleYearEdit(y)} label={y} />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div style={fGroup}>
                          <label style={lbl}>Filières</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '75px', overflowY: 'auto', padding: '2px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-subtle)' }}>
                            {Array.from(new Set((editFormData.diplomas || []).flatMap(diploma => academicCatalog?.filieres?.[diploma] || FILIERES[diploma] || []))).map(f => (
                              <SelectionTag key={f} active={(editFormData.groups || []).includes(f)} onClick={() => toggleGroupEdit(f)} label={f} />
                            ))}
                          </div>
                        </div>

                        <div style={fGroup}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={lbl}>Modules ({ (editFormData.subjects || []).length })</label>
                            <input className="input-premium" style={{ height: '26px', fontSize: '11px', width: '130px' }} placeholder="Filtrer..." value={editModuleSearch} onChange={e => setEditModuleSearch(e.target.value)} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-subtle)', padding: '6px', borderRadius: 'var(--radius-xl)' }}>
                            {(editFormData.years || []).map(year => (
                              <div key={year}>
                                <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--primary)', marginBottom: '4px' }}>{year}</p>
                                {(editFormData.groups || []).map(filiere => {
                                  const currentYear = activeAcademicYear || operationalAcademicYear || '2025-2026';
                                  const yearModules = (allModules || []).filter(m => !m.academicYear || m.academicYear === currentYear);
                                  const sourceModules = yearModules.length > 0 ? yearModules : (allModules || []);
                                  const modules = Array.from(new Set(sourceModules.filter(m => 
                                    (editFormData.diplomas || []).includes(m.diploma) && 
                                    m.major === filiere && 
                                    m.year === year
                                  ).map(m => m.name).filter(Boolean)));
                                  const filtered = editModuleSearch ? modules.filter(m => m.toLowerCase().includes(editModuleSearch.toLowerCase())) : modules;
                                  if (filtered.length === 0) return null;
                                  return (
                                    <div key={filiere} style={{ marginBottom: '6px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <p style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)' }}>{filiere}</p>
                                        <button type="button" onClick={() => toggleFiliereAllEdit(year, filiere, filtered)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '9px', fontWeight: '800', cursor: 'pointer' }}>
                                          Inverse
                                        </button>
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                        {filtered.map(m => (
                                          <button type="button" key={m} onClick={() => toggleSubjectEdit(m)} style={{ 
                                            padding: '4px 8px', borderRadius: '6px', fontSize: '10px', border: 'none', cursor: 'pointer',
                                            background: (editFormData.subjects || []).includes(m) ? 'var(--primary)' : 'white',
                                            color: (editFormData.subjects || []).includes(m) ? 'white' : 'var(--text-secondary)'
                                          }}>{m}</button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="submit" disabled={isSaving} className="btn-modern primary" style={{ flex: 1, justifyContent: 'center' }}>
                      {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                </form>
              )}

              {modalMode === 'details' && selectedItem && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-xl)', background: 'var(--primary-ultra-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800' }}>
                      {(selectedItem.lastName || selectedItem.name || '?')[0]}
                    </div>
                    <div>
                      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '800' }}>{selectedItem.lastName ? `${selectedItem.lastName} ${selectedItem.firstName}` : selectedItem.name}</h2>
                      <span className={`badge-status ${isActiveStudent(selectedItem.__sourceStudent || selectedItem) ? 'success' : 'warning'}`}>
                        {getStudentStatusLabel(selectedItem.__sourceStudent || selectedItem)}
                        {selectedItem.isHistoricalSnapshot ? ` · classe ${selectedItem.academicYear}` : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '24px', borderTop: '1px solid var(--border-light)' }}>
                    <InfoBox label="ID / Matricule" value={selectedItem.regNo || selectedItem.id.substring(0,8)} icon={Fingerprint} />
                    <InfoBox label="Filière / Module" value={selectedItem.major || (selectedItem.subjects || []).join(', ')} icon={Book} />
                    <InfoBox label="Année" value={selectedItem.year || 'N/A'} icon={Calendar} />
                    <InfoBox label="Statut" value={getStudentStatusLabel(selectedItem.__sourceStudent || selectedItem)} icon={CheckCircle2} valueColor="var(--primary)" />
                  </div>
                  {activeTab === 'students' && isAdmin && (
                    <ClosureDecisionEditor key={selectedItem.id}
                      student={students.find(student => student.id === selectedItem.id) || selectedItem.__sourceStudent || selectedItem}
                      onSave={async correction => {
                        const updated = await updateStudentClosureDecision(correction);
                        const snapshot = getStudentAcademicSnapshot(updated, selectedItem.academicYear, operationalAcademicYear) || updated;
                        setSelectedItem({ ...snapshot, __sourceStudent: updated });
                      }} />
                  )}
                  {activeTab === 'students' ? (() => {
                    const tokenForLink = selectedItem.token || selectedItem.id;
                    const url = `${BASE}/results/${tokenForLink}`;
                    return (
                      <div style={{ marginTop: '24px', padding: '20px', background: 'var(--primary-ultra-light)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--primary-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <p style={{ fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }}>
                          <LinkIcon size={12} /> Lien d'accès
                        </p>
                        <div style={{ padding: '12px', background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                          <QRCodeSVG value={url} size={160} fgColor="var(--primary)" />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                          <input readOnly className="input-premium" style={{ flex: 1, fontSize: '11px', background: 'white' }} value={url} />
                          <button className="btn-modern primary" onClick={() => { navigator.clipboard.writeText(url); showToast('Copié !', 'success'); }}>
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })() : (() => {
                    const linkAtt   = `${BASE}/portal/${selectedItem.tokenAttendance}`;
                    const linkNotes = `${BASE}/portal/${selectedItem.tokenGrades}`;
                    return (
                      <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {[
                          { label: 'Absences', url: linkAtt, color: 'var(--primary)', bg: 'var(--primary-ultra-light)', border: 'var(--primary-light)' },
                          { label: 'Notes', url: linkNotes, color: '#a06208', bg: 'rgba(var(--accent-rgb), 0.1)', border: 'rgba(var(--accent-rgb), 0.3)' },
                        ].map(({ label, url, color, bg, border }) => (
                          <div key={label} style={{ padding: '16px', background: bg, borderRadius: 'var(--radius-xl)', border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <p style={{ fontSize: 'var(--text-xs)', fontWeight: '800', color, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }}>
                              <LinkIcon size={12} /> Lien — {label}
                            </p>
                            <div style={{ padding: '10px', background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                              <QRCodeSVG value={url} size={140} fgColor={color === 'var(--primary)' ? 'var(--primary)' : '#a06208'} />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                              <input readOnly className="input-premium" style={{ flex: 1, fontSize: '11px', background: 'white' }} value={url} />
                              <button className="btn-modern primary" style={{ background: color, borderColor: color }} onClick={() => { navigator.clipboard.writeText(url); showToast('Copié !', 'success'); }}>
                                <Copy size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {modalMode === 'add-student' && (
                <form onSubmit={handleAddStudentSubmit}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>Inscription Stagiaire</h2>
                  </div>
                  {addStudentForm.academicYear && addStudentForm.academicYear !== operationalAcademicYear && (
                    <div style={{ marginBottom: '16px', padding: '8px 12px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={14} style={{ color: '#ca8a04', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: '#854d0e', fontWeight: '600', lineHeight: 1.4 }}>
                        L'année <strong>{addStudentForm.academicYear}</strong> est archivée. Une confirmation sera demandée avant l'inscription.
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={fGroup}>
                      <label style={lbl}>Année académique d'inscription</label>
                      <FilterSelect
                        value={addStudentForm.academicYear}
                        onChange={val => setAddStudentForm({ ...addStudentForm, academicYear: val })}
                        options={Array.from(new Set([operationalAcademicYear, ...(availableAcademicYearsList || [])])).map(year => ({
                          value: year,
                          label: year === operationalAcademicYear ? `${year} — année active` : `${year} — archive`
                        }))}
                      />
                    </div>
                    <div className="form-grid">
                      <div style={fGroup}>
                        <label style={lbl}>Nom</label>
                        <input required className="input-premium" placeholder="Ex: ALAMI" value={addStudentForm.lastName} onChange={e => setAddStudentForm({...addStudentForm, lastName: e.target.value})} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={lbl}>Prénom</label>
                        <input required className="input-premium" placeholder="Ex: Omar" value={addStudentForm.firstName} onChange={e => setAddStudentForm({...addStudentForm, firstName: e.target.value})} />
                      </div>
                    </div>
                    <div className="form-grid">
                      <div style={fGroup}>
                        <label style={lbl}>Niveau</label>
                        <FilterSelect value={addStudentForm.diploma} onChange={val => setAddStudentForm({...addStudentForm, diploma: val, major: '', year: ''})} options={[{ value: '', label: 'Sélectionner...' }, ...allDiplomas.map(d => ({ value: d, label: d }))]} />
                      </div>
                      <div style={fGroup}>
                        <label style={lbl}>Année d'étude</label>
                        <FilterSelect value={addStudentForm.year} onChange={val => setAddStudentForm({...addStudentForm, year: val})} disabled={!addStudentForm.diploma} options={[{ value: '', label: 'Sélectionner...' }, ...(academicCatalog?.years?.[addStudentForm.diploma] || getStudyYearsForDiploma(addStudentForm.diploma)).map(year => ({ value: year, label: year }))]} />
                      </div>
                    </div>
                    <div className="form-grid">
                      <div style={fGroup}>
                        <label style={lbl}>Filière</label>
                        <FilterSelect value={addStudentForm.major} onChange={val => setAddStudentForm({...addStudentForm, major: val})} disabled={!addStudentForm.diploma} options={[{ value: '', label: 'Choisir...' }, ...(academicCatalog?.filieres?.[addStudentForm.diploma] || FILIERES[addStudentForm.diploma] || []).map(f => ({ value: f, label: f }))]} />
                      </div>
                      <div style={fGroup}>
                        <label style={lbl}>Matricule</label>
                        <input required className="input-premium" style={{ fontFamily: 'monospace' }} placeholder={`${institution?.studentIdPrefix || 'EFP'}-XXXX`} value={addStudentForm.regNo} onChange={e => setAddStudentForm({...addStudentForm, regNo: e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button type="submit" className="btn-modern primary" style={{ flex: 1, justifyContent: 'center' }}>
                      Inscrire le stagiaire
                    </button>
                  </div>
                </form>
              )}

              {modalMode === 'add-teacher' && (
                <form onSubmit={handleAddTeacherSubmit}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>Nouveau Formateur</h2>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-grid">
                      <div style={fGroup}>
                        <label style={lbl}>Nom Complet</label>
                        <input required className="input-premium" placeholder="Ex: Dr. ALAMI Mohamed" value={addTeacherForm.name} onChange={e => setAddTeacherForm({...addTeacherForm, name: e.target.value})} />
                      </div>
                      <div style={fGroup}>
                        <label style={lbl}>Tarif (DH)</label>
                        <input type="number" required className="input-premium" placeholder="150" value={addTeacherForm.hourlyRate || ''} onChange={e => setAddTeacherForm({...addTeacherForm, hourlyRate: parseFloat(e.target.value) || 0})} />
                      </div>
                    </div>
                    
                    <div className="form-grid">
                      <div style={fGroup}>
                        <label style={lbl}>Diplômes assignés</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {allDiplomas.map(dip => (
                            <SelectionTag key={dip} active={(addTeacherForm.diplomas || []).includes(dip)} onClick={() => toggleAddTeacherDiploma(dip)} label={dip} />
                          ))}
                        </div>
                      </div>

                      <div style={fGroup}>
                        <label style={lbl}>Niveaux d'enseignement</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {Array.from(new Set((addTeacherForm.diplomas || []).flatMap(diploma => academicCatalog?.years?.[diploma] || getStudyYearsForDiploma(diploma)))).map(y => (
                            <SelectionTag key={y} active={(addTeacherForm.years || []).includes(y)} onClick={() => toggleAddTeacherYear(y)} label={y} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={fGroup}>
                      <label style={lbl}>Filières assignées</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '75px', overflowY: 'auto', padding: '2px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-subtle)' }}>
                        {Array.from(new Set((addTeacherForm.diplomas || []).flatMap(diploma => academicCatalog?.filieres?.[diploma] || FILIERES[diploma] || []))).map(f => (
                          <SelectionTag key={f} active={(addTeacherForm.groups || []).includes(f)} onClick={() => toggleAddTeacherGroup(f)} label={f} />
                        ))}
                      </div>
                    </div>

                    <div style={fGroup}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={lbl}>Modules ({ (addTeacherForm.subjects || []).length })</label>
                        <input className="input-premium" style={{ height: '26px', fontSize: '11px', width: '130px' }} placeholder="Filtrer..." value={addTeacherModuleSearch} onChange={e => setAddTeacherModuleSearch(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-subtle)', padding: '6px', borderRadius: 'var(--radius-xl)' }}>
                        {(addTeacherForm.years || []).sort().map(year => (
                          <div key={year}>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--primary)', marginBottom: '4px' }}>{year}</p>
                            {(addTeacherForm.groups || []).map(filiere => {
                              const currentYear = activeAcademicYear || operationalAcademicYear || '2025-2026';
                              const yearModules = (allModules || []).filter(m => !m.academicYear || m.academicYear === currentYear);
                              const sourceModules = yearModules.length > 0 ? yearModules : (allModules || []);
                              const modules = Array.from(new Set(sourceModules.filter(m => 
                                (addTeacherForm.diplomas || []).includes(m.diploma) && 
                                m.major === filiere && 
                                m.year === year
                              ).map(m => m.name).filter(Boolean)));
                              const filtered = addTeacherModuleSearch ? modules.filter(m => m.toLowerCase().includes(addTeacherModuleSearch.toLowerCase())) : modules;
                              if (filtered.length === 0) return null;
                              return (
                                <div key={filiere} style={{ marginBottom: '6px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <p style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)' }}>{filiere}</p>
                                    <button type="button" onClick={() => toggleFiliereAllAdd(year, filiere, filtered)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '9px', fontWeight: '800', cursor: 'pointer' }}>
                                      Inverse
                                    </button>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                    {filtered.map(m => (
                                      <button type="button" key={m} onClick={() => toggleAddTeacherSubject(m)} style={{ 
                                        padding: '4px 8px', borderRadius: '6px', fontSize: '10px', border: 'none', cursor: 'pointer',
                                        background: (addTeacherForm.subjects || []).includes(m) ? 'var(--primary)' : 'white',
                                        color: (addTeacherForm.subjects || []).includes(m) ? 'white' : 'var(--text-secondary)'
                                      }}>{m}</button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button type="submit" className="btn-modern primary" style={{ flex: 1, justifyContent: 'center' }}>
                      Enregistrer le formateur
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrModal && (
          <div className="app-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="app-modal-backdrop"
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
              onClick={closeQR} />
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="glass-premium directory-premium-dialog app-modal-surface"
              style={{ width: '100%', maxWidth: '380px', padding: '28px', borderRadius: 'var(--radius-3xl)', position: 'relative', zIndex: 201, boxShadow: 'var(--shadow-xl)' }}
            >
              <button onClick={closeQR} className="close-button" aria-label="Fermer le QR code" title="Fermer" style={{ position: 'absolute', right: '18px', top: '18px' }}>
                <X size={20} />
              </button>

              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '4px' }}>
                QR Code
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', fontWeight: '600' }}>
                {qrModal.title}
              </p>

              {qrModal.links.map(({ label, url, color }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  {qrModal.links.length > 1 && (
                    <span style={{ fontSize: '11px', fontWeight: '800', color, textTransform: 'uppercase', letterSpacing: '0.07em', alignSelf: 'flex-start' }}>
                      {label}
                    </span>
                  )}
                  <div style={{ padding: '14px', background: 'white', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-light)' }}>
                    <QRCodeSVG value={url} size={180} fgColor={color === 'var(--primary)' ? 'var(--primary)' : (color || 'var(--primary)')} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <input
                      readOnly
                      className="input-premium"
                      style={{ flex: 1, fontSize: '10px', background: 'var(--bg-subtle)', fontFamily: 'monospace' }}
                      value={url}
                    />
                    <button
                      className="btn-modern primary"
                      onClick={() => { navigator.clipboard.writeText(url); showToast('Lien copié !', 'success'); }}
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Copy size={14} /> Copier
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {promotionModalOpen && (
          <div className="app-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <motion.div className="app-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.28)', backdropFilter: 'blur(4px)' }} onClick={() => { setPromotionModalOpen(false); setPromotionResult(null); }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }} className="glass-premium directory-premium-dialog app-modal-surface"
              style={{ width: '100%', maxWidth: '780px', padding: '30px', borderRadius: 'var(--radius-3xl)', position: 'relative', zIndex: 101, boxShadow: 'var(--shadow-xl)', maxHeight: '90vh', overflowY: 'auto' }}>
              <button onClick={() => { setPromotionModalOpen(false); setPromotionResult(null); }} className="close-button" aria-label="Fermer la fenetre" title="Fermer" style={{ position: 'absolute', right: '20px', top: '20px' }}>
                <X size={20} />
              </button>

              {/* Improvement #4: Post-closure summary */}
              {promotionResult ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '16px', background: 'rgba(34,197,94,0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle size={22} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900', color: 'var(--text-primary)' }}>Cl&ocirc;ture termin&eacute;e</h2>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>L&apos;ann&eacute;e {promotionForm.fromAcademicYear} a &eacute;t&eacute; cl&ocirc;tur&eacute;e avec succ&egrave;s.</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
                    <InfoBox label="Promus" value={promotionResult.promotedCount} icon={ArrowRight} valueColor="var(--primary)" />
                    <InfoBox label={'Laur\u00e9ats'} value={promotionResult.graduatedCount} icon={GraduationCap} valueColor="#a16207" />
                    <InfoBox label="Redoublants" value={promotionResult.repeatedCount} icon={RotateCw} valueColor="var(--warning)" />
                    <InfoBox label="Abandons" value={promotionResult.withdrawnCount} icon={UsersIcon} valueColor="var(--text-muted)" />
                    <InfoBox label="Total" value={promotionResult.promotedCount + promotionResult.graduatedCount + promotionResult.repeatedCount + promotionResult.withdrawnCount} icon={UsersIcon} valueColor="var(--success)" />
                  </div>

                  {/* Improvement #7: Breakdown by filière */}
                  {promotionResult.breakdown && Object.keys(promotionResult.breakdown).length > 0 && (
                    <div style={{ marginBottom: '18px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>D&eacute;tail par fili&egrave;re</p>
                      <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr)', gap: '0', padding: '8px 12px', background: 'var(--bg-subtle)', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <span>Fili&egrave;re</span><span style={{ textAlign: 'center' }}>Promus</span><span style={{ textAlign: 'center' }}>Laur&eacute;ats</span><span>Redoubl.</span><span>Abandons</span>
                        </div>
                        {Object.entries(promotionResult.breakdown).map(([filiere, counts]) => (
                          <div key={filiere} style={{ display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr)', padding: '8px 12px', borderTop: '1px solid var(--border-light)', fontSize: '12px', fontWeight: '600' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{filiere}</span>
                            <span style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: '800' }}>{counts.promoted || 0}</span>
                            <span style={{ textAlign: 'center', color: '#a16207', fontWeight: '800' }}>{counts.graduated || 0}</span>
                            <span style={{ textAlign: 'center' }}>{counts.repeated || 0}</span>
                            <span style={{ textAlign: 'center' }}>{counts.withdrawn || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-xl)', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', color: '#166534', fontSize: '12px', fontWeight: '700', lineHeight: 1.6, marginBottom: '20px' }}>
                    Sauvegarde compl&egrave;te cr&eacute;&eacute;e avant la cl&ocirc;ture ({promotionResult.backupDocumentCount || 0} documents). L&apos;ann&eacute;e reste disponible dans les archives.
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    {/* Improvement #6: Undo button */}
                    <button type="button" className="btn-modern" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#dc2626' }} disabled={isPromotingAcademicYear} onClick={handleUndoPromotion}>
                      <Undo2 size={14} /> Annuler la cl&ocirc;ture
                    </button>
                    <button type="button" className="btn-modern primary" style={{ flex: 2 }} onClick={() => { setPromotionModalOpen(false); setPromotionResult(null); }}>Fermer</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '16px', background: 'rgba(15,23,42,0.06)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GraduationCap size={22} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900', color: 'var(--text-primary)' }}>Cl&ocirc;turer l&apos;ann&eacute;e scolaire</h2>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>Passage, lauréat, redoublement ou abandon selon vos décisions.</p>
                    </div>
                  </div>

                  {/* Improvement #5: Read-only year fields */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Ann&eacute;e cl&ocirc;tur&eacute;e</label>
                      <div className="input-premium" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', cursor: 'default', fontWeight: '800', color: 'var(--text-primary)' }}>{promotionForm.fromAcademicYear}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Nouvelle ann&eacute;e</label>
                      <div className="input-premium" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', cursor: 'default', fontWeight: '800', color: 'var(--text-primary)' }}>{promotionForm.toAcademicYear}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
                    <InfoBox label="Promus" value={promotionPreview.promoted} icon={ArrowRight} valueColor="var(--primary)" />
                    <InfoBox label={'Laur\u00e9ats'} value={promotionPreview.graduated} icon={GraduationCap} valueColor="#a16207" />
                    <InfoBox label="Redoublants" value={promotionPreview.repeated} icon={RotateCw} valueColor="var(--warning)" />
                    <InfoBox label="Abandons" value={promotionPreview.withdrawn} icon={UsersIcon} valueColor="var(--text-muted)" />
                    <InfoBox label="Sans décision" value={promotionPreview.pending} icon={UsersIcon} valueColor="var(--danger)" />
                  </div>

                  <ClosureDecisions students={promotionPreview.eligible} decisions={promotionDecisions}
                    onChange={setPromotionDecisions} disabled={isPromotingAcademicYear} />
                  {/* Improvement #7: Breakdown by filière in preview */}
                  {Object.keys(promotionPreview.filiereBreakdown).length > 0 && (
                    <div style={{ marginBottom: '18px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>D&eacute;tail par fili&egrave;re</p>
                      <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr)', gap: '0', padding: '8px 12px', background: 'var(--bg-subtle)', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <span>Fili&egrave;re</span><span style={{ textAlign: 'center' }}>Promus</span><span style={{ textAlign: 'center' }}>Laur&eacute;ats</span><span>Redoubl.</span><span>Abandons</span>
                        </div>
                        {Object.entries(promotionPreview.filiereBreakdown).map(([filiere, counts]) => (
                          <div key={filiere} style={{ display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr)', padding: '8px 12px', borderTop: '1px solid var(--border-light)', fontSize: '12px', fontWeight: '600' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{filiere}</span>
                            <span style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: '800' }}>{counts.promoted || 0}</span>
                            <span style={{ textAlign: 'center', color: '#a16207', fontWeight: '800' }}>{counts.graduated || 0}</span>
                            <span style={{ textAlign: 'center' }}>{counts.repeated || 0}</span>
                            <span style={{ textAlign: 'center' }}>{counts.withdrawn || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-xl)', background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)', color: '#075985', fontSize: '12px', fontWeight: '700', lineHeight: 1.6, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={16} style={{ flexShrink: 0 }} />
                    Une sauvegarde compl&egrave;te et v&eacute;rifi&eacute;e sera cr&eacute;&eacute;e avant toute modification. En cas d&apos;&eacute;chec, la cl&ocirc;ture sera bloqu&eacute;e.
                  </div>

                  <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-xl)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', color: '#92400e', fontSize: '12px', fontWeight: '700', lineHeight: 1.6, marginBottom: '24px' }}>
                    Passage inscrit au niveau suivant ; Lauréat termine la formation. Les redoublants gardent leur niveau dans la nouvelle année. Les abandons restent consultables dans les archives, avec leurs notes, relevés et historique.
                  </div>

                  {/* Improvement #2: Disable button when invalid */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" className="btn-modern primary" style={{ flex: 1, justifyContent: 'center' }} disabled={isPromotingAcademicYear || promotionPreview.total === 0 || promotionPreview.pending > 0 || !isYearFormatValid} onClick={handlePromoteAcademicYear}>
                      {isPromotingAcademicYear ? 'Sauvegarde et cl\u00f4ture en cours...' : "Confirmer la cl\u00f4ture"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Helper Components ── */
const StatCard = ({ delay, icon: Icon, tone = 'primary', value, label, detail }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className={`dashboard-metric dashboard-metric-${tone}`}
  >
    <div className="dashboard-metric-top">
      <h3>{label}</h3>
      <span className="dashboard-metric-icon" aria-hidden="true">
        <Icon size={23} strokeWidth={1.8} />
      </span>
    </div>
    <p className="dashboard-metric-value">{value}</p>
    <div className="dashboard-metric-footer">
      <span aria-hidden="true" />
      <p>{detail}</p>
    </div>
  </motion.div>
);

const ActionBtn = ({ disabled, icon: Icon, title, onClick, color = 'var(--text-muted)' }) => (
  <button disabled={disabled} onClick={onClick} title={title} className="action-btn"
    style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Icon size={16} />
  </button>
);

const InfoBox = ({ label, value, icon: Icon, valueColor = 'var(--text-secondary)' }) => (
  <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xl)', position: 'relative' }}>
    <Icon size={14} style={{ position: 'absolute', right: '16px', top: '16px', color: 'var(--text-faint)' }} />
    <p style={{ fontSize: 'var(--text-xs)', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</p>
    <p style={{ fontSize: 'var(--text-sm)', fontWeight: '700', color: valueColor, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
  </div>
);

const SelectionTag = ({ active, label, onClick }) => (
  <button type="button" onClick={onClick} style={{
    padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '10px', fontWeight: '800', transition: 'all 0.2s', cursor: 'pointer',
    background: active ? 'var(--primary)' : 'var(--bg-subtle)',
    color: active ? 'white' : 'var(--text-muted)',
    border: `1px solid ${active ? 'var(--primary)' : 'var(--border-light)'}`,
    boxShadow: active ? 'var(--shadow-sm)' : 'none'
  }}>{label}</button>
);

const fGroup = { display: 'flex', flexDirection: 'column', gap: '4px' };
const lbl = { fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' };

export default AdminDashboard;
