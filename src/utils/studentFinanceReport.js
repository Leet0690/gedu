import {
  buildStudentFeePaymentIndex,
  getPaymentStatusKey,
  PAYMENT_FEE_FIELDS,
} from './paymentUtils.js';
import {
  getCalendarYearForAcademicMonth,
  getPaymentAcademicYear,
  getStudentAcademicSnapshot,
  getStudentAvailableStudyYears,
  INITIAL_OPERATIONAL_ACADEMIC_YEAR,
  isStudentVacationMonth,
  STANDARD_ACADEMIC_MONTHS,
  validateAcademicYear,
} from './studentStatus.js';

const reportMonths = [
  ...STANDARD_ACADEMIC_MONTHS.slice(8),
  ...STANDARD_ACADEMIC_MONTHS.slice(0, 8),
];

const normalizeMonth = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const parseAmount = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const roundMoney = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

const getMonthlyAmount = (payment) => {
  const explicitAmount = parseAmount(payment.tuitionAmount);
  if (explicitAmount !== null) return explicitAmount;
  // The existing index resolves direct fields and legacy fees without counting
  // the same fee twice when both formats are stored on a receipt.
  const fees = buildStudentFeePaymentIndex([payment]).get(payment.studentId) || {};
  const knownFeeTotal = PAYMENT_FEE_FIELDS.reduce((sum, { key }) => sum + (fees[key] || 0), 0);
  const legacyFeeTotal = (Array.isArray(payment.fees) ? payment.fees : [])
    .reduce((sum, fee) => sum + (parseAmount(fee?.amount) || 0), 0);
  const legacyKnownFees = buildStudentFeePaymentIndex([{
    ...payment,
    ...Object.fromEntries(PAYMENT_FEE_FIELDS.map(({ key }) => [key, 0])),
  }]).get(payment.studentId) || {};
  const legacyKnownTotal = PAYMENT_FEE_FIELDS.reduce((sum, { key }) => sum + (legacyKnownFees[key] || 0), 0);
  // Older receipts may contain other charges too. Keep them out of tuition,
  // while removing known fees only once across the two receipt formats.
  const feeTotal = knownFeeTotal + Math.max(0, legacyFeeTotal - legacyKnownTotal);
  return Math.max(0, (parseAmount(payment.amount) || 0) - feeTotal);
};

const todayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const resolveSnapshot = (student, academicYear, operationalAcademicYear, payments) => {
  const snapshot = getStudentAcademicSnapshot(student, academicYear, operationalAcademicYear);
  if (snapshot) return snapshot;

  // Old receipts can retain a class that is absent from the student's history.
  // An actual receipt year is required; its month alone cannot establish a year.
  const receipt = payments.find(payment =>
    getPaymentAcademicYear(payment) === academicYear &&
    payment.studentSnapshot && typeof payment.studentSnapshot === 'object' &&
    Object.keys(payment.studentSnapshot).length > 0
  );
  return receipt ? {
    ...student,
    ...receipt.studentSnapshot,
    id: student.id,
    academicYear,
  } : null;
};

/**
 * Build a finance row for the selected month, student, and study year.
 * The caller supplies the roster selected by the screen's filters. Amounts are
 * recorded payments only; missing payments do not imply an invented debt.
 */
export const buildStudentFinanceReportRows = ({
  students = [],
  payments = [],
  academicYear = '',
  operationalAcademicYear = INITIAL_OPERATIONAL_ACADEMIC_YEAR,
  month = '',
  asOfDate = todayDate(),
} = {}) => {
  if (academicYear && !validateAcademicYear(academicYear)) return [];
  const selectedMonth = reportMonths.find(candidate => normalizeMonth(candidate) === normalizeMonth(month));
  if (!selectedMonth) return [];
  const currentMonthKey = /^\d{4}-\d{2}-\d{2}$/.test(asOfDate)
    ? asOfDate.slice(0, 7)
    : todayDate().slice(0, 7);
  const receiptsByStudent = new Map();
  const seenReceiptIds = new Set();
  (Array.isArray(payments) ? payments : []).forEach(payment => {
    if (!payment?.studentId || payment.isVirtualUnpaid) return;
    if (payment.id && seenReceiptIds.has(payment.id)) return;
    if (payment.id) seenReceiptIds.add(payment.id);
    const receipts = receiptsByStudent.get(payment.studentId) || [];
    receipts.push(payment);
    receiptsByStudent.set(payment.studentId, receipts);
  });

  const rows = [];
  const seenStudents = new Set();
  (Array.isArray(students) ? students : []).forEach(student => {
    if (!student?.id || seenStudents.has(student.id)) return;
    seenStudents.add(student.id);
    const studentReceipts = receiptsByStudent.get(student.id) || [];
    const academicYears = academicYear ? [academicYear] : [...new Set([
      ...getStudentAvailableStudyYears(student, operationalAcademicYear).map(option => option.academicYear),
      ...studentReceipts.map(getPaymentAcademicYear).filter(validateAcademicYear),
    ])].sort();

    academicYears.forEach(reportAcademicYear => {
      const snapshot = resolveSnapshot(student, reportAcademicYear, operationalAcademicYear, studentReceipts);
      if (!snapshot) return;
      const yearReceipts = studentReceipts.filter(payment =>
        getPaymentAcademicYear(payment) === reportAcademicYear &&
        normalizeMonth(payment.month) === normalizeMonth(selectedMonth)
      );
      const paidReceipts = yearReceipts.filter(payment => getPaymentStatusKey(payment.status) === 'paid');
      const paidByMonth = new Map();
      paidReceipts.forEach(payment => {
        const normalized = normalizeMonth(payment.month);
        if (!reportMonths.some(month => normalizeMonth(month) === normalized)) return;
        paidByMonth.set(normalized, (paidByMonth.get(normalized) || 0) + getMonthlyAmount(payment));
      });

      const monthly = [selectedMonth].map(month => {
        const monthIndex = STANDARD_ACADEMIC_MONTHS.indexOf(month);
        const calendarYear = getCalendarYearForAcademicMonth(reportAcademicYear, monthIndex);
        const monthKey = `${calendarYear}-${String(monthIndex + 1).padStart(2, '0')}`;
        const amount = roundMoney(paidByMonth.get(normalizeMonth(month)) || 0);
        return {
          month,
          amount,
          status: amount > 0 ? 'paid'
            : isStudentVacationMonth(snapshot, month) ? 'not_due'
              : monthKey > currentMonthKey ? 'upcoming' : 'unpaid',
        };
      });
      const paidFees = buildStudentFeePaymentIndex(yearReceipts, reportAcademicYear).get(student.id) || {};
      rows.push({
        studentId: student.id,
        academicYear: reportAcademicYear,
        month: selectedMonth,
        firstName: snapshot.firstName || '',
        lastName: snapshot.lastName || '',
        regNo: snapshot.regNo || '',
        major: snapshot.major || '',
        year: snapshot.year || '',
        monthly,
        monthlyPaidTotal: roundMoney(monthly.reduce((sum, item) => sum + item.amount, 0)),
        fees: Object.fromEntries(PAYMENT_FEE_FIELDS.map(({ key }) => {
          const amount = roundMoney(paidFees[key] || 0);
          return [key, { amount, status: amount > 0 ? 'paid' : 'unpaid' }];
        })),
      });
    });
  });
  return rows;
};
