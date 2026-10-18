import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { FILIERES, getStudyYearsForMajor } from '../data/modules';
import { FilterSelect } from '../components/ui/FilterSelect';
import {
  getCalendarYearForAcademicMonth,
  getStudentAcademicSnapshot
} from '../utils/studentStatus';
import {
  CalendarRange, Download, Search, Filter,
  CheckCircle2, XCircle, Clock, Users, ChevronLeft, ChevronRight
} from 'lucide-react';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const PRIORITY = { absent: 0, retard: 1, present: 2 };

const aggregateStatus = (records) => {
  if (!records || records.length === 0) return null;
  return records.reduce((best, r) => {
    if (best === null) return r.status;
    return (PRIORITY[r.status] ?? 3) < (PRIORITY[best] ?? 3) ? r.status : best;
  }, null);
};

const StatusCell = ({ status }) => {
  if (!status) return (
    <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-light)' }} />
    </div>
  );

  const cfg = {
    present: { label: 'P', bg: 'rgba(22,163,74,0.10)', color: '#15803d', border: 'rgba(22,163,74,0.25)' },
    absent:  { label: 'A', bg: 'rgba(220,38,38,0.10)',  color: '#dc2626', border: 'rgba(220,38,38,0.25)' },
    retard:  { label: 'R', bg: 'rgba(234,179,8,0.12)',  color: '#ca8a04', border: 'rgba(234,179,8,0.3)' },
  }[status] || {};

  return (
    <div style={{
      width: '28px', height: '28px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      fontSize: '10px', fontWeight: '900', color: cfg.color, letterSpacing: '0.02em'
    }}>
      {cfg.label}
    </div>
  );
};

const labelStyle = { fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', display: 'block' };

const MonthlyAttendance = () => {
  const { students, studentAttendance, loadStudentAttendanceForMonth, loading, activeAcademicYear, operationalAcademicYear, academicCatalog } = useApp();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const selectedAcademicYear = activeAcademicYear || operationalAcademicYear;
  const year = getCalendarYearForAcademicMonth(selectedAcademicYear, month);
  const [filterFiliere, setFilterFiliere] = useState('');
  const [filterAnnee, setFilterAnnee] = useState('');
  const [search, setSearch] = useState('');

  const allFilieres = useMemo(() => Array.from(new Set(Object.values(academicCatalog?.filieres || FILIERES).flat())), [academicCatalog]);
  const allAnnees = useMemo(() => {
    const diploma = Object.keys(academicCatalog?.filieres || FILIERES).find(key => (academicCatalog?.filieres?.[key] || FILIERES[key] || []).includes(filterFiliere));
    return academicCatalog?.years?.[diploma] || getStudyYearsForMajor(filterFiliere);
  }, [academicCatalog, filterFiliere]);
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [month, year]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
  const activeStudents = useMemo(() => {
    return (students || [])
      .map(s => getStudentAcademicSnapshot(s, selectedAcademicYear, operationalAcademicYear))
      .filter(Boolean);
  }, [students, selectedAcademicYear, operationalAcademicYear]);

  useEffect(() => {
    loadStudentAttendanceForMonth(month, year);
  }, [month, year, loadStudentAttendanceForMonth]);

  const filteredStudents = useMemo(() => {
    return activeStudents.filter(s => {
      if (filterFiliere && s.major !== filterFiliere) return false;
      if (filterAnnee && s.year !== filterAnnee) return false;
      if (search) {
        const full = `${s.lastName} ${s.firstName}`.toLowerCase();
        if (!full.includes(search.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
  }, [activeStudents, filterFiliere, filterAnnee, search]);

  const pad = (n) => String(n).padStart(2, '0');
  const monthPrefix = `${year}-${pad(month + 1)}`;

  const gridData = useMemo(() => {
    return filteredStudents.map(student => {
      const byDay = {};
      days.forEach(d => {
        const dateStr = `${monthPrefix}-${pad(d)}`;
        const recs = studentAttendance.filter(a => a.studentId === student.id && a.date === dateStr);
        byDay[d] = aggregateStatus(recs);
      });
      const counts = { present: 0, absent: 0, retard: 0, total: 0 };
      days.forEach(d => {
        if (byDay[d]) { counts[byDay[d]]++; counts.total++; }
      });
      return { student, byDay, counts };
    });
  }, [filteredStudents, studentAttendance, days, monthPrefix]);

  const globalStats = useMemo(() => {
    const totals = { present: 0, absent: 0, retard: 0 };
    gridData.forEach(({ counts }) => {
      totals.present += counts.present;
      totals.absent += counts.absent;
      totals.retard += counts.retard;
    });
    return totals;
  }, [gridData]);

  const exportCSV = () => {
    const dayHeaders = days.map(d => `${pad(d)}/${pad(month + 1)}`).join(',');
    const header = `\uFEFFNom,Prénom,Matricule,${dayHeaders},Présents,Absents,Retards\n`;
    const rows = gridData.map(({ student, byDay, counts }) => {
      const cells = days.map(d => byDay[d] ? byDay[d][0].toUpperCase() : '-').join(',');
      return `"${student.lastName}","${student.firstName}","${student.regNo || ''}",${cells},${counts.present},${counts.absent},${counts.retard}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Presences_${MONTHS[month]}_${year}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const prevMonth = () => setMonth(current => current === 0 ? 11 : current - 1);
  const nextMonth = () => setMonth(current => current === 11 ? 0 : current + 1);

  return (
    <div className="max-w-container section-padding">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '900', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <CalendarRange size={28} style={{ color: 'var(--primary)' }} /> Présences Mensuelles
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
            Suivi mensuel de l'assiduité des stagiaires.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: 'var(--space-5)' }}>
        <div className="app-filter-grid app-filter-grid--5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
          {/* Month navigator */}
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
              onChange={() => {}}
              disabled
              options={[{ label: String(year), value: year }]}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Filière</label>
            <FilterSelect
              value={filterFiliere}
              onChange={(val) => { setFilterFiliere(val); setFilterAnnee(''); }}
              options={[
                { label: "Toutes les filières", value: "" },
                ...allFilieres.map(f => ({ label: f, value: f }))
              ]}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Année d'étude</label>
            <FilterSelect
              value={filterAnnee}
              onChange={(val) => setFilterAnnee(val)}
              options={[
                { label: "Toutes années", value: "" },
                ...allAnnees.map(a => ({ label: a, value: a }))
              ]}
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
                placeholder="Nom du stagiaire..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', gap: '12px', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}
      >
        {[
          { label: 'Stagiaires', value: filteredStudents.length, icon: Users, color: 'var(--primary)', bg: 'var(--primary-ultra-light)' },
          { label: 'Total Présences', value: globalStats.present, icon: CheckCircle2, color: '#15803d', bg: 'rgba(22,163,74,0.08)' },
          { label: 'Total Absences', value: globalStats.absent, icon: XCircle, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
          { label: 'Total Retards', value: globalStats.retard, icon: Clock, color: '#ca8a04', bg: 'rgba(234,179,8,0.08)' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', background: bg, border: `1px solid ${bg.replace('0.08', '0.2').replace('0.12', '0.25')}`, borderRadius: 'var(--radius-xl)', flex: '1 1 140px' }}>
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
          { label: 'Présent', code: 'P', color: '#15803d', bg: 'rgba(22,163,74,0.10)', border: 'rgba(22,163,74,0.25)' },
          { label: 'Absent',  code: 'A', color: '#dc2626', bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.25)' },
          { label: 'Retard',  code: 'R', color: '#ca8a04', bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.3)' },
          { label: 'Non renseigné', code: '·', color: 'var(--text-faint)', bg: 'transparent', border: 'transparent' },
        ].map(l => (
          <div key={l.code} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '900', color: l.color, background: l.bg, border: `1px solid ${l.border}` }}>{l.code}</div>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Monthly Grid */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>
            Chargement...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <CalendarRange size={40} style={{ color: 'var(--text-faint)', margin: '0 auto 16px', display: 'block' }} />
            <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)' }}>
              {!filterFiliere ? 'Sélectionnez une filière pour afficher les stagiaires.' : 'Aucun stagiaire trouvé.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '44px' }} />
                <col style={{ width: '180px' }} />
                {days.map(d => <col key={d} style={{ width: '38px' }} />)}
                <col style={{ width: '38px' }} />
                <col style={{ width: '38px' }} />
                <col style={{ width: '38px' }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-subtle)', zIndex: 10 }}>
                    Stagiaire
                  </th>
                  {days.map(d => {
                    const date = new Date(year, month, d);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <th key={d} style={{
                        ...thStyle,
                        color: isWeekend ? 'var(--primary)' : 'var(--text-muted)',
                        background: isWeekend ? 'rgba(var(--primary-rgb), 0.05)' : 'var(--bg-subtle)',
                        minWidth: '38px'
                      }}>
                        {d}
                      </th>
                    );
                  })}
                  <th style={{ ...thStyle, color: '#15803d', background: 'rgba(22,163,74,0.06)' }}>P</th>
                  <th style={{ ...thStyle, color: '#dc2626', background: 'rgba(220,38,38,0.06)' }}>A</th>
                  <th style={{ ...thStyle, color: '#ca8a04', background: 'rgba(234,179,8,0.08)' }}>R</th>
                </tr>
              </thead>
              <tbody>
                {gridData.map(({ student, byDay, counts }, idx) => (
                  <motion.tr
                    key={student.id}
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
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '164px' }}>
                        {student.lastName} {student.firstName}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-faint)', fontWeight: '600', marginTop: '2px' }}>
                        {student.regNo || '—'}
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
                            ? 'rgba(var(--primary-rgb), 0.03)'
                            : (idx % 2 === 0 ? 'white' : 'rgba(248,249,251,0.5)')
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <StatusCell status={byDay[d]} />
                          </div>
                        </td>
                      );
                    })}
                    {/* Totals */}
                    <td style={{ ...tdStyle, textAlign: 'center', background: 'rgba(22,163,74,0.06)', padding: '6px 4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#15803d' }}>{counts.present || 0}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', background: 'rgba(220,38,38,0.06)', padding: '6px 4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#dc2626' }}>{counts.absent || 0}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', background: 'rgba(234,179,8,0.08)', padding: '6px 4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#ca8a04' }}>{counts.retard || 0}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Month/Year display footer */}
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
  fontSize: '11px',
  fontWeight: '800',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border-light)'
};

const tdStyle = {
  padding: '10px 8px',
  verticalAlign: 'middle'
};

export default MonthlyAttendance;
