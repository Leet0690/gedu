import React, { useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getGradeByModuleName, getStudentGradeModules } from '../utils/gradeSync';
import {
  getStudentResultsGrades,
  getStudentResultsRank,
  hasStudentResultsGrades,
  selectStudentStudyYear,
} from '../utils/studentResults';
import {
  calcCcAverage,
  calcModuleAverage,
  calcStudentSynthesisAverages,
  parseScore,
} from '../utils/gradeCalculations';
import {
  getStudentAvailableStudyYears,
  getStudentAcademicSnapshot,
} from '../utils/studentStatus';
import { getDiplomaAbbreviation } from '../data/modules';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import './StudentResults.css';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, CartesianGrid
} from 'recharts';
import {
  GraduationCap,
  Award,
  CalendarCheck,
  CheckCircle,
  Lock,
  TrendingUp,
  TrendingDown,
  Medal,
  BarChart3,
  Sparkles,
  User,
  Compass,
  FileText
} from 'lucide-react';

const gradeColor = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return 'var(--text-faint)';
  if (n >= 14) return 'var(--success)';
  if (n >= 10) return 'var(--warning)';
  return 'var(--danger)';
};

const GRADE_STYLES = {
  dash: { color: 'var(--text-faint)', fontSize: '13px', fontWeight: '500' },
  base: { fontSize: '13px', fontWeight: '800', padding: '4px 10px', borderRadius: '8px', display: 'inline-block', minWidth: '38px', textAlign: 'center' }
};

const getGradeBg = (n) => isNaN(n) ? 'transparent' : n >= 14 ? 'var(--success-ultra-light)' : n >= 10 ? 'var(--warning-ultra-light)' : 'var(--danger-ultra-light)';
const getGradeBorder = (n) => isNaN(n) ? 'none' : `1px solid ${n >= 14 ? 'rgba(22,163,74,0.15)' : n >= 10 ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.12)'}`;

const Grade = ({ val }) => {
  if (!val && val !== 0) return <span style={GRADE_STYLES.dash}>—</span>;
  const n = parseFloat(val);
  return (
    <span style={{ ...GRADE_STYLES.base, color: gradeColor(val), background: getGradeBg(n), border: getGradeBorder(n) }}>
      {n.toFixed(2).replace(/\.00$/, '')}
    </span>
  );
};

const StudentResults = () => {
  const { studentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { students = [], grades = {}, loading = false, modules: allModules = [], operationalAcademicYear } = useApp() || {};

  const student = students.find(s => s?.token && s.token === studentId);

  const availableYears = useMemo(
    () => (student ? getStudentAvailableStudyYears(student, operationalAcademicYear) : []),
    [student, operationalAcademicYear]
  );

  const activeStudyYear = selectStudentStudyYear(availableYears, searchParams.get('year'));

  const activeStudentSnapshot = useMemo(() => {
    if (!student || !activeStudyYear) return null;
    return getStudentAcademicSnapshot(student, activeStudyYear.academicYear, operationalAcademicYear);
  }, [student, activeStudyYear, operationalAcademicYear]);

  useEffect(() => {
    if (student) {
      const yearLabel = activeStudyYear?.label ? ` (${activeStudyYear.label})` : '';
      document.title = `${student.lastName || ''} ${student.firstName || ''}${yearLabel} - Résultats IPFP`.trim() || 'Résultats Stagiaire';
    }
  }, [student, activeStudyYear]);

  const resolvedStudentId = student?.id;
  const studentAcademicYear = activeStudyYear?.academicYear || '';

  const studentGrades = useMemo(() => {
    if (!resolvedStudentId || !activeStudyYear) return {};
    return getStudentResultsGrades(grades[resolvedStudentId] || {}, activeStudyYear);
  }, [grades, resolvedStudentId, activeStudyYear]);

  const studentModules = useMemo(
    () => getStudentGradeModules(allModules, activeStudentSnapshot),
    [allModules, activeStudentSnapshot]
  );
  const moduleNames = studentModules.map(m => m.name || '');

  const moduleScores = useMemo(() => studentModules.map(mod => {
    const g = getGradeByModuleName(studentGrades, mod.name) || {};
    const cc = calcCcAverage(g);
    const fp = parseScore(g.efcfp);
    const ft = parseScore(g.efcft);
    const score = calcModuleAverage({
      ccAverage: cc,
      theoretical: ft,
      practical: fp,
    });
    const hasGrades = score !== null;
    const passed = hasGrades && score >= 10;
    return { mod, g, cc, score, fp, ft, hasGrades, passed };
  }), [studentModules, studentGrades]);

  const hasRecordedGrades = hasStudentResultsGrades(studentGrades, studentModules);
  const generalAvgNum = hasRecordedGrades
    ? calcStudentSynthesisAverages(studentGrades, studentModules).generalAverage
    : null;
  const generalAvg = generalAvgNum !== null ? generalAvgNum.toFixed(2) : '—';
  const completedModules = moduleScores.filter(s => s.hasGrades).length;
  const validatedModules = moduleScores.filter(s => s.passed).length;

  const classRank = useMemo(() => getStudentResultsRank({
    students,
    grades,
    allModules,
    studentSnapshot: activeStudentSnapshot,
    operationalAcademicYear,
  }), [students, grades, activeStudentSnapshot, allModules, operationalAcademicYear]);

  const handleSelectYear = (key) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('year', key);
        return next;
      }
    );
  };

  const handleYearKeyDown = (event) => {
    const currentIndex = availableYears.findIndex(year => year.key === activeStudyYear?.key);
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % availableYears.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + availableYears.length) % availableYears.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = availableYears.length - 1;
    else return;
    event.preventDefault();
    handleSelectYear(availableYears[nextIndex].key);
    event.currentTarget.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
  };

  const chartData = useMemo(() =>
    moduleScores
      .filter(s => s.score !== null)
      .map(({ mod, score }) => ({
        name: mod.name.length > 20 ? `${mod.name.substring(0, 20)}...` : mod.name,
        fullName: mod.name,
        score: parseFloat(score.toFixed(2)),
      }))
      .sort((a, b) => b.score - a.score),
    [moduleScores]
  );

  const rankLabel = classRank.rank
    ? `${classRank.rank}${classRank.rank === 1 ? 'er' : 'ème'} / ${classRank.total}`
    : '—';

  if (loading) {
    return <div className="max-w-container section-padding"><TableSkeleton rows={10} /></div>;
  }

  if (!student) {
    return (
      <div className="flex-center" style={{ minHeight: '80vh', padding: 'var(--space-6)' }}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-premium" style={{ padding: '64px', textAlign: 'center', maxWidth: '440px' }}>
          <Lock size={64} style={{ color: 'var(--danger)', marginBottom: '24px' }} />
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900', marginBottom: '12px' }}>Lien Invalide</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>L'accès à ce relevé est protégé ou le lien a expiré.</p>
        </motion.div>
      </div>
    );
  }

  const isAdmitted = parseFloat(generalAvg) >= 10;

  return (
    <div className="max-w-container section-padding student-results-premium-page">
      
      {/* Profile Header */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="grade-premium-header" 
        style={{ 
          borderRadius: 'var(--radius-3xl)', 
          overflow: 'hidden', 
          marginBottom: 'var(--space-6)', 
          padding: '36px 40px',
          minHeight: 'auto',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '24px', zIndex: 2 }}>
          <div style={{ flex: 1, minWidth: 'min(280px, 100%)' }}>
            <span 
              className="grade-premium-eyebrow" 
              style={{ 
                color: 'rgba(255, 255, 255, 0.85)', 
                fontWeight: '900', 
                fontSize: '11px', 
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '16px'
              }}
            >
              <Sparkles size={11} /> Relevé de Notes Officiel
            </span>
            <h1 style={{ color: 'white', textTransform: 'uppercase', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: '950', letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 }}>
              {student.lastName} <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontWeight: '600' }}>{student.firstName}</span>
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '16px', color: 'rgba(255, 255, 255, 0.9)' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={13} style={{ opacity: 0.8 }} /> Matricule: {student.regNo}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Compass size={13} style={{ opacity: 0.8 }} /> {activeStudentSnapshot?.major || student.major}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CalendarCheck size={13} style={{ opacity: 0.8 }} /> {activeStudentSnapshot?.year || student.year} · {studentAcademicYear}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', height: '100%', minWidth: '160px' }}>
            <div 
              style={{ 
                background: 'rgba(255, 255, 255, 0.12)', 
                backdropFilter: 'blur(8px)', 
                border: '1px solid rgba(255, 255, 255, 0.15)', 
                borderRadius: '20px', 
                padding: '16px 24px', 
                textAlign: 'center',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
              }}
            >
              <p style={{ margin: 0, fontSize: '9px', fontWeight: '900', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Moyenne Générale</p>
              <h2 style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: '950', color: 'white', lineHeight: 1 }}>
                {generalAvg}
                {generalAvg !== '—' && <span style={{ fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginLeft: '2px' }}>/20</span>}
              </h2>
            </div>
          </div>
        </div>

        <div className="grade-premium-header-orb" aria-hidden="true" style={{ color: 'rgba(255, 255, 255, 0.08)', right: '-30px', bottom: '-40px' }}>
          <GraduationCap size={160} />
        </div>
      </motion.div>

      {/* Year Selector Tabs (when student has multiple study years available) */}
      {availableYears.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-6)',
          }}
        >
          <div
            className="student-results-year-tabs"
            role="tablist"
            aria-label="Année d'étude à consulter"
            onKeyDown={handleYearKeyDown}
          >
            {availableYears.map((yr) => {
              const isSelected = activeStudyYear?.key === yr.key;
              return (
                <button
                  key={yr.key}
                  id={`student-results-year-${yr.key}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="student-results-year-panel"
                  tabIndex={isSelected ? 0 : -1}
                  className="student-results-year-tab"
                  onClick={() => handleSelectYear(yr.key)}
                >
                  <span className="student-results-year-label">
                    <CalendarCheck size={14} aria-hidden="true" />
                    {yr.label}
                  </span>
                  {yr.academicYear && (
                    <span className="student-results-year-badge">
                      {yr.academicYear}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      <section
        id="student-results-year-panel"
        role={availableYears.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={availableYears.length > 1 ? `student-results-year-${activeStudyYear.key}` : undefined}
        tabIndex={availableYears.length > 1 ? 0 : undefined}
      >
      {!hasRecordedGrades && moduleNames.length > 0 && (
        <p className="student-results-no-grades" role="status">
          Aucune note saisie pour l'année {studentAcademicYear}.
        </p>
      )}

      {/* Grid of Key Metrics */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
          gap: 'var(--space-4)', 
          marginBottom: 'var(--space-6)' 
        }}
      >
        <MetricCard 
          icon={CheckCircle} 
          label="Modules validés" 
          value={`${validatedModules} / ${moduleNames.length}`}
          desc={`${completedModules} module(s) évalué(s) cette année`}
        />
        <MetricCard 
          icon={Medal} 
          label="Classement" 
          value={rankLabel} 
          desc={`Rang de la promotion ${studentAcademicYear}`}
          color={classRank.rank === 1 ? '#eab308' : classRank.rank && classRank.rank <= 3 ? '#94a3b8' : undefined}
        />
        <MetricCard 
          icon={Award} 
          label="Qualification" 
          value={getDiplomaAbbreviation(activeStudentSnapshot?.diploma || student.diploma)}
          desc={activeStudentSnapshot?.diploma || student.diploma}
        />
        <MetricCard 
          icon={isAdmitted ? TrendingUp : TrendingDown} 
          label="Statut Décisionnel" 
          value={completedModules === moduleNames.length && moduleNames.length > 0 ? (isAdmitted ? 'Admis' : 'Non Admis') : 'En Cours'}
          desc={`Statut de l'année (${activeStudentSnapshot?.academicYear || activeStudentSnapshot?.year || ''})`}
          color={completedModules === moduleNames.length && moduleNames.length > 0 ? (isAdmitted ? 'var(--success)' : 'var(--danger)') : 'var(--warning)'}
        />
      </div>

      {/* Main Results Table & Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        
        {/* Relevé de Notes Détaillé */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--primary-ultra-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={14} style={{ color: 'var(--primary)' }} />
            </div>
            <h3 style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Relevé de Notes Détaillé</h3>
            <div style={{ height: '1px', flex: 1, background: 'var(--border-light)' }} />
            <span className="badge-status primary" style={{ fontSize: '10px', padding: '3px 10px' }}>{moduleNames.length} Modules</span>
          </div>

          <div className="grade-premium-table-shell" style={{ overflow: 'hidden', border: '1px solid rgba(124, 58, 237, 0.12)' }}>
            {moduleNames.length === 0 ? (
              <EmptyState title="Aucune donnée" message="Les modules ne sont pas encore configurés pour votre filière." icon="book-open" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="grade-premium-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '850px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', width: '40px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '16px', fontSize: '11px', fontWeight: '800' }}>Libellé du Module</th>
                      <th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', textAlign: 'center', width: '70px' }}>C1</th>
                      <th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', textAlign: 'center', width: '70px' }}>C2</th>
                      <th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', textAlign: 'center', width: '70px' }}>C3</th>
                      <th style={{ padding: '16px', fontSize: '11px', fontWeight: '900', textAlign: 'center', width: '90px', background: 'rgba(124, 58, 237, 0.05)', color: '#6d28d9' }}>Moy CC</th>
                      <th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', textAlign: 'center', width: '95px' }}>EFC FP</th>
                      <th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', textAlign: 'center', width: '95px' }}>EFC FT</th>
                      <th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', textAlign: 'center', width: '95px' }}>Note finale</th>
                      <th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', textAlign: 'center', width: '110px' }}>Résultat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moduleScores.map(({ mod, g, cc, score, hasGrades, passed }, idx) => (
                      <tr key={mod.name} className="grade-premium-table-row" style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{ color: 'var(--text-faint)', fontWeight: '800', fontSize: '11px' }}>{idx + 1}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '750', color: 'var(--text-primary)' }}>{mod.name}</span>
                          {mod.coefficient && (
                            <span style={{ display: 'inline-block', fontSize: '10px', color: 'var(--text-faint)', marginLeft: '8px', fontWeight: '650' }}>(Coeff. {mod.coefficient})</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}><Grade val={g.c1} /></td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}><Grade val={g.c2} /></td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}><Grade val={g.c3} /></td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', background: 'rgba(124, 58, 237, 0.025)' }}>
                          {cc !== null ? (
                            <span style={{ fontWeight: '900', color: gradeColor(cc), fontSize: '13px' }}>{cc.toFixed(2)}</span>
                          ) : <span style={{ color: 'var(--text-faint)', fontSize: '13px', fontWeight: '500' }}>—</span>}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}><Grade val={g.efcfp} /></td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}><Grade val={g.efcft} /></td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          {score !== null ? (
                            <span style={{ fontWeight: '950', fontSize: '14px', color: gradeColor(score) }}>{score.toFixed(2)}</span>
                          ) : <span style={{ color: 'var(--text-faint)', fontSize: '13px', fontWeight: '500' }}>—</span>}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          {hasGrades ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: '10px', fontWeight: '800',
                              background: passed ? 'var(--success-ultra-light)' : 'var(--danger-ultra-light)',
                              color: passed ? 'var(--success)' : 'var(--danger)',
                              border: `1px solid ${passed ? 'rgba(22, 163, 74, 0.18)' : 'rgba(220, 38, 38, 0.15)'}`,
                              whiteSpace: 'nowrap',
                            }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: passed ? 'var(--success)' : 'var(--danger)' }} />
                              {passed ? 'Validé' : 'Non validé'}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-faint)', fontWeight: '600' }}>Non saisi</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Charts & Graphical Analysis */}
        {chartData.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.1 }} 
            className="grade-premium-filter-card" 
            style={{ padding: '28px', border: '1px solid rgba(124, 58, 237, 0.12)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-ultra-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={16} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: '850', color: 'var(--text-primary)', margin: 0 }}>Analyse Graphique de Performance</h3>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '650' }}>Classement des notes finales par ordre décroissant (/20)</p>
              </div>
            </div>

            <div style={{ height: `${Math.max(200, chartData.length * 38)}px`, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="colorGreen" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(22, 163, 74, 0.7)" />
                      <stop offset="100%" stopColor="rgba(22, 163, 74, 0.95)" />
                    </linearGradient>
                    <linearGradient id="colorOrange" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(217, 119, 6, 0.7)" />
                      <stop offset="100%" stopColor="rgba(217, 119, 6, 0.95)" />
                    </linearGradient>
                    <linearGradient id="colorRed" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(220, 38, 38, 0.7)" />
                      <stop offset="100%" stopColor="rgba(220, 38, 38, 0.95)" />
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.04)" />
                  <XAxis type="number" domain={[0, 20]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-faint)' }} tickCount={5} />
                  <YAxis
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false}
                    width={130} 
                    tick={{ fontSize: 11, fontWeight: 750, fill: 'var(--text-primary)' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(124, 58, 237, 0.02)' }}
                    contentStyle={{
                      background: 'rgba(255, 255, 255, 0.96)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(124, 58, 237, 0.15)',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow-md)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: '700'
                    }}
                    formatter={(v, _, p) => [`${v}/20`, p.payload.fullName]}
                  />
                  <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={16}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.score >= 14 ? 'url(#colorGreen)' : entry.score >= 10 ? 'url(#colorOrange)' : 'url(#colorRed)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
              {[
                ['≥ 14.00 (Excellence)', 'var(--success)'], 
                ['10.00 - 13.99 (Validation)', 'var(--warning)'], 
                ['< 10.00 (Échec)', 'var(--danger)']
              ].map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: '10px', fontWeight: '850', color: 'var(--text-muted)' }}>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Decision Summary Card */}
      {completedModules === moduleNames.length && moduleNames.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="grade-premium-history-card" 
          style={{ 
            padding: '48px 32px', 
            textAlign: 'center', 
            border: `1px solid ${isAdmitted ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.18)'}`, 
            borderRadius: 'var(--radius-3xl)', 
            boxShadow: 'var(--shadow-xl)', 
            background: isAdmitted 
              ? 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(240,253,244,0.9))' 
              : 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(254,242,242,0.9))', 
            position: 'relative', 
            overflow: 'hidden' 
          }}
        >
          <div style={{ position: 'absolute', top: '-60px', left: '-60px', width: '160px', height: '160px', borderRadius: '50%', background: isAdmitted ? 'rgba(22, 163, 74, 0.04)' : 'rgba(220, 38, 38, 0.04)', filter: 'blur(35px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-60px', right: '-60px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(124, 58, 237, 0.04)', filter: 'blur(35px)', pointerEvents: 'none' }} />
          
          <p style={{ fontSize: '10px', fontWeight: '900', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '14px' }}>Décision Académique de Fin d'Année</p>
          <h2 style={{ fontSize: '64px', fontWeight: '950', color: gradeColor(generalAvgNum), letterSpacing: '-0.03em', lineHeight: 1, margin: 0 }}>
            {generalAvg}
            <span style={{ fontSize: '18px', color: 'var(--text-faint)', fontWeight: '800', marginLeft: '4px' }}>/20</span>
          </h2>
          {classRank.rank && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '750', marginTop: '16px' }}>
              Classé <strong style={{ color: 'var(--text-primary)' }}>{rankLabel}</strong> dans l'ensemble de la promotion
            </p>
          )}
          
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '10px', 
              padding: '12px 32px', 
              borderRadius: 'var(--radius-pill)', 
              marginTop: '28px', 
              background: isAdmitted ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)', 
              color: isAdmitted ? 'var(--success)' : 'var(--danger)', 
              border: `1px solid ${isAdmitted ? 'rgba(22, 163, 74, 0.25)' : 'rgba(220, 38, 38, 0.2)'}`, 
              fontWeight: '900', 
              fontSize: '15px', 
              textTransform: 'uppercase', 
              boxShadow: 'var(--shadow-sm)',
              letterSpacing: '0.04em'
            }}
          >
            {isAdmitted ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {isAdmitted ? 'Admis' : 'Non admis'}
          </div>
        </motion.div>
      )}

      </section>

      {/* Footer System Watermark */}
      <div style={{ textAlign: 'center', marginTop: 'var(--space-10)', opacity: 0.35 }}>
        <p style={{ fontSize: '10px', fontWeight: '850', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>Document Académique Officiel · Système d'Information IPFP</p>
      </div>
    </div>
  );
};

/* Floating Card for metrics */
const MetricCard = ({ icon: Icon, label, value, desc, color }) => (
  <div 
    className="grade-premium-doc-card"
    style={{ 
      borderRadius: 'var(--radius-2xl)', 
      padding: '24px 20px', 
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid rgba(124, 58, 237, 0.1)',
      minHeight: '120px'
    }}
  >
    <div 
      style={{ 
        width: '38px', 
        height: '38px', 
        borderRadius: '12px', 
        background: 'var(--primary-ultra-light)', 
        color: 'var(--primary)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: '12px', 
        boxShadow: 'var(--shadow-xs)' 
      }}
    >
      <Icon size={16} />
    </div>
    <p style={{ margin: 0, fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
    <p style={{ margin: '6px 0 0', fontSize: '20px', fontWeight: '900', color: color || 'var(--text-primary)', lineHeight: 1.15 }}>{value}</p>
    {desc && <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px', fontWeight: '650' }}>{desc}</span>}
  </div>
);

export default StudentResults;
