import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { calcSchoolReport, getSchoolSubjects } from '../utils/schoolGrades';
import { getSchoolGradeScale } from '../config/educationProfiles';

export default function SchoolOverview({ students, tasks = false }) {
  const { grades, modules, activeAcademicYear, activeSemester, institution } = useApp();
  const field = activeSemester === 'S2' ? 's2' : 's1';
  const reports = students.map(student => calcSchoolReport(grades[student.id] || {}, getSchoolSubjects(modules, student, activeAcademicYear), activeAcademicYear, getSchoolGradeScale(student, institution)));
  const evaluated = reports.filter(report => report[field] !== null).length;
  const pending = reports.filter(report => !report.rows.length || report.rows.some(row => row[field] === null)).length;
  return <section className="glass-card school-grade-editor" style={{ margin: 0 }}>
    <h2 style={{ fontSize: 16, fontWeight: 800 }}>{tasks ? 'Suivi de la vie scolaire' : `Évaluations · ${activeSemester === 'S2' ? 'Semestre 2' : 'Semestre 1'}`}</h2>
    <p className="education-profile-description">{tasks ? `${pending} dossier(s) avec des matières ou des notes à compléter.` : `${evaluated} élève(s) avec des notes saisies sur ${students.length} inscrit(s).`}</p>
    <p className="education-profile-description">Les résultats sont suivis par matière et semestre. Les décisions de passage restent à valider par l’administration.</p>
    <Link to={tasks ? '/admin/catalog' : '/admin/grades'} className="btn-modern secondary">{tasks ? 'Gérer les cycles et classes' : 'Ouvrir les notes'}</Link>
  </section>;
}
