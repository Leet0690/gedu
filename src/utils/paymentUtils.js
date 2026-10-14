import { getPaymentAcademicYear } from './studentStatus.js';

export const PAYMENT_FEE_FIELDS = [
  { key: 'examFee', label: "Frais d'examen" },
  { key: 'registrationFee', label: "Frais d'inscription" },
  { key: 'supportFee', label: 'Support' },
];

const normalizeStatus = (value = '') =>
  String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const getPaymentStatusKey = (status) => {
  const normalized = normalizeStatus(status || 'payé');
  if (
    normalized.includes('impaye') ||
    normalized.includes('unpaid') ||
    normalized.includes('non paye') ||
    normalized.includes('a payer') ||
    normalized.includes('a regler')
  ) {
    return 'unpaid';
  }
  return 'paid';
};

export const getPaymentStatusLabel = (status) =>
  getPaymentStatusKey(status) === 'unpaid' ? 'Impayé' : 'Payé';

export const hasDuplicateMonthlyPayment = (
  payments = [],
  { studentId = '', month = '', academicYear = '', excludePaymentId = '' } = {}
) => {
  const normalizedMonth = String(month || '').trim().toLocaleLowerCase('fr');
  if (!studentId || !normalizedMonth || !academicYear) return false;

  return (payments || []).some(payment =>
    payment.id !== excludePaymentId &&
    payment.studentId === studentId &&
    String(payment.month || '').trim().toLocaleLowerCase('fr') === normalizedMonth &&
    getPaymentAcademicYear(payment) === academicYear &&
    getPaymentStatusKey(payment.status) === 'paid'
  );
};

const normalizeFeeLabel = (value) => normalizeStatus(value)
  .replace(/['’‘`´]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const feeKeysByLabel = new Map([
  ["frais d examen", 'examFee'],
  ['frais examen', 'examFee'],
  ["frais d inscription", 'registrationFee'],
  ['frais inscription', 'registrationFee'],
  ['support', 'supportFee'],
  ['frais de support', 'supportFee'],
  ['support pedagogique', 'supportFee'],
]);

const positiveFeeAmount = (value) => {
  const amount = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const emptyFeeAmounts = () => ({ examFee: 0, registrationFee: 0, supportFee: 0 });

const getPaymentFeeAmounts = (payment) => {
  const legacyAmounts = emptyFeeAmounts();
  const legacyFees = Array.isArray(payment.fees) ? payment.fees : [];
  legacyFees.forEach((fee) => {
    if (!fee) return;
    const key = PAYMENT_FEE_FIELDS.some(field => field.key === fee.key)
      ? fee.key
      : feeKeysByLabel.get(normalizeFeeLabel(fee.label));
    if (key) legacyAmounts[key] += positiveFeeAmount(fee.amount);
  });

  return Object.fromEntries(PAYMENT_FEE_FIELDS.map(({ key }) => [
    key,
    // New receipts store both formats; prefer the direct value once per fee.
    positiveFeeAmount(payment[key]) || legacyAmounts[key],
  ]));
};

/** Paid fee amounts by student, within the selected academic year (empty = all). */
export const buildStudentFeePaymentIndex = (payments = [], academicYear = '') => {
  const index = new Map();
  (payments || []).forEach((payment) => {
    if (!payment?.studentId || getPaymentStatusKey(payment.status) !== 'paid') return;
    if (academicYear && getPaymentAcademicYear(payment) !== academicYear) return;

    const amounts = getPaymentFeeAmounts(payment);
    const studentAmounts = index.get(payment.studentId) || emptyFeeAmounts();
    PAYMENT_FEE_FIELDS.forEach(({ key }) => {
      studentAmounts[key] += amounts[key];
    });
    index.set(payment.studentId, studentAmounts);
  });
  return index;
};

/** A fee is paid when at least one positive paid amount is recorded for it. */
export const matchesStudentFeePaymentFilters = (studentId, index, filters = {}) =>
  PAYMENT_FEE_FIELDS.every(({ key }) => {
    const selection = filters[key];
    const paid = (index.get(studentId)?.[key] || 0) > 0;
    if (selection === 'paid') return paid;
    if (selection === 'unpaid') return !paid;
    return true;
  });
