import { getInstitutionConfig } from '../config/institution.js';
import { isSchoolStudent } from '../config/educationProfiles.js';

let currentInstitution = getInstitutionConfig();
export const setEducationInstitution = institution => { currentInstitution = getInstitutionConfig(institution); };
export const getEducationInstitution = () => currentInstitution;
export const isSchoolEducation = (institution = currentInstitution) => institution?.educationType === 'private_school';

const rules = [
  [/\bdu stagiaire\b/gi, 'de l’élève'], [/\bau stagiaire\b/gi, 'à l’élève'],
  [/\ble stagiaire\b/gi, 'l’élève'], [/\bce stagiaire\b/gi, 'cet élève'],
  [/\bdu formateur\b/gi, 'de l’enseignant'], [/\bau formateur\b/gi, 'à l’enseignant'],
  [/\ble formateur\b/gi, 'l’enseignant'],
  [/\baucun module\b/gi, 'aucune matière'], [/\btous les modules\b/gi, 'toutes les matières'],
  [/\bdu module\b/gi, 'de la matière'], [/\ble module\b/gi, 'la matière'], [/\bun module\b/gi, 'une matière'],
  [/\bmodule manquant\b/gi, 'matière manquante'],
  [/\bNiveaux\s*\/\s*Filières\b/gi, 'Cycles / Classes'],
  [/\bNiveaux, filières (?:et|&) années\b/gi, 'Cycles, classes et niveaux'],
  [/\bNiveau\s*\/\s*diplôme\b/gi, 'Cycle scolaire'],
  [/\btous (?:les )?niveaux\b/gi, 'tous les cycles'],
  [/\bchoisir le niveau\b/gi, 'choisir le cycle'],
  [/\bAnnées? d[’']étude\b/gi, match => match.toLowerCase().startsWith('années') ? 'Niveaux scolaires' : 'Niveau scolaire'],
  [/\bannée académique\b/gi, 'année scolaire'],
  [/\bannées académiques\b/gi, 'années scolaires'],
  [/\bannée de formation\b/gi, 'année scolaire'],
  [/\bfin de formation\b/gi, 'fin de cycle'],
  [/\bstagiaires\b/gi, 'élèves'], [/\bstagiaire\b/gi, 'élève'],
  [/\bformateurs\b/gi, 'enseignants'], [/\bformateur\b/gi, 'enseignant'],
  [/\bmodules\b/gi, 'matières'], [/\bmodule\b/gi, 'matière'],
  [/\bfilières\b/gi, 'classes'], [/\bfilière\b/gi, 'classe'],
  [/\bdiplômes\b/gi, 'cycles'], [/\bdiplôme\b/gi, 'cycle'],
  [/\blauréats\b/gi, 'élèves en fin de cycle'], [/\blauréat\b/gi, 'fin de cycle'],
  [/\bapprenants\b/gi, 'élèves'],
];

const preserveCase = (match, replacement) => {
  if (match === match.toUpperCase()) return replacement.toUpperCase();
  if (match[0] === match[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
};

/** Translate UI copy only. Never pass database identifiers or user-entered names. */
export const educationText = (text, institution = currentInstitution) => {
  if (typeof text !== 'string' || !isSchoolEducation(institution)) return text;
  if (/^Niveau(?:x)?$/i.test(text)) return preserveCase(text, text.endsWith('x') ? 'cycles' : 'cycle');
  if (/^Année$/i.test(text)) return preserveCase(text, 'niveau scolaire');
  return rules.reduce((result, [pattern, replacement]) => result.replace(pattern, match =>
    preserveCase(match, typeof replacement === 'function' ? replacement(match) : replacement)), text);
};

export const getEducationModeForStudent = student => isSchoolStudent(student) ? 'private_school' : 'vocational';
