import test from 'node:test';
import assert from 'node:assert/strict';
import { calcCcAverage, calcModuleAverage, calcStudentSynthesisAverages, calcDiplomaSynthesis, parseScore, isModuleGradeComplete, getModuleCoefficient } from '../src/utils/gradeCalculations.js';
import { mergeGradeDraft } from '../src/utils/gradeDrafts.js';
import { getGradeByModuleName } from '../src/utils/gradeSync.js';

const complete = score => ({ c1: score, c2: score, efcft: score, efcfp: score });
const modules = [{ name: 'A', coefficient: 1 }, { name: 'B', coefficient: 3 }];

test('annual and diploma second-year means keep module coefficients', () => {
  const grades = { A: complete(18), B: complete(10), firstYear: { moyCC: 14, moyEFCFT: 14, moyEFCFP: 14, nsti: 17 } };
  const annual = calcStudentSynthesisAverages(grades, modules);
  const diploma = calcDiplomaSynthesis(grades, modules);
  assert.equal(annual.mcc, 12);
  assert.equal(annual.met, 12);
  assert.equal(annual.mep, 12);
  assert.equal(annual.generalAverage, 12);
  assert.deepEqual(diploma.secondYear, annual);
  assert.equal(diploma.generalAverage, 13.8);
});

test('zeros are valid, CC3 is optional, invalid numbers never enter a mean', () => {
  assert.equal(parseScore('12,75'), 12.75);
  assert.equal(parseScore(0), 0);
  for (const value of ['', ' ', undefined, null, false, NaN, Infinity, '12abc', '1,2,3', -1, 21]) {
    assert.equal(parseScore(value), null, String(value));
  }
  assert.equal(calcCcAverage({ c1: 12, c2: 18 }), 15);
  assert.equal(calcCcAverage({ c1: 12, c2: 18, c3: 0 }), 10);
  assert.equal(calcCcAverage({ c1: 12, c2: 18, c3: 'invalid' }), null);
  assert.equal(calcCcAverage({ c1: 12 }), null);
  assert.equal(calcModuleAverage({ ccAverage: 10, theoretical: 20, practical: 0 }), 8.75);
  assert.equal(isModuleGradeComplete({ c1: 0 }), false);
  assert.equal(isModuleGradeComplete(complete(0)), true);
  assert.equal(getModuleCoefficient({ coefficient: '2,5' }), 2.5);
  assert.equal(getModuleCoefficient({ coefficient: Infinity }), 1);
});

test('numeric zero in history and NSTI differs from a missing diploma grade', () => {
  const grades = { A: complete(10), firstYear: { moyCC: 0, moyEFCFT: 0, moyEFCFP: 0, nsti: 0 } };
  assert.equal(calcDiplomaSynthesis(grades, ['A']).generalAverage, 4);
  const missingStage = { ...grades, firstYear: { ...grades.firstYear, nsti: '' } };
  assert.equal(calcDiplomaSynthesis(missingStage, ['A']).generalAverage, null);
  assert.equal(calcDiplomaSynthesis({}, []).generalAverage, null);
});

test('diploma calculations retain precision until final display', () => {
  const grades = { A: complete(10.004), firstYear: { moyCC: 10.014, moyEFCFT: 10.014, moyEFCFP: 10.014, nsti: 10 } };
  const result = calcDiplomaSynthesis(grades, ['A']);
  assert.ok(Math.abs(result.generalAverage - 10.0072) < 1e-10);
  assert.equal(result.generalAverage.toFixed(2), '10.01');
});

test('aliases are counted once; renamed modules retain their grade lookup', () => {
  const grades = { ERP: complete(10), Other: complete(20) };
  const result = calcStudentSynthesisAverages(grades, [
    { name: 'ERP avec ODOO', coefficient: 3 }, { name: 'ERP', coefficient: 3 }, { name: 'Other', coefficient: 1 },
  ]);
  assert.equal(result.coefficientTotal, 4);
  assert.equal(result.generalAverage, 12.5);
  assert.equal(calcStudentSynthesisAverages(grades, [{ name: 'Renamed', originalName: 'ERP' }]).generalAverage, 10);
});

test('canonical writes and explicit clears take precedence over legacy keys', () => {
  assert.equal(getGradeByModuleName({ 'Module.js': { c1: 10 }, Module_js: { c1: 18 } }, 'Module.js').c1, 18);
  assert.deepEqual(getGradeByModuleName({ 'ERP avec ODOO': { c1: '' }, ERP: { c1: 18, c2: 12 } }, 'ERP avec ODOO'), { c1: '', c2: 12 });
});

test('automatic refresh preserves unsaved grades and cleared fields, while updating untouched rows', () => {
  const source = { A: complete(10), B: complete(17), C: complete(12) };
  const draft = { A: { ...complete(14), c3: '', c1: 0 }, B: complete(8) };
  const result = mergeGradeDraft(source, draft, new Set(['A']));
  assert.deepEqual(result.A, draft.A);
  assert.deepEqual(result.B, source.B);
  assert.deepEqual(result.C, source.C);
  assert.deepEqual(mergeGradeDraft(source, draft), source);
});
