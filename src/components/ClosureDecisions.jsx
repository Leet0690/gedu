import { educationText } from '../utils/education';
import { useState } from 'react';
import { getClosureDecisionOptions } from '../utils/academicYearClosure';
import { isSchoolStudent } from '../config/educationProfiles';
import { getSchoolPlacementOptions } from '../utils/schoolPlacement';

export default function ClosureDecisions({ students, decisions, onChange, disabled, catalog, placements = {}, onPlacementChange }) {
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [major, setMajor] = useState('');
  const [diploma, setDiploma] = useState('');
  const normalizeSearch = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();
  const searchTerms = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const uniqueValues = (roster, field) => [...new Set(roster.map(student => student[field]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  const diplomaStudents = students.filter(student => !diploma || student.diploma === diploma);
  const visible = diplomaStudents.filter(student => {
    const name = normalizeSearch(`${student.lastName || ''} ${student.firstName || ''} ${student.regNo || ''}`);
    return (!year || student.year === year) && (!major || student.major === major) &&
      searchTerms.every(term => name.includes(term));
  });
  const hasFilters = !!(search || year || major || diploma);
  const pendingVisibleCount = visible.filter(student => !decisions[student.id]).length;
  return (
    <section style={{ marginBottom: '20px' }} aria-label="Décisions de fin d’année">
      <p style={{ fontWeight: 800, marginBottom: '8px' }}>{educationText("Décision pour chaque stagiaire")}</p>
      <p style={{ fontSize: '12px', marginBottom: '12px', color: 'var(--text-muted)' }}>{educationText("Choisissez Passage, Lauréat, Redoublement ou Abandon. Les notes, relevés, paiements et présences restent conservés.")}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
          Niveau
          <select className="input-premium" value={diploma} disabled={disabled} style={{ width: '100%', minWidth: 0 }}
            onChange={event => { setDiploma(event.target.value); setYear(''); setMajor(''); }}>
            <option value="">Tous les niveaux</option>
            {uniqueValues(students, 'diploma').map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>{educationText("Année d’étude")}<select className="input-premium" value={year} disabled={disabled} style={{ width: '100%', minWidth: 0 }}
            onChange={event => setYear(event.target.value)}>
            <option value="">Toutes les années</option>
            {uniqueValues(diplomaStudents, 'year').map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>{educationText("Filière")}<select className="input-premium" value={major} disabled={disabled} style={{ width: '100%', minWidth: 0 }}
            onChange={event => setMajor(event.target.value)}>
            <option value="">{educationText("Toutes les filières")}</option>
            {uniqueValues(diplomaStudents, 'major').map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
        Recherche par nom
        <input className="input-premium" type="search" disabled={disabled}
          placeholder="Nom, prénom ou matricule…" value={search} onChange={event => setSearch(event.target.value)}
          style={{ width: '100%' }} />
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <p role="status" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {visible.length} / {students.length}{educationText(" stagiaire(s) affiché(s) · ")}{pendingVisibleCount} sans décision
        </p>
        {hasFilters && <button type="button" className="btn-modern" disabled={disabled} style={{ fontSize: '12px' }}
          onClick={() => { setSearch(''); setYear(''); setMajor(''); setDiploma(''); }}>Réinitialiser les filtres</button>}
      </div>
      <button type="button" className="btn-modern" disabled={disabled || pendingVisibleCount === 0}
        style={{ marginBottom: '12px', fontSize: '12px' }}
        onClick={() => onChange(previous => {
          const next = { ...previous };
          visible.forEach(student => {
            if (!next[student.id]) next[student.id] = getClosureDecisionOptions(student).find(option => !option.disabled)?.value || '';
          });
          return next;
        })}>{educationText("Appliquer passage / lauréat aux stagiaires affichés sans décision")}</button>
      <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '12px' }}>
        {visible.map(student => (
          <div key={student.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '12px', borderBottom: '1px solid var(--border-light)' }}>
            <label htmlFor={`closure-${student.id}`} style={{ flex: '1 1 190px', fontSize: '13px' }}>
              <strong>{student.lastName} {student.firstName}</strong>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                {student.regNo} · {student.diploma} · {student.major} · {student.year}
              </span>
            </label>
            <select id={`closure-${student.id}`} className="input-premium" disabled={disabled}
              style={{ flex: '1 1 180px', fontSize: '12px' }} value={decisions[student.id] || ''}
              onChange={event => onChange(previous => ({ ...previous, [student.id]: event.target.value }))}>
              <option value="">Choisir une décision…</option>
              {getClosureDecisionOptions(student).map(option => (
                <option key={option.value} value={option.value} disabled={option.disabled}>{educationText(option.label)}</option>
              ))}
            </select>
            {isSchoolStudent(student) && decisions[student.id] === 'pass' && <label style={{ display: 'grid', gap: 6, flex: '1 1 220px', fontSize: 12 }}>
              Classe d’accueil — année suivante
              <select className="input-premium" value={placements[student.id] ? JSON.stringify(placements[student.id]) : ''} disabled={disabled}
                onChange={event => onPlacementChange(previous => ({ ...previous, [student.id]: event.target.value ? JSON.parse(event.target.value) : null }))}>
                <option value="">Choisir la classe d’accueil</option>
                {getSchoolPlacementOptions(student, catalog).map(placement => <option key={placement.major} value={JSON.stringify(placement)}>{placement.diploma} · {placement.year} · {placement.major}</option>)}
              </select>
              {!getSchoolPlacementOptions(student, catalog).length && <small>Configurez d’abord une classe du niveau suivant dans le catalogue.</small>}
            </label>}
          </div>
        ))}
        {visible.length === 0 && <p style={{ padding: '12px' }}>{educationText("Aucun stagiaire trouvé.")}</p>}
      </div>
    </section>
  );
}
