import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatModuleUfNumber,
  isCompanyInternshipGradeMissing,
} from '../src/utils/bulletinUtils.js';

test('formatModuleUfNumber uses the study year and configured module order', () => {
  assert.equal(
    formatModuleUfNumber({ year: '2ème année', order: 12, code: 'legacy' }, 0, '1ère année'),
    'UF 2.12'
  );
});

test('formatModuleUfNumber falls back to the list position and student year', () => {
  assert.equal(formatModuleUfNumber('Module statique', 3, '2ème année'), 'UF 2.4');
});

test('isCompanyInternshipGradeMissing only flags an absent or incomplete internship grade', () => {
  const modules = [{ name: 'Stage en Entreprise' }, { name: 'Communication' }];

  assert.equal(isCompanyInternshipGradeMissing(modules, {}), true);
  assert.equal(isCompanyInternshipGradeMissing(modules, {
    'Stage en Entreprise': { c1: 12, c2: 14, efcft: 13, efcfp: '' },
  }), true);
  assert.equal(isCompanyInternshipGradeMissing(modules, {
    'Stage en Entreprise': { c1: 0, c2: 0, c3: '', efcft: 0, efcfp: 0 },
  }), false);
  assert.equal(isCompanyInternshipGradeMissing([{ name: 'Communication' }], {}), false);
});
