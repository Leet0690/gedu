import test from 'node:test';
import assert from 'node:assert/strict';

import { isAcademicYearScopedPath } from '../src/utils/routeScopes.js';

test('academic year selector is shown only on year-scoped routes', () => {
  const scopedRoutes = [
    '/',
    '/admin/students',
    '/admin/grades',
    '/admin/attendance-students',
    '/admin/monthly-attendance',
    '/admin/reports',
    '/admin/finance',
  ];
  const unscopedRoutes = [
    '/admin/teachers',
    '/admin/schedules',
    '/admin/schedule-generation',
    '/admin/modules',
    '/admin/attendance-teachers',
    '/admin/monthly-attendance-teachers',
    '/admin/continuous',
    '/admin/logs',
  ];

  scopedRoutes.forEach(path => assert.equal(isAcademicYearScopedPath(path), true, path));
  unscopedRoutes.forEach(path => assert.equal(isAcademicYearScopedPath(path), false, path));
  assert.equal(isAcademicYearScopedPath('/admin/finance/'), true);
});
