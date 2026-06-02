import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { MODULES_DATA } from '../data/modules';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell, PieChart, Pie, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import { logoBase64 } from '../utils/logoBase64.js';
import {
  ChartLine, Users, TrendingUp, TrendingDown, Download,
  Award, AlertTriangle, ChevronUp, ChevronDown, Minus,
  CheckCircle, XCircle, FileText, BookOpen, Files, Layers
} from 'lucide-react';

const labelStyle = {
  fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em'
};

const KPICard = ({ label, value, sub, color = 'var(--primary)', icon: Icon, iconBg, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card"
    style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}
  >
    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: iconBg || 'var(--primary-ultra-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={18} style={{ color }} />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: '900', color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</p>}
    </div>
  </motion.div>
);

const SortBtn = ({ label, field, sort, onSort }) => {
  const active = sort.startsWith(field);
  const asc = sort === `${field}_asc`;
  return (
    <button onClick={() => onSort(field)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '800', fontSize: 'var(--text-xs)', color: active ? 'var(--primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: 0 }}>
      {label}
      {active ? (asc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <Minus size={10} style={{ opacity: 0.3 }} />}
    </button>
  );
};

const CustomDonutLabel = ({ cx, cy, value, label }) => (
  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
    <tspan x={cx} dy="-6" fontSize="22" fontWeight="900" fill="var(--text-primary)">{value}</tspan>
    <tspan x={cx} dy="18" fontSize="10" fontWeight="700" fill="var(--text-muted)">{label}</tspan>
  </text>
);

const getStudentName = (student) =>
  student?.lastName ? `${student.lastName} ${student.firstName || ''}`.trim() : (student?.name || '');

const gradeModuleKey = (moduleName = '') => moduleName.replace(/\./g, '_');

const parseScore = (value) => {
  const score = parseFloat(value);
  return Number.isNaN(score) ? null : score;
};

const formatScore = (value, suffix = '') =>
  value === null || value === undefined || Number.isNaN(value) ? '-' : `${Number(value).toFixed(2)}${suffix}`;

const safeFilePart = (value = 'rapport') =>
  String(value)
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase() || 'rapport';

const clampText = (value, max = 32) => {
  const text = String(value || '-');
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
};

const addReportHeader = (doc, title, subtitle = '') => {
  const w = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 10;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, doc.internal.pageSize.getHeight(), 'F');

  try { doc.addImage(logoBase64, 'PNG', margin, y, 40, 18); } catch {}

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("Institut de formation professionnelle prive", w - margin, y + 4, { align: 'right' });
  doc.text("agree par le ministere de l'Inclusion economique, de la Petite entreprise,", w - margin, y + 8, { align: 'right' });
  doc.text("de l'Emploi et des Competences, sous le numero 4/01/6/2022", w - margin, y + 12, { align: 'right' });

  y = 34;
  doc.setDrawColor(180, 104, 185);
  doc.setLineWidth(0.6);
  doc.line(margin, y, w - margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 30, 30);
  doc.text(title, w / 2, y, { align: 'center' });
  y += 6;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, w / 2, y, { align: 'center' });
    y += 5;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, w / 2, y, { align: 'center' });
  y += 8;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);
  return y + 8;
};

const drawPdfTable = (doc, { title, headers, rows, widths, startY, margin = 15 }) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const rowH = 7;
  let y = startY;

  const drawHeader = () => {
    doc.setFillColor(245, 245, 250);
    doc.rect(margin, y, widths.reduce((sum, width) => sum + width, 0), rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    let x = margin;
    headers.forEach((header, i) => {
      doc.text(String(header), x + 1.5, y + 4.5);
      x += widths[i];
    });
    y += rowH;
  };

  if (title) {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = addReportHeader(doc, 'Suite du rapport');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(title, margin, y);
    y += 6;
  }

  drawHeader();

  rows.forEach((row, index) => {
    if (y > pageHeight - 18) {
      doc.addPage();
      y = addReportHeader(doc, 'Suite du rapport');
      drawHeader();
    }

    if (index % 2 === 0) {
      doc.setFillColor(252, 252, 254);
      doc.rect(margin, y, widths.reduce((sum, width) => sum + width, 0), rowH, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(35, 35, 35);
    let x = margin;
    row.forEach((cell, i) => {
      doc.text(clampText(cell, Math.max(8, Math.floor(widths[i] * 1.9))), x + 1.5, y + 4.5);
      x += widths[i];
    });
    doc.setDrawColor(235, 235, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH, margin + widths.reduce((sum, width) => sum + width, 0), y + rowH);
    y += rowH;
  });

  return y + 7;
};

const ReportAction = ({ icon: Icon, title, description, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      border: '1px solid var(--border-light)',
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      textAlign: 'left',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.55 : 1,
      boxShadow: 'var(--shadow-sm)'
    }}
  >
    <span style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--primary-ultra-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={17} />
    </span>
    <span style={{ minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: '13px', fontWeight: 900, color: 'var(--text-primary)' }}>{title}</span>
      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35, marginTop: '3px' }}>{description}</span>
    </span>
  </button>
);

const Reports = () => {
  const {
    students = [], grades = {}, modules: allModules = [],
    studentAttendance = [], loadStudentAttendanceForMonth
  } = useApp() || {};

  const [selectedDiploma, setSelectedDiploma] = useState(Object.keys(MODULES_DATA)[0]);
  const [selectedMajor, setSelectedMajor] = useState('');
  const [selectedYear, setSelectedYear] = useState('1ère année');
  const [selectedModule, setSelectedModule] = useState('');
  const [rankSort, setRankSort] = useState('avg_desc');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (loadStudentAttendanceForMonth) {
      const now = new Date();
      loadStudentAttendanceForMonth(now.getMonth(), now.getFullYear());
    }
  }, [loadStudentAttendanceForMonth]);

  const availableMajors = useMemo(() =>
    selectedDiploma ? Object.keys(MODULES_DATA[selectedDiploma] || {}) : [],
    [selectedDiploma]
  );

  const availableModulesList = useMemo(() => {
    if (!selectedDiploma || !selectedMajor || !selectedYear) return [];
    return allModules.filter(m =>
      m.diploma === selectedDiploma &&
      m.major === selectedMajor &&
      m.year === selectedYear
    );
  }, [selectedDiploma, selectedMajor, selectedYear, allModules]);

  const availableModules = useMemo(() => availableModulesList.map(m => m.name), [availableModulesList]);

  useEffect(() => {
    if (availableMajors.length > 0 && !availableMajors.includes(selectedMajor))
      setSelectedMajor(availableMajors[0]);
  }, [availableMajors, selectedMajor]);

  useEffect(() => {
    if (availableModules.length > 0 && !availableModules.includes(selectedModule))
      setSelectedModule(availableModules[0]);
    else if (availableModules.length === 0 && selectedModule)
      setSelectedModule('');
  }, [availableModules, selectedModule]);

  const analytics = useMemo(() => {
    const filteredStudents = students.filter(s =>
      s.diploma === selectedDiploma && s.major === selectedMajor && s.year === selectedYear
    );

    const getModuleScore = (studentId, modName) => {
      const g = grades[studentId]?.[modName.replace(/\./g, '_')];
      if (!g) return null;
      const efcfp = parseFloat(g.efcfp), efcft = parseFloat(g.efcft);
      if (!isNaN(efcfp) && !isNaN(efcft)) return (efcfp + efcft) / 2;
      const c1 = parseFloat(g.c1), c2 = parseFloat(g.c2), c3 = parseFloat(g.c3);
      const vals = [c1, c2, c3].filter(v => !isNaN(v));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const computeWeightedAvg = (studentId) => {
      let totalWeight = 0, totalScore = 0;
      availableModulesList.forEach(({ name, coefficient }) => {
        const score = getModuleScore(studentId, name);
        if (score !== null) {
          totalScore += score * (coefficient || 1);
          totalWeight += (coefficient || 1);
        }
      });
      return totalWeight > 0 ? totalScore / totalWeight : null;
    };

    const studentRankings = filteredStudents.map(s => {
      const avg = computeWeightedAvg(s.id);
      const sAtt = studentAttendance.filter(a => a.studentId === s.id);
      const absences = sAtt.filter(a => a.status === 'absent').length;
      const absenceRate = sAtt.length > 0 ? Math.round((absences / sAtt.length) * 100) : null;
      return { ...s, avg, absenceRate };
    });

    const toggleSort = (field) => {
      setRankSort(prev => prev === `${field}_desc` ? `${field}_asc` : `${field}_desc`);
    };

    // Module progression for selected module
    let avgC1 = 0, avgC2 = 0, avgC3 = 0, avgEFC = 0;
    let countC1 = 0, countC2 = 0, countC3 = 0, countEFC = 0;
    filteredStudents.forEach(s => {
      const g = grades[s.id]?.[selectedModule.replace(/\./g, '_')];
      if (g) {
        if (g.c1 && !isNaN(parseFloat(g.c1))) { avgC1 += parseFloat(g.c1); countC1++; }
        if (g.c2 && !isNaN(parseFloat(g.c2))) { avgC2 += parseFloat(g.c2); countC2++; }
        if (g.c3 && !isNaN(parseFloat(g.c3))) { avgC3 += parseFloat(g.c3); countC3++; }
        const efcfp = parseFloat(g.efcfp), efcft = parseFloat(g.efcft);
        if (!isNaN(efcfp) && !isNaN(efcft)) { avgEFC += (efcfp + efcft) / 2; countEFC++; }
      }
    });
    const progressionData = [
      { name: 'C1', val: countC1 > 0 ? parseFloat((avgC1 / countC1).toFixed(2)) : 0 },
      { name: 'C2', val: countC2 > 0 ? parseFloat((avgC2 / countC2).toFixed(2)) : 0 },
      ...(countC3 > 0 ? [{ name: 'C3', val: parseFloat((avgC3 / countC3).toFixed(2)) }] : []),
      { name: 'EFC', val: countEFC > 0 ? parseFloat((avgEFC / countEFC).toFixed(2)) : 0 },
    ];

    // Global module comparison
    const globalModuleData = availableModules.map(mod => {
      let total = 0, count = 0;
      filteredStudents.forEach(s => {
        const score = getModuleScore(s.id, mod);
        if (score !== null) { total += score; count++; }
      });
      return {
        name: mod.length > 22 ? mod.substring(0, 22) + '…' : mod,
        fullName: mod,
        moyenne: count > 0 ? parseFloat((total / count).toFixed(2)) : 0
      };
    }).sort((a, b) => b.moyenne - a.moyenne);

    const studentsWithAvg = studentRankings.filter(s => s.avg !== null);
    const classAvg = studentsWithAvg.length > 0
      ? studentsWithAvg.reduce((sum, s) => sum + s.avg, 0) / studentsWithAvg.length
      : null;
    const passCount = studentsWithAvg.filter(s => s.avg >= 10).length;
    const failCount = studentsWithAvg.filter(s => s.avg < 10).length;

    const donutData = [
      { name: `Admis (≥10)`, value: passCount, color: '#16a34a' },
      { name: `Non admis (<10)`, value: failCount, color: '#dc2626' },
    ];

    return {
      progressionData, globalModuleData, donutData,
      filteredStudentsCount: filteredStudents.length,
      studentRankings,
      toggleSort,
      classAvg,
      passCount,
      failCount,
      bestModule: globalModuleData[0] || null,
      worstModule: globalModuleData[globalModuleData.length - 1] || null,
    };
  }, [students, grades, selectedDiploma, selectedMajor, selectedYear, selectedModule, availableModules, availableModulesList, studentAttendance]);

  const sortedRankings = useMemo(() => {
    const copy = [...(analytics.studentRankings || [])];
    if (rankSort === 'avg_desc') return copy.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
    if (rankSort === 'avg_asc') return copy.sort((a, b) => (a.avg ?? -1) - (b.avg ?? -1));
    if (rankSort === 'name_asc') return copy.sort((a, b) => {
      const nameA = a.lastName ? `${a.lastName} ${a.firstName}` : (a.name || '');
      const nameB = b.lastName ? `${b.lastName} ${b.firstName}` : (b.name || '');
      return nameA.localeCompare(nameB);
    });
    if (rankSort === 'name_desc') return copy.sort((a, b) => {
      const nameA = a.lastName ? `${a.lastName} ${a.firstName}` : (a.name || '');
      const nameB = b.lastName ? `${b.lastName} ${b.firstName}` : (b.name || '');
      return nameB.localeCompare(nameA);
    });
    if (rankSort === 'abs_desc') return copy.sort((a, b) => (b.absenceRate ?? -1) - (a.absenceRate ?? -1));
    if (rankSort === 'abs_asc') return copy.sort((a, b) => (a.absenceRate ?? -1) - (b.absenceRate ?? -1));
    return copy;
  }, [analytics.studentRankings, rankSort]);

  const handleSortToggle = (field) => {
    setRankSort(prev => prev === `${field}_desc` ? `${field}_asc` : `${field}_desc`);
  };

  const hasAttendanceData = studentAttendance.length > 0;

  const allReportGroups = useMemo(() => {
    const groups = new Map();
    const addGroup = ({ diploma, major, year }) => {
      if (!diploma || !major || !year) return;
      const key = `${diploma}__${major}__${year}`;
      if (!groups.has(key)) groups.set(key, { diploma, major, year });
    };

    students.forEach(addGroup);
    allModules.forEach(addGroup);

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        studentsCount: students.filter(s => s.diploma === group.diploma && s.major === group.major && s.year === group.year).length,
        modulesCount: allModules.filter(m => m.diploma === group.diploma && m.major === group.major && m.year === group.year).length,
      }))
      .sort((a, b) => `${a.diploma} ${a.major} ${a.year}`.localeCompare(`${b.diploma} ${b.major} ${b.year}`));
  }, [students, allModules]);

  const getReportModuleDetails = useCallback((studentId, moduleName) => {
    const g = grades[studentId]?.[gradeModuleKey(moduleName)];
    const c1 = parseScore(g?.c1);
    const c2 = parseScore(g?.c2);
    const c3 = parseScore(g?.c3);
    const efcfp = parseScore(g?.efcfp);
    const efcft = parseScore(g?.efcft);
    let score = null;

    if (efcfp !== null && efcft !== null) {
      score = (efcfp + efcft) / 2;
    } else {
      const vals = [c1, c2, c3].filter(v => v !== null);
      score = vals.length > 0 ? vals.reduce((sum, val) => sum + val, 0) / vals.length : null;
    }

    return { c1, c2, c3, efcfp, efcft, score };
  }, [grades]);

  const getGroupModules = useCallback((group) => {
    const modulesMap = new Map();
    allModules
      .filter(m => m.diploma === group.diploma && m.major === group.major && m.year === group.year)
      .forEach(module => {
        if (!modulesMap.has(module.name)) modulesMap.set(module.name, module);
      });
    return Array.from(modulesMap.values());
  }, [allModules]);

  const getGroupStudents = useCallback((group) =>
    students.filter(s => s.diploma === group.diploma && s.major === group.major && s.year === group.year),
  [students]);

  const buildGroupStats = useCallback((group) => {
    const groupStudents = getGroupStudents(group);
    const groupModules = getGroupModules(group);

    const rankings = groupStudents.map(student => {
      let totalWeight = 0;
      let totalScore = 0;

      groupModules.forEach(module => {
        const { score } = getReportModuleDetails(student.id, module.name);
        if (score !== null) {
          const coefficient = parseFloat(module.coefficient);
          const weight = Number.isNaN(coefficient) ? 1 : coefficient;
          totalScore += score * weight;
          totalWeight += weight;
        }
      });

      const studentMonthAttendance = studentAttendance.filter(a => a.studentId === student.id);
      const absences = studentMonthAttendance.filter(a => a.status === 'absent').length;

      return {
        student,
        avg: totalWeight > 0 ? totalScore / totalWeight : null,
        absenceRate: studentMonthAttendance.length > 0 ? Math.round((absences / studentMonthAttendance.length) * 100) : null,
      };
    }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

    const rankedWithAvg = rankings.filter(item => item.avg !== null);
    const classAvg = rankedWithAvg.length > 0
      ? rankedWithAvg.reduce((sum, item) => sum + item.avg, 0) / rankedWithAvg.length
      : null;

    const moduleStats = groupModules.map(module => {
      const scores = groupStudents
        .map(student => getReportModuleDetails(student.id, module.name).score)
        .filter(score => score !== null);
      const avg = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

      return {
        name: module.name,
        coefficient: module.coefficient || 1,
        enteredCount: scores.length,
        avg,
        passCount: scores.filter(score => score >= 10).length,
        failCount: scores.filter(score => score < 10).length,
      };
    }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

    return {
      group,
      students: groupStudents,
      modules: groupModules,
      rankings,
      moduleStats,
      classAvg,
      passCount: rankedWithAvg.filter(item => item.avg >= 10).length,
      failCount: rankedWithAvg.filter(item => item.avg < 10).length,
    };
  }, [getGroupModules, getGroupStudents, getReportModuleDetails, studentAttendance]);

  const buildModuleStats = useCallback((group, moduleName) => {
    const groupStudents = getGroupStudents(group);
    const moduleRows = groupStudents.map(student => {
      const details = getReportModuleDetails(student.id, moduleName);
      return { student, ...details };
    });
    const scoredRows = moduleRows.filter(row => row.score !== null);
    const avg = scoredRows.length > 0
      ? scoredRows.reduce((sum, row) => sum + row.score, 0) / scoredRows.length
      : null;

    return {
      group,
      moduleName,
      rows: moduleRows,
      avg,
      enteredCount: scoredRows.length,
      passCount: scoredRows.filter(row => row.score >= 10).length,
      failCount: scoredRows.filter(row => row.score < 10).length,
    };
  }, [getGroupStudents, getReportModuleDetails]);

  const handleExportPDF = useCallback(() => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF('p', 'mm', 'a4');
        const w = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 10;

        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, w, doc.internal.pageSize.getHeight(), 'F');

        try { doc.addImage(logoBase64, 'PNG', margin, y, 40, 18); } catch {}

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text("Institut de formation professionnelle « établissement privé »", w - margin, y + 4, { align: 'right' });
        doc.text("agréé par le ministère de l'Inclusion économique, de la Petite entreprise,", w - margin, y + 8, { align: 'right' });
        doc.text("de l'Emploi et des Compétences, sous le numéro 4/01/6/2022", w - margin, y + 12, { align: 'right' });

        y = 34;
        doc.setDrawColor(180, 104, 185);
        doc.setLineWidth(0.6);
        doc.line(margin, y, w - margin, y);
        y += 8;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(30, 30, 30);
        doc.text('Rapport de Classe', w / 2, y, { align: 'center' });
        y += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        const groupLabel = `${selectedDiploma} · ${selectedMajor} · ${selectedYear}`;
        doc.text(groupLabel, w / 2, y, { align: 'center' });
        y += 5;
        doc.setFontSize(9);
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, w / 2, y, { align: 'center' });
        y += 8;

        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(margin, y, w - margin, y);
        y += 8;

        // KPI row
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('STAGIAIRES', margin, y);
        doc.text('MOY. PONDÉRÉE', margin + 40, y);
        doc.text('ADMIS', margin + 85, y);
        doc.text('NON ADMIS', margin + 115, y);
        y += 5;
        doc.setFontSize(15);
        doc.setTextColor(30, 30, 30);
        doc.text(String(analytics.filteredStudentsCount), margin, y);
        doc.setTextColor(analytics.classAvg !== null ? (analytics.classAvg >= 10 ? 22 : 180) : 120, analytics.classAvg !== null ? (analytics.classAvg >= 10 ? 163 : 38) : 120, analytics.classAvg !== null ? (analytics.classAvg >= 10 ? 74 : 38) : 120);
        doc.text(analytics.classAvg !== null ? analytics.classAvg.toFixed(2) + '/20' : '—', margin + 40, y);
        doc.setTextColor(22, 163, 74);
        doc.text(String(analytics.passCount), margin + 85, y);
        doc.setTextColor(220, 38, 38);
        doc.text(String(analytics.failCount), margin + 115, y);
        y += 10;

        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y, w - margin, y);
        y += 7;

        // Student ranking table
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        doc.text('Classement des Stagiaires', margin, y);
        y += 6;

        const colRank = margin;
        const colName = margin + 12;
        const colAvg = margin + 90;
        const colStatus = margin + 115;
        const colAbs = margin + 148;
        const rowH = 7;

        doc.setFillColor(245, 245, 250);
        doc.rect(margin, y, w - margin * 2, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text('RG', colRank, y + 4.5);
        doc.text('NOM & PRÉNOM', colName, y + 4.5);
        doc.text('MOYENNE', colAvg, y + 4.5);
        doc.text('RÉSULTAT', colStatus, y + 4.5);
        if (hasAttendanceData) doc.text('ABSENCES', colAbs, y + 4.5);
        y += rowH;

        sortedRankings.forEach((s, idx) => {
          if (y > 265) {
            doc.addPage();
            y = 20;
          }
          const isPass = s.avg !== null && s.avg >= 10;
          if (idx % 2 === 0) {
            doc.setFillColor(252, 252, 254);
            doc.rect(margin, y, w - margin * 2, rowH, 'F');
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(80, 80, 80);
          doc.text(String(idx + 1), colRank, y + 4.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 30, 30);
          const fullSName = s.lastName ? `${s.lastName} ${s.firstName}` : (s.name || '');
          const nameStr = fullSName.length > 28 ? fullSName.substring(0, 28) + '…' : fullSName;
          doc.text(nameStr, colName, y + 4.5);
          if (s.avg !== null) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isPass ? 22 : 220, isPass ? 163 : 38, isPass ? 74 : 38);
            doc.text(s.avg.toFixed(2), colAvg, y + 4.5);
            doc.setTextColor(isPass ? 22 : 220, isPass ? 163 : 38, isPass ? 74 : 38);
            doc.text(isPass ? 'Admis' : 'Non admis', colStatus, y + 4.5);
          } else {
            doc.setTextColor(160, 160, 160);
            doc.text('—', colAvg, y + 4.5);
            doc.text('—', colStatus, y + 4.5);
          }
          if (hasAttendanceData) {
            doc.setTextColor(s.absenceRate !== null && s.absenceRate > 20 ? 220 : 100, s.absenceRate !== null && s.absenceRate > 20 ? 38 : 100, 100);
            doc.text(s.absenceRate !== null ? `${s.absenceRate}%` : '—', colAbs, y + 4.5);
          }
          doc.setDrawColor(235, 235, 240);
          doc.setLineWidth(0.2);
          doc.line(margin, y + rowH, w - margin, y + rowH);
          y += rowH;
        });

        y += 8;
        if (analytics.globalModuleData.length > 0) {
          if (y > 240) { doc.addPage(); y = 20; }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(30, 30, 30);
          doc.text('Moyennes par Module (EFC)', margin, y);
          y += 6;

          doc.setFillColor(245, 245, 250);
          doc.rect(margin, y, w - margin * 2, rowH, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(120, 120, 120);
          doc.text('MODULE', margin, y + 4.5);
          doc.text('MOYENNE /20', margin + 120, y + 4.5);
          y += rowH;

          analytics.globalModuleData.forEach((mod, idx) => {
            if (y > 275) { doc.addPage(); y = 20; }
            if (idx % 2 === 0) {
              doc.setFillColor(252, 252, 254);
              doc.rect(margin, y, w - margin * 2, rowH, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(30, 30, 30);
            doc.text(mod.fullName.length > 40 ? mod.fullName.substring(0, 40) + '…' : mod.fullName, margin, y + 4.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(parseFloat(mod.moyenne) >= 10 ? 22 : 220, parseFloat(mod.moyenne) >= 10 ? 163 : 38, parseFloat(mod.moyenne) >= 10 ? 74 : 38);
            doc.text(String(mod.moyenne), margin + 120, y + 4.5);
            doc.setDrawColor(235, 235, 240);
            doc.setLineWidth(0.2);
            doc.line(margin, y + rowH, w - margin, y + rowH);
            y += rowH;
          });
        }

        doc.save(`rapport-classe-${selectedMajor.replace(/\s+/g, '-')}-${selectedYear.replace(/\s+/g, '-')}.pdf`);
      } catch (e) {
        console.error('PDF export error', e);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  }, [analytics, sortedRankings, selectedDiploma, selectedMajor, selectedYear, hasAttendanceData]);

  const drawGroupStatsPdf = useCallback((doc, stats, startY) => {
    const margin = 15;
    let y = startY;

    if (y > 245) {
      doc.addPage();
      y = addReportHeader(doc, 'Suite du rapport');
    }

    const groupLabel = `${stats.group.diploma} - ${stats.group.major} - ${stats.group.year}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(groupLabel, margin, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(135, 135, 135);
    doc.text('STAGIAIRES', margin, y);
    doc.text('MODULES', margin + 38, y);
    doc.text('MOYENNE', margin + 75, y);
    doc.text('ADMIS', margin + 113, y);
    doc.text('NON ADMIS', margin + 142, y);
    y += 5;

    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(String(stats.students.length), margin, y);
    doc.text(String(stats.modules.length), margin + 38, y);
    doc.setTextColor(stats.classAvg !== null && stats.classAvg >= 10 ? 22 : 220, stats.classAvg !== null && stats.classAvg >= 10 ? 163 : 38, stats.classAvg !== null && stats.classAvg >= 10 ? 74 : 38);
    doc.text(formatScore(stats.classAvg, '/20'), margin + 75, y);
    doc.setTextColor(22, 163, 74);
    doc.text(String(stats.passCount), margin + 113, y);
    doc.setTextColor(220, 38, 38);
    doc.text(String(stats.failCount), margin + 142, y);
    y += 10;

    const rankingHeaders = hasAttendanceData
      ? ['RG', 'NOM & PRENOM', 'MOY.', 'RESULTAT', 'ABS.']
      : ['RG', 'NOM & PRENOM', 'MOY.', 'RESULTAT'];
    const rankingWidths = hasAttendanceData ? [12, 72, 25, 34, 24] : [12, 82, 28, 38];
    const rankingRows = stats.rankings.map((item, index) => {
      const baseRow = [
        index + 1,
        getStudentName(item.student),
        formatScore(item.avg),
        item.avg === null ? '-' : item.avg >= 10 ? 'Admis' : 'Non admis',
      ];
      return hasAttendanceData
        ? [...baseRow, item.absenceRate !== null ? `${item.absenceRate}%` : '-']
        : baseRow;
    });

    y = drawPdfTable(doc, {
      title: 'Classement des stagiaires',
      headers: rankingHeaders,
      rows: rankingRows,
      widths: rankingWidths,
      startY: y,
    });

    const moduleRows = stats.moduleStats.map(module => [
      module.name,
      module.coefficient,
      module.enteredCount,
      formatScore(module.avg),
      module.passCount,
      module.failCount,
    ]);

    return drawPdfTable(doc, {
      title: 'Moyennes par module',
      headers: ['MODULE', 'COEF.', 'NOTES', 'MOY.', 'ADMIS', 'NON'],
      rows: moduleRows,
      widths: [72, 16, 20, 22, 18, 18],
      startY: y,
    });
  }, [hasAttendanceData]);

  const drawModuleStatsPdf = useCallback((doc, stats, startY) => {
    const margin = 15;
    let y = startY;

    if (y > 245) {
      doc.addPage();
      y = addReportHeader(doc, 'Suite du rapport');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(stats.moduleName, margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${stats.group.diploma} - ${stats.group.major} - ${stats.group.year}`, margin, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(135, 135, 135);
    doc.text('STAGIAIRES', margin, y);
    doc.text('NOTES SAISIES', margin + 38, y);
    doc.text('MOYENNE MODULE', margin + 78, y);
    doc.text('ADMIS', margin + 128, y);
    doc.text('NON ADMIS', margin + 154, y);
    y += 5;

    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(String(stats.rows.length), margin, y);
    doc.text(String(stats.enteredCount), margin + 38, y);
    doc.setTextColor(stats.avg !== null && stats.avg >= 10 ? 22 : 220, stats.avg !== null && stats.avg >= 10 ? 163 : 38, stats.avg !== null && stats.avg >= 10 ? 74 : 38);
    doc.text(formatScore(stats.avg, '/20'), margin + 78, y);
    doc.setTextColor(22, 163, 74);
    doc.text(String(stats.passCount), margin + 128, y);
    doc.setTextColor(220, 38, 38);
    doc.text(String(stats.failCount), margin + 154, y);
    y += 10;

    return drawPdfTable(doc, {
      title: 'Details des notes',
      headers: ['RG', 'NOM & PRENOM', 'C1', 'C2', 'C3', 'EFC P', 'EFC T', 'FINAL', 'RESULTAT'],
      rows: stats.rows.map((row, index) => [
        index + 1,
        getStudentName(row.student),
        formatScore(row.c1),
        formatScore(row.c2),
        formatScore(row.c3),
        formatScore(row.efcfp),
        formatScore(row.efcft),
        formatScore(row.score),
        row.score === null ? '-' : row.score >= 10 ? 'Admis' : 'Non admis',
      ]),
      widths: [8, 47, 16, 16, 16, 18, 18, 20, 28],
      startY: y,
      margin: 10,
    });
  }, []);

  const handleExportModulePDF = useCallback(() => {
    if (!selectedModule) return;
    setIsExporting(true);
    setTimeout(() => {
      try {
        const group = { diploma: selectedDiploma, major: selectedMajor, year: selectedYear };
        const stats = buildModuleStats(group, selectedModule);
        const doc = new jsPDF('p', 'mm', 'a4');
        const y = addReportHeader(doc, 'Rapport par module', `${selectedDiploma} - ${selectedMajor} - ${selectedYear}`);

        drawModuleStatsPdf(doc, stats, y);
        doc.save(`rapport-module-${safeFilePart(selectedMajor)}-${safeFilePart(selectedYear)}-${safeFilePart(selectedModule)}.pdf`);
      } catch (e) {
        console.error('Module PDF export error', e);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  }, [buildModuleStats, drawModuleStatsPdf, selectedDiploma, selectedMajor, selectedYear, selectedModule]);

  const handleExportAllGroupsPDF = useCallback(() => {
    if (allReportGroups.length === 0) return;
    setIsExporting(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF('p', 'mm', 'a4');
        let y = addReportHeader(doc, 'Rapports par groupe', 'Tous les groupes');

        allReportGroups.forEach((group, index) => {
          if (index > 0) {
            doc.addPage();
            y = addReportHeader(doc, 'Rapport par groupe', `${group.diploma} - ${group.major} - ${group.year}`);
          }
          y = drawGroupStatsPdf(doc, buildGroupStats(group), y);
        });

        doc.save('rapports-par-groupe.pdf');
      } catch (e) {
        console.error('All groups PDF export error', e);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  }, [allReportGroups, buildGroupStats, drawGroupStatsPdf]);

  const handleExportAllModulesPDF = useCallback(() => {
    const group = { diploma: selectedDiploma, major: selectedMajor, year: selectedYear };
    const modules = getGroupModules(group);
    if (modules.length === 0) return;

    setIsExporting(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF('p', 'mm', 'a4');
        let y = addReportHeader(doc, 'Rapports par module', `${selectedDiploma} - ${selectedMajor} - ${selectedYear}`);

        modules.forEach((module, index) => {
          if (index > 0) {
            doc.addPage();
            y = addReportHeader(doc, 'Rapport par module', `${selectedDiploma} - ${selectedMajor} - ${selectedYear}`);
          }
          y = drawModuleStatsPdf(doc, buildModuleStats(group, module.name), y);
        });

        doc.save(`rapports-modules-${safeFilePart(selectedMajor)}-${safeFilePart(selectedYear)}.pdf`);
      } catch (e) {
        console.error('All modules PDF export error', e);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  }, [buildModuleStats, drawModuleStatsPdf, getGroupModules, selectedDiploma, selectedMajor, selectedYear]);

  const handleExportGlobalPDF = useCallback(() => {
    if (allReportGroups.length === 0) return;
    setIsExporting(true);
    setTimeout(() => {
      try {
        const groupStats = allReportGroups.map(group => buildGroupStats(group));
        const allRankings = groupStats.flatMap(stats => stats.rankings.filter(item => item.avg !== null));
        const globalAvg = allRankings.length > 0
          ? allRankings.reduce((sum, item) => sum + item.avg, 0) / allRankings.length
          : null;
        const doc = new jsPDF('p', 'mm', 'a4');
        let y = addReportHeader(doc, 'Rapport global', 'Synthese de tous les groupes et modules');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(135, 135, 135);
        doc.text('GROUPES', 15, y);
        doc.text('STAGIAIRES', 50, y);
        doc.text('MODULES', 90, y);
        doc.text('MOYENNE GLOBALE', 125, y);
        y += 5;

        doc.setFontSize(14);
        doc.setTextColor(30, 30, 30);
        doc.text(String(groupStats.length), 15, y);
        doc.text(String(groupStats.reduce((sum, stats) => sum + stats.students.length, 0)), 50, y);
        doc.text(String(groupStats.reduce((sum, stats) => sum + stats.modules.length, 0)), 90, y);
        doc.setTextColor(globalAvg !== null && globalAvg >= 10 ? 22 : 220, globalAvg !== null && globalAvg >= 10 ? 163 : 38, globalAvg !== null && globalAvg >= 10 ? 74 : 38);
        doc.text(formatScore(globalAvg, '/20'), 125, y);
        y += 11;

        y = drawPdfTable(doc, {
          title: 'Synthese par groupe',
          headers: ['GROUPE', 'STAG.', 'MOD.', 'MOY.', 'ADMIS', 'NON'],
          rows: groupStats.map(stats => [
            `${stats.group.diploma} - ${stats.group.major} - ${stats.group.year}`,
            stats.students.length,
            stats.modules.length,
            formatScore(stats.classAvg),
            stats.passCount,
            stats.failCount,
          ]),
          widths: [78, 18, 18, 22, 18, 18],
          startY: y,
        });

        const moduleRows = groupStats.flatMap(stats =>
          stats.moduleStats.map(module => [
            `${stats.group.major} - ${stats.group.year}`,
            module.name,
            module.enteredCount,
            formatScore(module.avg),
            module.passCount,
            module.failCount,
          ])
        );

        drawPdfTable(doc, {
          title: 'Synthese par module',
          headers: ['GROUPE', 'MODULE', 'NOTES', 'MOY.', 'ADMIS', 'NON'],
          rows: moduleRows,
          widths: [40, 64, 18, 20, 18, 18],
          startY: y,
        });

        doc.save('rapport-global.pdf');
      } catch (e) {
        console.error('Global PDF export error', e);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  }, [allReportGroups, buildGroupStats]);

  const avgColor = analytics.classAvg === null ? 'var(--text-muted)'
    : analytics.classAvg >= 14 ? '#16a34a'
    : analytics.classAvg >= 10 ? '#d97706'
    : '#dc2626';

  return (
    <div className="section-padding" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <div style={{ padding: '10px', background: 'var(--primary-ultra-light)', color: 'var(--primary)', borderRadius: 'var(--radius-lg)' }}>
              <ChartLine size={22} />
            </div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '900', color: 'var(--text-primary)' }}>Analytique & Rapports</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Suivi visuel des performances académiques et de la progression.</p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={isExporting || analytics.filteredStudentsCount === 0}
          className="btn-modern primary"
          style={{ opacity: analytics.filteredStudentsCount === 0 ? 0.5 : 1, alignSelf: 'center' }}
        >
          <Download size={14} style={{ marginRight: '6px' }} />
          {isExporting ? 'Génération…' : 'Exporter PDF'}
        </button>
      </header>

      {/* Filter bar */}
      <div className="glass-card" style={{ padding: 'var(--space-5)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle}>Niveau</label>
          <select className="input-premium" style={{ minWidth: '180px' }} value={selectedDiploma} onChange={e => setSelectedDiploma(e.target.value)}>
            {Object.keys(MODULES_DATA).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle}>Filière</label>
          <select className="input-premium" style={{ minWidth: '200px' }} value={selectedMajor} onChange={e => setSelectedMajor(e.target.value)}>
            {availableMajors.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle}>Année</label>
          <select className="input-premium" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            <option value="1ère année">1ère année</option>
            <option value="2ème année">2ème année</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '220px' }}>
          <label style={labelStyle}>Module d'analyse</label>
          <select className="input-premium" value={selectedModule} onChange={e => setSelectedModule(e.target.value)}>
            {availableModules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Report generation */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '900', color: 'var(--text-primary)' }}>Generation de rapports</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Export PDF par groupe, par module, puis synthese globale.
            </p>
          </div>
          {isExporting && <span className="badge-status primary" style={{ fontSize: '11px' }}>Generation en cours...</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          <ReportAction
            icon={FileText}
            title="Rapport du groupe"
            description="Classement, moyenne et modules du groupe selectionne."
            onClick={handleExportPDF}
            disabled={isExporting || analytics.filteredStudentsCount === 0}
          />
          <ReportAction
            icon={BookOpen}
            title="Rapport du module"
            description="Notes C1, C2, C3, EFC et resultat du module selectionne."
            onClick={handleExportModulePDF}
            disabled={isExporting || !selectedModule}
          />
          <ReportAction
            icon={Files}
            title="Tous les groupes"
            description="Un PDF combine avec un rapport pour chaque groupe."
            onClick={handleExportAllGroupsPDF}
            disabled={isExporting || allReportGroups.length === 0}
          />
          <ReportAction
            icon={Layers}
            title="Tous les modules"
            description="Un PDF combine avec tous les modules du groupe selectionne."
            onClick={handleExportAllModulesPDF}
            disabled={isExporting || availableModulesList.length === 0}
          />
          <ReportAction
            icon={ChartLine}
            title="Rapport global"
            description="Synthese generale de tous les groupes et modules."
            onClick={handleExportGlobalPDF}
            disabled={isExporting || allReportGroups.length === 0}
          />
        </div>
      </motion.section>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
        <KPICard
          delay={0} label="Stagiaires" icon={Users}
          iconBg="rgba(99,102,241,0.08)" color="#6366f1"
          value={analytics.filteredStudentsCount}
          sub={`${selectedMajor} · ${selectedYear}`}
        />
        <KPICard
          delay={0.05} label="Moy. pondérée" icon={ChartLine}
          iconBg={analytics.classAvg === null ? 'var(--bg-subtle)' : analytics.classAvg >= 10 ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)'}
          color={avgColor}
          value={analytics.classAvg !== null ? analytics.classAvg.toFixed(2) + '/20' : '—'}
          sub={analytics.classAvg !== null ? (analytics.classAvg >= 10 ? 'Classe admissible' : 'Classe en difficulté') : 'Aucune note saisie'}
        />
        <KPICard
          delay={0.1} label="Meilleur module" icon={TrendingUp}
          iconBg="rgba(22,163,74,0.08)" color="#16a34a"
          value={analytics.bestModule ? analytics.bestModule.moyenne + '/20' : '—'}
          sub={analytics.bestModule?.fullName || ''}
        />
        <KPICard
          delay={0.15} label="Module à risque" icon={TrendingDown}
          iconBg="rgba(220,38,38,0.07)" color="#dc2626"
          value={analytics.worstModule ? analytics.worstModule.moyenne + '/20' : '—'}
          sub={analytics.worstModule?.fullName || ''}
        />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-5)' }}>

        {/* Line: Module progression */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card" style={{ padding: 'var(--space-6)', minHeight: '360px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
            <div>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '800' }}>Progression du Module</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{selectedModule || '—'} · C1 → EFC</p>
            </div>
            <div className="badge-status primary" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
              <Users size={11} /> {analytics.filteredStudentsCount}
            </div>
          </div>
          <div style={{ height: '270px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.progressionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-faint)' }} dy={10} />
                <YAxis domain={[0, 20]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--text-faint)' }} />
                <Tooltip contentStyle={{ background: 'white', border: 'none', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }} itemStyle={{ fontWeight: 800, color: 'var(--primary)' }} formatter={(v) => [v + '/20', 'Moyenne']} />
                <Line type="monotone" dataKey="val" stroke="var(--primary)" strokeWidth={3} dot={{ r: 5, fill: 'var(--primary)', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Donut: Pass/fail */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card" style={{ padding: 'var(--space-6)', minHeight: '360px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '800' }}>Admis / Non admis</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Basé sur la moyenne pondérée</p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {analytics.filteredStudentsCount === 0 || (analytics.passCount + analytics.failCount) === 0 ? (
              <div style={{ color: 'var(--text-faint)', fontSize: '12px', textAlign: 'center' }}>
                <Award size={32} style={{ opacity: 0.2, marginBottom: '8px' }} />
                <p>Aucune donnée disponible</p>
              </div>
            ) : (
              <>
                <div style={{ height: '220px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.donutData}
                        cx="50%" cy="50%"
                        innerRadius={62} outerRadius={88}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90} endAngle={-270}
                      >
                        {analytics.donutData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, name) => [v + ' stagiaire' + (v > 1 ? 's' : ''), name]} contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: 'var(--shadow-md)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                  {analytics.donutData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                        {d.name} — <span style={{ color: d.color }}>{d.value}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Bar: Inter-module comparison */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card" style={{ padding: 'var(--space-6)', minHeight: '360px' }}>
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '800' }}>Comparatif Inter-Modules</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Classement par moyenne finale (pondérée)</p>
          </div>
          <div style={{ height: '270px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.globalModuleData.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" domain={[0, 20]} hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 9.5, fontWeight: 700, fill: 'var(--text-primary)' }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: 'var(--shadow-md)' }} formatter={(v, _, p) => [v + '/20', p.payload.fullName || '']} />
                <Bar dataKey="moyenne" radius={[0, 8, 8, 0]} barSize={16}>
                  {analytics.globalModuleData.slice(0, 8).map((entry, i) => (
                    <Cell key={i} fill={parseFloat(entry.moyenne) >= 10 ? 'var(--primary)' : 'var(--danger)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Student ranking table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '800' }}>Classement des Stagiaires</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Moyenne pondérée par coefficient · {analytics.filteredStudentsCount} stagiaire{analytics.filteredStudentsCount !== 1 ? 's' : ''}</p>
          </div>
          {!hasAttendanceData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-faint)', background: 'var(--bg-subtle)', padding: '4px 10px', borderRadius: '20px' }}>
              <AlertTriangle size={10} /> Données présences non chargées
            </div>
          )}
        </div>

        {sortedRankings.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
            <Users size={28} style={{ opacity: 0.2, marginBottom: '8px' }} />
            <p>Aucun stagiaire dans ce groupe</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                <th style={{ padding: '10px 16px', width: '48px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>RG</span>
                </th>
                <th style={{ padding: '10px 16px' }}>
                  <SortBtn label="Nom & Prénom" field="name" sort={rankSort} onSort={handleSortToggle} />
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <SortBtn label="Moy. pond." field="avg" sort={rankSort} onSort={handleSortToggle} />
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Résultat</span>
                </th>
                {hasAttendanceData && (
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <SortBtn label="Absences" field="abs" sort={rankSort} onSort={handleSortToggle} />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedRankings.map((s, idx) => {
                const isPass = s.avg !== null && s.avg >= 10;
                const isMedal = idx < 3 && s.avg !== null;
                const medalColor = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#cd7f32';
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      {isMedal ? (
                        <Award size={15} style={{ color: medalColor }} />
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-faint)' }}>{idx + 1}</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <p style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                        {s.lastName ? `${s.lastName} ${s.firstName}` : (s.name || '—')}
                      </p>
                      {s.cin && <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '1px' }}>{s.cin}</p>}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      {s.avg !== null ? (
                        <span style={{
                          fontSize: '14px', fontWeight: '900',
                          color: s.avg >= 14 ? '#16a34a' : s.avg >= 10 ? '#d97706' : '#dc2626'
                        }}>
                          {s.avg.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      {s.avg !== null ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '800',
                          background: isPass ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)',
                          color: isPass ? '#16a34a' : '#dc2626',
                          border: `1px solid ${isPass ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.15)'}`,
                        }}>
                          {isPass ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {isPass ? 'Admis' : 'Non admis'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                    {hasAttendanceData && (
                      <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                        {s.absenceRate !== null ? (
                          <span style={{
                            fontSize: '12px', fontWeight: '800',
                            color: s.absenceRate > 30 ? '#dc2626' : s.absenceRate > 15 ? '#d97706' : '#16a34a'
                          }}>
                            {s.absenceRate}%
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
};

export default Reports;
