import test from 'node:test';
import assert from 'node:assert/strict';

import { hasDuplicateMonthlyPayment } from '../src/utils/paymentUtils.js';

test('monthly payment duplicate control includes the academic year', () => {
  const payments = [{
    id: 'p1',
    studentId: 's1',
    month: 'Octobre',
    academicYear: '2025-2026',
    status: 'payé',
  }];

  assert.equal(hasDuplicateMonthlyPayment(payments, {
    studentId: 's1',
    month: 'octobre',
    academicYear: '2025-2026',
  }), true);
  assert.equal(hasDuplicateMonthlyPayment(payments, {
    studentId: 's1',
    month: 'Octobre',
    academicYear: '2026-2027',
  }), false);
});

test('duplicate control ignores the edited payment and unpaid records', () => {
  const payments = [
    { id: 'paid', studentId: 's1', month: 'Mars', academicYear: '2025-2026', status: 'payé' },
    { id: 'unpaid', studentId: 's1', month: 'Avril', academicYear: '2025-2026', status: 'impayé' },
  ];

  assert.equal(hasDuplicateMonthlyPayment(payments, {
    studentId: 's1', month: 'Mars', academicYear: '2025-2026', excludePaymentId: 'paid',
  }), false);
  assert.equal(hasDuplicateMonthlyPayment(payments, {
    studentId: 's1', month: 'Avril', academicYear: '2025-2026',
  }), false);
});
