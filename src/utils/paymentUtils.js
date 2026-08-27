import { getPaymentAcademicYear } from './studentStatus.js';

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
