import React, { useState, useMemo } from 'react';
import ShadcnSelect from '../components/ShadcnSelect';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { FILIERES } from '../data/modules';
import { generateFicheSignature, generateFicheNotes, generateBulletinGlobal, generateNoteObtentionDiplome } from '../utils/pdfGenerator';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
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
  Copy
} from 'lucide-react';

/* ── Styles & Constants ── */
const lbl = { fontSize: 'var(--text-xs)', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' };
const thStyle = { padding: '12px 16px', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-subtle)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '12px 16px', borderBottom: '1px solid var(--border-light)' };
const selectStyle = { cursor: 'pointer', paddingRight: '36px' };

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
  <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <p style={{ fontSize: 'var(--text-lg)', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
    <p style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>{label}</p>
  </div>
);

const GradeManagement = () => {
  const { students = [], teachers = [], grades = {}, batchUpdateGrades, loading = false, modules: allModules = [], confirmAction } = useApp() || {};
  const { showToast } = useToast();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [filterDiploma, setFilterDiploma] = useState('');
  const [filterMajor, setFilterMajor] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [saved, setSaved] = useState(false);
  const [localGrades, setLocalGrades] = useState({});

  // ── PDF States ──
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [pdfModule, setPdfModule] = useState('');
  const [pdfCC, setPdfCC] = useState('1');

  const filteredStudents = useMemo(() => {
    return (students || []).filter(s => {
      if (filterDiploma && s.diploma !== filterDiploma) return false;
      if (filterMajor && s.major !== filterMajor) return false;
      if (filterYear && s.year !== filterYear) return false;
      return true;
    });
  }, [students, filterDiploma, filterMajor, filterYear]);

  const availableMajors = filterDiploma ? (FILIERES[filterDiploma] || []) : Array.from(new Set(students.map(s => s.major)));

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const studentModules = useMemo(() => {
    if (!selectedStudent) return [];
    return allModules.filter(m => 
      m.diploma === selectedStudent.diploma && 
      m.major === selectedStudent.major && 
      m.year === selectedStudent.year
    );
  }, [selectedStudent, allModules]);
  
  const modules = studentModules.map(m => m.name);
  
  React.useEffect(() => {
    setLocalGrades(selectedStudent ? (grades[selectedStudent.id] || {}) : {});
  }, [selectedStudent, grades]);

  // Modules for PDF (based on filters, not selected student)
  const pdfModulesList = useMemo(() => {
    if (filterDiploma && filterMajor && filterYear) {
      return allModules.filter(m => 
        m.diploma === filterDiploma && 
        m.major === filterMajor && 
        m.year === filterYear
      );
    }
    return [];
  }, [filterDiploma, filterMajor, filterYear, allModules]);
  
  const pdfModules = pdfModulesList.map(m => m.name);

  // Students for PDF (filtered)
  const pdfStudents = useMemo(() => {
    return (students || []).filter(s => {
      if (filterDiploma && s.diploma !== filterDiploma) return false;
      if (filterMajor && s.major !== filterMajor) return false;
      if (filterYear && s.year !== filterYear) return false;
      return true;
    }).sort((a, b) => (a.regNo || '').localeCompare(b.regNo || ''));
  }, [students, filterDiploma, filterMajor, filterYear]);

  const handleGradeChange = (module, field, value) => {
    const safeModule = module.replace(/\./g, '_');
    setLocalGrades(prev => {
      const current = prev[safeModule] || { c1: '', c2: '', c3: '', efcfp: '', efcft: '' };
      return { ...prev, [safeModule]: { ...current, [field]: value } };
    });
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
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 20;
  };

  const calcMoyenneCC = (g) => {
    if (!g || g.c1 === '' || g.c2 === '') return null;
    if (!isValidGrade(g.c1) || !isValidGrade(g.c2) || !isValidGrade(g.c3)) return null;
    
    const c1 = parseFloat(g.c1), c2 = parseFloat(g.c2);
    if (isNaN(c1) || isNaN(c2)) return null;
    if (g.c3 !== '' && g.c3 !== undefined && g.c3 !== null) {
      const c3 = parseFloat(g.c3);
      if (!isNaN(c3)) return (c1 + c2 + c3) / 3;
    }
    return (c1 + c2) / 2;
  };

  const calcAvg = (g) => {
    if (!g) return null;
    if (!isValidGrade(g.c1) || !isValidGrade(g.c2) || !isValidGrade(g.c3) || !isValidGrade(g.efcfp) || !isValidGrade(g.efcft)) return null;
    
    const cc = calcMoyenneCC(g);
    if (cc === null) return null;
    if (g.efcfp === '' || g.efcft === '') return null;
    const efcfp = parseFloat(g.efcfp), efcft = parseFloat(g.efcft);
    if (isNaN(efcfp) || isNaN(efcft)) return null;
    return (cc * 3 + efcft * 2 + efcfp * 3) / 8;
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
    let sumCC = 0, sumFT = 0, sumFP = 0, cnt = 0;
    studentModules.forEach(mod => {
      const g = localGrades[mod.name.replace(/\./g, '_')];
      const cc = calcMoyenneCC(g);
      if (cc !== null && g?.efcft !== '' && g?.efcft !== undefined && g?.efcfp !== '' && g?.efcfp !== undefined) {
        sumCC += cc;
        sumFT += parseFloat(g.efcft);
        sumFP += parseFloat(g.efcfp);
        cnt++;
      }
    });
    if (cnt === 0) return '—';
    const mCC = sumCC / cnt;
    const mFT = sumFT / cnt;
    const mFP = sumFP / cnt;
    return (((mCC * 3) + (mFT * 2) + (mFP * 3)) / 8).toFixed(2);
  };

  const completedModules = modules.filter(mod => isComplete(localGrades[mod.replace(/\./g, '_')])).length;

  // ── PDF Handlers ──
  const findFormateur = (moduleName) => {
    const t = teachers.find(t => (t.subjects || [t.subject]).includes(moduleName));
    return t ? t.name : '';
  };

  const handleFicheSignature = () => {
    if (!pdfModule || !pdfStudents.length) return;
    generateFicheSignature({
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

  const handleFicheNotes = () => {
    if (!pdfModule || !pdfStudents.length) return;
    generateFicheNotes({
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

  const handleBulletinGlobal = () => {
    if (!selectedStudent) return;
    generateBulletinGlobal(selectedStudent, grades, modules);
    showToast('Bulletin généré', 'success');
  };

  const handleNoteObtentionDiplome = () => {
    if (!selectedStudent) return;
    generateNoteObtentionDiplome(selectedStudent, grades, modules);
    showToast('Attestation générée', 'success');
  };

  if (loading && students.length === 0) {
    return (
      <div className="max-w-container section-padding">
        <TableSkeleton rows={12} />
      </div>
    );
  }

  return (
    <div className="max-w-container section-padding">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Gestion des Notes
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-8)' }}>
          Saisie centralisée des résultats académiques par stagiaire.
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={lbl}>Niveau</label>
            <ShadcnSelect
              value={filterDiploma}
              onChange={(val) => { setFilterDiploma(val); setFilterMajor(''); setSelectedStudentId(''); setPdfModule(''); }}
              options={Object.keys(FILIERES).map(d => ({ label: d, value: d }))}
              placeholder="-- Choisir le niveau --"
              style={selectStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={lbl}>Filière</label>
            <ShadcnSelect
              value={filterMajor}
              onChange={(val) => { setFilterMajor(val); setSelectedStudentId(''); setPdfModule(''); }}
              options={availableMajors.map(m => ({ label: m, value: m }))}
              placeholder="-- Choisir la filière --"
              style={selectStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={lbl}>Année</label>
            <ShadcnSelect
              value={filterYear}
              onChange={(val) => { setFilterYear(val); setSelectedStudentId(''); setPdfModule(''); }}
              options={[
                { label: "1ère année", value: "1ère année" },
                { label: "2ème année", value: "2ème année" }
              ]}
              placeholder="-- Choisir l'année --"
              style={selectStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={lbl}>Stagiaire</label>
            <ShadcnSelect
              value={selectedStudentId}
              onChange={setSelectedStudentId}
              options={[
                { label: "Sélectionner un stagiaire", value: "" },
                ...filteredStudents.map(s => ({ label: `${s.lastName} ${s.firstName}`, value: s.id }))
              ]}
              placeholder="Sélectionner un stagiaire"
              style={selectStyle}
            />
          </div>
        </div>
      </motion.div>

      {/* ── Documents Section ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="glass-card" style={{ marginBottom: 'var(--space-6)', overflow: 'hidden' }}>
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
                    <ShadcnSelect
                      value={pdfModule}
                      onChange={setPdfModule}
                      options={[
                        { label: "Sélectionner un module", value: "" },
                        ...pdfModules.map(m => ({ label: m, value: m }))
                      ]}
                      placeholder="Sélectionner un module"
                      style={{ ...selectStyle, marginTop: '8px' }}
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)', marginTop: '12px' }}>
                  
                  <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <FileSignature size={16} style={{ color: 'var(--primary)' }} />
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: '800' }}>Fiche de Notes (CC)</h4>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700' }}>Examen</label>
                      <ShadcnSelect
                        value={pdfCC}
                        onChange={setPdfCC}
                        options={[
                          { label: "CC1", value: "1" },
                          { label: "CC2", value: "2" },
                          { label: "CC3", value: "3" }
                        ]}
                        style={{ width: '80px', padding: '4px 28px 4px 12px', fontSize: '12px' }}
                      />
                    </div>
                    <button onClick={handleFicheSignature} disabled={!pdfModule} className="btn-modern primary" style={{ width: '100%', opacity: !pdfModule ? 0.5 : 1 }}>
                      <Download size={14} style={{ marginRight: '8px' }} /> Télécharger
                    </button>
                  </div>

                  <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <FileText size={16} style={{ color: '#d97706' }} />
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: '800' }}>Fiche de Notes (EFC)</h4>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '22px' }}>Modèle pour les examens de fin de module.</p>
                    <button onClick={handleFicheNotes} disabled={!pdfModule} className="btn-modern primary" style={{ width: '100%', background: '#d97706', borderColor: '#d97706', opacity: !pdfModule ? 0.5 : 1 }}>
                      <Download size={14} style={{ marginRight: '8px' }} /> Télécharger
                    </button>
                  </div>

                  <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <GraduationCap size={16} style={{ color: '#16a34a' }} />
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: '800' }}>Bulletin Global</h4>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '22px' }}>Relevé complet du stagiaire sélectionné.</p>
                    <button onClick={handleBulletinGlobal} disabled={!selectedStudent} className="btn-modern primary" style={{ width: '100%', background: '#16a34a', borderColor: '#16a34a', opacity: !selectedStudent ? 0.5 : 1 }}>
                      <Download size={14} style={{ marginRight: '8px' }} /> Bulletin
                    </button>
                  </div>

                  <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '20px', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <Award size={16} style={{ color: '#8b5cf6' }} />
                      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: '800' }}>Attestation Admis</h4>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '22px' }}>Note d'obtention (2ème année uniquement).</p>
                    <button onClick={handleNoteObtentionDiplome} disabled={!selectedStudent || selectedStudent.year === '1ère année'} className="btn-modern primary" style={{ width: '100%', background: '#8b5cf6', borderColor: '#8b5cf6', opacity: (!selectedStudent || selectedStudent.year === '1ère année') ? 0.5 : 1 }}>
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
        {selectedStudent ? (
          <motion.div key={selectedStudentId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-ultra-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '900', border: '1px solid var(--border-light)' }}>
                  {selectedStudent.lastName[0]}
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '800' }}>{selectedStudent.lastName} {selectedStudent.firstName}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
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
            {selectedStudent.year === '2ème année' && (
              <div className="glass-card" style={{ padding: '20px', marginBottom: '20px', background: 'rgba(99, 102, 241, 0.03)', border: '1px dashed var(--primary-light)' }}>
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
              <EmptyState title="Aucun module" message="Configurez les modules pour cette filière dans la gestion des modules." icon="book" />
            ) : (
              <div className="glass-card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '980px' }}>
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
                        const g = localGrades[mod.replace(/\./g, '_')] || { c1: '', c2: '', c3: '', efcfp: '', efcft: '' };
                        const moyCC = calcMoyenneCC(g);
                        const avg = calcAvg(g);
                        const complete = isComplete(g);
                        const passed = avg !== null && avg >= 10;

                        return (
                          <tr key={mod} style={{ background: idx % 2 === 0 ? 'white' : 'var(--bg-subtle)' }}>
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
          <EmptyState 
            title="Aucun stagiaire sélectionné" 
            message="Utilisez les filtres ci-dessus pour rechercher un stagiaire et gérer ses notes académiques." 
            icon="search" 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GradeManagement;
