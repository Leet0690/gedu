import { dedupeModulesByName, getGradeByModuleName } from './gradeSync.js';

const parseDecimal = value => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

export const isEmptyScore = value => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

export const parseScore = (value) => {
  const score = parseDecimal(value);
  return score !== null && score >= 0 && score <= 20 ? score : null;
};

export const isValidScore = value => isEmptyScore(value) || parseScore(value) !== null;

export const calcCcAverage = (grade) => {
  if (!grade) return null;

  const c1 = parseScore(grade.c1);
  const c2 = parseScore(grade.c2);
  const c3 = parseScore(grade.c3);

  if (c1 === null || c2 === null) return null;
  if (!isEmptyScore(grade.c3) && c3 === null) return null;

  const scores = [c1, c2, ...(c3 !== null ? [c3] : [])];
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
};

export const calcModuleAverage = ({ ccAverage, theoretical, practical }) => {
  if (
    [ccAverage, theoretical, practical].some(value =>
      value === null || value === undefined || value === ''
    )
  ) return null;

  const cc = parseScore(ccAverage);
  const theory = parseScore(theoretical);
  const practice = parseScore(practical);
  if ([cc, theory, practice].some(value => value === null)) return null;

  return ((cc * 3) + (theory * 2) + (practice * 3)) / 8;
};

export const getModuleCoefficient = (module, fallback = 1) => {
  const coefficient = parseDecimal(module?.coefficient);
  return coefficient === null || coefficient <= 0 ? fallback : coefficient;
};

export const calcStudentSynthesisAverages = (studentGrades = {}, modules = []) => {
  const moduleList = dedupeModulesByName((modules || []).filter(Boolean));
  const coefficientTotal = moduleList.reduce(
    (sum, module) => sum + getModuleCoefficient(module),
    0
  );

  if (coefficientTotal <= 0) {
    return {
      mcc: null,
      met: null,
      mep: null,
      generalAverage: null,
      coefficientTotal: 0,
    };
  }

  let ccWeightedTotal = 0;
  let theoreticalWeightedTotal = 0;
  let practicalWeightedTotal = 0;

  moduleList.forEach((module) => {
    const coefficient = getModuleCoefficient(module);
    const grade = getGradeByModuleName(studentGrades, module);

    ccWeightedTotal += coefficient * (calcCcAverage(grade) ?? 0);
    theoreticalWeightedTotal += coefficient * (parseScore(grade?.efcft) ?? 0);
    practicalWeightedTotal += coefficient * (parseScore(grade?.efcfp) ?? 0);
  });

  const mcc = ccWeightedTotal / coefficientTotal;
  const met = theoreticalWeightedTotal / coefficientTotal;
  const mep = practicalWeightedTotal / coefficientTotal;

  return {
    mcc,
    met,
    mep,
    generalAverage: calcModuleAverage({
      ccAverage: mcc,
      theoretical: met,
      practical: mep,
    }),
    coefficientTotal,
  };
};

export const isModuleGradeComplete = grade => calcModuleAverage({
  ccAverage: calcCcAverage(grade), theoretical: grade?.efcft, practical: grade?.efcfp,
}) !== null;

// Same weighted second-year synthesis as the annual report; round only for display.
export const calcDiplomaSynthesis = (studentGrades = {}, modules = []) => {
  const secondYear = calcStudentSynthesisAverages(studentGrades, modules);
  const history = studentGrades.firstYear || {};
  const firstYear = {
    mcc: parseScore(history.moyCC), met: parseScore(history.moyEFCFT), mep: parseScore(history.moyEFCFP),
  };
  const combined = Object.fromEntries(['mcc', 'met', 'mep'].map(key => [key,
    firstYear[key] !== null && secondYear[key] !== null ? (firstYear[key] + secondYear[key]) / 2 : null,
  ]));
  const nsti = parseScore(history.nsti);
  const complete = nsti !== null && Object.values(combined).every(value => value !== null);
  return {
    firstYear, secondYear, combined, nsti,
    generalAverage: complete ? (combined.mcc * 3 + combined.met * 2 + combined.mep * 3 + nsti * 2) / 10 : null,
  };
};
