import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import SchoolGradeTable from '../components/SchoolGradeTable';
import SchoolReport from '../components/SchoolReport';
import { getStudentAcademicSnapshot, getStudentAvailableStudyYears, isActiveStudent } from '../utils/studentStatus';
import { getSchoolSubjects } from '../utils/schoolGrades';
import { isSchoolStudent } from '../config/educationProfiles';

export default function SchoolRecords({ reportsOnly = false }) {
  const { students, activeAcademicYear, operationalAcademicYear, availableAcademicYearsList, activeSemester, modules, academicCatalog, loading } = useApp();
  const { hasPermission } = useAdminAuth();
  const [year, setYear] = useState(activeAcademicYear || operationalAcademicYear);
  const [semester, setSemester] = useState(activeSemester || 'S1');
  const [cycle, setCycle] = useState('');
  const [level, setLevel] = useState('');
  const [className, setClassName] = useState('');
  const [studentId, setStudentId] = useState('');
  const roster = useMemo(() => students.filter(isSchoolStudent).map(student => getStudentAcademicSnapshot(student, year, operationalAcademicYear)).filter(Boolean), [students, year, operationalAcademicYear]);
  const visible = roster.filter(student => (!cycle || student.diploma === cycle) && (!level || student.year === level) && (!className || student.major === className));
  const levels = [...new Set((cycle ? academicCatalog.years?.[cycle] || [] : Object.values(academicCatalog.years || {}).flat()))];
  const classes = [...new Set((cycle ? academicCatalog.filieres?.[cycle] || [] : Object.values(academicCatalog.filieres || {}).flat()))];
  const rows = visible.filter(isActiveStudent).flatMap(student => getSchoolSubjects(modules, student, year)
    .filter(module => !['S1', 'S2'].includes(module.semester) || module.semester === semester)
    .map(module => ({ student, module })));
  const selected = visible.find(student => student.id === studentId);
  return <div className="section-padding school-records-page">
    <header className="home-dashboard-heading"><div><span className="gedu-settings-eyebrow"><BookOpen size={14} /> Suivi scolaire</span><h1>{reportsOnly ? 'Bulletins scolaires' : 'Notes et évaluations'}</h1><p>Élèves, matières et contrôles par semestre. Année scolaire {year}.</p></div></header>
    <div className="glass-card school-record-filters">
      <label>Année scolaire<select value={year} onChange={event => setYear(event.target.value)}>{availableAcademicYearsList.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Cycle<select value={cycle} onChange={event => { setCycle(event.target.value); setLevel(''); setClassName(''); setStudentId(''); }}><option value="">Tous les cycles</option>{academicCatalog.diplomas.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Niveau scolaire<select value={level} onChange={event => { setLevel(event.target.value); setStudentId(''); }}><option value="">Tous les niveaux</option>{levels.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Classe / section<select value={className} onChange={event => { setClassName(event.target.value); setStudentId(''); }}><option value="">Toutes les classes</option>{classes.map(value => <option key={value}>{value}</option>)}</select></label>
      {!reportsOnly && <label>Semestre<select value={semester} onChange={event => setSemester(event.target.value)}><option value="S1">Semestre 1</option><option value="S2">Semestre 2</option></select></label>}
      <label>Bulletin d’un élève<select value={selected?.id || ''} onChange={event => setStudentId(event.target.value)}><option value="">Choisir un élève</option>{visible.map(student => <option key={student.id} value={student.id}>{student.lastName} {student.firstName} · {student.major} · {student.year}</option>)}</select></label>
    </div>
    {loading && <p role="status">Chargement des dossiers…</p>}
    {!reportsOnly && <SchoolGradeTable rows={rows} semester={semester} academicYear={year} readOnly={!hasPermission('grades', 'edit')} />}
    {selected && <SchoolReport student={selected} academicYear={year} />}
    {reportsOnly && !selected && <p className="school-empty glass-card">Sélectionnez un élève pour consulter ses résultats semestriels et télécharger son bulletin.</p>}
  </div>;
}

export function SchoolStudentResults() {
  const { studentId } = useParams();
  const [params, setParams] = useSearchParams();
  const { students, institution, operationalAcademicYear, loading, studentPortalGradesError } = useApp();
  const student = students.find(item => item.token === studentId);
  if (loading) return <p className="school-empty" role="status">Chargement du bulletin scolaire…</p>;
  if (!student) return <p className="school-empty" role="alert">Ce lien élève est invalide ou n’est plus disponible.</p>;
  if (studentPortalGradesError) return <p className="school-empty" role="alert">{studentPortalGradesError}</p>;
  const years = getStudentAvailableStudyYears(student, operationalAcademicYear);
  const selected = years.find(option => option.key === params.get('year')) || years.find(option => option.isCurrent) || years.at(-1);
  const snapshot = selected && getStudentAcademicSnapshot(student, selected.academicYear, operationalAcademicYear);
  return <main className="section-padding school-records-page" style={{ maxWidth: 1100, margin: '0 auto' }}>
    <header className="home-dashboard-heading"><div><span className="gedu-settings-eyebrow">{institution.name}</span><h1>Espace élève</h1><p>Résultats et bulletins scolaires</p></div></header>
    <label className="school-portal-year">Année scolaire<select value={selected?.key || ''} onChange={event => setParams({ year: event.target.value })}>{years.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
    {snapshot && <SchoolReport student={snapshot} academicYear={selected.academicYear} />}
  </main>;
}
