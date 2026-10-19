import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { getGradeByModuleName, getGradesForAcademicYear, sanitizeGradeKey } from '../utils/gradeSync';
import { isValidScore } from '../utils/gradeCalculations';
import { SCHOOL_ASSESSMENTS, calcSchoolSubjectAverage, getSchoolTermGrade } from '../utils/schoolGrades';
import { getSchoolGradeScale } from '../config/educationProfiles';

export default function SchoolGradeTable({ rows, semester, academicYear, readOnly = false, portalToken = '', teacherId = '' }) {
  const { grades, batchUpdateGrades, institution } = useApp();
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const hasDrafts = Object.keys(drafts).length > 0;
  useEffect(() => {
    if (!hasDrafts) return;
    const prevent = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [hasDrafts]);

  const getGrade = (student, module) => getGradeByModuleName(getGradesForAcademicYear(grades[student.id] || {}, academicYear), module) || {};
  const draftKey = (student, module) => JSON.stringify([student.id, module.name, semester, academicYear]);
  const change = (student, module, field, value) => {
    const key = draftKey(student, module);
    setDrafts(previous => ({ ...previous, [key]: {
      studentId: student.id, subject: module.name, semester, academicYear,
      changes: { ...(previous[key]?.changes || {}), [field]: value },
      scale: getSchoolTermGrade(getGrade(student, module), semester).scale || getSchoolGradeScale(student, institution),
    } }));
  };
  const save = async () => {
    const records = Object.values(drafts);
    if (records.some(item => SCHOOL_ASSESSMENTS.some(field => !isValidScore(item.changes[field]) || Number(item.changes[field]) > item.scale))) {
      showToast('Les notes doivent respecter le barème de la classe (sur 10 ou sur 20).', 'error'); return;
    }
    setSaving(true);
    try {
      const grouped = new Map();
      records.forEach(item => {
        const key = JSON.stringify([item.studentId, item.subject, item.academicYear]);
        const current = grouped.get(key)?.gradeData || getGradeByModuleName(getGradesForAcademicYear(grades[item.studentId] || {}, item.academicYear), item.subject) || {};
        grouped.set(key, { studentId: item.studentId, subject: sanitizeGradeKey(item.subject), academicYear: item.academicYear,
          gradeData: { ...current, school: { ...(current.school || {}), [item.semester]: { ...getSchoolTermGrade(current, item.semester), ...item.changes, scale: item.scale } } },
        });
      });
      const updates = [...grouped.values()];
      for (let offset = 0; offset < updates.length; offset += 200) await batchUpdateGrades(updates.slice(offset, offset + 200), portalToken, teacherId);
      setDrafts({});
    } catch (error) { showToast(error.message || 'Enregistrement impossible.', 'error'); }
    finally { setSaving(false); }
  };

  return <section className="glass-card school-grade-editor">
    <div className="school-grade-editor-heading"><div><h2>Notes par matière · {semester === 'S1' ? 'Semestre 1' : 'Semestre 2'}</h2><p>Contrôles sur le barème du cycle. Les cellules vides restent sans note. Les moyennes utilisent les contrôles renseignés.</p></div>
      {!readOnly && <button type="button" className="btn-modern primary" onClick={save} disabled={saving || !hasDrafts}><Save size={16} /> {saving ? 'Enregistrement…' : `Enregistrer${hasDrafts ? ' les modifications' : ''}`}</button>}
    </div>
    {hasDrafts && <p role="status" className="school-notice">Des notes sont en attente d’enregistrement, y compris dans les autres semestres consultés.</p>}
    <div className="school-table-scroll"><table className="school-table"><thead><tr><th>Élève</th><th>Matière</th>{SCHOOL_ASSESSMENTS.map((field, i) => <th key={field}>Contrôle {i + 1}</th>)}<th>Moyenne</th><th>Appréciation</th></tr></thead>
      <tbody>{rows.map(({ student, module }) => {
        const key = draftKey(student, module);
        const grade = { ...getSchoolTermGrade(getGrade(student, module), semester), ...(drafts[key]?.changes || {}) };
        const scale = grade.scale || getSchoolGradeScale(student, institution);
        const average = calcSchoolSubjectAverage(grade, scale);
        return <tr key={key}><td><strong>{student.lastName} {student.firstName}</strong><small>{student.year} · {student.major}</small></td><td>{module.name}</td>
          {SCHOOL_ASSESSMENTS.map((field, i) => <td key={field}><input aria-label={`Contrôle ${i + 1} sur ${scale} · ${student.lastName} ${student.firstName} · ${module.name}`} type="number" min="0" max={scale} step="0.01" value={grade[field] ?? ''} disabled={readOnly || saving} onChange={event => change(student, module, field, event.target.value)} /></td>)}
          <td>{average === null ? '—' : `${average.toFixed(2)} /${scale}`}</td><td><input aria-label={`Appréciation · ${student.lastName} · ${module.name}`} value={grade.comment || ''} maxLength={500} disabled={readOnly || saving} onChange={event => change(student, module, 'comment', event.target.value)} /></td></tr>;
      })}</tbody></table></div>
    {rows.length === 0 && <p className="school-empty">Choisissez une classe ayant des élèves inscrits et des matières configurées pour cette année scolaire.</p>}
  </section>;
}
