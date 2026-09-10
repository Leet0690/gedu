import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getGradeByModuleName,
  getGradeBucketForWrite,
  getGradesForAcademicYear,
  getModuleOrder,
  getStudentGradeModules,
  sortModulesByOrder,
} from '../src/utils/gradeSync.js';

test('legacy flat grades remain readable before the first academic-year snapshot', () => {
  const grades = { Comptabilite: { c1: '12' } };

  assert.deepEqual(
    getGradesForAcademicYear(grades, '2025-2026'),
    grades
  );
  assert.deepEqual(
    getGradeBucketForWrite(grades, '2025-2026'),
    grades
  );
});

test('versioned grades are isolated by academic year', () => {
  const grades = {
    Legacy: { c1: '7' },
    academicYears: {
      '2024-2025': { Comptabilite: { c1: '11' } },
      '2025-2026': { Comptabilite: { c1: '16' } },
    },
  };

  assert.equal(getGradesForAcademicYear(grades, '2024-2025').Comptabilite.c1, '11');
  assert.equal(getGradesForAcademicYear(grades, '2025-2026').Comptabilite.c1, '16');
  assert.deepEqual(getGradesForAcademicYear(grades, '2026-2027'), {});
  assert.deepEqual(getGradeBucketForWrite(grades, '2026-2027'), {});
  assert.equal(
    getGradeByModuleName(grades, 'Comptabilite', '2025-2026').c1,
    '16'
  );
});

test('getStudentGradeModules returns one row per module name for a student class', () => {
  const student = {
    diploma: 'Technicien Spécialisé',
    major: 'Développement Informatique',
    year: '2ème année',
  };

  const modules = [
    {
      name: 'Framework web : Laravel (back end)',
      diploma: student.diploma,
      major: student.major,
      year: student.year,
      order: 1,
    },
    {
      name: 'Framework web : Laravel (back end)',
      diploma: student.diploma,
      major: student.major,
      year: student.year,
      order: 99,
    },
    {
      name: 'ERP',
      diploma: student.diploma,
      major: student.major,
      year: student.year,
      order: 2,
    },
    {
      name: 'Framework web : Laravel (back end)',
      diploma: student.diploma,
      major: student.major,
      year: '1ère année',
      order: 1,
    },
  ];

  assert.deepEqual(
    getStudentGradeModules(modules, student).map(module => module.name),
    ['Framework web : Laravel (back end)', 'ERP']
  );
});

test('getStudentGradeModules falls back to the official catalog order when order is missing', () => {
  const student = {
    diploma: 'Technicien Spécialisé',
    major: 'Développement Informatique',
    year: '2ème année',
  };

  const modules = [
    {
      name: 'Framework WordPress CMS',
      diploma: student.diploma,
      major: student.major,
      year: student.year,
    },
    {
      name: 'Stage en Entreprise',
      diploma: student.diploma,
      major: student.major,
      year: student.year,
    },
    {
      name: 'Framework web : Laravel (back end)',
      diploma: student.diploma,
      major: student.major,
      year: student.year,
    },
  ];

  assert.deepEqual(
    getStudentGradeModules(modules, student).map(module => module.name),
    [
      'Framework web : Laravel (back end)',
      'Framework WordPress CMS',
      'Stage en Entreprise',
    ]
  );
  assert.equal(getModuleOrder(modules[2]), 1);
});

test('getModuleOrder resolves known aliases against the official catalog order', () => {
  assert.equal(
    getModuleOrder({
      name: 'Soft skills',
      diploma: 'Technicien Spécialisé',
      major: 'Développement Informatique',
      year: '1ère année',
    }),
    11
  );
});

test('getGradeByModuleName merges singular and plural Laravel module keys', () => {
  const grades = {
    'Framework web : Laravel (back end)': { c1: '19.5', c2: '20', efcft: '19', efcfp: '18.5' },
  };

  assert.deepEqual(
    getGradeByModuleName(grades, 'Frameworks web : Laravel (back end)'),
    { c1: '19.5', c2: '20', efcft: '19', efcfp: '18.5' }
  );
});

test('getModuleOrder resolves the Laravel singular/plural alias against the official catalog order', () => {
  assert.equal(
    getModuleOrder({
      name: 'Frameworks web : Laravel (back end)',
      diploma: 'Technicien Spécialisé',
      major: 'Développement Informatique',
      year: '2ème année',
    }),
    1
  );
});

test('getGradeByModuleName merges singular and plural Statistiques descriptives module keys', () => {
  const grades = {
    'Statistiques descriptive': { c1: '18', c2: '10' },
    'Statistiques descriptives': { efcft: '18', efcfp: '12' },
  };

  assert.deepEqual(
    getGradeByModuleName(grades, 'Statistiques descriptives'),
    { c1: '18', c2: '10', efcft: '18', efcfp: '12' }
  );
});

test('getModuleOrder resolves the Statistiques descriptives alias against official catalog order', () => {
  assert.equal(
    getModuleOrder({
      name: 'Statistiques descriptives',
      diploma: 'Technicien',
      major: 'Gestion Informatisée',
      year: '1ère année',
    }),
    5
  );
});

test('sortModulesByOrder uses creation order when no explicit or catalog order exists', () => {
  const modules = [
    { name: 'Alpha', createdAt: { seconds: 20, nanoseconds: 0 } },
    { name: 'Zulu', createdAt: { seconds: 10, nanoseconds: 0 } },
  ];

  assert.deepEqual(
    sortModulesByOrder(modules).map(module => module.name),
    ['Zulu', 'Alpha']
  );
});
