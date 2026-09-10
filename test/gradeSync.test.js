import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterModulesByAcademicYear,
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

test('filterModulesByAcademicYear filters by academicYear and falls back to default when empty', () => {
  const modules = [
    { id: '1', name: 'Comptabilité', academicYear: '2025-2026', coefficient: 2 },
    { id: '2', name: 'Algorithmique', academicYear: '2025-2026', coefficient: 3 },
    { id: '3', name: 'Algorithmique Avancée', academicYear: '2026-2027', coefficient: 4 },
  ];

  const y2526 = filterModulesByAcademicYear(modules, '2025-2026');
  assert.equal(y2526.length, 2);
  assert.deepEqual(y2526.map(m => m.name), ['Comptabilité', 'Algorithmique']);

  const y2627 = filterModulesByAcademicYear(modules, '2026-2027');
  assert.equal(y2627.length, 1);
  assert.equal(y2627[0].name, 'Algorithmique Avancée');
  assert.equal(y2627[0].coefficient, 4);

  // When a year has no modules and fallback is allowed, falls back to 2025-2026
  const yUnknown = filterModulesByAcademicYear(modules, '2027-2028', { allowFallback: true });
  assert.equal(yUnknown.length, 2);

  // When fallback is disabled, returns empty array
  const yStrict = filterModulesByAcademicYear(modules, '2027-2028', { allowFallback: false });
  assert.equal(yStrict.length, 0);
});

test('modifying or deleting a module in 2026-2027 does not affect 2025-2026', () => {
  const student = {
    diploma: 'Technicien Spécialisé',
    major: 'Développement Informatique',
    year: '1ère année',
  };

  // Modules configured separately for 2025-2026 and 2026-2027
  const initialModules = [
    // 2025-2026
    { id: 'm1', name: 'Algorithmique', coefficient: 2, order: 1, academicYear: '2025-2026', ...student },
    { id: 'm2', name: 'Statistiques descriptives', coefficient: 1, order: 2, academicYear: '2025-2026', ...student },
    { id: 'm3', name: 'Bases de données', coefficient: 2, order: 3, academicYear: '2025-2026', ...student },
    // 2026-2027 (user modifies coefficient of Algorithmique to 4, renames Databases, and deletes Statistiques)
    { id: 'm4', name: 'Algorithmique', coefficient: 4, order: 1, academicYear: '2026-2027', ...student },
    { id: 'm5', name: 'Bases de données SQL & NoSQL', coefficient: 3, order: 2, academicYear: '2026-2027', ...student },
  ];

  // Grade modules for 2025-2026 should remain completely unchanged
  const modules2025 = getStudentGradeModules(initialModules, student, '2025-2026');
  assert.equal(modules2025.length, 3);
  assert.equal(modules2025[0].name, 'Algorithmique');
  assert.equal(modules2025[0].coefficient, 2);
  assert.equal(modules2025[1].name, 'Statistiques descriptives');
  assert.equal(modules2025[1].coefficient, 1);
  assert.equal(modules2025[2].name, 'Bases de données');
  assert.equal(modules2025[2].coefficient, 2);

  // Grade modules for 2026-2027 should reflect the 2026-2027 updates
  const modules2026 = getStudentGradeModules(initialModules, student, '2026-2027');
  assert.equal(modules2026.length, 2);
  assert.equal(modules2026[0].name, 'Algorithmique');
  assert.equal(modules2026[0].coefficient, 4);
  assert.equal(modules2026[1].name, 'Bases de données SQL & NoSQL');
  assert.equal(modules2026[1].coefficient, 3);
});

