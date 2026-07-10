import { getGradeByModuleName } from './gradeSync.js';

export const parseScore = (value) => {
  const score = parseFloat(value);
  return Number.isNaN(score) ? null : score;
};

export const calcCcAverage = (grade) => {
  if (!grade) return null;

  const c1 = parseScore(grade.c1);
  const c2 = parseScore(grade.c2);
  const c3 = parseScore(grade.c3);

  if (c1 === null || c2 === null) return null;

  const scores = [c1, c2, ...(c3 !== null ? [c3] : [])];
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
};

export const calcModuleAverage = ({ ccAverage, theoretical, practical }) => {
  if (
    [ccAverage, theoretical, practical].some(value =>
      value === null || value === undefined || value === ''
    )
  ) return null;

  const cc = Number(ccAverage);
  const theory = Number(theoretical);
  const practice = Number(practical);
  if ([cc, theory, practice].some(Number.isNaN)) return null;

  return ((cc * 3) + (theory * 2) + (practice * 3)) / 8;
};

export const getModuleCoefficient = (module, fallback = 1) => {
  const coefficient = parseFloat(module?.coefficient);
  return Number.isNaN(coefficient) || coefficient <= 0 ? fallback : coefficient;
};

export const calcStudentSynthesisAverages = (studentGrades = {}, modules = []) => {
  const moduleList = (modules || []).filter(Boolean);
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
    const moduleName = typeof module === 'string'
      ? module
      : (module.name || module.module || module.label || '');
    const coefficient = getModuleCoefficient(module);
    const grade = getGradeByModuleName(studentGrades, moduleName);

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
