import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  flexRender, getCoreRowModel, useReactTable, getFilteredRowModel, getPaginationRowModel,
} from '@tanstack/react-table';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { logoBase64 } from '../utils/logoBase64';
import { generateBulletinGlobal } from '../utils/pdfGenerator';
import { FILIERES, MODULES_DATA, getModulesForStudent, getModulesForFiliere } from '../data/modules';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
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
  TrendingUp
} from 'lucide-react';

const labelStyle = { fontSize: 'var(--text-xs)', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '2px' };
const selectStyle = { cursor: 'pointer', paddingRight: '36px' };

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

const DASH_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const getTodayFrench = () => {
  const jsDay = new Date().getDay();
  return DASH_DAYS[jsDay === 0 ? 6 : jsDay - 1];
};

const formatRelativeTime = (timestamp) => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'À l\'instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
};

const getActivityIcon = (message) => {
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
      });

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
      transition={{ delay: 0.45 }}
      className="glass-card"
      style={{ padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '260px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--primary-ultra-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={14} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Séances d'aujourd'hui
            </span>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '1px' }}>{today}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', background: 'var(--primary-ultra-light)', borderRadius: '20px', padding: '3px 10px' }}>
            {todaySessions.length} séance{todaySessions.length !== 1 ? 's' : ''}
          </span>
          {activeSemester && setActiveSemester && (
            <SemesterToggle activeSemester={activeSemester} onChange={setActiveSemester} compact />
          )}
          <button 
            onClick={() => {
              localStorage.removeItem('ipfp_v2_core_cache');
              window.location.reload();
            }} 
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '50%' }}
            title="Rafraîchir les données (Vider le cache)"
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-faint)'}
          >
            <RotateCw size={12} />
          </button>
        </div>
      </div>

      {todaySessions.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-faint)' }}>
          <Calendar size={28} style={{ opacity: 0.35 }} />
          <p style={{ fontSize: '12px', fontWeight: '500' }}>Aucune séance prévue aujourd'hui</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', overflowY: 'auto', maxHeight: '280px' }}>
          {todaySessions.map((session) => {
            const isTP = session.type === 'TP';
            const teacher = teachers.find(t => t.id === session.teacherId);
            return (
              <div
                key={session.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', borderRadius: '10px',
                  background: isTP ? '#fdf4fe' : '#fffdf0',
                  border: `1px solid ${isTP ? 'rgba(176,104,185,0.25)' : 'rgba(254,205,8,0.35)'}`,
                  borderLeft: `3px solid ${isTP ? 'var(--primary)' : '#fecd08'}`,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '44px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: isTP ? 'var(--primary)' : '#a06208', fontVariantNumeric: 'tabular-nums' }}>
                    {session.start}
                  </span>
                  <div style={{ width: '1px', height: '6px', background: isTP ? 'rgba(176,104,185,0.4)' : 'rgba(254,205,8,0.6)', margin: '2px 0' }} />
                  <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {session.end}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: isTP ? '#7a3d82' : '#8a6a00', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                    {session.displayModule || 'Module non dÃ©fini'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    {teacher && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '2px' }}>
                        {teacher.name}
                      </span>
                    )}
                    {(session.groupCodes || []).map(abbr => (
                      <span key={abbr} style={{
                        fontSize: '10px', fontWeight: '800',
                        color: isTP ? 'var(--primary)' : '#a06208',
                        background: isTP ? 'rgba(176,104,185,0.12)' : 'rgba(254,205,8,0.2)',
                        border: `1px solid ${isTP ? 'rgba(176,104,185,0.3)' : 'rgba(254,205,8,0.5)'}`,
                        borderRadius: '5px', padding: '1px 7px', flexShrink: 0,
                        fontFamily: 'monospace',
                      }}>
                        {abbr}
                      </span>
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: '9px', fontWeight: '800', color: isTP ? 'var(--primary)' : '#a06208', background: isTP ? 'rgba(176,104,185,0.12)' : 'rgba(254,205,8,0.2)', borderRadius: '5px', padding: '2px 7px', flexShrink: 0 }}>
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

const ActivityFeedWidget = ({ notifications, onClear }) => {
  const recent = useMemo(() => (notifications || []).slice(0, 10), [notifications]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-card"
      style={{ padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '260px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={14} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Activité récente
            </span>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '1px' }}>Dernières actions</p>
          </div>
        </div>
        {recent.length > 0 && (
          <button
            onClick={onClear}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', padding: '3px 8px', borderRadius: '6px' }}
            title="Effacer l'historique"
          >
            Effacer
          </button>
        )}
      </div>

      {recent.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-faint)' }}>
          <Bell size={28} style={{ opacity: 0.35 }} />
          <p style={{ fontSize: '12px', fontWeight: '500' }}>Aucune activité récente</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '280px' }}>
          {recent.map((notif) => {
            const { icon: Icon, color, bg } = getActivityIcon(notif.message);
            return (
              <div
                key={notif.id}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '9px', background: notif.read ? 'transparent' : 'rgba(99,102,241,0.03)', border: '1px solid var(--border-light)' }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {notif.message}
                  </p>
                </div>
                <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text-faint)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {formatRelativeTime(notif.timestamp)}
                </span>
              </div>
            );
          })}
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
        items.push({ severity: 'urgent', text: `Aucune note saisie — groupe ${label}`, sub: `${gs.length} stagiaire${gs.length > 1 ? 's' : ''} concerné${gs.length > 1 ? 's' : ''}`, link: '/admin/grades' });
      } else if (pct < 50) {
        items.push({ severity: 'warning', text: `Notes incomplètes — groupe ${label}`, sub: `Seulement ${pct}% des notes saisies`, link: '/admin/grades' });
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
        text: `${missingTeachers.length} formateur${missingTeachers.length > 1 ? 's' : ''} sans présence ce mois`,
        sub: names + (missingTeachers.length > 2 ? ` +${missingTeachers.length - 2} autre${missingTeachers.length - 2 > 1 ? 's' : ''}` : ''),
        link: '/admin/monthly-attendance-teachers',
      });
    }

    const incompleteStudents = (students || []).filter(s => !s.diploma || !s.major || !s.year);
    if (incompleteStudents.length > 0) {
      items.push({ severity: 'info', text: `${incompleteStudents.length} profil${incompleteStudents.length > 1 ? 's' : ''} stagiaire incomplet${incompleteStudents.length > 1 ? 's' : ''}`, sub: 'Niveau, filière ou année manquant', link: '/admin/students' });
    }

    return items;
  }, [students, teachers, grades, teacherAttendance, allModules, activeSemester]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle size={14} style={{ color: '#dc2626' }} />
        </div>
        <div>
          <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            À faire
          </span>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '1px' }}>Tâches en attente</p>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '700', color: tasks.length > 0 ? '#dc2626' : '#16a34a', background: tasks.length > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)', borderRadius: '20px', padding: '3px 10px' }}>
          {tasks.length > 0 ? `${tasks.length} tâche${tasks.length > 1 ? 's' : ''}` : 'Tout est à jour'}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 0', color: 'var(--text-faint)' }}>
          <CheckCircle size={32} style={{ color: '#16a34a', opacity: 0.6 }} />
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>Tout est à jour !</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Aucune action requise pour le moment</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '320px' }}>
          {tasks.map((task, i) => {
            const { color, bg, border, icon: Icon } = SEVERITY_CONFIG[task.severity];
            return (
              <Link key={i} to={task.link} style={{ textDecoration: 'none' }}>
                <motion.div whileHover={{ x: 3 }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: bg, border: `1px solid ${border}`, cursor: 'pointer' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.text}</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.sub}</p>
                  </div>
                  <ArrowRight size={12} style={{ color, flexShrink: 0 }} />
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

  const pctColor = (p) => p >= 75 ? '#16a34a' : p >= 50 ? '#d97706' : '#dc2626';
  const pctBg = (p) => p >= 75 ? 'rgba(22,163,74,0.12)' : p >= 50 ? 'rgba(217,119,6,0.12)' : 'rgba(220,38,38,0.1)';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
      className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(254,205,8,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={14} style={{ color: '#a06208' }} />
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Saisie des Notes
            </span>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '1px' }}>Par groupe</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '20px', fontWeight: '900', color: pctColor(overall) }}>{overall}%</span>
          <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>global</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '12px' }}>
          Aucun stagiaire enregistré
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '320px' }}>
          {groups.map((g) => (
            <div key={g.label}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'monospace', background: 'var(--bg-subtle)', padding: '2px 7px', borderRadius: '5px' }}>{g.label}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{g.count} stagiaire{g.count > 1 ? 's' : ''}</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: pctColor(g.pct), background: pctBg(g.pct), padding: '2px 8px', borderRadius: '20px' }}>{g.pct}%</span>
              </div>
              <div style={{ height: '6px', borderRadius: '99px', background: 'var(--border-light)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${g.pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                  style={{ height: '100%', borderRadius: '99px', background: pctColor(g.pct) }}
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
const DASH_PX = 52;

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

const SemesterToggle = ({ activeSemester, onChange, compact = false }) => (
  <div style={{
    display: 'inline-flex',
    padding: compact ? '3px' : '4px',
    borderRadius: compact ? '10px' : 'var(--radius-xl)',
    background: 'var(--bg-page)',
    border: '1px solid var(--border-light)',
    gap: compact ? '2px' : '3px'
  }}>
    {['S1', 'S2'].map(sem => (
      <button
        key={sem}
        type="button"
        onClick={() => onChange(sem)}
        style={{
          minWidth: compact ? '38px' : '52px',
          padding: compact ? '5px 9px' : '8px 16px',
          borderRadius: compact ? '8px' : 'var(--radius-lg)',
          border: 'none',
          cursor: 'pointer',
          fontSize: compact ? '11px' : '12px',
          fontWeight: '900',
          transition: 'all 0.18s ease',
          background: activeSemester === sem ? 'var(--primary)' : 'transparent',
          color: activeSemester === sem ? 'white' : 'var(--text-muted)',
          boxShadow: activeSemester === sem ? 'var(--shadow-xs)' : 'none'
        }}
        title={`Activer ${sem}`}
      >
        {sem}
      </button>
    ))}
  </div>
);

const ScheduleCalendar = ({ realSchedules, teachers, activeSemester, setActiveSemester, getScheduleModule }) => {
  const allFilieres = useMemo(() => Array.from(new Set(Object.values(FILIERES).flat())), []);
  const allAnnees = ['1ère année', '2ème année'];
  const [selectedFiliere, setSelectedFiliere] = useState(allFilieres.includes('Développement Informatique') ? 'Développement Informatique' : allFilieres[0]);
  const [selectedAnnee, setSelectedAnnee] = useState(allAnnees[0]);
  const groupLabel = useMemo(() => getGroupAbbreviation(selectedFiliere, selectedAnnee), [selectedFiliere, selectedAnnee]);
  const filteredSessions = useMemo(
    () => realSchedules.filter(s => s.filiere === selectedFiliere && s.annee === selectedAnnee),
    [realSchedules, selectedFiliere, selectedAnnee]
  );

  const totalGridH = (DASH_END - DASH_START + 1) * DASH_PX;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Emploi du temps
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <select className="input-premium" style={{ fontSize: '11px', padding: '5px 10px', maxWidth: '200px', cursor: 'pointer' }} value={selectedFiliere} onChange={e => setSelectedFiliere(e.target.value)}>
              {allFilieres.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select className="input-premium" style={{ fontSize: '11px', padding: '5px 10px', width: '120px', cursor: 'pointer' }} value={selectedAnnee} onChange={e => setSelectedAnnee(e.target.value)}>
              {allAnnees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <SemesterToggle activeSemester={activeSemester} onChange={setActiveSemester} compact />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ padding: '5px 12px', borderRadius: '999px', background: 'var(--primary-ultra-light)', color: 'var(--primary)', fontSize: '11px', fontWeight: '800' }}>
            {groupLabel}
          </span>
          <span style={{ padding: '5px 12px', borderRadius: '999px', background: 'rgba(254,205,8,0.12)', color: '#a06208', fontSize: '11px', fontWeight: '800' }}>
            {filteredSessions.length} séances {activeSemester}
          </span>
          <Link to="/admin/schedules" className="btn-modern" style={{ padding: '5px 12px', fontSize: '11px', textDecoration: 'none' }}>
            <CalendarPlus size={12} style={{ marginRight: '5px' }} /> Gérer
          </Link>
        </div>
      </div>

      {/* Time Grid */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '480px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', minWidth: '700px' }}>
          {/* Time axis */}
          <div style={{ width: '48px', flexShrink: 0, borderRight: '1px solid var(--border-light)', background: 'rgba(248,249,251,0.9)', position: 'sticky', left: 0, zIndex: 20 }}>
            <div style={{ height: '36px', borderBottom: '1px solid var(--border-light)' }} />
            <div style={{ position: 'relative', height: `${totalGridH}px` }}>
              {DASH_HOURS.map(hour => (
                <div key={hour} style={{ position: 'absolute', top: `${(hour - DASH_START) * DASH_PX - 8}px`, right: '6px' }}>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          <div style={{ flex: 1, display: 'flex' }}>
            {DASH_DAYS.map(day => {
              const daySessions = filteredSessions
                .filter(s => s.day === day)
                .map(s => { const { start, end } = parseTimeRangeDash(s.time); return { ...s, start, end }; })
                .sort((a, b) => a.start.localeCompare(b.start));

              return (
                <div key={day} style={{ flex: 1, borderRight: '1px solid var(--border-light)', minWidth: '110px' }}>
                  {/* Day header */}
                  <div style={{
                    height: '36px', borderBottom: '1px solid var(--border-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 8px',
                    background: daySessions.length > 0 ? 'rgba(176,104,185,0.04)' : 'rgba(248,249,251,0.6)',
                    position: 'sticky', top: 0, zIndex: 10
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: '900', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
                      {DAY_ABBREVIATIONS[day] || day.slice(0, 3).toUpperCase()}
                    </span>
                    {daySessions.length > 0 && (
                      <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--primary)', background: 'var(--primary-ultra-light)', padding: '1px 5px', borderRadius: '999px' }}>
                        {daySessions.length}
                      </span>
                    )}
                  </div>

                  {/* Grid body */}
                  <div style={{ position: 'relative', height: `${totalGridH}px` }}>
                    {DASH_HOURS.map(hour => (
                      <div key={hour} style={{ position: 'absolute', top: `${(hour - DASH_START) * DASH_PX}px`, left: 0, right: 0, borderTop: '1px solid var(--border-light)', pointerEvents: 'none' }} />
                    ))}
                    {DASH_HOURS.map(hour => (
                      <div key={`h-${hour}`} style={{ position: 'absolute', top: `${(hour - DASH_START) * DASH_PX + DASH_PX / 2}px`, left: 0, right: 0, borderTop: '1px dashed rgba(0,0,0,0.04)', pointerEvents: 'none' }} />
                    ))}

                    {daySessions.length === 0 && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Libre</span>
                      </div>
                    )}

                    {daySessions.map(session => {
                      const top = timeToPxDash(session.start);
                      const height = Math.max(timeToPxDash(session.end) - top, DASH_PX * 0.7);
                      const isTP = session.type === 'TP';
                      const teacher = teachers.find(t => t.id === session.teacherId);
                      return (
                        <motion.div
                          key={session.id}
                          whileHover={{ scale: 1.02, zIndex: 10 }}
                          style={{
                            position: 'absolute', top: `${top}px`, height: `${height}px`,
                            left: '4px', right: '4px',
                            borderRadius: '7px', padding: '5px 7px', overflow: 'hidden', zIndex: 5,
                            backgroundColor: isTP ? '#fdf4fe' : '#fffdf0',
                            border: `1px solid ${isTP ? 'rgba(176,104,185,0.3)' : 'rgba(254,205,8,0.4)'}`,
                            boxShadow: isTP ? '0 1px 6px rgba(176,104,185,0.10)' : '0 1px 6px rgba(254,205,8,0.08)',
                          }}
                        >
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', borderRadius: '7px 0 0 7px', backgroundColor: isTP ? 'var(--primary)' : '#fecd08' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '3px' }}>
                            <Clock size={8} style={{ color: isTP ? 'var(--primary)' : '#a06208', flexShrink: 0 }} />
                            <span style={{ fontSize: '8px', fontWeight: '700', color: isTP ? 'var(--primary)' : '#a06208', fontVariantNumeric: 'tabular-nums' }}>
                              {session.start}–{session.end}
                            </span>
                          </div>
                          <div style={{
                            fontSize: '9px', fontWeight: '800',
                            color: isTP ? '#7a3d82' : '#8a6a00',
                            lineHeight: 1.3,
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden'
                          }}>
                            {getScheduleModule(session) || 'Module non défini'}
                          </div>
                          {height >= 44 && teacher && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px' }}>
                              <User size={7} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                              <span style={{ fontSize: '8px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {teacher.name}
                              </span>
                            </div>
                          )}
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
  const { students, teachers, grades, schedules, modules: allModules, deleteStudent, deleteTeacher, updateStudent, updateTeacher, studentAttendance, teacherAttendance, loadStudentAttendanceForMonth, loadTeacherAttendanceForMonth, migrateTeacherTokens, loading, confirmAction, notifications, clearNotifications, activeSemester, setActiveSemester, getActiveScheduleModule } = useApp();
  const { showToast } = useToast();
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  // Load attendance data for the current month on dashboard mount
  useEffect(() => {
    if (isDashboard) {
      const now = new Date();
      loadStudentAttendanceForMonth(now.getMonth(), now.getFullYear());
      loadTeacherAttendanceForMonth(now.getMonth(), now.getFullYear());
    }
  }, [isDashboard, loadStudentAttendanceForMonth, loadTeacherAttendanceForMonth]);
  const [localActiveTab, setLocalActiveTab] = useState('students');
  const activeTab = location.pathname.includes('teacher') ? 'teachers' 
                 : location.pathname.includes('student') ? 'students' 
                 : localActiveTab;

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

  // QR modal state
  const [qrModal, setQrModal] = useState(null); // { title, links: [{ label, url, color }] }
  const openQR = useCallback((title, links) => setQrModal({ title, links }), []);
  const closeQR = useCallback(() => setQrModal(null), []);

  const BASE = 'https://portail-ipfp.web.app';

  const allDiplomas = useMemo(() => Array.from(new Set(allModules.map(m => m.diploma))), [allModules]);
  const availableYears = useMemo(() => Array.from(new Set(allModules.map(m => m.year))), [allModules]);
  const availableMajors = useMemo(() => {
    if (!diplomaFilter) return Array.from(new Set(allModules.map(m => m.major)));
    return Array.from(new Set(allModules.filter(m => m.diploma === diplomaFilter).map(m => m.major)));
  }, [allModules, diplomaFilter]);
  const getStudentActiveModules = useCallback((student) => {
    const configuredModules = (allModules || [])
      .filter(m => m.diploma === student.diploma && m.major === student.major && m.year === student.year && [activeSemester, 'Annuel'].includes(m.semester || 'S1'))
      .map(m => m.name);
    return configuredModules.length > 0 ? configuredModules : getModulesForStudent(student);
  }, [allModules, activeSemester]);

  // Edit helper functions
  const toggleDiplomaEdit = (dip) => {
    setEditFormData(prev => {
      const currentDiplomas = prev.diplomas || (prev.diploma ? [prev.diploma] : []);
      const isSelected = currentDiplomas.includes(dip);
      const newDiplomas = isSelected ? currentDiplomas.filter(d => d !== dip) : [...currentDiplomas, dip];
      return {
        ...prev,
        diploma: undefined, 
        diplomas: newDiplomas,
        groups: newDiplomas.length === 0 ? [] : prev.groups,
        years: newDiplomas.includes('Licence Professionnelle') && newDiplomas.length === 1 ? ['1ère année'] : prev.years,
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
    <div className="max-w-container section-padding" style={{ paddingTop: '24px' }}>
      
      {!isDashboard && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              {activeTab === 'students' ? 'Liste des Stagiaires' : 'Liste des Formateurs'}
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: '500' }}>
              Gestion du personnel et des apprenants
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
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
            <Link to={activeTab === 'students' ? "/admin/add-student" : "/admin/add-teacher"} className="btn-modern primary">
              <Plus size={14} style={{ marginRight: '6px' }} /> Ajouter
            </Link>
          </div>
        </div>
      )}

      {isDashboard && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginBottom: 'var(--space-12)' }}>
          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-lg)', background: 'var(--primary-ultra-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} />
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '900', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Semestre actif</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '2px' }}>
                  Les modules affichés dans les emplois du temps, appels, notes et rapports suivent {activeSemester}.
                </p>
              </div>
            </div>
            <SemesterToggle activeSemester={activeSemester} onChange={setActiveSemester} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            <StatCard delay={0.05} icon={GraduationCap} iconColor="var(--primary)" iconBg="var(--primary-ultra-light)" value={(students || []).length} label="Total Stagiaires" />
            <StatCard delay={0.1} icon={UserPlus} iconColor="#a06208" iconBg="rgba(254, 205, 8, 0.12)" value={(teachers || []).length} label="Total Formateurs" />
            <StatCard delay={0.15} icon={UserPlus} iconColor="#16a34a" iconBg="rgba(22, 163, 74, 0.1)" value={studentAttendanceRate === null ? '—' : `${studentAttendanceRate}%`} label={`Présence Stagiaires — ${currentMonthName}`} />
            <StatCard delay={0.2} icon={User} iconColor="#0ea5e9" iconBg="rgba(14, 165, 233, 0.1)" value={teacherAttendanceRate === null ? '—' : `${teacherAttendanceRate}%`} label={`Présence Formateurs — ${currentMonthName}`} />
          </div>

          {/* New Requested Order in Grid format to keep dimensions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-3)' }}>
            <TodaySessionsWidget schedules={schedules || []} teachers={teachers || []} getScheduleModule={getActiveScheduleModule} activeSemester={activeSemester} setActiveSemester={setActiveSemester} />
            <GradesBreakdownWidget students={students || []} grades={grades || {}} allModules={allModules || []} activeSemester={activeSemester} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-3)' }}>
            <PendingTasksWidget students={students || []} teachers={teachers || []} grades={grades || {}} teacherAttendance={teacherAttendance || []} allModules={allModules || []} activeSemester={activeSemester} />
            <ActivityFeedWidget notifications={notifications || []} onClear={clearNotifications} />
          </div>

          <ScheduleCalendar realSchedules={schedules || []} teachers={teachers || []} activeSemester={activeSemester} setActiveSemester={setActiveSemester} getScheduleModule={getActiveScheduleModule} />
        </div>
      )}

      {!isDashboard && (
        <>
          <div className="glass-card" style={{ display: 'flex', alignItems: 'end', gap: 'var(--space-3)', flexWrap: 'wrap', padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 240px' }}>
              <label style={labelStyle}>Recherche</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ color: 'var(--text-faint)', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input className="input-premium" style={{ width: '100%', paddingLeft: '36px', fontSize: '13px' }} placeholder="Rechercher…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 150px' }}>
              <label style={labelStyle}>Niveau</label>
              <select className="input-premium" style={{ width: '100%', fontSize: '13px', padding: '9px 12px' }} value={diplomaFilter} onChange={(e) => { setDiplomaFilter(e.target.value); setCategoryFilter(''); }}>
                <option value="">Tous niveaux</option>
                {allDiplomas.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 140px' }}>
              <label style={labelStyle}>Année</label>
              <select className="input-premium" style={{ width: '100%', fontSize: '13px', padding: '9px 12px' }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="">Toutes années</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 160px' }}>
              <label style={labelStyle}>Filière</label>
              <select className="input-premium" style={{ width: '100%', fontSize: '13px', padding: '9px 12px' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Toutes filières</option>
                {availableMajors.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <button onClick={exportCSV} className="btn-modern" style={{ padding: '11px 14px' }}><Download size={14} style={{ marginRight: '6px' }} /> Export</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-6)' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '12px 0' }}>
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="btn-modern" style={{ opacity: table.getCanPreviousPage() ? 1 : 0.5 }}>
                <ChevronLeft size={16} /> Précédent
              </button>
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="btn-modern" style={{ opacity: table.getCanNextPage() ? 1 : 0.5 }}>
                Suivant <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Section */}
      <AnimatePresence>
        {modalMode && selectedItem && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)' }} onClick={closeModal}></motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-premium"
              style={{ width: '100%', maxWidth: '500px', padding: '32px', borderRadius: 'var(--radius-3xl)', position: 'relative', zIndex: 101, boxShadow: 'var(--shadow-xl)', maxHeight: '90vh', overflowY: 'auto' }}>
              
              <button onClick={closeModal} className="close-button" aria-label="Fermer la fenêtre" title="Fermer" style={{ position: 'absolute', right: '20px', top: '20px' }}>
                <X size={20} />
              </button>

              {modalMode === 'edit' && (
                <form onSubmit={handleUpdate}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>Modifier {activeTab === 'students' ? 'le stagiaire' : 'le formateur'}</h2>
                    {saveSuccess && <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} style={{ color: 'var(--success)', fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} /> Enregistré
                    </motion.span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {activeTab === 'students' ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={fGroup}>
                            <label style={lbl}>Nom</label>
                            <input required className="input-premium" value={editFormData.lastName || ''} onChange={e => setEditFormData({...editFormData, lastName: e.target.value})} />
                          </div>
                          <div style={fGroup}>
                            <label style={lbl}>Prénom</label>
                            <input required className="input-premium" value={editFormData.firstName || ''} onChange={e => setEditFormData({...editFormData, firstName: e.target.value})} />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={fGroup}>
                            <label style={lbl}>Niveau</label>
                            <select className="input-premium" value={editFormData.diploma || ''} onChange={e => setEditFormData({...editFormData, diploma: e.target.value, major: ''})}>
                              {Object.keys(FILIERES).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <div style={fGroup}>
                            <label style={lbl}>Année</label>
                            <select className="input-premium" value={editFormData.year || ''} onChange={e => setEditFormData({...editFormData, year: e.target.value})}>
                              <option value="1ère année">1ère année</option>
                              <option value="2ème année">2ème année</option>
                            </select>
                          </div>
                        </div>
                        <div style={fGroup}>
                          <label style={lbl}>Filière</label>
                          <select className="input-premium" value={editFormData.major || ''} onChange={e => setEditFormData({...editFormData, major: e.target.value})}>
                            {(FILIERES[editFormData.diploma] || []).map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div style={fGroup}>
                          <label style={lbl}>Matricule</label>
                          <input className="input-premium" value={editFormData.regNo || ''} onChange={e => setEditFormData({...editFormData, regNo: e.target.value})} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={fGroup}>
                          <label style={lbl}>Nom Complet</label>
                          <input required className="input-premium" value={editFormData.name || ''} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                        </div>
                        
                        <div style={fGroup}>
                          <label style={lbl}>Diplômes assignés</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {allDiplomas.map(dip => (
                              <SelectionTag key={dip} active={(editFormData.diplomas || []).includes(dip)} onClick={() => toggleDiplomaEdit(dip)} label={dip} />
                            ))}
                          </div>
                        </div>

                        <div style={fGroup}>
                          <label style={lbl}>Niveaux</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {['1ère année', '2ème année'].map(y => (
                              <SelectionTag key={y} active={(editFormData.years || []).includes(y)} onClick={() => toggleYearEdit(y)} label={y} />
                            ))}
                          </div>
                        </div>

                        <div style={fGroup}>
                          <label style={lbl}>Filières</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto', padding: '4px' }}>
                            {Array.from(new Set(allModules.filter(m => (editFormData.diplomas || []).includes(m.diploma)).map(m => m.major))).map(f => (
                              <SelectionTag key={f} active={(editFormData.groups || []).includes(f)} onClick={() => toggleGroupEdit(f)} label={f} />
                            ))}
                          </div>
                        </div>

                        <div style={fGroup}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={lbl}>Modules ({ (editFormData.subjects || []).length })</label>
                            <input className="input-premium" style={{ height: '28px', fontSize: '11px', width: '150px' }} placeholder="Filtrer..." value={editModuleSearch} onChange={e => setEditModuleSearch(e.target.value)} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-subtle)', padding: '8px', borderRadius: 'var(--radius-xl)' }}>
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
                                    <div key={filiere} style={{ marginBottom: '8px' }}>
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

                  <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                    <button type="button" onClick={closeModal} className="btn-modern" style={{ flex: 1 }}>Annuler</button>
                    <button type="submit" disabled={isSaving} className="btn-modern primary" style={{ flex: 2 }}>
                      {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                </form>
              )}

              {modalMode === 'details' && (
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
              onClick={closeQR} />
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="glass-premium"
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
    </div>
  );
};

/* ── Helper Components ── */
const StatCard = ({ delay, icon: Icon, iconColor, iconBg, value, label }) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-lg)', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>
      <Icon size={20} />
    </div>
    <div>
      <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: '800', lineHeight: 1, marginBottom: '4px' }}>{value}</h3>
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-muted)' }}>{label}</p>
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
    padding: '8px 14px', borderRadius: 'var(--radius-pill)', fontSize: '10px', fontWeight: '800', transition: 'all 0.2s', cursor: 'pointer',
    background: active ? 'var(--primary)' : 'var(--bg-subtle)',
    color: active ? 'white' : 'var(--text-muted)',
    border: `1px solid ${active ? 'var(--primary)' : 'var(--border-light)'}`,
    boxShadow: active ? 'var(--shadow-sm)' : 'none'
  }}>{label}</button>
);

const fGroup = { display: 'flex', flexDirection: 'column', gap: '4px' };
const lbl = { fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' };

export default AdminDashboard;
