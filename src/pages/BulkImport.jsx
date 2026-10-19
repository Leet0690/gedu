import { educationText } from '../utils/education';
import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Presentation, RefreshCw, Upload, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useToast } from '../context/ToastContext';
import { downloadExcelTemplate, readExcelRows, validateExcelRows } from '../utils/excelImport';

const TYPE_CONFIG = {
  students: {
    label: 'Stagiaires',
    singular: 'stagiaire',
    icon: Users,
    accept: '.xls,.xlsx',
  },
  teachers: {
    label: 'Formateurs',
    singular: 'formateur',
    icon: Presentation,
    accept: '.xls,.xlsx',
  },
};

const BulkImport = () => {
  const { students = [], teachers = [], importStudents, importTeachers, operationalAcademicYear, institution, academicCatalog } = useApp();
  const { isAdmin } = useAdminAuth();
  const { showToast } = useToast();
  const [type, setType] = useState('students');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const config = { ...TYPE_CONFIG[type], label: educationText(TYPE_CONFIG[type].label), singular: educationText(TYPE_CONFIG[type].singular) };
  const Icon = config.icon;
  const validRows = useMemo(() => rows.filter(row => row.valid), [rows]);
  const invalidRows = useMemo(() => rows.filter(row => !row.valid), [rows]);

  const clearImport = () => {
    setRows([]);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTypeChange = nextType => {
    setType(nextType);
    clearImport();
  };

  const handleFileChange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReading(true);
    setFileName(file.name);
    try {
      const parsedRows = await readExcelRows(file, type);
      const checkedRows = validateExcelRows(parsedRows, type, { existingStudents: students, existingTeachers: teachers, institution, academicCatalog });
      setRows(checkedRows);
      showToast(`${checkedRows.length} ligne(s) analysée(s).`, checkedRows.some(row => !row.valid) ? 'warning' : 'success');
    } catch (error) {
      setRows([]);
      showToast(error.message || 'Le fichier Excel n’a pas pu être lu.', 'error');
    } finally {
      setReading(false);
    }
  };

  const handleImport = async () => {
    if (validRows.length === 0) {
      showToast('Aucune ligne valide à importer.', 'warning');
      return;
    }
    setImporting(true);
    try {
      const cleanRows = validRows.map(row => {
        const cleanRow = { ...row };
        delete cleanRow.rowNumber;
        delete cleanRow.errors;
        delete cleanRow.valid;
        return {
          ...cleanRow,
          ...(type === 'students'
            ? { academicYear: cleanRow.academicYear || operationalAcademicYear }
            : {}),
        };
      });
      if (type === 'students') await importStudents(cleanRows);
      else await importTeachers(cleanRows);
      clearImport();
    } catch (error) {
      console.error('Import Excel impossible :', error);
      showToast(error.message || 'L’import n’a pas pu être terminé.', 'error');
    } finally {
      setImporting(false);
    }
  };

  if (!isAdmin) {
    return <div className="section-padding"><div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>Cette page est réservée à l’administrateur principal.</div></div>;
  }

  return (
    <div className="section-padding bulk-import-page" style={{ maxWidth: '1180px', margin: '0 auto' }}>
      <header className="home-dashboard-heading" style={{ marginBottom: 24 }}>
        <div>
          <span className="gedu-settings-eyebrow"><FileSpreadsheet size={13} /> Import en masse</span>
          <h1>Importer des listes Excel</h1>
          <p>{educationText("Ajoutez plusieurs stagiaires ou formateurs en une seule opération, avec un aperçu avant l’enregistrement.")}</p>
        </div>
        <div className="dashboard-stat-icon" aria-hidden="true"><Upload size={22} /></div>
      </header>

      <div className="bulk-import-tabs" role="tablist" aria-label="Type d’import">
        {Object.entries(TYPE_CONFIG).map(([key, item]) => {
          const TabIcon = item.icon;
          return (
            <button key={key} type="button" role="tab" aria-selected={type === key} className={type === key ? 'is-active' : ''} onClick={() => handleTypeChange(key)}>
              <TabIcon size={17} /> {educationText(item.label)}
            </button>
          );
        })}
      </div>

      <div className="bulk-import-layout">
        <section className="glass-card bulk-import-upload-card">
          <div className="institution-settings-section-heading">
            <span className="dashboard-stat-icon"><Icon size={18} /></span>
            <div><h2>Fichier {config.label.toLowerCase()}</h2><p>Formats acceptés : Excel .xls et .xlsx.</p></div>
          </div>

          <div className="bulk-import-template-actions">
            <button type="button" className="btn-modern secondary" onClick={() => downloadExcelTemplate(type)}>
              <Download size={16} /> Télécharger le modèle vide
            </button>
            <small>Le modèle contient une feuille vide et une feuille « Instructions ».</small>
          </div>

          <label className="bulk-import-dropzone" htmlFor="bulk-import-file">
            <Upload size={28} />
            <strong>{fileName || `Choisir un fichier ${config.label.toLowerCase()}`}</strong>
            <span>Cliquez ici pour sélectionner votre fichier Excel</span>
            <input ref={fileInputRef} id="bulk-import-file" type="file" accept={config.accept} onChange={handleFileChange} />
          </label>

          {reading && <div className="bulk-import-reading"><RefreshCw size={15} className="bulk-import-spin" /> Lecture du fichier…</div>}

          <div className="bulk-import-help">
            <strong>Avant l’import</strong>
            <ul>
              <li>Gardez les intitulés du modèle et une ligne par personne.</li>
              <li>{educationText("Pour plusieurs diplômes, filières, années ou modules, séparez les valeurs par ")}<code>;</code>.</li>
              <li>Les doublons de matricule ou de nom seront bloqués automatiquement.</li>
            </ul>
          </div>
        </section>

        <section className="glass-card bulk-import-preview-card">
          <div className="bulk-import-preview-heading">
            <div><h2>Aperçu avant import</h2><p>{rows.length ? `${rows.length} ligne(s) trouvée(s)` : 'Aucun fichier analysé'}</p></div>
            {rows.length > 0 && <button type="button" className="btn-modern ghost" onClick={clearImport}>Effacer</button>}
          </div>

          {rows.length === 0 ? (
            <div className="bulk-import-empty"><FileSpreadsheet size={32} /><span>Votre aperçu apparaîtra ici après la lecture du fichier.</span></div>
          ) : (
            <>
              <div className="bulk-import-summary">
                <span className="is-valid"><CheckCircle2 size={15} /> {validRows.length} prête(s)</span>
                <span className="is-invalid"><AlertTriangle size={15} /> {invalidRows.length} à corriger</span>
              </div>
              <div className="bulk-import-table-wrap">
                <table className="bulk-import-table">
                  <thead><tr><th>Ligne</th><th>Identité</th><th>Parcours</th><th>État</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 50).map(row => {
                      const identity = type === 'students' ? `${row.lastName} ${row.firstName}`.trim() : row.name;
                      const parcours = type === 'students'
                        ? [row.diploma, row.major, row.year].filter(Boolean).join(' · ')
                        : [row.diplomas.join(', '), row.groups.join(', '), row.years.join(', ')].filter(Boolean).join(' · ');
                      return (
                        <tr key={`${row.rowNumber}-${identity}`} className={row.valid ? '' : 'is-invalid'}>
                          <td>{row.rowNumber}</td>
                          <td>{identity || '—'}</td>
                          <td>{parcours || '—'}</td>
                          <td>{row.valid ? <span className="bulk-import-status valid"><CheckCircle2 size={14} /> Valide</span> : <span className="bulk-import-status invalid" title={row.errors.join(', ')}><AlertTriangle size={14} /> {row.errors.join(', ')}</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > 50 && <small className="bulk-import-more">Affichage des 50 premières lignes sur {rows.length}.</small>}
              <div className="bulk-import-footer">
                <small>Les lignes invalides seront ignorées. Vérifiez-les dans Excel puis rechargez le fichier.</small>
                <button type="button" className="btn-modern primary" disabled={importing || validRows.length === 0} onClick={handleImport}>
                  <Upload size={16} /> {importing ? 'Importation…' : `Importer ${validRows.length} ${config.singular}(s)`}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default BulkImport;

