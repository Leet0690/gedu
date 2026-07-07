import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilterSelect } from '../components/ui/FilterSelect';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { ALL_STUDY_YEARS, MODULES_DATA, getClassCode, getDiplomaAbbreviation, getStudyYearsForDiploma } from '../data/modules';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import {
  Plus,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCw,
  Copy,
  AlertTriangle,
  CheckCircle,
  Zap,
  Check,
  Boxes,
  BookOpen,
  SlidersHorizontal,
} from 'lucide-react';

const labelStyle = { fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const HIGHER_EDUCATION_DIPLOMAS = ['Licence Professionnelle', 'Master spécialisé'];
const DIPLOMA_LABELS = {
  'Licence Professionnelle': 'Licence',
  'Master spécialisé': 'Master'
};

const getDiplomaLabel = (diploma) => DIPLOMA_LABELS[diploma] || diploma;

const isHigherEducationDiploma = (diploma) => HIGHER_EDUCATION_DIPLOMAS.includes(diploma);

const getSemesterOptions = (diploma) => {
  if (diploma === 'Master spécialisé') {
    return ['S1', 'S2', 'S3', 'S4'].map(semester => ({ label: semester, value: semester }));
  }
  if (diploma === 'Licence Professionnelle') {
    return ['S1', 'S2'].map(semester => ({ label: semester, value: semester }));
  }
  return [
    { label: 'S1', value: 'S1' },
    { label: 'S2', value: 'S2' },
    { label: 'Annuel (S1 & S2)', value: 'Annuel' }
  ];
};

const normalizeModuleFormData = (data) => {
  if (data.diploma === 'Licence Professionnelle') {
    return { ...data, year: '1ère année' };
  }
  if (data.diploma === 'Master spécialisé') {
    const semesterNumber = Number(data.semester.replace('S', '')) || 1;
    return {
      ...data,
      year: semesterNumber <= 2 ? '1ère année' : '2ème année',
      semester: semesterNumber % 2 === 1 ? 'S1' : 'S2'
    };
  }
  return data;
};

const getFormSemester = (module) => {
  if (module.diploma !== 'Master spécialisé' || module.year !== '2ème année') {
    return module.semester || 'S1';
  }
  return (module.semester || 'S1') === 'S2' ? 'S4' : 'S3';
};

const ActionBtn = ({ icon: Icon, title, onClick, color = 'var(--text-muted)' }) => (
  <button onClick={onClick} title={title} className="action-btn"
    style={{ padding: '8px', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Icon size={16} />
  </button>
);

const ModuleManagement = () => {
  const { modules, addModule, updateModule, deleteModule, loading, confirmAction } = useApp();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    coefficient: '1',
    diploma: 'Technicien Spécialisé',
    major: 'Développement Informatique',
    year: '1ère année',
    semester: 'S1'
  });

  const [filterDiploma, setFilterDiploma] = useState('');
  const [filterMajor, setFilterMajor] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSemester, setFilterSemester] = useState('');

  const [page, setPage] = useState(1);
  const itemsPerPage = 15;
  const [selectedIds, setSelectedIds] = useState([]);

  // Copy modal state
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySource, setCopySource] = useState(null);
  const [copyTargets, setCopyTargets] = useState([]);
  const [isCopying, setIsCopying] = useState(false);

  const diplomas = ['Technicien Spécialisé', 'Technicien', 'Licence Professionnelle', 'Master spécialisé']
    .filter(diploma => MODULES_DATA[diploma]);
  const majors = filterDiploma ? Object.keys(MODULES_DATA[filterDiploma] || {}) : [];
  const filterYears = filterDiploma ? getStudyYearsForDiploma(filterDiploma) : ALL_STUDY_YEARS;
  const formYears = getStudyYearsForDiploma(formData.diploma);
  const formSemesterOptions = getSemesterOptions(formData.diploma);
  const filterSemesterOptions = filterDiploma ? getSemesterOptions(filterDiploma) : getSemesterOptions('');
  const hideYearChoice = isHigherEducationDiploma(formData.diploma);

  // All available groups across all diplomas for the copy modal
  const allGroups = useMemo(() => {
    const groups = [];
    Object.entries(MODULES_DATA).forEach(([diploma, majorMap]) => {
      Object.entries(majorMap).forEach(([major, yearMap]) => {
        Object.keys(yearMap).forEach(year => {
          groups.push({ diploma, major, year, code: getClassCode(diploma, major, year) });
        });
      });
    });
    return groups;
  }, []);

  const isFiltersSelected = !!(filterYear && filterDiploma && filterMajor && filterSemester);

  const groupedModules = useMemo(() => {
    const f = modules.filter(m => {
      if (filterDiploma && m.diploma !== filterDiploma) return false;
      if (filterMajor && m.major !== filterMajor) return false;
      if (filterYear && m.year !== filterYear) return false;
      const sem = getFormSemester(m);
      if (filterSemester && sem !== filterSemester) return false;
      return true;
    });

    const groups = {};
    f.forEach(m => {
      const key = `${m.name}_${m.coefficient}_${getFormSemester(m)}`;
      if (!groups[key]) {
        groups[key] = { ...m, allClasses: [], allDiplomas: [], ids: [] };
      }
      const classCode = getClassCode(m.diploma, m.major, m.year);
      if (!groups[key].allClasses.includes(classCode)) groups[key].allClasses.push(classCode);
      if (!groups[key].allDiplomas.includes(m.diploma)) groups[key].allDiplomas.push(m.diploma);
      groups[key].ids.push(m.id);
    });
    return Object.values(groups);
  }, [modules, filterDiploma, filterMajor, filterYear, filterSemester]);


  const paginatedModules = useMemo(
    () => groupedModules.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [groupedModules, page]
  );
  const totalPages = Math.ceil(groupedModules.length / itemsPerPage);

  const resetForm = () => {
    setFormData({
      name: '',
      coefficient: '1',
      diploma: Object.keys(MODULES_DATA)[0],
      major: Object.keys(MODULES_DATA[Object.keys(MODULES_DATA)[0]])[0],
      year: '1ère année',
      semester: 'S1'
    });
    setIsEditing(false);
    setSelectedIds([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.coefficient) return;
    try {
      const trimmedName = formData.name.trim();
      const normalizedFormData = normalizeModuleFormData({
        ...formData,
        name: trimmedName,
        coefficient: parseFloat(formData.coefficient)
      });
      if (isEditing) {
        for (const id of selectedIds) {
          await updateModule(id, normalizedFormData);
        }
      } else {
        await addModule(normalizedFormData);
      }
      setIsModalOpen(false);
      resetForm();
    } catch {
      showToast('Erreur de sauvegarde.', 'error');
    }
  };

  const handleEdit = (m) => {
    setFormData({
      name: m.name,
      coefficient: m.coefficient.toString(),
      diploma: m.diploma,
      major: m.major,
      year: m.year,
      semester: getFormSemester(m)
    });
    setSelectedIds(m.ids || [m.id]);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (group) => {
    if (await confirmAction({
      title: 'Supprimer le module ?',
      message: `Voulez-vous supprimer "${group.name}" pour toutes les classes associées ? Cette action est irréversible.`,
      type: 'danger'
    })) {
      for (const id of group.ids) await deleteModule(id);
    }
  };


  // Feature 2: Quick-add a single missing module
  const handleQuickAdd = async (name) => {
    try {
      await addModule({ name, coefficient: 1, diploma: filterDiploma, major: filterMajor, year: filterYear, semester: filterSemester });
    } catch {
      showToast("Erreur lors de l'ajout", 'error');
    }
  };

  // Feature 6: Open copy modal
  const openCopyModal = (m) => {
    setCopySource(m);
    setCopyTargets([]);
    setCopyModalOpen(true);
  };

  const toggleCopyTarget = (group) => {
    const key = `${group.diploma}||${group.major}||${group.year}`;
    setCopyTargets(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleCopyConfirm = async () => {
    if (!copySource || copyTargets.length === 0) return;
    setIsCopying(true);
    let copied = 0;
    let skipped = 0;
    try {
      for (const key of copyTargets) {
        const [diploma, major, year] = key.split('||');
        const exists = modules.some(m =>
          m.name === copySource.name && m.diploma === diploma && m.major === major && m.year === year && (m.semester || 'S1') === (copySource.semester || 'S1')
        );
        if (exists) { skipped++; continue; }
        await addModule({ name: copySource.name, coefficient: copySource.coefficient, diploma, major, year, semester: copySource.semester || 'S1' });
        copied++;
      }
      const msg = copied > 0
        ? `Copié vers ${copied} groupe${copied > 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} ignoré${skipped > 1 ? 's' : ''} — déjà présent)` : ''}`
        : `Déjà présent dans tous les groupes sélectionnés`;
      showToast(msg, copied > 0 ? 'success' : 'info');
      setCopyModalOpen(false);
      setCopySource(null);
      setCopyTargets([]);
    } catch {
      showToast('Erreur lors de la copie', 'error');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="module-premium-page">
      <header className="module-premium-header">
        <div className="module-premium-header-icon">
          <Boxes size={24} />
        </div>
        <div className="module-premium-header-copy">
          <span className="module-premium-eyebrow">Référentiel académique</span>
          <h1>Gestion des Modules</h1>
          <p>Configurez les matières et leurs coefficients pour chaque filière.</p>
        </div>
        <div className="module-premium-header-actions">
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="btn-modern primary">
            <Plus size={16} style={{ marginRight: 'var(--space-2)' }} /> Ajouter Module
          </button>
        </div>
        <div className="module-premium-header-orb" aria-hidden="true">
          <BookOpen size={112} />
        </div>
      </header>

      {/* Filters */}
      <div className="glass-card module-premium-filter-card">
        <div className="module-premium-section-heading">
          <span className="module-premium-section-icon"><SlidersHorizontal size={15} /></span>
          <div>
            <h2>Filtres d'affichage</h2>
            <p>Sélectionnez une classe et un semestre pour afficher ses modules.</p>
          </div>
        </div>
        <div className="module-premium-filter-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle}>Niveau</label>
          <FilterSelect
            value={filterDiploma}
            onChange={val => { setFilterDiploma(val); setFilterMajor(''); setFilterYear(''); setFilterSemester(''); setPage(1); }}
            options={[
              { label: "Choisir le niveau", value: "" },
              ...diplomas.map(d => ({ label: getDiplomaLabel(d), value: d }))
            ]}
            placeholder="Choisir le niveau"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle}>Année</label>
          <FilterSelect
            value={filterYear}
            onChange={val => { setFilterYear(val); setPage(1); }}
            options={[
              { label: "Choisir l'année", value: "" },
              ...filterYears.map(year => ({ label: year, value: year }))
            ]}
            placeholder="Choisir l'année"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle}>Filière</label>
          <FilterSelect
            value={filterMajor}
            onChange={val => { setFilterMajor(val); setPage(1); }}
            options={[
              { label: "Choisir la filière", value: "" },
              ...majors.map(m => ({ label: m, value: m }))
            ]}
            placeholder="Choisir la filière"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle}>Semestre</label>
          <FilterSelect
            value={filterSemester}
            onChange={val => { setFilterSemester(val); setPage(1); }}
            options={[{ label: "Semestre", value: "" }, ...filterSemesterOptions]}
            placeholder="Semestre"
          />
        </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="glass-card module-premium-table-shell" style={{ padding: 'var(--space-4)' }}><TableSkeleton rows={10} /></div>
      ) : !isFiltersSelected ? (
        <div className="module-premium-empty-shell">
          <EmptyState title="Filtres requis" message="Veuillez sélectionner l'année, le niveau, la filière et le semestre pour afficher les modules." icon="filter" />
        </div>
      ) : (
        <div className="glass-card module-premium-table-shell">
          <table className="module-premium-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-light)' }}>
                <th style={{ padding: '16px', fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Module</th>
                <th style={{ padding: '16px', fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Niveau</th>
                <th style={{ padding: '16px', fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Sem.</th>
                <th style={{ padding: '16px', fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Classes</th>
                <th style={{ padding: '16px', fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Coeff.</th>
                <th style={{ padding: '16px', fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedModules.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: 0 }}>
                    <EmptyState title="Aucun module" message="Aucun module n'est configuré pour cette sélection." icon="book" />
                  </td>
                </tr>
              ) : (
                paginatedModules.map((m) => (
                  <tr key={m.id} className="module-premium-table-row" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '16px' }}>
                      <p style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{m.name}</p>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {m.allDiplomas && m.allDiplomas.length > 1 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {m.allDiplomas.map((d, i) => (
                            <span key={i} style={{ fontSize: '10px', fontWeight: '700', color: 'var(--primary)', background: 'var(--primary-ultra-light)', padding: '2px 6px', borderRadius: '5px' }}>
                              {getDiplomaAbbreviation(d)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>{m.diploma}</p>
                      )}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '12px', background: 'var(--primary-ultra-light)', padding: '4px 8px', borderRadius: '6px' }}>{getFormSemester(m)}</span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {m.allClasses.map((c, i) => (
                          <span key={i} style={{ padding: '2px 8px', background: 'var(--bg-subtle)', borderRadius: '6px', fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>{c}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 10px', background: 'rgba(0,0,0,0.03)', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: '800', fontSize: '12px' }}>{m.coefficient}</span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end' }}>
                        <ActionBtn icon={Copy} title="Copier vers d'autres groupes" color="#6366f1" onClick={() => openCopyModal(m)} />
                        <ActionBtn icon={Edit3} title="Modifier" onClick={() => handleEdit(m)} />
                        <ActionBtn icon={Trash2} title="Supprimer" color="#dc2626" onClick={() => handleDelete(m)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={groupedModules.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Add / Edit Module Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="app-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div className="app-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-premium module-premium-dialog app-modal-surface"
              style={{ position: 'relative', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', borderRadius: 'var(--radius-3xl)', boxShadow: 'var(--shadow-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>{isEditing ? 'Modifier Module' : 'Nouveau Module'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="close-button" aria-label="Fermer la fenêtre" title="Fermer"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(120px, 1fr)', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={labelStyle}>Nom du Module</label>
                    <input className="input-premium" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="Ex: Algorithmique" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={labelStyle}>Coefficient</label>
                    <input className="input-premium" type="number" step="0.25" min="0.25" value={formData.coefficient} onChange={e => setFormData({ ...formData, coefficient: e.target.value })} required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={labelStyle}>Niveau</label>
                    <FilterSelect
                      value={formData.diploma}
                      onChange={val => setFormData({
                        ...formData,
                        diploma: val,
                        major: Object.keys(MODULES_DATA[val] || {})[0] || '',
                        year: getStudyYearsForDiploma(val)[0],
                        semester: 'S1'
                      })}
                      options={diplomas.map(d => ({ label: getDiplomaLabel(d), value: d }))}
                    />
                  </div>
                  {!hideYearChoice ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Année</label>
                      <FilterSelect
                        value={formData.year}
                        onChange={val => setFormData({ ...formData, year: val })}
                        options={formYears.map(year => ({ label: year, value: year }))}
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Semestre</label>
                      <FilterSelect
                        value={formData.semester}
                        onChange={val => setFormData({ ...formData, semester: val })}
                        options={formSemesterOptions}
                      />
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                  {!hideYearChoice && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={labelStyle}>Semestre</label>
                      <FilterSelect
                        value={formData.semester}
                        onChange={val => setFormData({ ...formData, semester: val })}
                        options={formSemesterOptions}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: hideYearChoice ? '1 / -1' : undefined }}>
                    <label style={labelStyle}>Filière</label>
                    <FilterSelect
                      value={formData.major}
                      onChange={val => setFormData({ ...formData, major: val })}
                      options={Object.keys(MODULES_DATA[formData.diploma] || {}).map(m => ({ label: m, value: m }))}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button type="submit" className="btn-modern primary" style={{ flex: 1 }}>{isEditing ? 'Enregistrer' : 'Ajouter'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Copy to groups modal */}
      <AnimatePresence>
        {copyModalOpen && copySource && (
          <div className="app-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div className="app-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCopyModalOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-premium module-premium-dialog app-modal-surface"
              style={{ position: 'relative', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', borderRadius: 'var(--radius-3xl)', boxShadow: 'var(--shadow-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: '900' }}>Copier vers d'autres groupes</h2>
                <button onClick={() => setCopyModalOpen(false)} className="close-button" aria-label="Fermer la fenêtre" title="Fermer"><X size={20} /></button>
              </div>

              <div style={{ marginBottom: '20px', padding: '12px 14px', background: 'var(--primary-ultra-light)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--primary-light)' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Module à copier</p>
                <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>{copySource.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Coeff. {copySource.coefficient} · {copySource.semester || 'S1'}</p>
              </div>

              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Sélectionner les groupes cibles
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto', marginBottom: '20px' }}>
                {allGroups.map(group => {
                  const key = `${group.diploma}||${group.major}||${group.year}`;
                  const isCurrent = group.diploma === copySource.diploma && group.major === copySource.major && group.year === copySource.year;
                  const isSelected = copyTargets.includes(key);
                  const alreadyExists = modules.some(m => m.name === copySource.name && m.diploma === group.diploma && m.major === group.major && m.year === group.year && (m.semester || 'S1') === (copySource.semester || 'S1'));
                  return (
                    <button
                      key={key}
                      disabled={isCurrent}
                      onClick={() => toggleCopyTarget(group)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                        borderRadius: 'var(--radius-lg)', border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}`,
                        background: isSelected ? 'var(--primary-ultra-light)' : isCurrent ? 'var(--bg-subtle)' : 'white',
                        cursor: isCurrent ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: isCurrent ? 0.5 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ width: '18px', height: '18px', borderRadius: '5px', border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-light)'}`, background: isSelected ? 'var(--primary)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isSelected && <Check size={11} style={{ color: 'white' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: isSelected ? 'var(--primary)' : 'var(--text-primary)', fontFamily: 'monospace', background: isSelected ? 'rgba(176,104,185,0.15)' : 'var(--bg-subtle)', padding: '1px 6px', borderRadius: '4px' }}>{group.code}</span>
                          {isCurrent && <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-faint)', background: 'var(--border-light)', padding: '1px 6px', borderRadius: '4px' }}>Source</span>}
                          {alreadyExists && !isCurrent && <span style={{ fontSize: '9px', fontWeight: '700', color: '#d97706', background: 'rgba(217,119,6,0.1)', padding: '1px 6px', borderRadius: '4px' }}>Déjà présent</span>}
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{group.major} · {group.year}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleCopyConfirm}
                  disabled={copyTargets.length === 0 || isCopying}
                  className="btn-modern primary"
                  style={{ flex: 1, opacity: copyTargets.length === 0 ? 0.5 : 1 }}
                >
                  <Copy size={13} style={{ marginRight: '6px' }} />
                  {isCopying ? 'Copie en cours…' : `Copier vers ${copyTargets.length} groupe${copyTargets.length > 1 ? 's' : ''}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModuleManagement;
