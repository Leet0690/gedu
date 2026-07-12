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
import { getStudentGradeModules } from '../utils/gradeSync';
import {
  ALL_STUDY_YEARS,
  FILIERES,
  getClassCode,
  getModulesForStudent,
  getModulesForFiliere,
  getNextStudyYear,
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
import {
  STUDENT_STATUS,
  getDefaultAcademicYearTransition,
  getStudentStatusLabel,
  isActiveStudent,
  isLaureatStudent,
  validateAcademicYearTransition,
  hasExistingClosure
} from '../utils/studentStatus';
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
  Layers,
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
  BarChart3
} from 'lucide-react';

const labelStyle = { fontSize: 'var(--text-xs)', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '2px' };
const selectStyle = { cursor: 'pointer', paddingRight: '36px' };

const getGroupAbbreviation = (filiere, annee) => getClassCode('', filiere, annee);

const DASH_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const getTodayFrench = () => {
  const jsDay = new Date().getDay();
  return DASH_DAYS[jsDay === 0 ? 6 : jsDay - 1];
};

const formatRelativeTime = (timestamp) => {
  const diff = Date.now() - timestamp;
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
  if (lower.includes('formation continue')) return { icon: GraduationCap, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' };
  if (message.includes('stagiaire') && message.includes('ajouté')) return { icon: UserPlus, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' };
  if (message.includes('formateur') && message.includes('ajouté')) return { icon: UserPlus, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' };
  if (message.includes('supprimé') || message.includes('supprimée')) return { icon: Trash2, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' };
  if (message.includes('mis à jour') || message.includes('mise à jour')) return { icon: Edit3, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  if (message.includes('Notes') || message.includes('notes')) return { icon: FileText, color: 'var(--primary)', bg: 'var(--primary-ultra-light)' };
  if (message.includes('Séance') || message.includes('séance')) return { icon: Calendar, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' };
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
                    {session.displayModule || 'Module non dÃ©fini'}
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

const ActivityFeedWidget = ({ notifications }) => {
  const [visibleCount, setVisibleCount] = useState(10);
  const recent = useMemo(() => {
    return (notifications || []).filter(n => !n.message.includes('Accès Direction autorisé'));
  }, [notifications]);
  const visibleActivities = useMemo(() => recent.slice(0, visibleCount), [recent, visibleCount]);
  const hasMoreActivities = visibleCount < recent.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
      className="glass-card home-widget home-widget-tall home-widget-activity"
    >
      <div className="home-widget-header">
        <div className="home-widget-heading">
          <div className="home-widget-icon home-tone-indigo">
            <Activity size={14} />
          </div>
          <div>
            <span className="home-widget-title">
              Activité récente
            </span>
            <p className="home-widget-subtitle">Dernières actions</p>
          </div>
        </div>
      </div>

      {recent.length === 0 ? (
        <div className="home-widget-empty">
          <Bell size={28} className="home-widget-empty-icon" />
          <p>Aucune activité récente</p>
        </div>
      ) : (
        <div className="home-widget-list home-activity-list">
          {visibleActivities.map((notif) => {
            const { icon: Icon, tone } = getActivityVisual(notif.message);
            return (
              <div
                key={notif.id}
                className={`home-activity-item ${notif.read ? '' : 'home-activity-item-unread'}`}
              >
                <div className={`home-activity-icon home-tone-${tone}`}>
                  <Icon size={13} />
                </div>
                <div className="home-activity-content">
                  <p className="home-activity-message">
                    {notif.message}
                  </p>
                </div>
                <span className="home-activity-time">
                  {formatRelativeTime(notif.timestamp)}
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

const PendingTasksWidget = ({ students, teachers, grades, teacherAttendance, allModules, activeSemester }) => {
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
      const configuredModules = (allModules || [])
        .filter(m => m.diploma === diploma && m.major === major && m.year === year && [activeSemester, 'Annuel'].includes(m.semester || 'S1'))
        .map(m => m.name);
      const mods = configuredModules.length > 0 ? configuredModules : getModulesForFiliere(diploma, major, year);
      if (mods.length === 0) return;
      let entered = 0;
      const total = gs.length * mods.length;
      gs.forEach(s => {
        mods.forEach(m => {
          const g = grades[s.id]?.[m.replace(/\./g, '_')];
          if (g && (g.c1 || g.c2 || g.c3 || g.efcfp || g.efcft)) entered++;
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
  }, [students, teachers, grades, teacherAttendance, allModules, activeSemester]);

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

const GradesBreakdownWidget = ({ students, grades, allModules, activeSemester }) => {
  const groups = useMemo(() => {
    const map = {};
    (students || []).forEach(s => {
      if (!s.diploma || !s.major || !s.year) return;
      const key = `${s.diploma}||${s.major}||${s.year}`;
      if (!map[key]) map[key] = { diploma: s.diploma, major: s.major, year: s.year, count: 0, total: 0, entered: 0 };
      const g = map[key];
      g.count++;
      const configuredModules = (allModules || [])
        .filter(m => m.diploma === s.diploma && m.major === s.major && m.year === s.year && [activeSemester, 'Annuel'].includes(m.semester || 'S1'))
        .map(m => m.name);
      const mods = configuredModules.length > 0 ? configuredModules : getModulesForStudent(s);
      g.total += mods.length;
      mods.forEach(m => {
        const gr = grades[s.id]?.[m.replace(/\./g, '_')];
        if (gr && (gr.c1 || gr.c2 || gr.c3 || gr.efcfp || gr.efcft)) g.entered++;
      });
    });
    return Object.values(map).map(g => ({
      ...g,
      label: getGroupAbbreviation(g.major, g.year),
      pct: g.total > 0 ? Math.round((g.entered / g.total) * 100) : 0,
    })).sort((a, b) => a.pct - b.pct);
  }, [students, grades, allModules, activeSemester]);

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
    return { bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.02) 100%)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.2)' };
  }
  if (normalized.includes('mar')) {
    return { bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)', text: '#059669', border: 'rgba(16, 185, 129, 0.2)' };
  }
  if (normalized.includes('mer')) {
    return { bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)', text: '#d97706', border: 'rgba(245, 158, 11, 0.2)' };
  }
  if (normalized.includes('jeu')) {
    return { bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.2)' };
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

const ScheduleCalendar = ({ realSchedules, teachers, activeSemester, setActiveSemester, getScheduleModule }) => {
  const diplomas = useMemo(() => Object.keys(FILIERES), []);
  const defaultDiploma = diplomas.includes('Technicien Spécialisé') ? 'Technicien Spécialisé' : diplomas[0];
  const [selectedDiploma, setSelectedDiploma] = useState(defaultDiploma);

  const availableFilieres = useMemo(() => FILIERES[selectedDiploma] || [], [selectedDiploma]);
  const [selectedFiliere, setSelectedFiliere] = useState(() => {
    const defaultFilieres = FILIERES[defaultDiploma] || [];
    return defaultFilieres.includes('Développement Informatique') ? 'Développement Informatique' : defaultFilieres[0];
  });

  const availableStudyYears = useMemo(() => getStudyYearsForDiploma(selectedDiploma), [selectedDiploma]);
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
                const nextFiliere = (FILIERES[val] || [])[0] || '';
                setSelectedDiploma(val); 
                setSelectedFiliere(nextFiliere);
                setSelectedAnnee(getStudyYearsForDiploma(val)[0]);
              }} 
              options={diplomas.map(d => ({ label: d, value: d }))} 
            />
            <FilterSelect 
              className="home-filter-select home-filter-select-major" 
              value={selectedFiliere} 
              onChange={val => { 
                setSelectedFiliere(val); 
                setSelectedAnnee(getStudyYearsForDiploma(selectedDiploma)[0]); 
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
              color: 'rgba(176, 104, 185, 0.09)',
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
  const { students, teachers, grades, schedules, modules: allModules, addStudent, addTeacher, deleteStudent, deleteTeacher, updateStudent, promoteAcademicYear, undoLastPromotion, updateTeacher, studentAttendance, teacherAttendance, loadStudentAttendanceForMonth, loadTeacherAttendanceForMonth, migrateTeacherTokens, loading, confirmAction, notifications, activeSemester, setActiveSemester, getActiveScheduleModule } = useApp();
  const { showToast } = useToast();
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  // Load attendance data for the current month on mount
  useEffect(() => {
    const now = new Date();
    loadStudentAttendanceForMonth(now.getMonth(), now.getFullYear());
    loadTeacherAttendanceForMonth(now.getMonth(), now.getFullYear());
  }, [loadStudentAttendanceForMonth, loadTeacherAttendanceForMonth]);
  
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
  const [diplomaFilter, setDiplomaFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  // Modal state
  const [modalMode, setModalMode] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editModuleSearch, setEditModuleSearch] = useState('');
  
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [promotionForm, setPromotionForm] = useState(() => getDefaultAcademicYearTransition());
  const [isPromotingAcademicYear, setIsPromotingAcademicYear] = useState(false);
  const [promotionResult, setPromotionResult] = useState(null);

  // Add student & teacher form states and helper handlers
  const [addStudentForm, setAddStudentForm] = useState({
    firstName: '', lastName: '', major: '', regNo: '', diploma: '', year: ''
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
      const allowedYears = getStudyYearsForDiplomas(newDiplomas);
      const allowedGroups = new Set(newDiplomas.flatMap(diploma => FILIERES[diploma] || []));
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
      const trimmedData = {
        ...addStudentForm,
        firstName: addStudentForm.firstName.trim(),
        lastName: addStudentForm.lastName.trim()
      };
      await addStudent(trimmedData);
      showToast('Stagiaire inscrit avec succès.', 'success');
      setAddStudentForm({ firstName: '', lastName: '', major: '', regNo: '', diploma: '', year: '' });
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

  const BASE = 'https://portail-ipfp.web.app';

  const activeStudents = useMemo(() => (students || []).filter(isActiveStudent), [students]);
  const promotionPreview = useMemo(() => {
    const eligible = activeStudents.filter(s => isKnownStudyYear(s.diploma, s.year));
    // Improvement #7: Build breakdown by filière
    const filiereBreakdown = {};
    eligible.forEach(s => {
      const key = `${s.diploma || 'N/A'} - ${s.major || 'N/A'}`;
      if (!filiereBreakdown[key]) filiereBreakdown[key] = { promoted: 0, graduated: 0 };
      if (getNextStudyYear(s.diploma, s.year)) filiereBreakdown[key].promoted++;
      else filiereBreakdown[key].graduated++;
    });
    return {
      promoted: eligible.filter(s => getNextStudyYear(s.diploma, s.year)).length,
      graduated: eligible.filter(s => !getNextStudyYear(s.diploma, s.year)).length,
      total: eligible.length,
      filiereBreakdown,
    };
  }, [activeStudents]);
  const isYearFormatValid = useMemo(() => validateAcademicYearTransition(promotionForm.fromAcademicYear, promotionForm.toAcademicYear), [promotionForm]);
  const isAlreadyClosed = useMemo(() => hasExistingClosure(activeStudents, promotionForm.fromAcademicYear), [activeStudents, promotionForm.fromAcademicYear]);

  const allDiplomas = useMemo(() => Object.keys(FILIERES), []);
  const availableYears = useMemo(
    () => diplomaFilter ? getStudyYearsForDiploma(diplomaFilter) : ALL_STUDY_YEARS,
    [diplomaFilter]
  );
  const availableMajors = useMemo(() => {
    if (!diplomaFilter) return Array.from(new Set(Object.values(FILIERES).flat()));
    return FILIERES[diplomaFilter] || [];
  }, [diplomaFilter]);
  const getStudentActiveModules = useCallback((student) => {
    const configuredModules = getStudentGradeModules(allModules || [], student);
    return configuredModules.length > 0 ? configuredModules : getModulesForStudent(student);
  }, [allModules]);

  // Edit helper functions
  const toggleDiplomaEdit = (dip) => {
    setEditFormData(prev => {
      const currentDiplomas = prev.diplomas || (prev.diploma ? [prev.diploma] : []);
      const isSelected = currentDiplomas.includes(dip);
      const newDiplomas = isSelected ? currentDiplomas.filter(d => d !== dip) : [...currentDiplomas, dip];
      const allowedYears = getStudyYearsForDiplomas(newDiplomas);
      const allowedGroups = new Set(newDiplomas.flatMap(diploma => FILIERES[diploma] || []));
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
    if (!isYearFormatValid) {
      showToast('Format d\u2019ann\u00e9e invalide.', 'error');
      return;
    }
    if (isAlreadyClosed) {
      showToast(`L\u2019ann\u00e9e ${promotionForm.fromAcademicYear} a d\u00e9j\u00e0 \u00e9t\u00e9 cl\u00f4tur\u00e9e.`, 'error');
      return;
    }

    const confirmed = await confirmAction({
      title: "Cl\u00f4turer l'ann\u00e9e scolaire ?",
      message: `${promotionPreview.graduated} stagiaire(s) en fin de cycle deviendront lauréats et ${promotionPreview.promoted} stagiaire(s) passeront à l'année suivante. Les prochains numéros de reçus recommenceront à FD0001 pour les paiements et F0001 pour les formateurs.`,
      type: 'warning'
    });
    if (!confirmed) return;

    setIsPromotingAcademicYear(true);
    try {
      const result = await promoteAcademicYear({
        fromAcademicYear: promotionForm.fromAcademicYear,
        toAcademicYear: promotionForm.toAcademicYear,
      });
      if (result.error) return;
      setPromotionResult(result);
    } catch (err) {
      console.error(err);
      showToast("Erreur pendant la cl\u00f4ture de l'ann\u00e9e scolaire.", 'error');
    } finally {
      setIsPromotingAcademicYear(false);
    }
  }, [confirmAction, promoteAcademicYear, promotionForm, promotionPreview, isYearFormatValid, isAlreadyClosed, showToast]);

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
      if (activeTab === 'students') return `"${item.lastName}","${item.firstName}","${item.regNo}","${item.diploma || ''}","${item.major}","${item.year || ''}","ACTIF"`;
      return `"${item.name || ''}","${item.subject || ''}","ACTIF"`;
    }).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `IPFP_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast('Exportation réussie', 'success');
  };

  const tableData = useMemo(() => {
    let data = activeTab === 'students' ? (students || []) : (teachers || []);
    if (diplomaFilter) data = data.filter(item => activeTab === 'students' ? item.diploma === diplomaFilter : (item.diplomas || []).includes(diplomaFilter));
    if (yearFilter) data = data.filter(item => activeTab === 'students' ? item.year === yearFilter : (item.years || []).includes(yearFilter));
    if (categoryFilter) data = data.filter(item => activeTab === 'students' ? item.major === categoryFilter : (item.groups || []).includes(categoryFilter));
    if (activeTab === 'teachers' && moduleFilter) data = data.filter(item => (item.subjects || [item.subject]).includes(moduleFilter));
    return data;
  }, [activeTab, students, teachers, categoryFilter, diplomaFilter, yearFilter, moduleFilter]);

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
            <span className="badge-status success" style={{ fontSize: '9px' }}>ACTIF</span>
            <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
              {activeTab === 'students' ? row.original.major : (row.original.subjects || [row.original.subject]).slice(0, 2).join(', ')}
            </span>
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
                <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'rgba(254,205,8,0.1)', color: '#a06208', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
          <ActionBtn icon={Edit3} title="Modifier" onClick={() => openEdit(row.original)} />
          {activeTab === 'students' && <ActionBtn icon={Download} title="Bulletin" onClick={() => generateBulletinGlobal(row.original, grades, getStudentActiveModules(row.original))} />}
          <ActionBtn icon={Trash2} title="Supprimer" color="#dc2626" onClick={() => handleDelete(row.original)} />
        </div>
      ),
    },
  ], [activeTab, openDetails, openEdit, handleDelete, grades, getStudentActiveModules]);

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

  const studentAttendanceRate = useMemo(() => {
    if (!studentAttendance || studentAttendance.length === 0) return null;
    const presents = studentAttendance.filter(a => a.status === 'present').length;
    return Math.round((presents / studentAttendance.length) * 100);
  }, [studentAttendance]);

  const teacherAttendanceRate = useMemo(() => {
    if (!teacherAttendance || teacherAttendance.length === 0) return null;
    const presents = teacherAttendance.filter(a => a.status === 'present').length;
    return Math.round((presents / teacherAttendance.length) * 100);
  }, [teacherAttendance]);

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
              Gestion du personnel et des apprenants
            </p>
          </div>
          <div className="directory-premium-header-actions">
            {activeTab === 'students' && (
              <button className="btn-modern" style={{ background: 'rgba(15,23,42,0.04)', color: 'var(--text-primary)' }} onClick={() => setPromotionModalOpen(true)}>
                <GraduationCap size={14} style={{ marginRight: '6px' }} /> Cl&ocirc;turer l&apos;ann&eacute;e
              </button>
            )}
            {activeTab === 'students' && (
              <button className="btn-modern primary" style={{ background: '#6366f1' }} onClick={async () => {
                if (await confirmAction({ 
                  title: "Régénérer les liens ?", 
                  message: "Voulez-vous regénérer tous les liens des stagiaires ?",
                  type: "warning"
                })) {
                  // Logic handled in AppContext usually, but here for demo
                  showToast("Liens régénérés !", 'success');
                }
              }}>
                <RotateCw size={14} style={{ marginRight: '6px' }} /> Régénérer
              </button>
            )}
            <button onClick={() => setModalMode(activeTab === 'students' ? 'add-student' : 'add-teacher')} className="btn-modern primary">
              <Plus size={14} style={{ marginRight: '6px' }} /> Ajouter
            </button>
          </div>
          <div className="directory-premium-header-orb" aria-hidden="true">
            {activeTab === 'students' ? <GraduationCap size={112} /> : <Presentation size={112} />}
          </div>
        </div>
      )}

      {isDashboard && (
        <div className="home-dashboard-stack">
          <div className="home-premium-hero">
            <div className="home-premium-hero-icon">
              <BarChart3 size={24} />
            </div>
            <div className="home-premium-hero-copy">
              <span className="home-premium-hero-eyebrow">Vue d'ensemble</span>
              <h1>Tableau de bord</h1>
              <p>Suivez l'activité académique, les présences et les actions prioritaires.</p>
            </div>
            <div className="home-premium-hero-badges">
              <span><Calendar size={12} /> {currentMonthName}</span>
              <span><Layers size={12} /> {activeSemester || 'Semestre actif'}</span>
            </div>
            <div className="home-premium-hero-orb" aria-hidden="true">
              <GraduationCap size={58} />
            </div>
          </div>

          <div className="home-stats-grid">
            <StatCard delay={0.05} icon={UsersIcon} tone="primary" value={(students || []).length} label="Total Stagiaires" />
            <StatCard delay={0.1} icon={Presentation} tone="warning" value={(teachers || []).length} label="Total Formateurs" />
            <StatCard delay={0.15} icon={CalendarCheck} tone="success" value={studentAttendanceRate === null ? '—' : `${studentAttendanceRate}%`} label={`Présence Stagiaires — ${currentMonthName}`} />
            <StatCard delay={0.2} icon={BarChart3} tone="info" value={teacherAttendanceRate === null ? '—' : `${teacherAttendanceRate}%`} label={`Présence Formateurs — ${currentMonthName}`} />
          </div>

          {/* New Requested Order in Grid format to keep dimensions */}
          <div className="home-dashboard-widget-grid">
            <TodaySessionsWidget schedules={schedules || []} teachers={teachers || []} getScheduleModule={getActiveScheduleModule} activeSemester={activeSemester} setActiveSemester={setActiveSemester} />
            <GradesBreakdownWidget students={students || []} grades={grades || {}} allModules={allModules || []} activeSemester={activeSemester} />
          </div>

          <div className="home-dashboard-widget-grid">
            <PendingTasksWidget students={students || []} teachers={teachers || []} grades={grades || {}} teacherAttendance={teacherAttendance || []} allModules={allModules || []} activeSemester={activeSemester} />
            <ActivityFeedWidget notifications={notifications || []} />
          </div>

          <ScheduleCalendar realSchedules={schedules || []} teachers={teachers || []} activeSemester={activeSemester} setActiveSemester={setActiveSemester} getScheduleModule={getActiveScheduleModule} />
        </div>
      )}

      {!isDashboard && (
        <>
          <div className="glass-card directory-premium-filter-card" style={{ display: 'flex', alignItems: 'end', gap: 'var(--space-3)', flexWrap: 'wrap', padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 240px' }}>
              <label style={labelStyle}>Recherche</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ color: 'var(--text-faint)', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input className="input-premium" style={{ width: '100%', paddingLeft: '36px', fontSize: '13px' }} placeholder="Rechercher…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 150px' }}>
              <label style={labelStyle}>Niveau</label>
              <FilterSelect
                style={{ width: '100%', fontSize: '13px', padding: '9px 12px' }}
                value={diplomaFilter}
                onChange={(val) => { setDiplomaFilter(val); setCategoryFilter(''); setYearFilter(''); }}
                placeholder={activeTab === 'students' ? "Choisir le niveau..." : "Tous niveaux"}
                options={activeTab === 'students'
                  ? [{ value: '', label: 'Choisir le niveau...' }, ...allDiplomas.map(d => ({ value: d, label: d }))]
                  : [{ value: '', label: 'Tous niveaux' }, ...allDiplomas.map(d => ({ value: d, label: d }))]
                }
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 140px' }}>
              <label style={labelStyle}>Année</label>
              <FilterSelect
                style={{ width: '100%', fontSize: '13px', padding: '9px 12px' }}
                value={yearFilter}
                onChange={(val) => setYearFilter(val)}
                disabled={activeTab === 'students' && !diplomaFilter}
                placeholder={activeTab === 'students' ? (diplomaFilter ? "Choisir l'année..." : "Sélectionner niveau") : "Toutes années"}
                options={activeTab === 'students'
                  ? [{ value: '', label: diplomaFilter ? "Choisir l'année..." : "Sélectionner niveau d'abord" }, ...availableYears.map(y => ({ value: y, label: y }))]
                  : [{ value: '', label: 'Toutes années' }, ...availableYears.map(y => ({ value: y, label: y }))]
                }
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 160px' }}>
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

          {activeTab === 'students' && !(diplomaFilter && yearFilter && categoryFilter) ? (
            <div style={{
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={fGroup}>
                            <label style={lbl}>Nom</label>
                            <input required className="input-premium" value={editFormData.lastName || ''} onChange={e => setEditFormData({...editFormData, lastName: e.target.value})} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={lbl}>Prénom</label>
                            <input required className="input-premium" value={editFormData.firstName || ''} onChange={e => setEditFormData({...editFormData, firstName: e.target.value})} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={fGroup}>
                            <label style={lbl}>Niveau</label>
                            <FilterSelect value={editFormData.diploma || ''} onChange={val => setEditFormData({...editFormData, diploma: val, major: '', year: ''})} options={Object.keys(FILIERES).map(d => ({ value: d, label: d }))} />
                          </div>
                          <div style={fGroup}>
                            <label style={lbl}>Année</label>
                            <FilterSelect value={editFormData.year || ''} onChange={val => setEditFormData({...editFormData, year: val})} options={getStudyYearsForDiploma(editFormData.diploma).map(year => ({ value: year, label: year }))} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                          <div style={fGroup}>
                            <label style={lbl}>Filière</label>
                            <FilterSelect value={editFormData.major || ''} onChange={val => setEditFormData({...editFormData, major: val})} options={(FILIERES[editFormData.diploma] || []).map(f => ({ value: f, label: f }))} />
                          </div>
                          <div style={fGroup}>
                            <label style={lbl}>Matricule</label>
                            <input className="input-premium" value={editFormData.regNo || ''} onChange={e => setEditFormData({...editFormData, regNo: e.target.value})} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                          <div style={fGroup}>
                            <label style={lbl}>Nom Complet</label>
                            <input required className="input-premium" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                          </div>
                          <div style={fGroup}>
                            <label style={lbl}>Tarif (DH)</label>
                            <input type="number" required className="input-premium" value={editFormData.hourlyRate || ''} onChange={e => setEditFormData({...editFormData, hourlyRate: parseFloat(e.target.value) || 0})} />
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
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
                              {getStudyYearsForDiplomas(editFormData.diplomas || []).map(y => (
                                <SelectionTag key={y} active={(editFormData.years || []).includes(y)} onClick={() => toggleYearEdit(y)} label={y} />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div style={fGroup}>
                          <label style={lbl}>Filières</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '75px', overflowY: 'auto', padding: '2px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-subtle)' }}>
                            {Array.from(new Set((editFormData.diplomas || []).flatMap(diploma => FILIERES[diploma] || []))).map(f => (
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
                                  const modules = Array.from(new Set(allModules.filter(m => 
                                    (editFormData.diplomas || []).includes(m.diploma) && 
                                    m.major === filiere && 
                                    m.year === year
                                  ).map(m => m.name)));
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
                      <span className="badge-status success">Dossier actif</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '24px', borderTop: '1px solid var(--border-light)' }}>
                    <InfoBox label="ID / Matricule" value={selectedItem.regNo || selectedItem.id.substring(0,8)} icon={Fingerprint} />
                    <InfoBox label="Filière / Module" value={selectedItem.major || (selectedItem.subjects || []).join(', ')} icon={Book} />
                    <InfoBox label="Année" value={selectedItem.year || 'N/A'} icon={Calendar} />
                    <InfoBox label="Statut" value="ACTIF" icon={CheckCircle2} valueColor="var(--primary)" />
                  </div>
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
                          { label: 'Notes', url: linkNotes, color: '#a06208', bg: 'rgba(254,205,8,0.1)', border: 'rgba(254,205,8,0.3)' },
                        ].map(({ label, url, color, bg, border }) => (
                          <div key={label} style={{ padding: '16px', background: bg, borderRadius: 'var(--radius-xl)', border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <p style={{ fontSize: 'var(--text-xs)', fontWeight: '800', color, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }}>
                              <LinkIcon size={12} /> Lien — {label}
                            </p>
                            <div style={{ padding: '10px', background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                              <QRCodeSVG value={url} size={140} fgColor={color === 'var(--primary)' ? '#b068b9' : '#a06208'} />
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={fGroup}>
                        <label style={lbl}>Nom</label>
                        <input required className="input-premium" placeholder="Ex: ALAMI" value={addStudentForm.lastName} onChange={e => setAddStudentForm({...addStudentForm, lastName: e.target.value})} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={lbl}>Prénom</label>
                        <input required className="input-premium" placeholder="Ex: Omar" value={addStudentForm.firstName} onChange={e => setAddStudentForm({...addStudentForm, firstName: e.target.value})} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={fGroup}>
                        <label style={lbl}>Niveau</label>
                        <FilterSelect value={addStudentForm.diploma} onChange={val => setAddStudentForm({...addStudentForm, diploma: val, major: '', year: ''})} options={[{ value: '', label: 'Sélectionner...' }, ...allDiplomas.map(d => ({ value: d, label: d }))]} />
                      </div>
                      <div style={fGroup}>
                        <label style={lbl}>Année d'étude</label>
                        <FilterSelect value={addStudentForm.year} onChange={val => setAddStudentForm({...addStudentForm, year: val})} disabled={!addStudentForm.diploma} options={[{ value: '', label: 'Sélectionner...' }, ...getStudyYearsForDiploma(addStudentForm.diploma).map(year => ({ value: year, label: year }))]} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                      <div style={fGroup}>
                        <label style={lbl}>Filière</label>
                        <FilterSelect value={addStudentForm.major} onChange={val => setAddStudentForm({...addStudentForm, major: val})} disabled={!addStudentForm.diploma} options={[{ value: '', label: 'Choisir...' }, ...(FILIERES[addStudentForm.diploma] || []).map(f => ({ value: f, label: f }))]} />
                      </div>
                      <div style={fGroup}>
                        <label style={lbl}>Matricule</label>
                        <input required className="input-premium" style={{ fontFamily: 'monospace' }} placeholder="IPFP-XXXX" value={addStudentForm.regNo} onChange={e => setAddStudentForm({...addStudentForm, regNo: e.target.value})} />
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
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                      <div style={fGroup}>
                        <label style={lbl}>Nom Complet</label>
                        <input required className="input-premium" placeholder="Ex: Dr. ALAMI Mohamed" value={addTeacherForm.name} onChange={e => setAddTeacherForm({...addTeacherForm, name: e.target.value})} />
                      </div>
                      <div style={fGroup}>
                        <label style={lbl}>Tarif (DH)</label>
                        <input type="number" required className="input-premium" placeholder="150" value={addTeacherForm.hourlyRate || ''} onChange={e => setAddTeacherForm({...addTeacherForm, hourlyRate: parseFloat(e.target.value) || 0})} />
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
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
                          {getStudyYearsForDiplomas(addTeacherForm.diplomas || []).map(y => (
                            <SelectionTag key={y} active={(addTeacherForm.years || []).includes(y)} onClick={() => toggleAddTeacherYear(y)} label={y} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={fGroup}>
                      <label style={lbl}>Filières assignées</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '75px', overflowY: 'auto', padding: '2px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-subtle)' }}>
                        {Array.from(new Set((addTeacherForm.diplomas || []).flatMap(diploma => FILIERES[diploma] || []))).map(f => (
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
                              const modules = Array.from(new Set(allModules.filter(m => 
                                (addTeacherForm.diplomas || []).includes(m.diploma) && 
                                m.major === filiere && 
                                m.year === year
                              ).map(m => m.name)));
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
                    <QRCodeSVG value={url} size={180} fgColor={color === 'var(--primary)' ? '#b068b9' : (color || '#b068b9')} />
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
              style={{ width: '100%', maxWidth: '600px', padding: '30px', borderRadius: 'var(--radius-3xl)', position: 'relative', zIndex: 101, boxShadow: 'var(--shadow-xl)', maxHeight: '90vh', overflowY: 'auto' }}>
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
                    <InfoBox label="Total" value={promotionResult.promotedCount + promotionResult.graduatedCount} icon={UsersIcon} valueColor="var(--success)" />
                  </div>

                  {/* Improvement #7: Breakdown by filière */}
                  {promotionResult.breakdown && Object.keys(promotionResult.breakdown).length > 0 && (
                    <div style={{ marginBottom: '18px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>D&eacute;tail par fili&egrave;re</p>
                      <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0', padding: '8px 12px', background: 'var(--bg-subtle)', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <span>Fili&egrave;re</span><span style={{ textAlign: 'center' }}>Promus</span><span style={{ textAlign: 'center' }}>Laur&eacute;ats</span>
                        </div>
                        {Object.entries(promotionResult.breakdown).map(([filiere, counts]) => (
                          <div key={filiere} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 12px', borderTop: '1px solid var(--border-light)', fontSize: '12px', fontWeight: '600' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{filiere}</span>
                            <span style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: '800' }}>{counts.promoted || 0}</span>
                            <span style={{ textAlign: 'center', color: '#a16207', fontWeight: '800' }}>{counts.graduated || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-xl)', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', color: '#166534', fontSize: '12px', fontWeight: '700', lineHeight: 1.6, marginBottom: '20px' }}>
                    Op&eacute;ration journalis&eacute;e. Les prochains re&ccedil;us commenceront par FD0001 pour les paiements et F0001 pour les formateurs.
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
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>Promotion automatique des stagiaires actifs.</p>
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
                    <InfoBox label="Actifs" value={activeStudents.length} icon={UsersIcon} valueColor="var(--success)" />
                  </div>

                  {/* Improvement #7: Breakdown by filière in preview */}
                  {Object.keys(promotionPreview.filiereBreakdown).length > 0 && (
                    <div style={{ marginBottom: '18px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>D&eacute;tail par fili&egrave;re</p>
                      <div style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0', padding: '8px 12px', background: 'var(--bg-subtle)', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <span>Fili&egrave;re</span><span style={{ textAlign: 'center' }}>1&egrave;re &rarr; 2&egrave;me</span><span style={{ textAlign: 'center' }}>2&egrave;me &rarr; Laur&eacute;at</span>
                        </div>
                        {Object.entries(promotionPreview.filiereBreakdown).map(([filiere, counts]) => (
                          <div key={filiere} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 12px', borderTop: '1px solid var(--border-light)', fontSize: '12px', fontWeight: '600' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{filiere}</span>
                            <span style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: '800' }}>{counts.promoted || 0}</span>
                            <span style={{ textAlign: 'center', color: '#a16207', fontWeight: '800' }}>{counts.graduated || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Improvement #3: Double closure warning */}
                  {isAlreadyClosed && (
                    <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-xl)', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', color: '#991b1b', fontSize: '12px', fontWeight: '700', lineHeight: 1.6, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                      L&apos;ann&eacute;e {promotionForm.fromAcademicYear} a d&eacute;j&agrave; &eacute;t&eacute; cl&ocirc;tur&eacute;e. Cette op&eacute;ration est bloqu&eacute;e.
                    </div>
                  )}

                  <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-xl)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', color: '#92400e', fontSize: '12px', fontWeight: '700', lineHeight: 1.6, marginBottom: '24px' }}>
                    Les 2&egrave;me ann&eacute;e seront marqu&eacute;s comme laur&eacute;ats. Les 1&egrave;re ann&eacute;e passeront en 2&egrave;me ann&eacute;e. Un historique sera conserv&eacute; dans chaque dossier.
                  </div>

                  {/* Improvement #2: Disable button when invalid */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" className="btn-modern primary" style={{ flex: 1, justifyContent: 'center' }} disabled={isPromotingAcademicYear || promotionPreview.total === 0 || !isYearFormatValid || isAlreadyClosed} onClick={handlePromoteAcademicYear}>
                      {isPromotingAcademicYear ? 'Cl\u00f4ture en cours...' : "Confirmer la cl\u00f4ture"}
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
const StatCard = ({ delay, icon: Icon, tone = 'primary', value, label }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    whileHover={{ y: -5, scale: 1.02 }}
    className={`finance-net-card finance-net-card-home-${tone} dashboard-premium-stat`}
  >
    <div className="finance-net-card-shine" aria-hidden="true" />
    <div className="finance-net-card-icon-bg" aria-hidden="true">
      <Icon size={54} strokeWidth={1.35} />
    </div>
    <div className="finance-net-card-top">
      <span className="finance-net-card-kicker">Tableau de bord</span>
      <span className="premium-metric-badge"><Icon size={11} /> Aperçu</span>
    </div>
    <div className="finance-net-card-content">
      <h3>{label}</h3>
      <p className="finance-net-card-amount">{value}</p>
    </div>
  </motion.div>
);

const ActionBtn = ({ icon: Icon, title, onClick, color = 'var(--text-muted)' }) => (
  <button onClick={onClick} title={title} className="action-btn"
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
