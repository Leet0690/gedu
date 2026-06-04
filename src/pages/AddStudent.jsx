import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { FILIERES } from '../data/modules';
import { 
  ArrowLeft, 
  UserPlus, 
  User, 
  GraduationCap, 
  BookOpen, 
  Hash, 
  CheckCircle2, 
  ChevronRight,
  Layers
} from 'lucide-react';

const AddStudent = () => {
  const { addStudent, modules: allModules } = useApp();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', major: '', regNo: '',
    diploma: '', year: '',
  });
  const [isSuccess, setIsSuccess] = useState(false);

  const allDiplomas = useMemo(() => Array.from(new Set(allModules.map(m => m.diploma))), [allModules]);
  const availableFilieres = useMemo(() => {
    if (!formData.diploma) return [];
    return Array.from(new Set(allModules.filter(m => m.diploma === formData.diploma).map(m => m.major)));
  }, [allModules, formData.diploma]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedData = {
      ...formData,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim()
    };
    addStudent(trimmedData);
    setIsSuccess(true);
    setTimeout(() => navigate('/admin/students'), 1200);
  };

  return (
    <div className="max-w-container section-padding">
    <div className="page-shell narrow">
      <button onClick={() => navigate('/admin/students')} className="action-btn" style={{ marginBottom: 'var(--space-8)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} />
        <span style={{ fontSize: '13px', fontWeight: '800' }}>Retour à la liste</span>
      </button>

      <div className="page-header">
        <h1 className="page-title">
          <UserPlus size={28} className="page-title-icon" /> Inscription Stagiaire
        </h1>
        <p className="page-subtitle">Ajouter un nouveau profil académique à la base de données.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card form-card">
        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ width: '64px', height: '64px', background: 'var(--success)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: 'var(--shadow-glow)' }}>
              <CheckCircle2 size={32} />
            </motion.div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '8px' }}>Inscription Validée</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Redirection vers la liste des stagiaires...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="form-stack">
            <div className="form-grid">
              <div className="field-group">
                <label className="field-label">Nom de famille</label>
                <div className="input-with-icon">
                  <User size={14} className="field-icon" />
                  <input required className="input-premium" style={{ width: '100%', paddingLeft: '34px' }} placeholder="Ex: ALAMI" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Prénom</label>
                <div className="input-with-icon">
                  <User size={14} className="field-icon" />
                  <input required className="input-premium" style={{ width: '100%', paddingLeft: '34px' }} placeholder="Ex: Omar" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="form-grid">
              <div className="field-group">
                <label className="field-label">Niveau de formation</label>
                <select required className="input-premium" value={formData.diploma} onChange={(e) => setFormData({...formData, diploma: e.target.value, major: ''})}>
                  <option value="">Sélectionner...</option>
                  {allDiplomas.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Année d'étude</label>
                <select required className="input-premium" value={formData.year} onChange={(e) => setFormData({...formData, year: e.target.value})}>
                  <option value="">Sélectionner...</option>
                  <option value="1ère année">1ère année</option>
                  <option value="2ème année">2ème année</option>
                </select>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Filière spécifique</label>
              <div className="input-with-icon">
                <Layers size={14} className="field-icon" />
                <select required className="input-premium" style={{ width: '100%', paddingLeft: '34px' }} value={formData.major} onChange={(e) => setFormData({...formData, major: e.target.value})} disabled={!formData.diploma}>
                  <option value="">{formData.diploma ? 'Choisir la filière' : 'Veuillez choisir un niveau'}</option>
                  {availableFilieres.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Numéro de Matricule</label>
              <div className="input-with-icon">
                <Hash size={14} className="field-icon" />
                <input required className="input-premium" style={{ width: '100%', paddingLeft: '34px', fontFamily: 'monospace' }} placeholder="IPFP-XXXX-XXXX" value={formData.regNo} onChange={(e) => setFormData({...formData, regNo: e.target.value})} />
              </div>
            </div>

            <button type="submit" className="btn-modern primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', borderRadius: 'var(--radius-xl)', marginTop: '8px' }}>
              Valider l'inscription <ChevronRight size={18} style={{ marginLeft: '8px' }} />
            </button>
          </form>
        )}
      </motion.div>
      </div>
    </div>
  );
};

export default AddStudent;
