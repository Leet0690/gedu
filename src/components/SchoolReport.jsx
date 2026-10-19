import { Download } from 'lucide-react';
import { calcSchoolReport, getSchoolSubjects } from '../utils/schoolGrades';
import { useApp } from '../context/AppContext';
import { getSchoolGradeScale } from '../config/educationProfiles';

const format = value => value === null ? '—' : value.toFixed(2);

export default function SchoolReport({ student, academicYear }) {
  const { institution, grades, modules } = useApp();
  const subjects = getSchoolSubjects(modules, student, academicYear);
  const report = calcSchoolReport(grades[student.id] || {}, subjects, academicYear, getSchoolGradeScale(student, institution));
  const download = async () => {
    const { generateSchoolBulletin } = await import('../utils/schoolBulletin');
    await generateSchoolBulletin({ student, academicYear, institution, report });
  };
  return <section className="glass-card school-report">
    <header className="school-grade-editor-heading"><div><h2>{student.lastName} {student.firstName}</h2><p>{student.diploma} · {student.year} · Classe {student.major} · {academicYear}</p></div><button className="btn-modern secondary" onClick={download} disabled={!subjects.length}><Download size={16} /> Bulletin PDF</button></header>
    <div className="school-report-stats"><div><span>Semestre 1 /{report.scale}</span><strong>{format(report.s1)}</strong></div><div><span>Semestre 2 /{report.scale}</span><strong>{format(report.s2)}</strong></div><div><span>Moyenne annuelle /{report.scale}</span><strong>{format(report.annual)}</strong></div></div>
    <p className="school-notice">Les moyennes semestrielles sont pondérées par les coefficients des matières évaluées. La moyenne annuelle apparaît quand tous les semestres attendus sont renseignés. La décision de passage est saisie par l’administration.</p>
    <div className="school-table-scroll"><table className="school-table"><thead><tr><th>Matière</th><th>Coefficient</th><th>Semestre 1</th><th>Semestre 2</th><th>Année</th><th>Appréciations</th></tr></thead><tbody>{report.rows.map(row => <tr key={row.module.id || row.module.name}><td>{row.module.name}</td><td>{row.coefficient}</td><td>{format(row.s1)}</td><td>{format(row.s2)}</td><td>{format(row.annual)}</td><td>{[row.grade.school?.S1?.comment, row.grade.school?.S2?.comment].filter(Boolean).join(' / ') || '—'}</td></tr>)}</tbody></table></div>
    {!subjects.length && <p className="school-empty">Aucune matière configurée pour cette classe et cette année scolaire.</p>}
  </section>;
}
