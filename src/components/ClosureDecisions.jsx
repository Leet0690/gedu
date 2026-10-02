import { useState } from 'react';
import { getClosureDecisionOptions } from '../utils/academicYearClosure';

export default function ClosureDecisions({ students, decisions, onChange, disabled }) {
  const [search, setSearch] = useState('');
  const visible = students.filter(student =>
    `${student.lastName} ${student.firstName} ${student.regNo || ''} ${student.major || ''}`
      .toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr').trim()));
  return (
    <section style={{ marginBottom: '20px' }} aria-label="Décisions de fin d’année">
      <p style={{ fontWeight: 800, marginBottom: '8px' }}>Décision pour chaque stagiaire</p>
      <p style={{ fontSize: '12px', marginBottom: '12px', color: 'var(--text-muted)' }}>
        Choisissez Passage, Lauréat, Redoublement ou Abandon. Les notes, relevés, paiements et présences restent conservés.
      </p>
      <input className="input-premium" type="search" aria-label="Rechercher un stagiaire pour la clôture"
        placeholder="Nom, matricule ou filière…" value={search} onChange={event => setSearch(event.target.value)}
        style={{ width: '100%', marginBottom: '8px' }} />
      <button type="button" className="btn-modern" disabled={disabled}
        style={{ marginBottom: '12px', fontSize: '12px' }}
        onClick={() => onChange(previous => {
          const next = { ...previous };
          visible.forEach(student => {
            if (!next[student.id]) next[student.id] = getClosureDecisionOptions(student).find(option => !option.disabled)?.value || '';
          });
          return next;
        })}>
        Appliquer passage / lauréat aux stagiaires affichés sans décision
      </button>
      <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '12px' }}>
        {visible.map(student => (
          <div key={student.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '12px', borderBottom: '1px solid var(--border-light)' }}>
            <label htmlFor={`closure-${student.id}`} style={{ flex: '1 1 190px', fontSize: '13px' }}>
              <strong>{student.lastName} {student.firstName}</strong>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                {student.regNo} · {student.major} · {student.year}
              </span>
            </label>
            <select id={`closure-${student.id}`} className="input-premium" disabled={disabled}
              style={{ flex: '1 1 180px', fontSize: '12px' }} value={decisions[student.id] || ''}
              onChange={event => onChange(previous => ({ ...previous, [student.id]: event.target.value }))}>
              <option value="">Choisir une décision…</option>
              {getClosureDecisionOptions(student).map(option => (
                <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
              ))}
            </select>
          </div>
        ))}
        {visible.length === 0 && <p style={{ padding: '12px' }}>Aucun stagiaire trouvé.</p>}
      </div>
    </section>
  );
}
