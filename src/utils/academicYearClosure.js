import { getNextStudyYear, isKnownStudyYear } from '../data/modules.js';
import { isSchoolStudent } from '../config/educationProfiles.js';
import { getNextSchoolLevel, validateSchoolPlacement } from './schoolPlacement.js';
import { getGradeBucketForWrite, GRADE_ACADEMIC_YEARS_FIELD } from './gradeSync.js';
import { STUDENT_STATUS, getNextAcademicYear, isStudentCurrentlyInAcademicYear, validateAcademicYearTransition } from './studentStatus.js';

export const CLOSURE_DECISIONS = { PASS: 'pass', GRADUATE: 'graduate', REPEAT: 'repeat', WITHDRAW: 'withdraw' };
export const isClosureDecision = decision => Object.values(CLOSURE_DECISIONS).includes(decision);

export const getClosureDecisionOptions = student => {
  const known = isKnownStudyYear(student.diploma, student.year);
  const school = isSchoolStudent(student);
  const hasNext = school ? !!getNextSchoolLevel(student) : !!getNextStudyYear(student.diploma, student.year);
  return [
    { value: 'pass', label: 'Passage — année suivante', disabled: !known || !hasNext },
    { value: 'graduate', label: school ? 'Fin de cycle — sortie de l’établissement' : 'Lauréat — fin de formation', disabled: !known || (school ? !!getNextStudyYear(student.diploma, student.year) : hasNext) },
    { value: 'repeat', label: 'Redoublement — même niveau', disabled: !known },
    { value: 'withdraw', label: 'Abandon — dossier conservé', disabled: !known },
  ];
};

export const getRecordedClosureDecision = (student, entry) => {
  if (!entry) return '';
  const hasNext = !!getNextStudyYear(entry.diploma || student.diploma, entry.year);
  // Older closures used "pass" for both promotion and graduation.
  if (entry.decision === 'pass' && !hasNext && !entry.targetPlacement) return 'graduate';
  if (isClosureDecision(entry.decision)) return entry.decision;
  if (student.status === STUDENT_STATUS.WITHDRAWN) return 'withdraw';
  if (student.status === STUDENT_STATUS.LAUREAT) return 'graduate';
  return student.year === entry.year ? 'repeat' : 'pass';
};

export const getClosureOutcome = (student, decision) => {
  if (!getClosureDecisionOptions(student).some(option => option.value === decision && !option.disabled)) {
    throw new Error('Choisissez une décision compatible avec le niveau : passage avant la fin du cycle, lauréat en fin de formation.');
  }
  if (decision === CLOSURE_DECISIONS.REPEAT) return 'repeated';
  if (decision === CLOSURE_DECISIONS.WITHDRAW) return 'withdrawn';
  if (decision === CLOSURE_DECISIONS.PASS) {
    return 'promoted';
  }
  if (decision === CLOSURE_DECISIONS.GRADUATE) return 'graduated';
  throw new Error('Une décision est requise pour chaque stagiaire.');
};

const TRANSITION_FIELDS = [
  'graduationAcademicYear', 'graduatedAt', 'previousAcademicYear', 'promotedFromYear',
  'promotedAt', 'withdrawalAcademicYear', 'withdrawnAt', 'repeatedAt',
];

/** Produce only patches: the dossier, token, payments, attendance and documents stay intact. */
export const buildStudentClosure = ({ student, decision, fromAcademicYear, toAcademicYear, operationId, closedAt, grades = {}, targetPlacement, catalog }) => {
  if (!validateAcademicYearTransition(fromAcademicYear, toAcademicYear) ||
      !isStudentCurrentlyInAcademicYear(student, fromAcademicYear, fromAcademicYear) ||
      !isKnownStudyYear(student.diploma, student.year)) {
    throw new Error('Stagiaire ou année non admissible à cette clôture.');
  }
  if ((student.classHistory || []).some(entry => entry?.academicYear === fromAcademicYear)) {
    throw new Error('Cette année a déjà été clôturée pour ce stagiaire.');
  }
  const type = getClosureOutcome(student, decision);
  if (isSchoolStudent(student) && type === 'promoted' && !validateSchoolPlacement(student, targetPlacement, catalog)) {
    throw new Error('Choisissez une classe d’accueil configurée pour le niveau scolaire suivant.');
  }
  const previousTransition = Object.fromEntries(TRANSITION_FIELDS
    .filter(field => student[field] !== undefined).map(field => [field, student[field]]));
  const historyEntry = {
    academicYear: fromAcademicYear, diploma: student.diploma || '', major: student.major || '',
    year: student.year, status: student.status || STUDENT_STATUS.ACTIVE,
    decision, closedAt, operationId, previousTransition,
    ...(isSchoolStudent(student) && type === 'promoted' ? { targetPlacement } : {}),
  };
  const data = { classHistory: [...(student.classHistory || []), historyEntry] };
  if (type === 'withdrawn') {
    Object.assign(data, {
      status: STUDENT_STATUS.WITHDRAWN, academicYear: fromAcademicYear,
      withdrawalAcademicYear: fromAcademicYear, withdrawnAt: closedAt,
    });
  } else if (type === 'graduated') {
    Object.assign(data, {
      status: STUDENT_STATUS.LAUREAT, academicYear: fromAcademicYear,
      graduationAcademicYear: fromAcademicYear, graduatedAt: closedAt,
    });
  } else {
    Object.assign(data, {
      status: STUDENT_STATUS.ACTIVE, academicYear: toAcademicYear,
      year: type === 'repeated' ? student.year : (isSchoolStudent(student) ? targetPlacement.year : getNextStudyYear(student.diploma, student.year)),
      ...(isSchoolStudent(student) && type === 'promoted' ? { diploma: targetPlacement.diploma, major: targetPlacement.major } : {}),
      previousAcademicYear: fromAcademicYear, promotedFromYear: student.year,
      [type === 'repeated' ? 'repeatedAt' : 'promotedAt']: closedAt,
    });
  }
  const gradeYears = { [fromAcademicYear]: getGradeBucketForWrite(grades, fromAcademicYear) };
  if (type === 'promoted' || type === 'repeated') {
    // An explicit empty bucket prevents legacy first-year notes leaking into a repeated year.
    gradeYears[toAcademicYear] = grades[GRADE_ACADEMIC_YEARS_FIELD]?.[toAcademicYear] || {};
  }
  return { data, type, gradeYears };
};

export const buildStudentClosureUndo = student => {
  const lastEntry = student.classHistory.at(-1);
  return {
    ...Object.fromEntries(TRANSITION_FIELDS.map(field => [field, ''])),
    ...(lastEntry.previousTransition || {}),
    year: lastEntry.year, status: lastEntry.status || STUDENT_STATUS.ACTIVE,
    ...(isSchoolStudent(student) ? { diploma: lastEntry.diploma, major: lastEntry.major } : {}),
    academicYear: lastEntry.academicYear,
    classHistory: student.classHistory.slice(0, -1),
  };
};

/** Reapply the last closure from its original snapshot, never deleting academic data. */
export const buildStudentClosureCorrection = ({ student, academicYear, decision, grades = {}, correctedAt, reason = '', expectedRevision, targetPlacement, catalog }) => {
  const history = Array.isArray(student.classHistory) ? student.classHistory : [];
  const entry = history.at(-1);
  if (!entry || entry.academicYear !== academicYear || !entry.operationId) {
    throw new Error('Seule la dernière clôture du stagiaire peut être corrigée. Une décision antérieure nécessite de traiter les clôtures suivantes.');
  }
  if (expectedRevision !== undefined && expectedRevision !== (entry.revision || 0)) {
    throw new Error('Cette décision a été modifiée entre-temps. Fermez puis rouvrez le dossier.');
  }
  const beforeDecision = getRecordedClosureDecision(student, entry);
  if (decision === beforeDecision) throw new Error('Choisissez une décision différente.');
  const restored = {
    ...student, ...buildStudentClosureUndo(student),
    diploma: entry.diploma || student.diploma, major: entry.major || student.major,
  };
  const result = buildStudentClosure({
    student: restored, decision, grades, fromAcademicYear: academicYear,
    toAcademicYear: getNextAcademicYear(academicYear), operationId: entry.operationId,
    closedAt: correctedAt,
    targetPlacement: targetPlacement || entry.targetPlacement, catalog,
  });
  const correctedEntry = {
    ...entry, decision, revision: (entry.revision || 0) + 1,
    ...(targetPlacement ? { targetPlacement } : {}),
    correctedAt,
    corrections: [...(entry.corrections || []), { from: beforeDecision, to: decision, correctedAt, reason }],
  };
  return {
    ...result, beforeDecision,
    data: {
      ...Object.fromEntries(TRANSITION_FIELDS.map(field => [field, restored[field] ?? ''])),
      ...result.data,
      // Graduation and withdrawal must restore the level of the closed year as well.
      year: result.data.year || entry.year,
      classHistory: [...history.slice(0, -1), correctedEntry],
    },
  };
};
