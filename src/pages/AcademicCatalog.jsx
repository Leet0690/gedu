import React, { useMemo, useState } from 'react';
import { BookOpen, GraduationCap, Plus, Save, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useToast } from '../context/ToastContext';

const emptyForm = { diploma: '', major: '', year: '' };

const toEditableGroups = groups => Object.fromEntries(
  Object.entries(groups || {}).map(([diploma, majors]) => [
    diploma,
    Object.fromEntries(Object.entries(majors || {}).map(([major, years]) => [
      major,
      Array.from(years instanceof Set ? years : Array.isArray(years) ? years : Object.keys(years || {})),
    ])),
  ]),
);

const AcademicCatalog = () => {
  const { academicCatalog, updateAcademicCatalog } = useApp();
  const { isAdmin } = useAdminAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const entries = useMemo(() => Object.entries(academicCatalog?.groups || {}).flatMap(([diploma, majors]) => (
    Object.entries(majors || {}).map(([major, years]) => ({
      diploma,
      major,
      years: Array.from(years instanceof Set ? years : Array.isArray(years) ? years : Object.keys(years || {})),
    }))
  )), [academicCatalog]);

  const saveGroups = async groups => {
    setSaving(true);
    try {
      return await updateAcademicCatalog(toEditableGroups(groups));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = event => {
    const { name, value } = event.target;
    setForm(previous => ({ ...previous, [name]: value }));
  };

  const handleAdd = async event => {
    event.preventDefault();
    const diploma = form.diploma.trim();
    const major = form.major.trim();
    const year = form.year.trim();
    if (!diploma || !major || !year) {
      showToast('Le niveau, la filière et l’année sont obligatoires.', 'error');
      return;
    }

    const nextGroups = toEditableGroups(academicCatalog?.groups || {});
    nextGroups[diploma] ||= {};
    nextGroups[diploma][major] = Array.from(new Set([...(nextGroups[diploma][major] || []), year]));
    if (await saveGroups(nextGroups)) setForm(emptyForm);
  };

  const handleRemoveYear = async (diploma, major, year) => {
    const nextGroups = toEditableGroups(academicCatalog?.groups || {});
    const nextYears = (nextGroups[diploma]?.[major] || []).filter(item => item !== year);
    if (nextYears.length > 0) {
      nextGroups[diploma][major] = nextYears;
    } else {
      delete nextGroups[diploma][major];
      if (Object.keys(nextGroups[diploma]).length === 0) delete nextGroups[diploma];
    }
    await saveGroups(nextGroups);
  };

  const handleRemoveMajor = async (diploma, major) => {
    const nextGroups = toEditableGroups(academicCatalog?.groups || {});
    delete nextGroups[diploma]?.[major];
    if (nextGroups[diploma] && Object.keys(nextGroups[diploma]).length === 0) delete nextGroups[diploma];
    await saveGroups(nextGroups);
  };

  if (!isAdmin) {
    return <div className="section-padding"><div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>Cette page est réservée à l’administrateur principal.</div></div>;
  }

  return (
    <div className="section-padding academic-catalog-page" style={{ maxWidth: '1180px', margin: '0 auto' }}>
      <header className="home-dashboard-heading" style={{ marginBottom: 24 }}>
        <div>
          <span className="gedu-settings-eyebrow"><BookOpen size={13} /> Paramètres académiques</span>
          <h1>Niveaux, filières et années</h1>
          <p>Configurez les choix proposés dans les formulaires et les filtres de l’établissement.</p>
        </div>
        <div className="dashboard-stat-icon" aria-hidden="true"><GraduationCap size={22} /></div>
      </header>

      <div className="academic-catalog-layout">
        <form onSubmit={handleAdd} className="glass-card academic-catalog-form">
          <div className="institution-settings-section-heading">
            <span className="dashboard-stat-icon"><Plus size={18} /></span>
            <div><h2>Ajouter une configuration</h2><p>Un même niveau ou une même filière peut contenir plusieurs années.</p></div>
          </div>
          <div className="academic-catalog-form-grid">
            <label>Niveau / diplôme<input name="diploma" value={form.diploma} onChange={handleChange} placeholder="Ex. Technicien spécialisé" /></label>
            <label>Filière<input name="major" value={form.major} onChange={handleChange} placeholder="Ex. Développement digital" /></label>
            <label>Année d’étude<input name="year" value={form.year} onChange={handleChange} placeholder="Ex. 1ère année" /></label>
          </div>
          <div className="academic-catalog-form-actions">
            <small>Les anciens choix de démonstration sont retirés dès le premier enregistrement du catalogue.</small>
            <button type="submit" className="btn-modern primary" disabled={saving}><Save size={16} /> {saving ? 'Enregistrement…' : 'Ajouter'}</button>
          </div>
        </form>

        <section className="glass-card academic-catalog-list-card">
          <div className="institution-settings-section-heading">
            <span className="dashboard-stat-icon"><BookOpen size={18} /></span>
            <div><h2>Catalogue configuré</h2><p>{entries.length} filière(s) configurée(s). Supprimez les choix inutiles pour laisser les filtres libres.</p></div>
          </div>
          {entries.length === 0 ? (
            <div className="academic-catalog-empty">Aucun niveau, filière ou année configuré. Ajoutez votre premier parcours ci-dessus.</div>
          ) : (
            <div className="academic-catalog-groups">
              {entries.map(entry => (
                <article key={`${entry.diploma}:${entry.major}`} className="academic-catalog-group">
                  <div className="academic-catalog-group-heading">
                    <div><span>{entry.diploma}</span><strong>{entry.major}</strong></div>
                    <button type="button" className="academic-catalog-delete-major" disabled={saving} onClick={() => handleRemoveMajor(entry.diploma, entry.major)} title="Supprimer la filière"><Trash2 size={15} /></button>
                  </div>
                  <div className="academic-catalog-years">
                    {entry.years.map(year => <span key={year} className="academic-catalog-year">{year}<button type="button" disabled={saving} onClick={() => handleRemoveYear(entry.diploma, entry.major, year)} aria-label={`Supprimer ${year}`}><Trash2 size={12} /></button></span>)}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AcademicCatalog;
