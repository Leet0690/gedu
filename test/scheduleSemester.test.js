import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeScheduleModules,
  serializeScheduleModules,
  getScheduleModulesForSemester,
  getScheduleModuleForSemester,
} from '../src/utils/scheduleSemester.js';

test('multiple modules survive saving, rendering and reopening both semesters', () => {
  const selected = {
    moduleS1: ['Algorithmique', 'Bases de données'],
    moduleS2: ['Java', 'Développement Web'],
  };
  const stored = serializeScheduleModules(selected);
  assert.equal(stored.moduleS1, 'Algorithmique / Bases de données');
  assert.equal(stored.moduleS2, 'Java / Développement Web');
  assert.equal(stored.module, stored.moduleS1);
  assert.equal(getScheduleModuleForSemester(stored, 'S1'), stored.moduleS1);
  assert.equal(getScheduleModuleForSemester(stored, 'S2'), stored.moduleS2);
  assert.deepEqual(getScheduleModulesForSemester(stored, 'S1'), selected.moduleS1);
  assert.deepEqual(getScheduleModulesForSemester(stored, 'S2'), selected.moduleS2);
});

test('editing an S2-only session does not copy the compatibility module into S1', () => {
  const stored = serializeScheduleModules({ moduleS1: [], moduleS2: ['Java', 'Web'] });
  assert.equal(stored.module, 'Java / Web');
  const reopened = {
    moduleS1: getScheduleModulesForSemester(stored, 'S1'),
    moduleS2: getScheduleModulesForSemester(stored, 'S2'),
  };
  assert.deepEqual(reopened.moduleS1, []);
  assert.deepEqual(reopened.moduleS2, ['Java', 'Web']);
  assert.deepEqual(serializeScheduleModules(reopened), stored);
});

test('unchecking modules removes stale compatibility values', () => {
  assert.deepEqual(serializeScheduleModules({
    module: 'Ancien module', moduleS1: [], moduleS2: [],
  }), { module: '', moduleS1: '', moduleS2: '' });
  assert.deepEqual(serializeScheduleModules({
    module: 'Ancien module', moduleS1: [], moduleS2: ['Module actuel'],
  }), { module: 'Module actuel', moduleS1: '', moduleS2: 'Module actuel' });
});

test('imported arrays render module names separated by a slash', () => {
  assert.equal(getScheduleModuleForSemester({ moduleS1: ['Réseaux', 'TCP/IP'] }, 'S1'), 'Réseaux / TCP/IP');
  assert.equal(getScheduleModuleForSemester({ moduleS1: [], moduleS2: ['Web'] }, 'S1'), '');
  assert.deepEqual(normalizeScheduleModules(' Réseaux / TCP/IP / Réseaux '), ['Réseaux', 'TCP/IP']);
  assert.deepEqual(normalizeScheduleModules([' Web ', '', null, 'Web']), ['Web']);
});

test('legacy multi-module sessions resolve each module against its semester', () => {
  const catalog = [
    { name: 'Réseaux', semester: 'S1' },
    { name: 'Web', semester: 'S2' },
    { name: 'Langues', semester: 'Annuel' },
  ];
  const legacy = { module: 'Réseaux / Web / Langues' };
  assert.equal(getScheduleModuleForSemester(legacy, 'S1', catalog), 'Réseaux / Langues');
  assert.equal(getScheduleModuleForSemester(legacy, 'S2', catalog), 'Web / Langues');
});

test('annual modules remain selectable in both explicit semester fields', () => {
  const stored = serializeScheduleModules({ moduleS1: ['Langues'], moduleS2: ['Langues'] });
  assert.equal(getScheduleModuleForSemester(stored, 'S1'), 'Langues');
  assert.equal(getScheduleModuleForSemester(stored, 'S2'), 'Langues');
});

test('legacy semester resolution respects the session academic year', () => {
  const catalog = [
    { name: 'Web', semester: 'S1', academicYear: '2025-2026' },
    { name: 'Web', semester: 'S2', academicYear: '2026-2027' },
  ];
  const legacy = { module: 'Web', academicYear: '2026-2027' };
  assert.equal(getScheduleModuleForSemester(legacy, 'S1', catalog), '');
  assert.equal(getScheduleModuleForSemester(legacy, 'S2', catalog), 'Web');
});
