import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilterSelect } from '../components/ui/FilterSelect';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { FILIERES, getClassCode, getNextStudyYear, getStudyYearsForDiploma } from '../data/modules';
import { getGradeByModuleName, getStudentGradeModules, sanitizeGradeKey } from '../utils/gradeSync';
import {
  calcCcAverage,
  calcModuleAverage,
  calcStudentSynthesisAverages,
  parseScore,
} from '../utils/gradeCalculations';
import { isActiveStudent } from '../utils/studentStatus';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const getGroupAbbreviation = (filiere, annee) => getClassCode('', filiere, annee);

const getClassColor = (label) => {
  const colors = {
    'TSDI1': { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' },
    'TSDI2': { background: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' },
    'TSGTL1': { background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' },
    'TSGTL2': { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' },
    'TSGE1': { background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe' },
    'TSGE2': { background: '#ede9fe', color: '#6d28d9', borderColor: '#c7d2fe' },
    'TGI1': { background: '#fffbeb', color: '#d97706', borderColor: '#fde68a' },
    'TGI2': { background: '#fef3c7', color: '#b45309', borderColor: '#fcd34d' },
  };

  if (colors[label]) return colors[label];

  const hash = Array.from(label).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hues = [190, 340, 200, 280, 15, 160, 80, 120];
  const hue = hues[hash % hues.length];
  return {
    background: `hsl(${hue}, 85%, 96%)`,
    color: `hsl(${hue}, 85%, 32%)`,
    borderColor: `hsl(${hue}, 80%, 88%)`
  };
};

import { 
  FileText, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  GraduationCap, 
  CheckCircle2, 
  Clock, 
  History, 
  CloudUpload, 
  FileSignature, 
  Award,
  Info,
  Filter,
  X,
  Copy,
  SlidersHorizontal,
  PenTool
} from 'lucide-react';

/* ── Styles & Constants ── */
const lbl = { fontSize: 'var(--text-xs)', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' };
const thStyle = { padding: '12px 16px', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-subtle)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '12px 16px', borderBottom: '1px solid var(--border-light)' };
const EMPTY_GRADE = { c1: '', c2: '', c3: '', efcfp: '', efcft: '' };

/* ── Components ── */
const GradeInput = ({ value, onChange, placeholder = '—' }) => {
  const num = parseFloat(value);
  const isInvalid = value !== '' && value !== undefined && !isNaN(num) && (num < 0 || num > 20);
  return (
    <input type="number" step="0.25" className="input-premium"
      style={{ 
        width: '64px', textAlign: 'center', fontWeight: '700', padding: '6px 4px', fontSize: 'var(--text-sm)', margin: '0 auto',
        border: isInvalid ? '2px solid var(--danger)' : undefined,
        backgroundColor: isInvalid ? 'var(--danger-ultra-light)' : undefined,
        color: isInvalid ? 'var(--danger)' : undefined
      }}
      placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  );
};

const MiniStat = ({ label, value, icon: Icon }) => (
  <div className="grade-premium-mini-stat" style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <p style={{ fontSize: 'var(--text-lg)', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
    <p style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>{label}</p>
  </div>
);

const GradeManagement = () => {
  const { students = [], teachers = [], grades = {}, batchUpdateGrades, loading = false, modules: allModules = [], confirmAction } = useApp() || {};
  const { showToast } = useToast();
  const [entryMode, setEntryMode] = useState('student');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedGradeModule, setSelectedGradeModule] = useState('');
  const [filterDiploma, setFilterDiploma] = useState('');
  const [filterMajor, setFilterMajor] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [saved, setSaved] = useState(false);
  const [localGrades, setLocalGrades] = useState({});
  const [moduleLocalGrades, setModuleLocalGrades] = useState({});
  const [moduleDirtyStudentIds, setModuleDirtyStudentIds] = useState(() => new Set());
  const activeStudents = useMemo(() => (students || []).filter(isActiveStudent), [students]);

  // ── PDF States ──
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [pdfModule, setPdfModule] = useState('');
  const [pdfCC, setPdfCC] = useState('1');

  const filteredStudents = useMemo(() => {
    return activeStudents.filter(s => {
      if (filterDiploma && s.diploma !== filterDiploma) return false;
      if (filterMajor && s.major !== filterMajor) return false;
      if (filterYear && s.year !== filterYear) return false;
      return true;
    });
  }, [activeStudents, filterDiploma, filterMajor, filterYear]);

  const availableMajors = filterDiploma ? (FILIERES[filterDiploma] || []) : Array.from(new Set(activeStudents.map(s => s.major)));

  const selectedStudent = activeStudents.find(s => s.id === selectedStudentId);
  const supportsTwoYearFinalDocument = !!selectedStudent
    && getStudyYearsForDiploma(selectedStudent.diploma).length > 1
    && !getNextStudyYear(selectedStudent.diploma, selectedStudent.year);
  const studentModules = useMemo(() => {
    return getStudentGradeModules(allModules, selectedStudent);
  }, [selectedStudent, allModules]);
  
  const modules = studentModules.map(m => m.name);
  
  React.useEffect(() => {
    setLocalGrades(selectedStudent ? (grades[selectedStudent.id] || {}) : {});
  }, [selectedStudent, grades]);

  // Modules for PDF (based on filters, not selected student)
  const pdfModulesList = useMemo(() => {
    if (filterDiploma && filterMajor && filterYear) {
      return getStudentGradeModules(
        allModules,
        { diploma: filterDiploma, major: filterMajor, year: filterYear }
      );
    }
    return [];
  }, [filterDiploma, filterMajor, filterYear, allModules]);
  
  const pdfModules = pdfModulesList.map(m => m.name);

  const moduleStudents = useMemo(() => [...filteredStudents].sort((a, b) => {
    const regCompare = String(a.regNo || '').localeCompare(String(b.regNo || ''), 'fr', {
      numeric: true,
      sensitivity: 'base',
    });
    if (regCompare !== 0) return regCompare;
    return `${a.lastName || ''} ${a.firstName || ''}`.localeCompare(
      `${b.lastName || ''} ${b.firstName || ''}`,
      'fr',
      { sensitivity: 'base' }
    );
  }), [filteredStudents]);

  // Students for PDF (filtered)
  const pdfStudents = useMemo(() => {
    return activeStudents.filter(s => {
      if (filterDiploma && s.diploma !== filterDiploma) return false;
      if (filterMajor && s.major !== filterMajor) return false;
      if (filterYear && s.year !== filterYear) return false;
      return true;
    }).sort((a, b) => (a.regNo || '').localeCompare(b.regNo || ''));
  }, [activeStudents, filterDiploma, filterMajor, filterYear]);

  React.useEffect(() => {
    if (!selectedGradeModule) {
      setModuleLocalGrades({});
      setModuleDirtyStudentIds(new Set());
      return;
    }

    const nextGrades = {};
    moduleStudents.forEach(student => {
      nextGrades[student.id] = {
        ...EMPTY_GRADE,
        ...(getGradeByModuleName(grades[student.id], selectedGradeModule) || {}),
      };
    });
    setModuleLocalGrades(nextGrades);
    setModuleDirtyStudentIds(new Set());
  }, [grades, moduleStudents, selectedGradeModule]);

  const canDiscardModuleDraft = async () => {
    if (moduleDirtyStudentIds.size === 0 || !confirmAction) return true;
    return confirmAction({
      title: 'Notes non enregistrées',
      message: 'Des notes saisies par module ne sont pas encore enregistrées. Voulez-vous abandonner ces modifications ?',
      type: 'warning',
    });
  };

  const handleDiplomaFilterChange = async (value) => {
    if (!(await canDiscardModuleDraft())) return;
    setFilterDiploma(value);
    setFilterMajor('');
    setFilterYear('');
    setSelectedStudentId('');
    setSelectedGradeModule('');
    setPdfModule('');
  };

  const handleMajorFilterChange = async (value) => {
    if (!(await canDiscardModuleDraft())) return;
    setFilterMajor(value);
    setSelectedStudentId('');
    setSelectedGradeModule('');
    setPdfModule('');
  };

  const handleYearFilterChange = async (value) => {
    if (!(await canDiscardModuleDraft())) return;
    setFilterYear(value);
    setSelectedStudentId('');
    setSelectedGradeModule('');
    setPdfModule('');
  };

  const handleGradeModuleSelection = async (value) => {
    if (value === selectedGradeModule || !(await canDiscardModuleDraft())) return;
    setSelectedGradeModule(value);
    setSaved(false);
  };

  const handleGradeChange = (module, field, value) => {
    const safeModule = sanitizeGradeKey(module);
    setLocalGrades(prev => {
      const current = prev[safeModule] || { c1: '', c2: '', c3: '', efcfp: '', efcft: '' };
      return { ...prev, [safeModule]: { ...current, [field]: value } };
    });
  };

  const handleModuleGradeChange = (studentId, field, value) => {
    setModuleLocalGrades(prev => ({
      ...prev,
      [studentId]: {
        ...EMPTY_GRADE,
        ...(prev[studentId] || {}),
        [field]: value,
      },
    }));
    setModuleDirtyStudentIds(prev => {
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    let hasInvalid = false;
    Object.values(localGrades).forEach(g => {
      ['c1', 'c2', 'c3', 'efcfp', 'efcft'].forEach(field => {
        if (g[field] !== '' && g[field] !== undefined) {
          const num = parseFloat(g[field]);
          if (num < 0 || num > 20) hasInvalid = true;
        }
      });
    });

    if (hasInvalid) {
      showToast("Validation impossible : certaines notes sont invalides.", 'error');
      return;
    }
    
    if (!selectedStudentId) return;

    const updates = Object.keys(localGrades).map(moduleKey => ({
      studentId: selectedStudentId,
      subject: moduleKey,
      gradeData: localGrades[moduleKey]
    }));

    if (updates.length > 0) {
      await batchUpdateGrades(updates);
    }
    
    setSaved(true); 
    setTimeout(() => setSaved(false), 2500); 
  };

  const isValidGrade = (val) => {
    if (val === '' || val === undefined || val === null) return true;
    const num = Number(val);
    return Number.isFinite(num) && num >= 0 && num <= 20;
  };

  const handleSaveByModule = async () => {
    if (!selectedGradeModule || moduleDirtyStudentIds.size === 0) return;

    const dirtyIds = Array.from(moduleDirtyStudentIds);
    const hasInvalid = dirtyIds.some(studentId =>
      ['c1', 'c2', 'c3', 'efcfp', 'efcft'].some(field =>
        !isValidGrade(moduleLocalGrades[studentId]?.[field])
      )
    );

    if (hasInvalid) {
      showToast('Validation impossible : certaines notes sont invalides.', 'error');
      return;
    }

    await batchUpdateGrades(dirtyIds.map(studentId => ({
      studentId,
      subject: selectedGradeModule,
      gradeData: { ...EMPTY_GRADE, ...(moduleLocalGrades[studentId] || {}) },
    })));

    setModuleDirtyStudentIds(new Set());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const calcMoyenneCC = (g) => {
    if (!g) return null;
    if (!isValidGrade(g.c1) || !isValidGrade(g.c2) || !isValidGrade(g.c3)) return null;
    return calcCcAverage(g);
  };

  const calcAvg = (g) => {
    if (!g) return null;
    if (!isValidGrade(g.c1) || !isValidGrade(g.c2) || !isValidGrade(g.c3) || !isValidGrade(g.efcfp) || !isValidGrade(g.efcft)) return null;
    
    const cc = calcMoyenneCC(g);
    if (cc === null) return null;
    if (g.efcfp === '' || g.efcft === '') return null;
    const efcfp = parseScore(g.efcfp), efcft = parseScore(g.efcft);
    return calcModuleAverage({
      ccAverage: cc,
      theoretical: efcft,
      practical: efcfp,
    });
  };

  const isComplete = (g) => {
    if (!g || g.c1 === '' || g.c2 === '' || g.efcfp === '' || g.efcft === '') return false;
    return true;
  };

  const getMention = (avg) => {
    if (avg === null) return '';
    if (avg < 10) return { label: 'Faible', color: '#dc2626', bg: '#fef2f2' };
    if (avg < 12) return { label: 'Passable', color: '#d97706', bg: '#fffbeb' };
    if (avg < 14) return { label: 'A.Bien', color: '#059669', bg: '#ecfdf5' };
    if (avg < 16) return { label: 'Bien', color: '#2563eb', bg: '#eff6ff' };
    if (avg < 18) return { label: 'T.Bien', color: '#7c3aed', bg: '#f5f3ff' };
    return { label: 'Excellent', color: '#db2777', bg: '#fdf2f8' };
  };

  const generalAvg = () => {
    const { generalAverage } = calcStudentSynthesisAverages(localGrades, studentModules);
    return generalAverage !== null ? generalAverage.toFixed(2) : '—';
  };

  const completedModules = modules.filter(mod => isComplete(getGradeByModuleName(localGrades, mod))).length;
  const completedModuleStudents = moduleStudents.filter(student =>
    isComplete(moduleLocalGrades[student.id])
  ).length;

  // ── PDF Handlers ──
  const findFormateur = (moduleName) => {
    const t = teachers.find(t => (t.subjects || [t.subject]).includes(moduleName));
    return t ? t.name : '';
  };

  const handleFicheSignature = async () => {
    if (!pdfModule || !pdfStudents.length) return;
    const { generateFicheSignature } = await import('../utils/pdfGenerator');
    await generateFicheSignature({
      students: pdfStudents,
      filiere: filterMajor,
      niveau: filterYear || '',
      module: pdfModule,
      ccNumber: pdfCC,
      formateur: findFormateur(pdfModule),
      allGrades: grades,
    });
    showToast('Fiche de signature générée', 'success');
  };

  const handleFicheNotes = async () => {
    if (!pdfModule || !pdfStudents.length) return;
    const { generateFicheNotes } = await import('../utils/pdfGenerator');
    await generateFicheNotes({
      students: pdfStudents,
      filiere: filterMajor,
      classe: filterYear || '',
      anneeFormation: '2025-2026',
      module: pdfModule,
      formateur: findFormateur(pdfModule),
      allGrades: grades,
    });
    showToast('Fiche de notes générée', 'success');
  };

  const handleBulletinGlobal = async () => {
    if (!selectedStudent) return;
    const { generateBulletinGlobal } = await import('../utils/pdfGenerator');
    await generateBulletinGlobal(selectedStudent, grades, studentModules);
    showToast('Bulletin généré', 'success');
  };

  const handleNoteObtentionDiplome = async () => {
    if (!selectedStudent) return;
    const { generateNoteObtentionDiplome } = await import('../utils/pdfGenerator');
    await generateNoteObtentionDiplome(selectedStudent, grades, modules);
    showToast('Attestation générée', 'success');
  };

  if (loading && activeStudents.length === 0) {
    return (
      <div className="max-w-container section-padding">
        <TableSkeleton rows={12} />
      </div>
    );
  }

  return (
    <div className="max-w-container section-padding grade-premium-page">
      <motion.div className="grade-premium-header" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grade-premium-header-icon">
          <PenTool size={24} />
        </div>
        <div className="grade-premium-header-copy">
          <span className="grade-premium-eyebrow">Évaluation et résultats</span>
          <h1>
          Gestion des Notes
          {filterDiploma && filterMajor && filterYear && (
            <span style={{
              ...getClassColor(getGroupAbbreviation(filterMajor, filterYear)),
              padding: '3px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '800',
              border: '1px solid currentColor',
              borderWidth: '1px',
              display: 'inline-block'
            }}>
              {getGroupAbbreviation(filterMajor, filterYear)}
            </span>
          )}
          </h1>
          <p>Saisie centralisée des résultats académiques par stagiaire ou par module.</p>
        </div>
        <div className="grade-premium-header-orb" aria-hidden="true">
          <GraduationCap size={112} />
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="glass-card grade-premium-filter-card">
        <div
          role="tablist"
          aria-label="Mode de saisie des notes"
          style={{
            display: 'inline-flex',
            gap: '4px',
            padding: '4px',
            marginBottom: '20px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-light)',
          }}
        >
          {[
            { value: 'student', label: 'Par stagiaire' },
            { value: 'module', label: 'Par module' },
          ].map(mode => {
            const isActive = entryMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setEntryMode(mode.value);
                  setSaved(false);
                }}
                style={{
                  padding: '9px 18px',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '800',
                  color: isActive ? 'white' : 'var(--text-muted)',
                  background: isActive ? 'var(--primary)' : 'transparent',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 160ms ease',
                }}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
        <div className="grade-premium-section-heading">
          <span className="grade-premium-section-icon"><SlidersHorizontal size={15} /></span>
          <div>
            <h2>Filtres de saisie</h2>
            <p>
              {entryMode === 'student'
                ? 'Sélectionnez une classe puis un stagiaire pour saisir ses résultats.'
                : 'Sélectionnez une classe puis un module pour saisir les notes de tous les stagiaires.'}
            </p>
          </div>
        </div>
        <div className="grade-premium-filter-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={lbl}>Niveau</label>
            <FilterSelect
              value={filterDiploma}
              onChange={handleDiplomaFilterChange}
              options={[
                { label: "-- Choisir le niveau --", value: "" },
                ...Object.keys(FILIERES).map(d => ({ label: d, value: d }))
              ]}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={lbl}>Filière</label>
            <FilterSelect
              value={filterMajor}
              onChange={handleMajorFilterChange}
              options={[
                { label: "-- Choisir la filière --", value: "" },
                ...availableMajors.map(m => ({ label: m, value: m }))
              ]}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={lbl}>Année</label>
            <FilterSelect
              value={filterYear}
              onChange={handleYearFilterChange}
              options={[
                { label: "-- Choisir l'année --", value: "" },
                ...getStudyYearsForDiploma(filterDiploma).map(year => ({ label: year, value: year }))
              ]}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={lbl}>{entryMode === 'student' ? 'Stagiaire' : 'Module'}</label>
            {entryMode === 'student' ? (
              <FilterSelect
                value={selectedStudentId}
                onChange={(val) => setSelectedStudentId(val)}
                options={[
                  { label: "Sélectionner un stagiaire", value: "" },
                  ...filteredStudents.map(s => ({
                    label: `${s.lastName} ${s.firstName} [${getGroupAbbreviation(s.major, s.year)}]`,
                    value: s.id
                  }))
                ]}
              />
            ) : (
              <FilterSelect
                value={selectedGradeModule}
                onChange={handleGradeModuleSelection}
                options={[
                  { label: 'Sélectionner un module', value: '' },
                  ...pdfModules.map(module => ({ label: module, value: module })),
                ]}
              />
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Documents Section ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="glass-card grade-premium-doc-panel">
        <button onClick={() => setShowDocPanel(!showDocPanel)}
          style={{ width: '100%', padding: '16px 24px', background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-lg)', background: 'var(--primary-ultra-light)', color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} />
            </div>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: '800', color: 'var(--text-primary)' }}>
              Édition des Documents PDF
            </span>
          </div>
          {showDocPanel ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <AnimatePresence>
          {showDocPanel && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0 24px 24px', borderTop: '1px solid var(--border-light)' }}>
                
                {filterDiploma && filterMajor && filterYear && pdfModules.length > 0 && (
                  <div style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                    <label style={lbl}>Module Cible</label>
                    <div style={{ marginTop: '8px' }}>
                      <FilterSelect
                        value={pdfModule}
                        onChange={(val) => setPdfModule(val)}
                        options={[
                          { label: "Sélectionner un module", value: "" },
                          ...pdfModules.map(m => ({ label: m, value: m }))
                        ]}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)', marginTop: '12px' }}>
                  
                  <div className="grade-premium-doc-card" style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <FileSignature size={16} style={{ color: 'var(--primary)' }} />
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: '800' }}>Fiche de Notes (CC)</h4>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700' }}>Examen</label>
                      <div style={{ width: '100px' }}>
                        <FilterSelect
                          value={pdfCC}
                          onChange={(val) => setPdfCC(val)}
                          options={[
                            { label: "CC1", value: "1" },
                            { label: "CC2", value: "2" },
                            { label: "CC3", value: "3" }
                          ]}
                        />
                      </div>
                    </div>
                    <button onClick={handleFicheSignature} disabled={!pdfModule} className="btn-modern primary" style={{ width: '100%', opacity: !pdfModule ? 0.5 : 1 }}>
                      <Download size={14} style={{ marginRight: '8px' }} /> Télécharger
                    </button>
                  </div>

                  <div className="grade-premium-doc-card" style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <FileText size={16} style={{ color: '#d97706' }} />
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: '800' }}>Fiche de Notes (EFC)</h4>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '22px' }}>Modèle pour les examens de fin de module.</p>
                    <button onClick={handleFicheNotes} disabled={!pdfModule} className="btn-modern primary" style={{ width: '100%', background: '#d97706', borderColor: '#d97706', opacity: !pdfModule ? 0.5 : 1 }}>
                      <Download size={14} style={{ marginRight: '8px' }} /> Télécharger
                    </button>
                  </div>

                  <div className="grade-premium-doc-card" style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <GraduationCap size={16} style={{ color: '#16a34a' }} />
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: '800' }}>Bulletin Global</h4>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '22px' }}>Relevé complet du stagiaire sélectionné.</p>
                    <button onClick={handleBulletinGlobal} disabled={!selectedStudent} className="btn-modern primary" style={{ width: '100%', background: '#16a34a', borderColor: '#16a34a', opacity: !selectedStudent ? 0.5 : 1 }}>
                      <Download size={14} style={{ marginRight: '8px' }} /> Bulletin
                    </button>
                  </div>

                  <div className="grade-premium-doc-card" style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <Award size={16} style={{ color: '#8b5cf6' }} />
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: '800' }}>Attestation Admis</h4>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '22px' }}>Note d'obtention disponible en fin de cycle de deux années.</p>
                    <button onClick={handleNoteObtentionDiplome} disabled={!supportsTwoYearFinalDocument} className="btn-modern primary" style={{ width: '100%', background: '#8b5cf6', borderColor: '#8b5cf6', opacity: supportsTwoYearFinalDocument ? 1 : 0.5 }}>
                      <Download size={14} style={{ marginRight: '8px' }} /> Attestation
                    </button>
                  </div>

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Student Content ── */}
      <AnimatePresence mode="wait">
        {entryMode === 'module' ? (
          selectedGradeModule ? (
            <motion.div
              className="grade-premium-student-panel"
              key={`module-${selectedGradeModule}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="grade-premium-student-header" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                  <div style={{ width: '48px', height: '48px', flex: '0 0 48px', borderRadius: 'var(--radius-xl)', background: 'var(--primary-ultra-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light)' }}>
                    <PenTool size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '800', overflowWrap: 'anywhere' }}>
                      {selectedGradeModule}
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '4px' }}>
                      {filterMajor} · {filterYear} · saisie par module
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <MiniStat label="Stagiaires" value={moduleStudents.length} />
                  <MiniStat label="Complets" value={`${completedModuleStudents}/${moduleStudents.length}`} />
                  <button
                    onClick={handleSaveByModule}
                    disabled={moduleDirtyStudentIds.size === 0}
                    className="btn-modern primary"
                    style={{ padding: '12px 24px', opacity: moduleDirtyStudentIds.size === 0 ? 0.55 : 1 }}
                  >
                    <CloudUpload size={18} style={{ marginRight: '8px' }} />
                    Enregistrer{moduleDirtyStudentIds.size > 0 ? ` (${moduleDirtyStudentIds.size})` : ''}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {saved && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    style={{ background: 'var(--success-ultra-light)', border: '1px solid var(--success-light)', borderRadius: 'var(--radius-lg)', padding: '12px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: '700', color: 'var(--success)' }}>Notes du module synchronisées avec succès.</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {moduleStudents.length === 0 ? (
                <div className="grade-premium-empty-shell">
                  <EmptyState title="Aucun stagiaire" message="Aucun stagiaire actif ne correspond à cette classe." icon="search" />
                </div>
              ) : (
                <div className="glass-card grade-premium-table-shell">
                  <div style={{ overflowX: 'auto' }}>
                    <table className="grade-premium-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '1120px' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>#</th>
                          <th style={thStyle}>N° inscription</th>
                          <th style={thStyle}>Stagiaire</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>CC1</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>CC2</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>CC3</th>
                          <th style={{ ...thStyle, textAlign: 'center', background: 'rgba(0,0,0,0.02)' }}>Moy CC</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>EFCFP</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>EFCFT</th>
                          <th style={{ ...thStyle, textAlign: 'center', background: 'var(--primary-ultra-light)' }}>Générale</th>
                          <th style={{ ...thStyle, textAlign: 'center' }}>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {moduleStudents.map((student, idx) => {
                          const g = moduleLocalGrades[student.id] || EMPTY_GRADE;
                          const moyCC = calcMoyenneCC(g);
                          const avg = calcAvg(g);
                          const complete = isComplete(g);
                          const isDirty = moduleDirtyStudentIds.has(student.id);

                          return (
                            <tr key={student.id} className="grade-premium-table-row" style={{ background: idx % 2 === 0 ? 'white' : 'var(--bg-subtle)' }}>
                              <td style={tdStyle}><span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-faint)' }}>{idx + 1}</span></td>
                              <td style={tdStyle}><span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{student.regNo || '—'}</span></td>
                              <td style={tdStyle}>
                                <p style={{ fontSize: 'var(--text-sm)', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                  {student.lastName} {student.firstName}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                  {isDirty ? <CloudUpload size={10} style={{ color: 'var(--warning)' }} /> : complete ? <CheckCircle2 size={10} style={{ color: 'var(--success)' }} /> : <Clock size={10} style={{ color: 'var(--text-faint)' }} />}
                                  <span style={{ fontSize: '9px', fontWeight: '800', color: isDirty ? 'var(--warning)' : complete ? 'var(--success)' : 'var(--text-faint)', textTransform: 'uppercase' }}>
                                    {isDirty ? 'Modifié' : complete ? 'Complet' : 'Partiel'}
                                  </span>
                                </div>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.c1 ?? ''} onChange={(v) => handleModuleGradeChange(student.id, 'c1', v)} /></td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.c2 ?? ''} onChange={(v) => handleModuleGradeChange(student.id, 'c2', v)} /></td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.c3 ?? ''} onChange={(v) => handleModuleGradeChange(student.id, 'c3', v)} placeholder="opt." /></td>
                              <td style={{ ...tdStyle, textAlign: 'center', background: 'rgba(0,0,0,0.01)' }}>
                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: '800' }}>{moyCC !== null ? moyCC.toFixed(2) : '—'}</span>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.efcfp ?? ''} onChange={(v) => handleModuleGradeChange(student.id, 'efcfp', v)} /></td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.efcft ?? ''} onChange={(v) => handleModuleGradeChange(student.id, 'efcft', v)} /></td>
                              <td style={{ ...tdStyle, textAlign: 'center', background: 'var(--primary-ultra-light)' }}>
                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: '900', color: avg !== null ? (avg >= 10 ? 'var(--primary)' : 'var(--accent)') : 'var(--text-faint)' }}>
                                  {avg !== null ? avg.toFixed(2) : '—'}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                {avg !== null ? (
                                  <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', background: getMention(avg).bg, color: getMention(avg).color }}>
                                    {getMention(avg).label}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-faint)' }}>Non saisi</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="grade-premium-empty-shell">
              <EmptyState
                title="Aucun module sélectionné"
                message="Sélectionnez une classe et un module pour saisir les notes de tous les stagiaires."
                icon="book"
              />
            </div>
          )
        ) : selectedStudent ? (
          <motion.div className="grade-premium-student-panel" key={selectedStudentId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="grade-premium-student-header" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-ultra-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '900', border: '1px solid var(--border-light)' }}>
                  {selectedStudent.lastName[0]}
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedStudent.lastName} {selectedStudent.firstName}
                    <span style={{
                      ...getClassColor(getGroupAbbreviation(selectedStudent.major, selectedStudent.year)),
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '800',
                      border: '1px solid currentColor',
                      borderWidth: '1px',
                      display: 'inline-block'
                    }}>
                      {getGroupAbbreviation(selectedStudent.major, selectedStudent.year)}
                    </span>
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '4px' }}>
                    {selectedStudent.major} · {selectedStudent.year}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <MiniStat label="Moyenne" value={generalAvg()} />
                <MiniStat label="Validés" value={`${completedModules}/${modules.length}`} />
                <button onClick={handleSave} className="btn-modern primary" style={{ padding: '12px 24px' }}>
                  <CloudUpload size={18} style={{ marginRight: '8px' }} /> Enregistrer
                </button>
              </div>
            </div>

            <AnimatePresence>
              {saved && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  style={{ background: 'var(--success-ultra-light)', border: '1px solid var(--success-light)', borderRadius: 'var(--radius-lg)', padding: '12px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: '700', color: 'var(--success)' }}>Notes synchronisées avec succès.</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 2nd Year Specific Saisie */}
            {supportsTwoYearFinalDocument && (
              <div className="glass-card grade-premium-history-card" style={{ padding: '20px', marginBottom: '20px', background: 'rgba(99, 102, 241, 0.03)', border: '1px dashed var(--primary-light)' }}>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: '800', marginBottom: '16px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={16} /> Historique & NSTI
                </h4>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={lbl}>Moy CC (1ère)</label>
                    <GradeInput value={(localGrades.firstYear || {}).moyCC || ''} onChange={(v) => handleGradeChange('firstYear', 'moyCC', v)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={lbl}>EFCFT (1ère)</label>
                    <GradeInput value={(localGrades.firstYear || {}).moyEFCFT || ''} onChange={(v) => handleGradeChange('firstYear', 'moyEFCFT', v)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={lbl}>EFCFP (1ère)</label>
                    <GradeInput value={(localGrades.firstYear || {}).moyEFCFP || ''} onChange={(v) => handleGradeChange('firstYear', 'moyEFCFP', v)} />
                  </div>
                  <div style={{ width: '1px', background: 'var(--border-light)' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ ...lbl, color: 'var(--accent)' }}>Note NSTI</label>
                    <GradeInput value={(localGrades.firstYear || {}).nsti || ''} onChange={(v) => handleGradeChange('firstYear', 'nsti', v)} />
                  </div>
                </div>
              </div>
            )}

            {/* Main Grade Table */}
            {modules.length === 0 ? (
              <div className="grade-premium-empty-shell">
                <EmptyState title="Aucun module" message="Configurez les modules pour cette filière dans la gestion des modules." icon="book" />
              </div>
            ) : (
              <div className="glass-card grade-premium-table-shell">
                <div style={{ overflowX: 'auto' }}>
                  <table className="grade-premium-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '980px' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Désignation Module</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>CC1</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>CC2</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>CC3</th>
                        <th style={{ ...thStyle, textAlign: 'center', background: 'rgba(0,0,0,0.02)' }}>Moy CC</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>EFCFP</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>EFCFT</th>
                        <th style={{ ...thStyle, textAlign: 'center', background: 'var(--primary-ultra-light)' }}>Générale</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((mod, idx) => {
                        const g = getGradeByModuleName(localGrades, mod) || { c1: '', c2: '', c3: '', efcfp: '', efcft: '' };
                        const moyCC = calcMoyenneCC(g);
                        const avg = calcAvg(g);
                        const complete = isComplete(g);
                        return (
                          <tr key={mod} className="grade-premium-table-row" style={{ background: idx % 2 === 0 ? 'white' : 'var(--bg-subtle)' }}>
                            <td style={tdStyle}><span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-faint)' }}>{idx + 1}</span></td>
                            <td style={tdStyle}>
                              <p style={{ fontSize: 'var(--text-sm)', fontWeight: '700', color: 'var(--text-primary)' }}>{mod}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                {complete ? <CheckCircle2 size={10} style={{ color: 'var(--success)' }} /> : <Clock size={10} style={{ color: 'var(--text-faint)' }} />}
                                <span style={{ fontSize: '9px', fontWeight: '800', color: complete ? 'var(--success)' : 'var(--text-faint)', textTransform: 'uppercase' }}>{complete ? 'Complet' : 'Partiel'}</span>
                              </div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.c1} onChange={(v) => handleGradeChange(mod, 'c1', v)} /></td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.c2} onChange={(v) => handleGradeChange(mod, 'c2', v)} /></td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.c3 || ''} onChange={(v) => handleGradeChange(mod, 'c3', v)} placeholder="opt." /></td>
                            <td style={{ ...tdStyle, textAlign: 'center', background: 'rgba(0,0,0,0.01)' }}>
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: '800' }}>{moyCC !== null ? moyCC.toFixed(2) : '—'}</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.efcfp} onChange={(v) => handleGradeChange(mod, 'efcfp', v)} /></td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}><GradeInput value={g.efcft} onChange={(v) => handleGradeChange(mod, 'efcft', v)} /></td>
                            <td style={{ ...tdStyle, textAlign: 'center', background: 'var(--primary-ultra-light)' }}>
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: '900', color: avg !== null ? (avg >= 10 ? 'var(--primary)' : 'var(--accent)') : 'var(--text-faint)' }}>
                                {avg !== null ? avg.toFixed(2) : '—'}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              {avg !== null && (
                                <span style={{ 
                                  padding: '4px 10px', 
                                  borderRadius: 'var(--radius-pill)', 
                                  fontSize: '9px', 
                                  fontWeight: '800', 
                                  textTransform: 'uppercase',
                                  background: getMention(avg).bg, 
                                  color: getMention(avg).color 
                                }}>
                                  {getMention(avg).label}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="grade-premium-empty-shell">
            <EmptyState
              title="Aucun stagiaire sélectionné"
              message="Utilisez les filtres ci-dessus pour rechercher un stagiaire et gérer ses notes académiques."
              icon="search"
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GradeManagement;
