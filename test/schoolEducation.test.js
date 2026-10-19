import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { SCHOOL_CYCLES } from '../src/config/educationProfiles.js';
import { getInstitutionConfig } from '../src/config/institution.js';
import { educationText } from '../src/utils/education.js';
import { buildAcademicCatalog, getStudyYearsForDiploma } from '../src/data/modules.js';
import { buildStudentClosure, buildStudentClosureUndo, getClosureDecisionOptions } from '../src/utils/academicYearClosure.js';
import { getSchoolPlacementOptions } from '../src/utils/schoolPlacement.js';
import { getStudentAcademicSnapshot, getStudentAvailableStudyYears, getStudentVacationMonths } from '../src/utils/studentStatus.js';
import { calcSchoolSubjectAverage, calcSchoolReport } from '../src/utils/schoolGrades.js';
import { createExcelTemplate, readExcelRows, validateExcelRows } from '../src/utils/excelImport.js';
import { getPublicInstitution } from '../src/utils/publicInstitution.js';
import { generateSchoolBulletin } from '../src/utils/schoolBulletin.js';

const school = getInstitutionConfig({ educationType: 'private_school', name: 'École des savoirs' });
const pupil = { id: 'pupil', firstName: 'Omar', lastName: 'Alami', regNo: 'ELV-001', educationType: 'private_school', diploma: 'Primaire', major: 'A', year: '6ème année primaire', academicYear: '2025-2026', token: 'retained' };
const catalog = buildAcademicCatalog({ educationType: 'private_school', configuredGroups: { Collège: { B: ['1ère année collège'] }, Primaire: { A: ['6ème année primaire'] }, Technicien: { Gestion: ['1ère année'] } } });

test('school cycles preserve six primary levels, three middle levels and the lycée order without sample classes', () => {
  assert.equal(getStudyYearsForDiploma('Primaire').length, 6);
  assert.equal(getStudyYearsForDiploma('Collège').length, 3);
  assert.deepEqual(getStudyYearsForDiploma('Lycée'), ['Tronc commun', '1ère année baccalauréat', '2ème année baccalauréat']);
  assert.deepEqual(buildAcademicCatalog({ educationType: 'private_school' }).diplomas, []);
  assert.deepEqual(catalog.diplomas, ['Collège', 'Primaire']);
  const sorted = buildAcademicCatalog({ configuredGroups: { Lycée: { A: [...SCHOOL_CYCLES.Lycée.years].reverse() } } });
  assert.deepEqual(sorted.years.Lycée, SCHOOL_CYCLES.Lycée.years);
});

test('vocabulary adapts the school UI and keeps professional wording in vocational mode', () => {
  assert.equal(educationText('Stagiaires et formateurs', school), 'Élèves et enseignants');
  assert.equal(educationText('Inscrire le stagiaire', school), 'Inscrire l’élève');
  assert.equal(educationText('Choisir un module', school), 'Choisir une matière');
  assert.equal(educationText('Niveau / diplôme', school), 'Cycle scolaire');
  assert.equal(educationText('Année d’étude', school), 'Niveau scolaire');
  assert.equal(educationText('Formateurs', getInstitutionConfig()), 'Formateurs');
});

test('cross-cycle passage requires a configured receiving class and retains the previous class and grades', () => {
  assert.equal(getClosureDecisionOptions(pupil).find(option => option.value === 'pass').disabled, false);
  const placement = getSchoolPlacementOptions(pupil, catalog)[0];
  assert.deepEqual(placement, { diploma: 'Collège', year: '1ère année collège', major: 'B' });
  const args = { student: pupil, decision: 'pass', fromAcademicYear: '2025-2026', toAcademicYear: '2026-2027', operationId: 'test', closedAt: '2026-07-01', catalog };
  assert.throws(() => buildStudentClosure(args), /classe d’accueil/);
  assert.throws(() => buildStudentClosure({ ...args, targetPlacement: { ...placement, major: 'Unknown' } }), /classe d’accueil/);
  const result = buildStudentClosure({ ...args, targetPlacement: placement, grades: { academicYears: { '2025-2026': { Français: { school: { S1: { c1: 14 }, S2: { c1: 16 } } } } } } });
  const promoted = { ...pupil, ...result.data };
  assert.equal(promoted.diploma, 'Collège'); assert.equal(promoted.major, 'B'); assert.equal(promoted.token, 'retained');
  const previous = getStudentAcademicSnapshot(promoted, '2025-2026', '2026-2027');
  assert.equal(previous.diploma, 'Primaire'); assert.equal(previous.year, '6ème année primaire');
  const undo = buildStudentClosureUndo(promoted);
  assert.equal(undo.diploma, 'Primaire'); assert.equal(undo.major, 'A');
  assert.equal(result.gradeYears['2025-2026'].Français.school.S2.c1, 16);
  assert.deepEqual(result.gradeYears['2026-2027'], {});
});

test('school histories retain higher levels and repeat attempts without invented first or second year membership', () => {
  const student = { ...pupil, year: '4ème année primaire', academicYear: '2026-2027', classHistory: [{ academicYear: '2025-2026', diploma: 'Primaire', year: '4ème année primaire', major: 'B' }] };
  assert.equal(getStudentAcademicSnapshot(student, '', '2026-2027').year, '4ème année primaire');
  const options = getStudentAvailableStudyYears(student, '2026-2027');
  assert.equal(options.length, 2); assert.ok(options.every(option => option.yearLevel === '4ème année primaire'));
  assert.equal(getStudentAcademicSnapshot(student, '2024-2025', '2026-2027'), null);
  assert.deepEqual(getStudentVacationMonths(student), ['Juillet', 'Août']);
});

test('school averages keep zero, skip empty cells and isolate academic years and semesters', () => {
  assert.equal(calcSchoolSubjectAverage({ c1: 0, c2: 20 }), 10);
  assert.equal(calcSchoolSubjectAverage({ c1: '', c2: '' }), null);
  assert.equal(calcSchoolSubjectAverage({ c1: 14, c2: 21 }), null);
  const modules = [{ name: 'Français', coefficient: 2 }, { name: 'Mathématiques', coefficient: 1 }];
  const grades = { academicYears: { '2025-2026': { Français: { school: { S1: { c1: 10 }, S2: { c1: 20 } } }, Mathématiques: { school: { S1: { c1: 16 }, S2: { c1: 10 } } } } } };
  const report = calcSchoolReport(grades, modules, '2025-2026');
  assert.equal(report.s1, 12); assert.equal(report.s2, 50 / 3); assert.equal(report.annual, 43 / 3);
  assert.equal(calcSchoolReport(grades, modules, '2026-2027').s1, null);
  assert.equal(calcSchoolReport({ academicYears: { '2025-2026': { Français: { school: { S1: { c1: 20 } } } } } }, modules, '2025-2026').annual, null);
});

for (const bookType of ['xls', 'xlsx']) test(`school Excel templates round-trip ${bookType} headers for pupils and teachers`, async () => {
  for (const type of ['students', 'teachers']) {
    const workbook = createExcelTemplate(type, school);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = type === 'students'
      ? ['ALAMI', 'Omar', 'ELV-002', 'Primaire', 'A', '6ème année primaire', '2025-2026', 'active']
      : ['ALAMI Mohamed', 'Primaire', 'A', '6ème année primaire', 'Français; Mathématiques', '150,50'];
    XLSX.utils.sheet_add_aoa(worksheet, [data], { origin: 'A3' });
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType });
    const rows = await readExcelRows({ arrayBuffer: async () => buffer }, type);
    assert.equal(rows.length, 1); assert.equal(rows[0].rowNumber, 3);
    const checked = validateExcelRows(rows, type, { institution: school, academicCatalog: catalog });
    assert.deepEqual(checked[0].errors, []);
    if (type === 'teachers') assert.equal(rows[0].hourlyRate, 150.5);
    const empty = createExcelTemplate(type, school);
    assert.equal((await readExcelRows({ arrayBuffer: async () => XLSX.write(empty, { type: 'buffer', bookType }) }, type)).length, 0);
  }
});

test('public school profile publishes no identity domains or private settings', () => {
  const profile = getPublicInstitution({ ...school, authEmailDomain: 'private.example', secret: 'must-not-publish' });
  assert.equal(profile.educationType, 'private_school'); assert.equal(profile.authEmailDomain, undefined); assert.equal(profile.secret, undefined);
});

test('primary-school scales remain explicit and old /20 scores can be displayed on /10 without changing their meaning', () => {
  assert.equal(calcSchoolSubjectAverage({ c1: 11, scale: 10 }), null);
  assert.equal(calcSchoolSubjectAverage({ c1: 7, c2: 9, scale: 10 }), 8);
  const report = calcSchoolReport({ academicYears: { '2025-2026': { Français: { school: { S1: { c1: 16, scale: 20 }, S2: { c1: 8, scale: 10 } } } } } }, [{ name: 'Français' }], '2025-2026', 10);
  assert.equal(report.s1, 8); assert.equal(report.s2, 8); assert.equal(report.annual, 8); assert.equal(report.scale, 10);
});

test('school bulletin uses school identity and paginates a long subject list', async () => {
  const modules = Array.from({ length: 60 }, (_, index) => ({ name: `Matière ${index + 1}`, coefficient: 1 }));
  const report = calcSchoolReport({}, modules, '2025-2026');
  const document = await generateSchoolBulletin({ student: pupil, academicYear: '2025-2026', institution: { ...school, logoUrl: '' }, report, save: false });
  assert.ok(document.getNumberOfPages() > 1);
  assert.doesNotMatch(document.output(), /4\/01\/6\/2022|NSTI|EFCFT/);
});
