import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { FILIERES, getStudyYearsForDiplomas } from '../data/modules';
import { 
  ArrowLeft, 
  UserPlus, 
  User, 
  Banknote, 
  CheckCircle2, 
  ChevronRight, 
  Search, 
  X, 
  Layers, 
  BookOpen, 
  GraduationCap,
  CalendarDays,
  Target
} from 'lucide-react';

const AddTeacher = () => {
  const { addTeacher, modules: allModules } = useApp();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', diplomas: [], subjects: [], groups: [], years: [] });
  const [isSuccess, setIsSuccess] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');

  const allDiplomas = useMemo(() => Object.keys(FILIERES), []);
  const availableYears = useMemo(() => getStudyYearsForDiplomas(formData.diplomas), [formData.diplomas]);

  const toggleDiploma = (dip) => {
    setFormData(prev => {
      const isSelected = prev.diplomas.includes(dip);
      const newDiplomas = isSelected ? prev.diplomas.filter(d => d !== dip) : [...prev.diplomas, dip];
      const allowedYears = getStudyYearsForDiplomas(newDiplomas);
      const allowedGroups = new Set(newDiplomas.flatMap(diploma => FILIERES[diploma] || []));
      return {
        ...prev,
        diplomas: newDiplomas,
        groups: prev.groups.filter(group => allowedGroups.has(group)),
        subjects: newDiplomas.length === 0 ? [] : prev.subjects,
        years: prev.years.filter(year => allowedYears.includes(year))
      };
    });
  };

  const toggleFiliereAllModules = (year, filiere, modules) => {
    const allSelected = modules.every(m => formData.subjects.includes(m));
    if (allSelected) {
      setFormData(prev => ({ ...prev, subjects: prev.subjects.filter(s => !modules.includes(s)) }));
    } else {
      setFormData(prev => ({ ...prev, subjects: [...new Set([...prev.subjects, ...modules])] }));
    }
  };

  const toggleSubject = (mod) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(mod) ? prev.subjects.filter(s => s !== mod) : [...prev.subjects, mod]
    }));
  };

  const toggleGroup = (filiere) => {
    setFormData(prev => ({
      ...prev,
      groups: prev.groups.includes(filiere) ? prev.groups.filter(g => g !== filiere) : [...prev.groups, filiere]
    }));
  };

  const toggleYear = (year) => {
    setFormData(prev => ({
      ...prev,
      years: prev.years.includes(year) ? prev.years.filter(y => y !== year) : [...prev.years, year]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.diplomas.length === 0) return showToast('Sélectionnez au moins un diplôme.', 'warning');
    if (formData.subjects.length === 0) return showToast('Sélectionnez au moins un module.', 'warning');
    if (formData.groups.length === 0) return showToast('Sélectionnez au moins une filière.', 'warning');
    if (formData.years.length === 0) return showToast('Sélectionnez au moins un niveau.', 'warning');
    addTeacher(formData);
    setIsSuccess(true);
    setTimeout(() => { setIsSuccess(false); navigate('/admin/teachers'); }, 1200);
  };

  return (
    <div className="max-w-container section-padding">
    <div className="page-shell">
      <button onClick={() => navigate('/admin/teachers')} className="action-btn" style={{ marginBottom: 'var(--space-8)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} />
        <span style={{ fontSize: '13px', fontWeight: '800' }}>Retour à la liste</span>
      </button>

      <div className="page-header">
        <h1 className="page-title">
          <UserPlus size={28} className="page-title-icon" /> Profil Formateur
        </h1>
        <p className="page-subtitle">Définir un nouveau membre du corps enseignant et ses habilitations.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card form-card">
        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ width: '64px', height: '64px', background: 'var(--success)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: 'var(--shadow-glow)' }}>
              <CheckCircle2 size={32} />
            </motion.div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '8px' }}>Formateur Enregistré</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Redirection en cours...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="form-stack spacious">
            {/* Identity & Rate */}
            <div className="form-grid identity-grid">
              <div className="field-group">
                <label className="field-label">Nom complet du formateur</label>
                <div className="input-with-icon">
                  <User size={14} className="field-icon" />
                  <input required className="input-premium" style={{ width: '100%', paddingLeft: '34px' }} placeholder="Ex: Dr. ALAMI Mohamed" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Tarif horaire (DH)</label>
                <div className="input-with-icon">
                  <Banknote size={14} className="field-icon" />
                  <input type="number" required className="input-premium" style={{ width: '100%', paddingLeft: '34px' }} placeholder="Ex: 150" value={formData.hourlyRate || ''} onChange={(e) => setFormData({...formData, hourlyRate: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
            </div>

            {/* Selection Steps */}
            <div className="form-grid wide">
              <div className="field-group">
                <label className="field-label">1. Diplômes préparés</label>
                <div className="choice-list">
                  {allDiplomas.map(dip => (
                    <SelectionTag key={dip} active={formData.diplomas.includes(dip)} onClick={() => toggleDiploma(dip)} label={dip} />
                  ))}
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">2. Niveaux d'enseignement</label>
                <div className="choice-list">
                  {availableYears.map(y => (
                    <SelectionTag key={y} active={formData.years.includes(y)} onClick={() => toggleYear(y)} label={y} />
                  ))}
                </div>
              </div>
            </div>

              <div className="field-group">
                <label className="field-label">3. Filières assignées</label>
                <div className="choice-list">
                  {Array.from(new Set(formData.diplomas.flatMap(diploma => FILIERES[diploma] || []))).map(f => (
                    <SelectionTag key={f} active={formData.groups.includes(f)} onClick={() => toggleGroup(f)} label={f} />
                  ))}
                  {formData.diplomas.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Sélectionnez un diplôme d'abord</p>}
                </div>
              </div>

            {/* Modules Grid */}
            <div className="section-divider">
              <div className="toolbar-row" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <BookOpen size={20} style={{ color: 'var(--primary)' }} />
                  <label className="field-label">4. Modules enseignés ({formData.subjects.length})</label>
                </div>
                {(formData.years.length > 0 && formData.groups.length > 0) && (
                  <div className="input-with-icon responsive-search">
                    <Search size={14} className="field-icon" />
                    <input className="input-premium" style={{ width: '100%', paddingLeft: '34px', height: '36px', fontSize: '12px' }} placeholder="Rechercher un module..." value={moduleSearch} onChange={(e) => setModuleSearch(e.target.value)} />
                  </div>
                )}
              </div>

              {formData.subjects.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', background: 'var(--bg-subtle)', padding: '12px', borderRadius: 'var(--radius-xl)', marginBottom: '20px' }}>
                  {formData.subjects.map(s => (
                    <span key={s} onClick={() => toggleSubject(s)} className="badge-status primary" style={{ cursor: 'pointer', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {s} <X size={10} />
                    </span>
                  ))}
                </div>
              )}

              {formData.years.length === 0 || formData.groups.length === 0 ? (
                <div className="empty-panel">
                  <Target size={32} style={{ color: 'var(--text-faint)', marginBottom: '16px' }} />
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>Veuillez définir les Niveaux et Filières pour lister les modules.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                  {formData.years.sort().map(year => (
                    <div key={year} className="glass-card" style={{ padding: '20px', background: 'white' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                        <CalendarDays size={16} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>{year}</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '450px', overflowY: 'auto', paddingRight: '8px' }}>
                        {formData.groups.map(filiere => {
                          const modules = Array.from(new Set(allModules.filter(m => 
                            formData.diplomas.includes(m.diploma) && 
                            m.major === filiere && 
                            m.year === year
                          ).map(m => m.name)));
                          const filtered = moduleSearch ? modules.filter(m => m.toLowerCase().includes(moduleSearch.toLowerCase())) : modules;
                          if (filtered.length === 0) return null;
                          const allSelected = filtered.every(m => formData.subjects.includes(m));
                          return (
                            <div key={filiere}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>{filiere}</p>
                                <button type="button" onClick={() => toggleFiliereAllModules(year, filiere, filtered)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}>
                                  {allSelected ? 'Tout retirer' : 'Tout ajouter'}
                                </button>
                              </div>
                              <div style={{ display: 'grid', gap: '4px' }}>
                                {filtered.map(mod => (
                                  <button type="button" key={mod} onClick={() => toggleSubject(mod)} 
                                    style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 'var(--radius-lg)', fontSize: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.1s', 
                                      background: formData.subjects.includes(mod) ? 'var(--primary-ultra-light)' : 'transparent', 
                                      color: formData.subjects.includes(mod) ? 'var(--primary)' : 'var(--text-secondary)',
                                      display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {formData.subjects.includes(mod) && <CheckCircle2 size={10} />}
                                    </div>
                                    {mod}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className="btn-modern primary" style={{ width: '100%', justifyContent: 'center', padding: '16px', borderRadius: 'var(--radius-xl)', fontSize: '15px', marginTop: '12px' }}>
              Finaliser la création du profil <ChevronRight size={18} style={{ marginLeft: '8px' }} />
            </button>
          </form>
        )}
      </motion.div>
      </div>
    </div>
  );
};

const SelectionTag = ({ active, label, onClick }) => (
  <button type="button" onClick={onClick} style={{
    padding: '10px 18px', borderRadius: 'var(--radius-pill)', fontSize: '11px', fontWeight: '800', transition: 'all 0.2s', cursor: 'pointer',
    background: active ? 'var(--primary)' : 'var(--bg-subtle)',
    color: active ? 'white' : 'var(--text-muted)',
    border: `1px solid ${active ? 'var(--primary)' : 'var(--border-light)'}`,
    boxShadow: active ? 'var(--shadow-glow)' : 'none'
  }}>{label}</button>
);

export default AddTeacher;
