import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import {
  GraduationCap, Download, Search,
  CheckCircle2, XCircle, Clock, Users, ChevronLeft, ChevronRight
} from 'lucide-react';
import { FilterSelect } from '../components/ui/FilterSelect';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

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

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const normalizeTimeSlot = (value = '') => (value || '').replace(/[^0-9]/g, '') || 'x';
const getRecordTimestamp = (record) => {
  if (!record?.timestamp) return 0;
  if (typeof record.timestamp.toMillis === 'function') return record.timestamp.toMillis();
  if (typeof record.timestamp.seconds === 'number') return record.timestamp.seconds * 1000;
  return 0;
};
const getDayNameFromDate = (dateStr) => {
  const [year, month, day] = (dateStr || '').split('-').map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date(dateStr);
  return DAY_NAMES[date.getDay()];
};
const dedupeTeacherRecordsBySlot = (records = []) => {
  const bySlot = {};
  records.forEach(record => {
    const slotKey = normalizeTimeSlot(record.timeSlot);
    const current = bySlot[slotKey];
    if (!current || getRecordTimestamp(record) >= getRecordTimestamp(current)) {
      bySlot[slotKey] = record;
    }
  });
  return Object.values(bySlot);
};
const getScheduledRecordsForDate = ({ records = [], schedules = [], teacher, date }) => {
  const dayName = getDayNameFromDate(date);
  const scheduledSlots = new Set(
    schedules
      .filter(session => session.teacherId === teacher.id && session.day === dayName)
      .map(session => normalizeTimeSlot(session.time))
  );

  if (scheduledSlots.size === 0) return [];
  return records.filter(record =>
    record.teacherId === teacher.id &&
    record.date === date &&
    scheduledSlots.has(normalizeTimeSlot(record.timeSlot))
  );
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

const StatusCell = ({ status }) => {
  if (!status) return (
    <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-light)' }} />
    </div>
  );

  const cfg = {
    present: { label: 'P', bg: 'rgba(22,163,74,0.10)',  color: '#15803d', border: 'rgba(22,163,74,0.25)' },
    absent:  { label: 'A', bg: 'rgba(220,38,38,0.10)',   color: '#dc2626', border: 'rgba(220,38,38,0.25)' },
    retard:  { label: 'R', bg: 'rgba(234,179,8,0.12)',   color: '#ca8a04', border: 'rgba(234,179,8,0.3)' },
  }[status] || {};

  return (
    <div style={{
      width: '28px', height: '28px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      fontSize: '10px', fontWeight: '900', color: cfg.color
    }}>
      {cfg.label}
    </div>
  );
};

const labelStyle = {
  fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', display: 'block'
};

const MonthlyAttendanceTeachers = () => {
  const { teachers, teacherAttendance, loadTeacherAttendanceForMonth, schedules, loading } = useApp();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');

  const availableYears = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [month, year]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  useEffect(() => {
    loadTeacherAttendanceForMonth(month, year, { force: true });
  }, [month, year, loadTeacherAttendanceForMonth]);

  const filteredTeachers = useMemo(() =>
    (teachers || [])
      .filter(t => !search || (t.name || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [teachers, search]
  );

  const pad = (n) => String(n).padStart(2, '0');
  const monthPrefix = `${year}-${pad(month + 1)}`;

  const gridData = useMemo(() => {
    return filteredTeachers.map(teacher => {
      const byDay = {};
      const hoursByDay = {};
      days.forEach(d => {
        const dateStr = `${monthPrefix}-${pad(d)}`;
        const recs = getScheduledRecordsForDate({
          records: teacherAttendance,
          schedules,
          teacher,
          date: dateStr
        });
        byDay[d] = aggregateStatus(recs);
        hoursByDay[d] = aggregateHours(recs);
      });
      const counts = { present: 0, absent: 0, retard: 0, totalHours: 0 };
      days.forEach(d => {
        if (byDay[d]) counts[byDay[d]]++;
        counts.totalHours += hoursByDay[d] || 0;
      });
      return { teacher, byDay, hoursByDay, counts };
    });
  }, [filteredTeachers, teacherAttendance, schedules, days, monthPrefix]);

  const globalStats = useMemo(() => {
    const totals = { present: 0, absent: 0, retard: 0, totalHours: 0 };
    gridData.forEach(({ counts }) => {
      totals.present += counts.present;
      totals.absent += counts.absent;
      totals.retard += counts.retard;
      totals.totalHours += counts.totalHours;
    });
    return totals;
  }, [gridData]);

  const exportCSV = () => {
    const dayHeaders = days.map(d => `${pad(d)}/${pad(month + 1)}`).join(',');
    const header = `\uFEFFFormateur,${dayHeaders},Présents,Absents,Retards,Heures\n`;
    const rows = gridData.map(({ teacher, byDay, counts }) => {
      const cells = days.map(d => byDay[d] ? byDay[d][0].toUpperCase() : '-').join(',');
      return `"${teacher.name || ''}",${cells},${counts.present},${counts.absent},${counts.retard},${counts.totalHours}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Presences_Formateurs_${MONTHS[month]}_${year}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="max-w-container section-padding">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '900', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <GraduationCap size={28} style={{ color: 'var(--primary)' }} /> Présences Mensuelles — Formateurs
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
            Suivi mensuel des vacations et de l'assiduité des formateurs.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: 'var(--space-5)' }}>
        <div className="app-filter-grid app-filter-grid--3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Mois</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={prevMonth} className="action-btn" style={{ flexShrink: 0 }}><ChevronLeft size={16} /></button>
              <FilterSelect
                value={month}
                onChange={(val) => setMonth(Number(val))}
                options={MONTHS.map((m, i) => ({ label: m, value: i }))}
                style={{ flex: 1, textAlign: 'center' }}
              />
              <button onClick={nextMonth} className="action-btn" style={{ flexShrink: 0 }}><ChevronRight size={16} /></button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Année</label>
            <FilterSelect
              value={year}
              onChange={(val) => setYear(Number(val))}
              options={availableYears.map(y => ({ label: String(y), value: y }))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Rechercher</label>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
              <input
                type="text" className="input-premium"
                style={{ width: '100%', paddingLeft: '34px' }}
                placeholder="Nom du formateur..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', gap: '12px', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}
      >
        {[
          { label: 'Formateurs', value: filteredTeachers.length, icon: Users, color: 'var(--primary)', bg: 'var(--primary-ultra-light)' },
          { label: 'Jours Présents', value: globalStats.present, icon: CheckCircle2, color: '#15803d', bg: 'rgba(22,163,74,0.08)' },
          { label: 'Jours Absents', value: globalStats.absent, icon: XCircle, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
          { label: 'Retards', value: globalStats.retard, icon: Clock, color: '#ca8a04', bg: 'rgba(234,179,8,0.08)' },
          { label: 'Total Heures', value: `${globalStats.totalHours}h`, icon: Clock, color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', background: bg, border: `1px solid ${color}22`, borderRadius: 'var(--radius-xl)', flex: '1 1 130px' }}>
            <Icon size={18} style={{ color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: '900', color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '2px' }}>{label}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { label: 'Présent', code: 'P', color: '#15803d', bg: 'rgba(22,163,74,0.10)',  border: 'rgba(22,163,74,0.25)' },
          { label: 'Absent',  code: 'A', color: '#dc2626', bg: 'rgba(220,38,38,0.10)',   border: 'rgba(220,38,38,0.25)' },
          { label: 'Retard',  code: 'R', color: '#ca8a04', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)' },
          { label: 'Non renseigné', code: '·', color: 'var(--text-faint)', bg: 'transparent', border: 'transparent' },
        ].map(l => (
          <div key={l.code} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '900', color: l.color, background: l.bg, border: `1px solid ${l.border}` }}>{l.code}</div>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>
            Chargement...
          </div>
        ) : filteredTeachers.length === 0 ? (
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
                {days.map(d => <col key={d} style={{ width: '38px' }} />)}
                <col style={{ width: '38px' }} />
                <col style={{ width: '38px' }} />
                <col style={{ width: '38px' }} />
                <col style={{ width: '52px' }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-subtle)', zIndex: 10 }}>
                    Formateur
                  </th>
                  {days.map(d => {
                    const date = new Date(year, month, d);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <th key={d} style={{
                        ...thStyle,
                        color: isWeekend ? 'var(--primary)' : 'var(--text-muted)',
                        background: isWeekend ? 'rgba(176,104,185,0.05)' : 'var(--bg-subtle)',
                        minWidth: '38px'
                      }}>
                        {d}
                      </th>
                    );
                  })}
                  <th style={{ ...thStyle, color: '#15803d', background: 'rgba(22,163,74,0.06)' }}>P</th>
                  <th style={{ ...thStyle, color: '#dc2626', background: 'rgba(220,38,38,0.06)' }}>A</th>
                  <th style={{ ...thStyle, color: '#ca8a04', background: 'rgba(234,179,8,0.08)' }}>R</th>
                  <th style={{ ...thStyle, color: '#0ea5e9', background: 'rgba(14,165,233,0.06)' }}>Hrs</th>
                </tr>
              </thead>
              <tbody>
                {gridData.map(({ teacher, byDay, counts }, idx) => (
                  <motion.tr
                    key={teacher.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: idx * 0.015 } }}
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-faint)' }}>{idx + 1}</span>
                    </td>
                    <td style={{
                      ...tdStyle,
                      position: 'sticky', left: 0, zIndex: 5,
                      background: idx % 2 === 0 ? 'white' : 'rgba(248,249,251,0.8)',
                      borderRight: '1px solid var(--border-light)'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '174px' }}>
                        {teacher.name}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-faint)', fontWeight: '600', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '174px' }}>
                        {(teacher.subjects || [teacher.subject]).filter(Boolean).slice(0, 2).join(', ') || '—'}
                      </div>
                    </td>
                    {days.map(d => {
                      const date = new Date(year, month, d);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      return (
                        <td key={d} style={{
                          ...tdStyle,
                          textAlign: 'center', padding: '6px 4px',
                          background: isWeekend
                            ? 'rgba(176,104,185,0.03)'
                            : (idx % 2 === 0 ? 'white' : 'rgba(248,249,251,0.5)')
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <StatusCell status={byDay[d]} />
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, textAlign: 'center', background: 'rgba(22,163,74,0.06)', padding: '6px 4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#15803d' }}>{counts.present}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', background: 'rgba(220,38,38,0.06)', padding: '6px 4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#dc2626' }}>{counts.absent}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', background: 'rgba(234,179,8,0.08)', padding: '6px 4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#ca8a04' }}>{counts.retard}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', background: 'rgba(14,165,233,0.06)', padding: '6px 4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#0ea5e9' }}>{counts.totalHours > 0 ? `${counts.totalHours}h` : '—'}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-faint)' }}>
          {MONTHS[month]} {year} · {daysInMonth} jours
        </span>
      </div>
    </div>
  );
};

const thStyle = {
  padding: '12px 4px',
  fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
  textAlign: 'center', whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border-light)'
};

const tdStyle = { padding: '10px 8px', verticalAlign: 'middle' };

export default MonthlyAttendanceTeachers;
