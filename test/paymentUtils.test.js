import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStudentFeePaymentIndex,
  hasDuplicateMonthlyPayment,
  matchesStudentFeePaymentFilters,
} from '../src/utils/paymentUtils.js';

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

test('annual-fee-only receipts do not block a monthly tuition payment', () => {
  const payments = [{
    id: 'annual-fees',
    studentId: 's1',
    month: 'Octobre',
    academicYear: '2025-2026',
    amount: 350,
    examFee: 150,
    registrationFee: 200,
    status: 'payé',
  }];

  assert.equal(hasDuplicateMonthlyPayment(payments, {
    studentId: 's1', month: 'Octobre', academicYear: '2025-2026',
  }), false);
});

test('fee payment index scopes each student to the selected academic year', () => {
  const payments = [
    { studentId: 's1', academicYear: '2025-2026', status: 'payé', examFee: 150 },
    { studentId: 's1', date: '2026-10-10', status: 'payé', registrationFee: '200' },
    { studentId: 's2', academicYear: '2026-2027', status: 'payé', supportFee: 100 },
    { studentId: 's1', receiptAcademicYear: '2026-2027', status: 'payé', supportFee: 50 },
  ];

  assert.deepEqual(buildStudentFeePaymentIndex(payments, '2026-2027').get('s1'), {
    examFee: 0, registrationFee: 200, supportFee: 50,
  });
  assert.deepEqual(buildStudentFeePaymentIndex(payments, '2025-2026').get('s1'), {
    examFee: 150, registrationFee: 0, supportFee: 0,
  });
  assert.deepEqual(buildStudentFeePaymentIndex(payments).get('s1'), {
    examFee: 150, registrationFee: 200, supportFee: 50,
  });
  assert.deepEqual(buildStudentFeePaymentIndex(payments).get('s2'), {
    examFee: 0, registrationFee: 0, supportFee: 100,
  });
});

test('fee index combines keyed and legacy receipts without counting both copies', () => {
  const index = buildStudentFeePaymentIndex([
    {
      studentId: 's1', examFee: '150', registrationFee: 0,
      fees: [
        { label: "Frais d'examen", amount: 150 },
        { label: 'Frais d’inscription', amount: '200' },
      ],
    },
    {
      studentId: 's1', supportFee: 25,
      fees: [{ key: 'supportFee', label: 'Support', amount: 25 }],
    },
    { studentId: 's1', fees: [{ key: 'supportFee', amount: '12,50' }] },
  ]);

  assert.deepEqual(index.get('s1'), {
    examFee: 150, registrationFee: 200, supportFee: 37.5,
  });
});

test('legacy fee labels allow accents, typographic apostrophes and extra spaces', () => {
  const index = buildStudentFeePaymentIndex([
    {
      studentId: 's1',
      fees: [
        { label: '  FRÁIS   D’EXÁMEN ', amount: 150 },
        { label: 'Frais d‘inscription', amount: 200 },
        { label: 'SUPPORT PÉDAGOGIQUE', amount: 75 },
        { label: 'Autres frais', amount: 999 },
      ],
    },
  ]);
  assert.deepEqual(index.get('s1'), {
    examFee: 150, registrationFee: 200, supportFee: 75,
  });
});

test('legacy receipts retain existing status defaults and derive their year from the date', () => {
  const index = buildStudentFeePaymentIndex([
    { studentId: 's1', receiptNumber: 'FD0042', date: '2025-02-10', examFee: 150 },
    { studentId: 's1', date: '2024-10-10', status: 'validé', registrationFee: 200 },
    { studentId: 's1', date: '2025-09-10', status: 'payé', supportFee: 75 },
  ], '2024-2025');

  assert.deepEqual(index.get('s1'), {
    examFee: 150, registrationFee: 200, supportFee: 0,
  });
});

test('unpaid receipts and nonpositive or invalid fee amounts do not mark fees paid', () => {
  const index = buildStudentFeePaymentIndex([
    { studentId: 's1', status: 'impayé', examFee: 150 },
    { studentId: 's1', status: 'Non payé', registrationFee: 200 },
    { studentId: 's1', status: 'unpaid', supportFee: 75 },
    { studentId: 's1', status: 'payé', examFee: -5, registrationFee: 'invalid', supportFee: Infinity },
    { studentId: 's1', status: 'payé', fees: [{ label: 'Support', amount: 0 }] },
    { status: 'payé', examFee: 300 },
    null,
  ]);

  assert.deepEqual(index.get('s1'), {
    examFee: 0, registrationFee: 0, supportFee: 0,
  });
  assert.equal(matchesStudentFeePaymentFilters('s1', index, {
    examFee: 'paid',
  }), false);
  assert.equal(matchesStudentFeePaymentFilters('s1', index, {
    examFee: 'unpaid', registrationFee: 'unpaid', supportFee: 'unpaid',
  }), true);
});

test('fee filters combine paid and unpaid selections and include students without receipts', () => {
  const index = buildStudentFeePaymentIndex([
    { studentId: 's1', status: 'payé', examFee: 50 },
    { studentId: 's2', status: 'payé', registrationFee: 200 },
  ]);

  assert.equal(matchesStudentFeePaymentFilters('s1', index, {
    examFee: 'paid', registrationFee: 'unpaid', supportFee: 'all',
  }), true);
  assert.equal(matchesStudentFeePaymentFilters('s1', index, {
    examFee: 'paid', registrationFee: 'paid',
  }), false);
  assert.equal(matchesStudentFeePaymentFilters('s2', index, { examFee: 'paid' }), false);
  assert.equal(matchesStudentFeePaymentFilters('s3', index), true);
  assert.equal(matchesStudentFeePaymentFilters('s3', index, {
    examFee: '', registrationFee: '', supportFee: '',
  }), true);
  assert.equal(matchesStudentFeePaymentFilters('s3', index, { supportFee: 'unpaid' }), true);
  assert.equal(matchesStudentFeePaymentFilters('s3', index, { supportFee: 'paid' }), false);
  assert.equal(matchesStudentFeePaymentFilters('s1', buildStudentFeePaymentIndex([], '2026-2027'), {
    examFee: 'unpaid',
  }), true);
});
