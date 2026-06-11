import React, { useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getStudentGradeModules, sanitizeGradeKey } from '../utils/gradeSync';
import { isActiveStudent, isLaureatStudent } from '../utils/studentStatus';
import { getDiplomaAbbreviation } from '../data/modules';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, CartesianGrid
} from 'recharts';
import {
  GraduationCap,
  Award,
  CalendarCheck,
  CheckCircle,
  BookOpen,
  Lock,
  FileText,
  TrendingUp,
  TrendingDown,
  Activity,
  Medal,
  BarChart3,
} from 'lucide-react';

const calcMoyenneCC = (g) => {
  if (!g || g.c1 === '' || g.c1 === undefined || g.c2 === '' || g.c2 === undefined) return null;
  const c1 = parseFloat(g.c1), c2 = parseFloat(g.c2);
  if (isNaN(c1) || isNaN(c2)) return null;
  if (g.c3 !== '' && g.c3 !== undefined && g.c3 !== null) {
    const c3 = parseFloat(g.c3);
    if (!isNaN(c3)) return (c1 + c2 + c3) / 3;
  }
  return (c1 + c2) / 2;
};

const calcModuleScore = (g) => {
  if (!g) return null;
  const cc = calcMoyenneCC(g);
  const fp = parseFloat(g.efcfp), ft = parseFloat(g.efcft);
  if (cc === null || isNaN(fp) || isNaN(ft)) return null;
  return (cc * 3 + ft * 2 + fp * 3) / 8;
};

const gradeColor = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return 'var(--text-faint)';
  if (n >= 14) return '#16a34a';
  if (n >= 10) return '#d97706';
  return '#dc2626';
};

const Grade = ({ val }) => {
  if (!val && val !== 0) return <span style={{ color: 'var(--text-faint)', fontSize: '13px' }}>—</span>;
  const n = parseFloat(val);
  const color = gradeColor(val);
  return (
    <span style={{
      fontSize: '13px', fontWeight: '800', color,
      background: isNaN(n) ? 'transparent' : n >= 14 ? 'rgba(22,163,74,0.07)' : n >= 10 ? 'rgba(217,119,6,0.07)' : 'rgba(220,38,38,0.07)',
      padding: '2px 7px', borderRadius: '6px',
    }}>
      {val}
    </span>
  );
};

const StudentResults = () => {
  const { studentId } = useParams();
  const { students = [], grades = {}, loading = false, modules: allModules = [] } = useApp() || {};

  const student = students.find(s => {
    if (!s) return false;
    const clean = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    return clean(s.token) === clean(studentId) || clean(s.id) === clean(studentId);
  });

  useEffect(() => {
    if (student) {
      document.title = `${student.lastName || ''} ${student.firstName || ''} - Résultats IPFP`.trim() || 'Résultats Stagiaire';
    }
  }, [student]);

  const studentGrades = student ? (grades[student.id] || {}) : {};
  const studentModules = useMemo(
    () => getStudentGradeModules(allModules, student),
    [allModules, student]
  );
  const moduleNames = studentModules.map(m => m.name || '');

  const moduleScores = useMemo(() => studentModules.map(mod => {
    const g = studentGrades[sanitizeGradeKey(mod.name)] || {};
    const cc = calcMoyenneCC(g);
    const score = calcModuleScore(g);
    const fp = g.efcfp !== '' && g.efcfp !== undefined ? parseFloat(g.efcfp) : null;
    const ft = g.efcft !== '' && g.efcft !== undefined ? parseFloat(g.efcft) : null;
    const hasGrades = score !== null;
    const passed = hasGrades && score >= 10;
    return { mod, g, cc, score, fp, ft, hasGrades, passed };
  }), [studentModules, studentGrades]);

  let sumCC = 0, sumFT = 0, sumFP = 0, cnt = 0;
  moduleScores.forEach(({ cc, fp, ft }) => {
    if (cc === null || fp === null || ft === null || isNaN(fp) || isNaN(ft)) return;
    sumCC += cc; sumFT += ft; sumFP += fp; cnt++;
  });
  const generalAvgNum = cnt > 0 ? (((sumCC / cnt) * 3) + ((sumFT / cnt) * 2) + ((sumFP / cnt) * 3)) / 8 : 0;
  const generalAvg = cnt > 0 ? generalAvgNum.toFixed(2) : '—';
  const completedModules = moduleScores.filter(s => s.hasGrades).length;

  const classRank = useMemo(() => {
    if (!student) return { rank: null, total: 0 };
    const studentIsLaureat = isLaureatStudent(student);
    const peers = students.filter(s => {
      const sameClass = s.diploma === student.diploma && s.major === student.major && s.year === student.year;
      if (!sameClass) return false;
      if (studentIsLaureat) {
        if (!isLaureatStudent(s)) return false;
        if (student.graduationAcademicYear) return s.graduationAcademicYear === student.graduationAcademicYear;
        return true;
      }
      if (!isActiveStudent(s)) return false;
      if (student.academicYear && s.academicYear) return s.academicYear === student.academicYear;
      return true;
    });
    const peerAvgs = peers.map(s => {
      const sGrades = grades[s.id] || {};
      let sCC = 0, sFT = 0, sFP = 0, sCnt = 0;
      studentModules.forEach(mod => {
        const g = sGrades[sanitizeGradeKey(mod.name)] || {};
        const cc = calcMoyenneCC(g);
        const fp = g.efcfp !== '' && g.efcfp !== undefined ? parseFloat(g.efcfp) : NaN;
        const ft = g.efcft !== '' && g.efcft !== undefined ? parseFloat(g.efcft) : NaN;
        if (cc !== null && !isNaN(fp) && !isNaN(ft)) {
          sCC += cc; sFT += ft; sFP += fp; sCnt++;
        }
      });
      const avg = sCnt > 0 ? (((sCC / sCnt) * 3) + ((sFT / sCnt) * 2) + ((sFP / sCnt) * 3)) / 8 : null;
      return { id: s.id, avg };
    }).filter(p => p.avg !== null);

    const current = peerAvgs.find(p => p.id === student.id);
    if (!current) return { rank: null, total: peerAvgs.length };

    const rank = peerAvgs.filter(p => p.avg > current.avg + 0.0001).length + 1;
    return { rank, total: peerAvgs.length };
  }, [students, grades, student, studentModules]);

  const chartData = useMemo(() =>
    moduleScores
      .filter(s => s.score !== null)
      .map(({ mod, score }) => ({
        name: mod.name.length > 22 ? `${mod.name.substring(0, 22)}...` : mod.name,
        fullName: mod.name,
        score: parseFloat(score.toFixed(2)),
      }))
      .sort((a, b) => b.score - a.score),
    [moduleScores]
  );

  const rankLabel = classRank.rank
    ? `${classRank.rank}${classRank.rank === 1 ? 'er' : 'ème'} / ${classRank.total}`
    : '—';

  if (loading && students.length === 0) {
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

  return (
    <div className="max-w-container section-padding">

      {/* Profile Header */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ borderRadius: 'var(--radius-3xl)', overflow: 'hidden', marginBottom: 'var(--space-8)', border: '1px solid rgba(176, 104, 185, 0.18)', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ background: 'linear-gradient(135deg, #1b1625 0%, #312543 100%)', padding: 'clamp(32px, 5vw, 48px)', color: 'white', position: 'relative' }}>
          <div style={{ position: 'absolute', right: '-12px', bottom: '-24px', opacity: 0.06, color: 'var(--primary)', transform: 'rotate(-10deg)', pointerEvents: 'none' }}>
            <GraduationCap size={240} />
          </div>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div className="badge-status primary" style={{ background: 'rgba(255, 255, 255, 0.12)', color: 'var(--primary-light)', padding: '6px 16px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '11px', fontWeight: '800' }}>{student.major}</span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontWeight: '950', letterSpacing: '-0.04em', lineHeight: 1.1, textTransform: 'uppercase', color: 'white' }}>
              <span style={{ color: 'var(--primary-light)' }}>{student.lastName}</span> <span style={{ color: '#e4b8ed' }}>{student.firstName}</span>
            </h1>
            <p style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '12px' }}>
              Matricule: {student.regNo} · {student.diploma} · {student.year}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1px', background: 'var(--border-light)' }}>
          <Metric icon={CheckCircle} label="Modules validés" value={`${completedModules}/${moduleNames.length}`} />
          <Metric icon={CalendarCheck} label="Année d'étude" value={student.year} />
          <Metric icon={Award} label="Qualification" value={getDiplomaAbbreviation(student.diploma)} />
          {/* Feature 4: Class rank */}
          <Metric
            icon={Medal}
            label="Classement"
            value={rankLabel}
            color={classRank.rank === 1 ? '#f59e0b' : classRank.rank <= 3 ? '#94a3b8' : 'var(--text-primary)'}
          />
        </div>
      </motion.div>

      {/* Table */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Relevé de Notes Détaillé</h3>
          <div style={{ height: '1px', flex: 1, background: 'var(--border-light)' }} />
          <div className="badge-status" style={{ background: 'rgba(176, 104, 185, 0.08)', color: 'var(--primary)' }}>{moduleNames.length} Modules</div>
        </div>

        <div className="glass-card grade-premium-table-shell" style={{ border: '1px solid rgba(176, 104, 185, 0.15)', background: 'rgba(255, 255, 255, 0.9)', overflow: 'hidden' }}>
          {moduleNames.length === 0 ? (
            <EmptyState title="Aucune donnée" message="Les modules ne sont pas encore configurés pour votre filière." icon="book-open" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="grade-premium-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '860px' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>#</th>
                    <th style={thStyle}>Libellé du Module</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>C1</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>C2</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>C3</th>
                    <th style={{ ...thStyle, textAlign: 'center', background: 'rgba(124, 58, 237, 0.05)', color: '#6d28d9', fontWeight: '900' }}>Moy CC</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>EFC FP</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>EFC FT</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Note finale</th>
                    {/* Feature 1: pass/fail column */}
                    <th style={{ ...thStyle, textAlign: 'center' }}>Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {moduleScores.map(({ mod, g, cc, score, hasGrades, passed }, idx) => (
                    <tr key={mod.name} className="grade-premium-table-row" style={{ background: idx % 2 === 0 ? 'white' : 'var(--bg-subtle)' }}>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-faint)', fontWeight: '800', fontSize: '11px' }}>{idx + 1}</span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-lg)', background: 'var(--primary-ultra-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <BookOpen size={14} />
                          </div>
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: '750', color: 'var(--text-primary)' }}>{mod.name}</span>
                            {mod.coefficient && (
                              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-faint)', marginTop: '2px' }}>Coeff. {mod.coefficient}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Feature 1: color-coded grade cells */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}><Grade val={g.c1} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><Grade val={g.c2} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><Grade val={g.c3} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center', background: 'rgba(124, 58, 237, 0.025)' }}>
                        {cc !== null ? (
                          <span style={{ fontWeight: '900', color: gradeColor(cc), fontSize: '13px' }}>{cc.toFixed(2)}</span>
                        ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><Grade val={g.efcfp} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><Grade val={g.efcft} /></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {score !== null ? (
                          <span style={{ fontWeight: '950', fontSize: '14px', color: gradeColor(score) }}>{score.toFixed(2)}</span>
                        ) : <span style={{ color: 'var(--text-faint)', fontSize: '13px' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {hasGrades ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: '10px', fontWeight: '800',
                            background: passed ? 'rgba(22, 163, 74, 0.06)' : 'rgba(220, 38, 38, 0.06)',
                            color: passed ? 'var(--success)' : 'var(--danger)',
                            border: `1px solid ${passed ? 'rgba(22, 163, 74, 0.18)' : 'rgba(220, 38, 38, 0.15)'}`,
                            whiteSpace: 'nowrap',
                          }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: passed ? 'var(--success)' : 'var(--danger)' }} />
                            {passed ? 'Validé' : 'Non validé'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>En cours</span>
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

      {/* Feature 5: Performance bar chart */}
      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card" style={{ padding: '28px', marginBottom: 'var(--space-8)', border: '1px solid rgba(176, 104, 185, 0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-ultra-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={16} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: '850', color: 'var(--text-primary)', margin: 0 }}>Performance par Module</h3>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Note finale (/20) — Rouge si non validé, vert si validé</p>
            </div>
          </div>
          <div style={{ height: `${Math.max(200, chartData.length * 36)}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis type="number" domain={[0, 20]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-faint)' }} tickCount={5} />
                <YAxis
                  dataKey="name" type="category" axisLine={false} tickLine={false}
                  width={150} tick={{ fontSize: 11, fontWeight: 750, fill: 'var(--text-primary)' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(176,104,185,0.03)' }}
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.96)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(176, 104, 185, 0.2)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-md)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: '700'
                  }}
                  formatter={(v, _, p) => [v + '/20', p.payload.fullName]}
                />
                <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={18}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.score >= 14 ? '#16a34a' : entry.score >= 10 ? '#d97706' : '#dc2626'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '16px' }}>
            {[['≥ 14 — Bien', '#16a34a'], ['10–14 — Passable', '#d97706'], ['< 10 — Non validé', '#dc2626']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Summary card */}
      {cnt === moduleNames.length && moduleNames.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-premium" style={{ padding: '48px 32px', textAlign: 'center', border: '1px solid rgba(176, 104, 185, 0.22)', borderRadius: 'var(--radius-3xl)', boxShadow: 'var(--shadow-lg)', background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(249,240,251,0.85))', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-60px', left: '-60px', width: '150px', height: '150px', borderRadius: '50%', background: parseFloat(generalAvg) >= 10 ? 'rgba(22, 163, 74, 0.05)' : 'rgba(220, 38, 38, 0.05)', filter: 'blur(30px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-60px', right: '-60px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(176, 104, 185, 0.05)', filter: 'blur(30px)', pointerEvents: 'none' }} />
          
          <p style={{ fontSize: '10px', fontWeight: '900', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>Résultat Global de l'Année</p>
          <h2 style={{ fontSize: '56px', fontWeight: '950', color: gradeColor(generalAvgNum), letterSpacing: '-0.04em', lineHeight: 1, margin: 0 }}>
            {generalAvg}<span style={{ fontSize: '18px', color: 'var(--text-faint)', fontWeight: '700' }}> / 20</span>
          </h2>
          {classRank.rank && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '750', marginTop: '12px' }}>
              Classé <strong style={{ color: 'var(--text-primary)' }}>{rankLabel}</strong> dans la promotion
            </p>
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: 'var(--radius-pill)', marginTop: '24px', background: parseFloat(generalAvg) >= 10 ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)', color: parseFloat(generalAvg) >= 10 ? 'var(--success)' : 'var(--danger)', border: `1px solid ${parseFloat(generalAvg) >= 10 ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.15)'}`, fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', boxShadow: 'var(--shadow-xs)' }}>
            {parseFloat(generalAvg) >= 10 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {parseFloat(generalAvg) >= 10 ? 'Admis' : 'Non admis'}
          </div>
        </motion.div>
      )}

      <div style={{ textAlign: 'center', marginTop: 'var(--space-12)', opacity: 0.4 }}>
        <p style={{ fontSize: '10px', fontWeight: '850', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Document généré par le système LUX-CORE · IPFP</p>
      </div>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value, color }) => (
  <div style={{ background: 'rgba(255, 255, 255, 0.65)', backdropFilter: 'blur(8px)', padding: '24px 16px', textAlign: 'center', transition: 'all 0.2s' }}>
    <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-xl)', background: 'var(--primary-ultra-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: 'var(--shadow-xs)' }}>
      <Icon size={16} />
    </div>
    <p style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{label}</p>
    <p style={{ fontSize: '18px', fontWeight: '900', color: color || 'var(--text-primary)', margin: 0 }}>{value}</p>
  </div>
);

const thStyle = { padding: '16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-light)' };
const tdStyle = { padding: '16px', borderBottom: '1px solid var(--border-light)' };

export default StudentResults;
