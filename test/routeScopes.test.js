import test from 'node:test';
import assert from 'node:assert/strict';

import { isAcademicYearScopedPath } from '../src/utils/routeScopes.js';

test('academic year selection remains available throughout administration, excluding public routes', () => {
  const administrationRoutes = [
    '/',
    '/admin/students',
    '/admin/grades',
    '/admin/attendance-students',
    '/admin/monthly-attendance',
    '/admin/reports',
    '/admin/finance',
    '/admin/teachers',
    '/admin/schedules',
    '/admin/schedule-generation',
    '/admin/modules',
    '/admin/attendance-teachers',
    '/admin/monthly-attendance-teachers',
    '/admin/continuous',
    '/admin/logs',
    '/admin/users',
  ];
  const publicRoutes = ['', '/login', '/portal/test-token', '/teacher/test-token', '/results/test-token', '/administrator'];

  administrationRoutes.forEach(path => assert.equal(isAcademicYearScopedPath(path), true, path));
  publicRoutes.forEach(path => assert.equal(isAcademicYearScopedPath(path), false, path));
  assert.equal(isAcademicYearScopedPath('/admin/finance/'), true);
});
