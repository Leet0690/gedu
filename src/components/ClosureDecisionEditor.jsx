import { useState } from 'react';
import { getClosureDecisionOptions, getRecordedClosureDecision } from '../utils/academicYearClosure';

export default function ClosureDecisionEditor({ student, onSave }) {
  const entry = student.classHistory?.at(-1);
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  if (!entry?.operationId) return null;
  const options = getClosureDecisionOptions({ ...student, diploma: entry.diploma || student.diploma, year: entry.year });
  const recorded = getRecordedClosureDecision(student, entry);
  const submit = async event => {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess(false);
    try {
      await onSave({
        studentId: student.id, academicYear: entry.academicYear, decision,
        expectedRevision: entry.revision || 0, reason: reason.trim(),
      });
      setDecision(''); setReason(''); setSuccess(true);
    } catch (err) {
      setError(err.message || 'Impossible de modifier la décision.');
    } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} style={{ marginTop: '20px', padding: '16px', border: '1px solid var(--border-light)', borderRadius: '14px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Modifier la décision après clôture</h3>
      <p style={{ fontSize: '12px', margin: '8px 0' }}>
        Dernière clôture : <strong>{entry.academicYear}</strong> · {entry.year}<br />
        Décision actuelle : <strong>{options.find(option => option.value === recorded)?.label}</strong>
      </p>
      <label htmlFor="correct-closure-decision">Nouvelle décision</label>
      <select id="correct-closure-decision" className="input-premium" value={decision} disabled={saving}
        onChange={event => { setDecision(event.target.value); setSuccess(false); }} required style={{ width: '100%', margin: '8px 0' }}>
        <option value="">Choisir une décision…</option>
        {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled || option.value === recorded}>{option.label}</option>)}
      </select>
      <label htmlFor="correct-closure-reason">Motif de la correction (facultatif)</label>
      <input id="correct-closure-reason" className="input-premium" value={reason} disabled={saving} maxLength={500}
        onChange={event => setReason(event.target.value)} style={{ width: '100%', margin: '8px 0' }} />
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Le niveau et le statut seront recalculés. Les notes, relevés, paiements et présences sont conservés. Chaque correction est enregistrée dans l’historique.
      </p>
      {error && <p role="alert" style={{ color: 'var(--danger)', marginBottom: '8px' }}>{error}</p>}
      {success && <p role="status" style={{ color: 'var(--success)', marginBottom: '8px' }}>Décision modifiée. Le dossier a été mis à jour.</p>}
      <button type="submit" className="btn-modern primary" disabled={saving || !decision || decision === recorded}>
        {saving ? 'Enregistrement…' : 'Enregistrer la nouvelle décision'}
      </button>
      {entry.corrections?.length > 0 && (
        <details style={{ marginTop: '12px', fontSize: '12px' }}>
          <summary>Historique des corrections ({entry.corrections.length})</summary>
          {entry.corrections.map((correction, index) => (
            <p key={index} style={{ marginTop: '8px' }}>
              {new Date(correction.correctedAt).toLocaleString('fr-FR')} : {options.find(option => option.value === correction.from)?.label} → {options.find(option => option.value === correction.to)?.label}
              {correction.reason ? ` — ${correction.reason}` : ''}
            </p>
          ))}
        </details>
      )}
    </form>
  );
}
