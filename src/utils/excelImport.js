import * as XLSX from 'xlsx';
import { getEducationInstitution, educationText, isSchoolEducation } from './education.js';
import { SCHOOL_CYCLES } from '../config/educationProfiles.js';

const normalizeHeader = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const normalizeCell = value => String(value ?? '').trim();

const splitList = value => normalizeCell(value)
  .split(/[;,|]/)
  .map(item => item.trim())
  .filter(Boolean)
  .filter((item, index, list) => list.indexOf(item) === index);

const normalizeStatus = value => {
  const status = normalizeHeader(value);
  return {
    actif: 'active',
    active: 'active',
    laureat: 'laureat',
    'laureat e': 'laureat',
    withdrawn: 'withdrawn',
    abandon: 'withdrawn',
    abandonne: 'withdrawn',
  }[status] || status;
};

const isAcademicYear = value => {
  const match = String(value || '').match(/^(\d{4})-(\d{4})$/);
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
};

const HEADER_ALIASES = {
  students: {
    firstName: ['prenom', 'first name', 'firstname'],
    lastName: ['nom', 'nom de famille', 'last name', 'lastname'],
    regNo: ['matricule', 'numero inscription', 'numero de matricule', 'code'],
    diploma: ['cycle', 'cycle scolaire', 'niveau', 'diplome', 'niveau diplome', 'diploma'],
    major: ['classe', 'classe section', 'section', 'filiere', 'formation', 'major'],
    year: ['niveau scolaire', 'annee detude', 'annee d etude', 'annee etude', 'niveau detude', 'niveau d etude', 'study year', 'year'],
    academicYear: ['annee academique', 'annee scolaire', 'academic year', 'school year'],
    status: ['statut', 'status'],
  },
  teachers: {
    name: ['nom complet', 'nom', 'enseignant', 'formateur', 'name', 'full name'],
    diplomas: ['cycles', 'cycle', 'diplomes', 'diplome', 'niveaux', 'niveau', 'diplomas'],
    groups: ['classes', 'classe', 'sections', 'filieres', 'filiere', 'groupes', 'groupe', 'formations', 'groups'],
    years: ['niveaux scolaires', 'niveau scolaire', 'annees detude', 'annees d etude', 'annee detude', 'annee d etude', 'annees', 'niveaux detude', 'niveaux d etude', 'years'],
    subjects: ['modules', 'module', 'matieres', 'matiere', 'subjects', 'subject'],
    hourlyRate: ['taux horaire', 'tarif horaire', 'tarif', 'hourly rate', 'hourlyrate'],
  },
};

const TEMPLATE_DEFINITIONS = {
  students: {
    filename: 'modele_import_stagiaires.xlsx',
    headers: ['Nom', 'Prénom', 'Matricule', 'Niveau / diplôme', 'Filière', 'Année d’étude', 'Année académique', 'Statut'],
    instructions: [
      ['Nom', 'Oui', 'Nom de famille du stagiaire', 'ALAMI'],
      ['Prénom', 'Oui', 'Prénom du stagiaire', 'Omar'],
      ['Matricule', 'Oui', 'Identifiant unique', 'STG-001'],
      ['Niveau / diplôme', 'Oui', 'Valeur configurée dans Catalogue académique', 'Technicien'],
      ['Filière', 'Oui', 'Valeur configurée dans Catalogue académique', 'Développement Digital'],
      ['Année d’étude', 'Oui', 'Exemple : 1ère année ou 2ème année', '1ère année'],
      ['Année académique', 'Non', 'Format AAAA-AAAA ; vide = année active', '2025-2026'],
      ['Statut', 'Non', 'active, laureat ou withdrawn ; vide = active', 'active'],
    ],
  },
  teachers: {
    filename: 'modele_import_formateurs.xlsx',
    headers: ['Nom complet', 'Diplômes', 'Filières', 'Années d’étude', 'Modules', 'Taux horaire'],
    instructions: [
      ['Nom complet', 'Oui', 'Nom affiché du formateur', 'Dr. ALAMI Mohamed'],
      ['Diplômes', 'Oui', 'Plusieurs valeurs séparées par ;', 'Technicien; Technicien Spécialisé'],
      ['Filières', 'Oui', 'Plusieurs valeurs séparées par ;', 'Développement Digital; Gestion'],
      ['Années d’étude', 'Oui', 'Plusieurs valeurs séparées par ;', '1ère année; 2ème année'],
      ['Modules', 'Oui', 'Modules séparés par ;', 'Algorithmique; Base de données'],
      ['Taux horaire', 'Non', 'Nombre ; accepte la virgule décimale', '150'],
    ],
  },
};

const findColumnIndex = (headers, aliases) => {
  const normalized = headers.map(normalizeHeader);
  return normalized.findIndex(header => aliases.includes(header));
};

const parseNumber = value => {
  const normalized = normalizeCell(value).replace(/\s/g, '').replace(',', '.');
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const buildRow = (row, headers, type, rowNumber) => {
  const aliases = HEADER_ALIASES[type];
  const read = field => {
    const index = findColumnIndex(headers, aliases[field]);
    return index < 0 ? '' : normalizeCell(row[index]);
  };

  if (type === 'students') {
    return {
      rowNumber,
      firstName: read('firstName'),
      lastName: read('lastName'),
      regNo: read('regNo'),
      diploma: read('diploma'),
      major: read('major'),
      year: read('year'),
      academicYear: read('academicYear'),
      status: normalizeStatus(read('status')) || 'active',
    };
  }

  return {
    rowNumber,
    name: read('name'),
    diplomas: splitList(read('diplomas')),
    groups: splitList(read('groups')),
    years: splitList(read('years')),
    subjects: splitList(read('subjects')),
    hourlyRate: parseNumber(read('hourlyRate')),
  };
};

export const readExcelRows = async (file, type) => {
  if (!file) throw new Error('Sélectionnez un fichier Excel.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Le fichier ne doit pas dépasser 10 Mo.');
  if (!['students', 'teachers'].includes(type)) throw new Error('Type d’import inconnu.');

  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, raw: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error('Le fichier Excel ne contient aucune feuille.');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '', raw: false });
  const headerRowIndex = rows.findIndex(row => Array.isArray(row) && row.some(value => normalizeCell(value)));
  if (headerRowIndex < 0) throw new Error('Le fichier Excel est vide.');

  const headers = rows[headerRowIndex].map(normalizeCell);
  const requiredHeaders = type === 'students'
    ? ['firstName', 'lastName', 'regNo', 'diploma', 'major', 'year']
    : ['name', 'diplomas', 'groups', 'years', 'subjects'];
  const missingHeaders = requiredHeaders
    .filter(field => findColumnIndex(headers, HEADER_ALIASES[type][field]) < 0)
    .map(field => field === 'firstName' ? 'Prénom' : field === 'lastName' ? 'Nom' : field);
  if (missingHeaders.length > 0) {
    throw new Error(`Colonnes obligatoires absentes : ${missingHeaders.join(', ')}.`);
  }

  return rows.slice(headerRowIndex + 1)
    .map((row, index) => ({ row, rowNumber: headerRowIndex + index + 2 }))
    .filter(({ row }) => row.some(value => normalizeCell(value)))
    .map(({ row, rowNumber }) => buildRow(row, headers, type, rowNumber));
};

export const validateExcelRows = (rows, type, { existingStudents = [], existingTeachers = [], institution = getEducationInstitution(), academicCatalog } = {}) => {
  const existingKeys = new Set((type === 'students' ? existingStudents : existingTeachers)
    .map(item => String(type === 'students' ? item.regNo : item.name).trim().toLowerCase())
    .filter(Boolean));
  const fileKeys = new Set();

  return rows.map(row => {
    const errors = [];
    const key = String(type === 'students' ? row.regNo : row.name).trim().toLowerCase();
    if (type === 'students') {
      if (!row.lastName) errors.push('Nom manquant');
      if (!row.firstName) errors.push('Prénom manquant');
      if (!row.regNo) errors.push('Matricule manquant');
      if (!row.diploma) errors.push('Niveau manquant');
      if (!row.major) errors.push('Filière manquante');
      if (!row.year) errors.push('Année d’étude manquante');
      if (row.academicYear && !isAcademicYear(row.academicYear)) errors.push('Année académique invalide');
      if (!['active', 'laureat', 'withdrawn'].includes(row.status)) errors.push('Statut invalide');
    } else {
      if (!row.name) errors.push('Nom complet manquant');
      if (row.diplomas.length === 0) errors.push('Diplôme manquant');
      if (row.groups.length === 0) errors.push('Filière manquante');
      if (row.years.length === 0) errors.push('Année d’étude manquante');
      if (row.subjects.length === 0) errors.push('Module manquant');
      if (Number.isNaN(row.hourlyRate)) errors.push('Taux horaire invalide');
    }
    if (isSchoolEducation(institution)) {
      const cycles = type === 'students' ? [row.diploma] : row.diplomas;
      if (cycles.some(cycle => !institution.schoolCycles.includes(cycle))) errors.push('Cycle non proposé par l’école');
      if (type === 'students' && !SCHOOL_CYCLES[row.diploma]?.years.includes(row.year)) errors.push('Niveau incompatible avec le cycle');
      if (type === 'students' && academicCatalog && !Array.from(academicCatalog.groups?.[row.diploma]?.[row.major] || []).includes(row.year)) errors.push('Classe non configurée pour ce niveau scolaire');
      const classes = type === 'students' ? [row.major] : row.groups;
      const configured = cycles.flatMap(cycle => Object.keys(academicCatalog?.groups?.[cycle] || {}));
      if (academicCatalog && classes.some(value => !configured.includes(value))) errors.push('Classe absente du catalogue');
    }
    if (key && existingKeys.has(key)) errors.push(type === 'students' ? 'Matricule déjà présent' : 'Formateur déjà présent');
    if (key && fileKeys.has(key)) errors.push('Doublon dans le fichier');
    if (key) fileKeys.add(key);
    return { ...row, errors: errors.map(error => educationText(error, institution)), valid: errors.length === 0 };
  });
};

export const createExcelTemplate = (type, institution = getEducationInstitution()) => {
  const definition = TEMPLATE_DEFINITIONS[type];
  if (!definition) return;
  const school = isSchoolEducation(institution);
  const headers = definition.headers.map(header => educationText(header, institution));
  const instructions = definition.instructions.map(([field, required, description, example]) => [
    educationText(field, institution), required, educationText(description, institution), example,
  ]);
  if (school) {
    const examples = type === 'students'
      ? ['ALAMI', 'Omar', 'ELV-001', 'Primaire', 'A', '3ème année primaire', '2025-2026', 'active']
      : ['ALAMI Mohamed', 'Primaire; Collège', 'A; B', '3ème année primaire; 1ère année collège', 'Mathématiques; Français', '150'];
    instructions.forEach((row, index) => { row[3] = examples[index]; });
  }
  const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ['Champ', 'Obligatoire', 'Description', 'Exemple'],
    ...instructions,
  ]);
  dataSheet['!cols'] = definition.headers.map(header => ({ wch: Math.max(18, header.length + 4) }));
  instructionsSheet['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 55 }, { wch: 42 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, educationText(type === 'students' ? 'Stagiaires' : 'Formateurs', institution));
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
  return workbook;
};

export const downloadExcelTemplate = type => {
  const workbook = createExcelTemplate(type);
  if (workbook) XLSX.writeFile(workbook, isSchoolEducation()
    ? `modele_import_${type === 'students' ? 'eleves' : 'enseignants'}.xlsx`
    : TEMPLATE_DEFINITIONS[type].filename);
};

