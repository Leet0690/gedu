import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { MODULES_DATA } from '../data/modules';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { DatePicker } from '../components/ui';
import {
  Users, Search, Download, Clock, UserCheck, X,
  CheckCircle2, XCircle, FileSpreadsheet, GraduationCap,
  CalendarRange, ChevronLeft, ChevronRight
} from 'lucide-react';
import { FilterSelect } from '../components/ui/FilterSelect';

/* ─── Helpers & Monthly-view helpers ─── */
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

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const getRecordTimestamp = (record) => {
  if (!record?.timestamp) return 0;
  if (typeof record.timestamp.toMillis === 'function') return record.timestamp.toMillis();
  if (typeof record.timestamp.seconds === 'number') return record.timestamp.seconds * 1000;
  return 0;
};
const dedupeTeacherRecordsBySlot = (records = []) => {
  const bySlot = {};
  records.forEach(record => {
    const slotKey = (record.timeSlot || '').replace(/[^0-9]/g, '') || 'global';
    const current = bySlot[slotKey];
    if (!current || getRecordTimestamp(record) >= getRecordTimestamp(current)) {
      bySlot[slotKey] = record;
    }
  });
  return Object.values(bySlot);
};
const aggregateStatus = (records) => {
  const uniqueRecords = dedupeTeacherRecordsBySlot(records);
  if (!uniqueRecords.length) return null;
  const hasPresent = uniqueRecords.some(r => r.status === 'present');
  if (hasPresent) return 'present';
  const hasAbsent = uniqueRecords.some(r => r.status === 'absent');
  if (hasAbsent) return 'absent';
  return null;
};
const aggregateHours = (records) => {
  const uniqueRecords = dedupeTeacherRecordsBySlot(records);
  if (!uniqueRecords.length) return 0;
  return uniqueRecords.reduce((sum, r) => {
    if (r.status !== 'present') return sum;
    const h = Number(r.hours);
    const calculated = h > 0 ? h : (calcDuration(r.timeSlot) || 4);
    return sum + calculated;
  }, 0);
};

const StatusCell = ({ status, hours }) => {
  if (!status) return (
    <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-light)' }} />
    </div>
  );
  if (status === 'present') {
    return (
      <div style={{ width: '28px', height: '28px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.25)', fontSize: '9px', fontWeight: '900', color: '#15803d' }}>
        {hours ? `${hours}h` : 'P'}
      </div>
    );
  }
  const cfg = {
    absent:  { label: 'A', bg: 'rgba(220,38,38,0.10)',   color: '#dc2626', border: 'rgba(220,38,38,0.25)' },
  }[status] || {};
  return (
    <div style={{ width: '28px', height: '28px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: '10px', fontWeight: '900', color: cfg.color }}>
      {cfg.label}
    </div>
  );
};
const formatHours = (h) => {
  if (!h) return '0h';
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h${mins}m` : `${hrs}h`;
};
const getGroupAbbreviation = (filiere, annee) => {
  let diplomaAbbr = '', majorAbbr = '';
  for (const dip in MODULES_DATA) {
    if (MODULES_DATA[dip][filiere]) { diplomaAbbr = dip.includes('Spécialisé') ? 'TS' : 'T'; break; }
  }
  if (filiere.includes('Développement')) majorAbbr = 'DI';
  else if (filiere.includes('Gestion Informatisée')) majorAbbr = 'GI';
  else if (filiere.includes('Logistique')) majorAbbr = 'GTL';
  else if (filiere.includes('Entreprises')) majorAbbr = 'GE';
  else majorAbbr = filiere.split(' ').map(w => w[0]).join('').toUpperCase();
  return diplomaAbbr + majorAbbr + (annee.includes('1') ? '1' : '2');
};

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const normalizeTimeSlot = (value = '') => (value || '').replace(/[^0-9]/g, '') || 'x';
const safeModuleKey = (value = '') => (value || 'global').replace(/[^a-zA-Z0-9]/g, '_');
const makeAttendanceDocId = (teacherId, moduleId, timeSlot, date) =>
  `${teacherId}_${safeModuleKey(moduleId)}_${normalizeTimeSlot(timeSlot)}_${date}`;

const getDayNameFromDate = (dateStr) => {
  const [year, month, day] = (dateStr || '').split('-').map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date(dateStr);
  return DAY_NAMES[date.getDay()];
};

const getScheduledRowsForDate = ({ schedules = [], teachers = [], date, searchTerm = '', getScheduleModule = (session) => session.module || '' }) => {
  const dayName = getDayNameFromDate(date);
  const term = searchTerm.trim().toLowerCase();
  const slotsMap = new Map();

  schedules.filter(s => s.day === dayName).forEach(session => {
    const teacher = teachers.find(t => t.id === session.teacherId);
    if (!teacher) return;
    if (term && !(teacher.name || '').toLowerCase().includes(term)) return;

    const normalizedTime = normalizeTimeSlot(session.time);
    const slotKey = `${teacher.id}_${normalizedTime}`;
    const abbr = getGroupAbbreviation(session.filiere, session.annee);
    const displayModule = getScheduleModule(session);

    if (slotsMap.has(slotKey)) {
      const row = slotsMap.get(slotKey);
      if (!row.groups.includes(abbr)) row.groups.push(abbr);
      return;
    }

    slotsMap.set(slotKey, {
      key: slotKey,
      session,
      teacher,
      date,
      duration: calcDuration(session.time),
      docId: makeAttendanceDocId(teacher.id, displayModule, session.time, date),
      module: displayModule,
      time: session.time,
      groups: [abbr]
    });
  });

  return Array.from(slotsMap.values()).sort((a, b) =>
    (a.teacher.name || '').localeCompare(b.teacher.name || '') || (a.time || '').localeCompare(b.time || '')
  );
};

const getRecordForScheduledRow = (records = [], row) => {
  const rowSlot = normalizeTimeSlot(row.time);
  const candidates = records.filter(record =>
    record.teacherId === row.teacher.id &&
    record.date === row.date &&
    normalizeTimeSlot(record.timeSlot) === rowSlot
  );

  if (!candidates.length) return null;
  const exact = candidates.find(record => record.id === row.docId);
  if (exact) return exact;
  return candidates.reduce((latest, record) =>
    getRecordTimestamp(record) >= getRecordTimestamp(latest) ? record : latest
  , candidates[0]);
};

const labelStyle = { fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', display: 'block' };
const fGroup = { display: 'flex', flexDirection: 'column' };
const fIcon = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' };
const thStyle = { padding: '16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' };
const tdStyle = { padding: '16px' };
const mThStyle = { padding: '12px 4px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-light)' };
const mTdStyle = { padding: '10px 8px', verticalAlign: 'middle' };

const TeacherAttendance = () => {
  const { teachers, teacherAttendance, updateTeacherAttendance, loadTeacherAttendanceForDate, loadTeacherAttendanceForMonth, schedules, loading, getActiveScheduleModule, activeSemester } = useApp();
  const { showToast } = useToast();

  const [view, setView] = useState('daily');

  /* ── Daily state ── */
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingHours, setPendingHours] = useState({});

  const dayOfWeek = useMemo(() => getDayNameFromDate(selectedDate), [selectedDate]);

  const sessionRows = useMemo(() => {
    return getScheduledRowsForDate({ schedules, teachers, date: selectedDate, searchTerm, getScheduleModule: getActiveScheduleModule });
  }, [schedules, teachers, searchTerm, selectedDate, getActiveScheduleModule]);

  const stats = useMemo(() => {
    let presents = 0, absents = 0, totalHours = 0;
    sessionRows.forEach(row => {
      const r = getRecordForScheduledRow(teacherAttendance, row);
      if (r?.status === 'present') { presents++; totalHours += r.hours || 0; }
      else if (r?.status === 'absent') absents++;
    });
    return { presents, absents, totalHours, total: sessionRows.length };
  }, [sessionRows, teacherAttendance]);

  useEffect(() => { loadTeacherAttendanceForDate(selectedDate); }, [selectedDate, loadTeacherAttendanceForDate]);

  const handleStatusChange = async (row, status) => {
    try {
      const hours = status === 'present'
        ? (pendingHours[row.docId] !== undefined ? parseFloat(pendingHours[row.docId]) || 0 : row.duration)
        : 0;
      await updateTeacherAttendance(row.teacher.id, selectedDate, status, '', hours, row.module, row.time);
    }
    catch { showToast("Erreur lors de l'enregistrement.", 'error'); }
  };
  const handleHoursChange = async (row, hours) => {
    try {
      const record = getRecordForScheduledRow(teacherAttendance, row);
      await updateTeacherAttendance(row.teacher.id, selectedDate, record?.status || 'present', record?.comment || '', hours, row.module, row.time);
    } catch { console.error('hours update failed'); }
  };

  const exportDailyCSV = () => {
    if (!sessionRows.length) return showToast('Aucune donnée.', 'info');
    const headers = "\uFEFFFormateur,Module,Horaire,Groupes,Date,Statut,Heures['1ère année', '2ème année', 'Semestre 1', 'Semestre 2', 'Semestre 3', 'Semestre 4']";
    const rows = sessionRows.map(row => {
      const r = getRecordForScheduledRow(teacherAttendance, row) || {};
      return `"${row.teacher.name}","${row.module}","${row.time}","${row.groups.join(', ')}","${selectedDate}","${r.status || 'non défini'}","${r.status === 'present' ? r.hours || 0 : 0}"`;
    }).join('['1ère année', '2ème année', 'Semestre 1', 'Semestre 2', 'Semestre 3', 'Semestre 4']');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Presences_Formateurs_${selectedDate}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  /* ── Monthly state ── */
  const now = new Date();
  const [mMonth, setMMonth] = useState(now.getMonth());
  const [mYear, setMYear] = useState(now.getFullYear());
  const [mSearch, setMSearch] = useState('');
  const availableYears = useMemo(() => { const y = now.getFullYear(); return [y - 1, y, y + 1]; }, []);

  useEffect(() => { if (view === 'monthly') loadTeacherAttendanceForMonth(mMonth, mYear, { force: true }); }, [view, mMonth, mYear, loadTeacherAttendanceForMonth]);

  const daysInMonth = useMemo(() => new Date(mYear, mMonth + 1, 0).getDate(), [mMonth, mYear]);
  const mDays = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const pad = (n) => String(n).padStart(2, '0');
  const monthPrefix = `${mYear}-${pad(mMonth + 1)}`;

  const mFilteredTeachers = useMemo(() =>
    (teachers || []).filter(t => !mSearch || (t.name || '').toLowerCase().includes(mSearch.toLowerCase()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [teachers, mSearch]
  );

  const mGridData = useMemo(() => mFilteredTeachers.map(teacher => {
    const byDay = {}, hoursByDay = {};
    mDays.forEach(d => {
      const dateStr = `${monthPrefix}-${pad(d)}`;
      const scheduledRows = getScheduledRowsForDate({ schedules, teachers: [teacher], date: dateStr, getScheduleModule: getActiveScheduleModule });
      const recs = scheduledRows
        .map(row => getRecordForScheduledRow(teacherAttendance, row))
        .filter(Boolean);
      byDay[d] = aggregateStatus(recs);
      hoursByDay[d] = aggregateHours(recs);
    });
    const counts = { present: 0, absent: 0, totalHours: 0 };
    mDays.forEach(d => { if (byDay[d]) counts[byDay[d]]++; counts.totalHours += hoursByDay[d] || 0; });
    return { teacher, byDay, hoursByDay, counts };
  }), [mFilteredTeachers, teacherAttendance, schedules, mDays, monthPrefix, getActiveScheduleModule]);

  const mGlobalStats = useMemo(() => {
    const t = { present: 0, absent: 0, totalHours: 0 };
    mGridData.forEach(({ counts }) => { t.present += counts.present; t.absent += counts.absent; t.totalHours += counts.totalHours; });
    return t;
  }, [mGridData]);

  const exportMonthlyCSV = () => {
    const dayHeaders = mDays.map(d => `${pad(d)}/${pad(mMonth + 1)}`).join(',');
    const header = `\uFEFFFormateur,${dayHeaders},Jours Présents,Jours Absents,Heures['1ère année', '2ème année', 'Semestre 1', 'Semestre 2', 'Semestre 3', 'Semestre 4']`;
    const rows = mGridData.map(({ teacher, byDay, hoursByDay, counts }) => {
      const cells = mDays.map(d => {
        if (!byDay[d]) return '-';
        if (byDay[d] === 'present') return hoursByDay[d] ? `${hoursByDay[d]}h` : 'P';
        return byDay[d][0].toUpperCase();
      }).join(',');
      return `"${teacher.name}",${cells},${counts.present},${counts.absent},${counts.totalHours}`;
    }).join('['1ère année', '2ème année', 'Semestre 1', 'Semestre 2', 'Semestre 3', 'Semestre 4']');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Presences_Formateurs_${MONTHS[mMonth]}_${mYear}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const prevMonth = () => { if (mMonth === 0) { setMMonth(11); setMYear(y => y - 1); } else setMMonth(m => m - 1); };
  const nextMonth = () => { if (mMonth === 11) { setMMonth(0); setMYear(y => y + 1); } else setMMonth(m => m + 1); };

  return (
    <div className="max-w-container section-padding">
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '900', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <UserCheck size={28} style={{ color: 'var(--primary)' }} /> Présences Formateurs
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Suivi des vacations et pointage des séances de cours.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-6)', width: 'fit-content' }}>
        {[
          { key: 'daily',   label: 'Appel Quotidien', icon: UserCheck },
          { key: 'monthly', label: 'Vue Mensuelle',    icon: CalendarRange },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setView(key)} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '8px 18px', borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '700', transition: 'all 0.2s',
            background: view === key ? 'white' : 'transparent',
            color: view === key ? 'var(--primary)' : 'var(--text-muted)',
            boxShadow: view === key ? 'var(--shadow-xs)' : 'none',
          }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ════ DAILY VIEW ════ */}
      {view === 'daily' && (
        <>
          <div className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              <div style={fGroup}>
                <label style={labelStyle}>Date d'appel</label>
                <DatePicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  title="Date d'appel"
                  placeholder="Choisir une date"
                />
              </div>
              <div style={fGroup}>
                <label style={labelStyle}>Jour de semaine</label>
                <div className="input-premium" style={{ background: 'var(--bg-subtle)', fontWeight: '800', color: 'var(--primary)', textAlign: 'center' }}>{dayOfWeek}</div>
              </div>
              <div style={fGroup}>
                <label style={labelStyle}>Recherche Formateur</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={fIcon} />
                  <input type="text" className="input-premium" style={{ width: '100%', paddingLeft: '34px' }} placeholder="Nom..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {sessionRows.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
              <MiniStat label="Séances" value={stats.total} />
              <MiniStat label="Présents" value={stats.presents} />
              <MiniStat label="Total Heures" value={formatHours(stats.totalHours)} />
              <MiniStat label="Taux" value={stats.total > 0 ? `${Math.round((stats.presents / stats.total) * 100)}%` : '—'} />
            </motion.div>
          )}

          <div className="glass-card" style={{ overflow: 'hidden' }}>
            {loading ? <TableSkeleton rows={8} /> : (
              sessionRows.length === 0 ? (
                <EmptyState title="Aucune séance" message={`Aucun cours n'est programmé dans l'emploi du temps pour ce ${dayOfWeek}.`} icon="calendar" />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '850px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)' }}>
                        <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>#</th>
                        <th style={thStyle}>Formateur</th>
                        <th style={thStyle}>Module & Horaire</th>
                        <th style={thStyle}>Groupes</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '100px' }}>Heures</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '220px' }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionRows.map((row, idx) => {
                        const record = getRecordForScheduledRow(teacherAttendance, row);
                        const status = record?.status || '';
                        return (
                          <tr key={row.key} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-faint)' }}>{idx + 1}</span></td>
                            <td style={tdStyle}><span style={{ fontWeight: '700' }}>{row.teacher.name}</span></td>
                            <td style={tdStyle}>
                              <p style={{ fontSize: 'var(--text-sm)', fontWeight: '700' }}>{row.module}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', marginTop: '2px' }}>
                                <Clock size={10} /><span style={{ fontSize: '11px', fontWeight: '800' }}>{row.time}</span>
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {row.groups.map(g => <span key={g} className="badge-status primary" style={{ fontSize: '9px', padding: '2px 6px' }}>{g}</span>)}
                              </div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                                <input type="number" step="0.5" className="input-premium"
                                  style={{ width: '64px', textAlign: 'center', padding: '4px', fontSize: '12px', fontWeight: '900' }}
                                  value={pendingHours[row.docId] !== undefined ? pendingHours[row.docId] : (record?.hours !== undefined ? record.hours : row.duration)}
                                  onChange={(e) => setPendingHours(p => ({ ...p, [row.docId]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleHoursChange(row, parseFloat(pendingHours[row.docId]) || 0);
                                      setPendingHours(p => { const n = { ...p }; delete n[row.docId]; return n; });
                                    }
                                  }} />
                                {pendingHours[row.docId] !== undefined && (
                                  <button
                                    style={{ padding: '4px 5px', color: '#15803d', background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                    onClick={() => {
                                      handleHoursChange(row, parseFloat(pendingHours[row.docId]) || 0);
                                      setPendingHours(p => { const n = { ...p }; delete n[row.docId]; return n; });
                                    }}
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <div className="teacher-attendance-status-actions">
                                <StatusBtnDaily active={status === 'present'} color="var(--success)" onClick={() => handleStatusChange(row, 'present')}>Présent</StatusBtnDaily>
                                <StatusBtnDaily active={status === 'absent'} color="var(--danger)" onClick={() => handleStatusChange(row, 'absent')}>Absent</StatusBtnDaily>
                                {status && (
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(row, '')}
                                    className="teacher-attendance-reset-button"
                                    title="Reinitialiser le statut"
                                    aria-label="Reinitialiser le statut"
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
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
          <div className="glass-card" style={{ padding: '20px', marginBottom: 'var(--space-5)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
              <div>
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
              <div>
                <label style={labelStyle}>Année</label>
                <FilterSelect
                  value={mYear}
                  onChange={(val) => setMYear(Number(val))}
                  options={availableYears.map(y => ({ label: String(y), value: y }))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Rechercher</label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                  <input type="text" className="input-premium" style={{ width: '100%', paddingLeft: '34px' }} placeholder="Nom du formateur..." value={mSearch} onChange={e => setMSearch(e.target.value)} />
                </div>
              </div>

            </div>
          </div>

          {/* Monthly stats */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: '12px', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
            {[
              { label: 'Formateurs', value: mFilteredTeachers.length, color: 'var(--primary)', bg: 'var(--primary-ultra-light)' },
              { label: 'Jours Présents', value: mGlobalStats.present, color: '#15803d', bg: 'rgba(22,163,74,0.08)' },
              { label: 'Jours Absents', value: mGlobalStats.absent, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
              { label: 'Total Heures', value: `${mGlobalStats.totalHours}h`, color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ padding: '12px 18px', background: bg, border: `1px solid ${color}22`, borderRadius: 'var(--radius-xl)', flex: '1 1 110px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: '900', color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '4px' }}>{label}</div>
              </div>
            ))}
          </motion.div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {[
              { label: 'Présent (heures)', code: 'P', color: '#15803d', bg: 'rgba(22,163,74,0.10)',  border: 'rgba(22,163,74,0.25)' },
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
            {mFilteredTeachers.length === 0 ? (
              <div style={{ padding: '64px', textAlign: 'center' }}>
                <GraduationCap size={40} style={{ color: 'var(--text-faint)', margin: '0 auto 16px', display: 'block' }} />
                <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)' }}>Aucun formateur trouvé.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '44px' }} />
                    <col style={{ width: '190px' }} />
                    {mDays.map(d => <col key={d} style={{ width: '38px' }} />)}
                    <col style={{ width: '38px' }} /><col style={{ width: '38px' }} /><col style={{ width: '52px' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)' }}>
                      <th style={mThStyle}>#</th>
                      <th style={{ ...mThStyle, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-subtle)', zIndex: 10 }}>Formateur</th>
                      {mDays.map(d => {
                        const isWeekend = new Date(mYear, mMonth, d).getDay() % 6 === 0;
                        return <th key={d} style={{ ...mThStyle, color: isWeekend ? 'var(--primary)' : 'var(--text-muted)', background: isWeekend ? 'rgba(176,104,185,0.05)' : 'var(--bg-subtle)' }}>{d}</th>;
                      })}
                      <th style={{ ...mThStyle, color: '#15803d', background: 'rgba(22,163,74,0.06)' }}>P</th>
                      <th style={{ ...mThStyle, color: '#dc2626', background: 'rgba(220,38,38,0.06)' }}>A</th>
                      <th style={{ ...mThStyle, color: '#0ea5e9', background: 'rgba(14,165,233,0.06)' }}>Hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mGridData.map(({ teacher, byDay, hoursByDay, counts }, idx) => (
                      <tr key={teacher.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ ...mTdStyle, textAlign: 'center' }}><span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-faint)' }}>{idx + 1}</span></td>
                        <td style={{ ...mTdStyle, position: 'sticky', left: 0, zIndex: 5, background: idx % 2 === 0 ? 'white' : 'rgba(248,249,251,0.8)', borderRight: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '174px' }}>{teacher.name}</div>
                        </td>
                        {mDays.map(d => {
                          const isWeekend = new Date(mYear, mMonth, d).getDay() % 6 === 0;
                          return (
                            <td key={d} style={{ ...mTdStyle, padding: '6px 4px', textAlign: 'center', background: isWeekend ? 'rgba(176,104,185,0.03)' : (idx % 2 === 0 ? 'white' : 'rgba(248,249,251,0.5)') }}>
                              <div style={{ display: 'flex', justifyContent: 'center' }}><StatusCell status={byDay[d]} hours={hoursByDay[d]} /></div>
                            </td>
                          );
                        })}
                        <td style={{ ...mTdStyle, textAlign: 'center', padding: '6px 4px', background: 'rgba(22,163,74,0.06)' }}><span style={{ fontSize: '12px', fontWeight: '900', color: '#15803d' }}>{counts.present}</span></td>
                        <td style={{ ...mTdStyle, textAlign: 'center', padding: '6px 4px', background: 'rgba(220,38,38,0.06)' }}><span style={{ fontSize: '12px', fontWeight: '900', color: '#dc2626' }}>{counts.absent}</span></td>
                        <td style={{ ...mTdStyle, textAlign: 'center', padding: '6px 4px', background: 'rgba(14,165,233,0.06)' }}><span style={{ fontSize: '12px', fontWeight: '900', color: '#0ea5e9' }}>{counts.totalHours > 0 ? `${counts.totalHours}h` : '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-faint)' }}>{MONTHS[mMonth]} {mYear} · {daysInMonth} jours</span>
          </div>
        </>
      )}
    </div>
  );
};

const StatusBtnDaily = ({ active, color, children, onClick }) => (
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

export default TeacherAttendance;
