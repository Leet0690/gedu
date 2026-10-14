import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentFinanceReportRows } from '../src/utils/studentFinanceReport.js';
import { FIRST_YEAR, SECOND_YEAR } from '../src/utils/studentStatus.js';

const academicYear = '2026-2027';
const student = {
  id: 's1', firstName: 'Salma', lastName: 'Test', regNo: 'FD001/26',
  major: 'Développement informatique', year: FIRST_YEAR, academicYear,
};
const options = {
  students: [student], academicYear, operationalAcademicYear: academicYear,
  month: 'Octobre', asOfDate: '2026-10-14',
};
const receipt = (data = {}) => ({ studentId: 's1', academicYear, status: 'payé', ...data });
const month = (row, name) => row.monthly.find(item => item.month === name);

test('reports only the selected month and all fee types for students without receipts', () => {
  const [row] = buildStudentFinanceReportRows(options);
  assert.equal(row.studentId, 's1');
  assert.equal(row.regNo, 'FD001/26');
  assert.equal(row.month, 'Octobre');
  assert.deepEqual(row.monthly.map(item => item.month), ['Octobre']);
  assert.deepEqual(month(row, 'Octobre'), { month: 'Octobre', amount: 0, status: 'unpaid' });
  assert.equal(row.monthlyPaidTotal, 0);
  assert.deepEqual(row.fees, {
    examFee: { amount: 0, status: 'unpaid' },
    registrationFee: { amount: 0, status: 'unpaid' },
    supportFee: { amount: 0, status: 'unpaid' },
  });
});

test('tuition stays monthly while annual fees aggregate the full academic year', () => {
  const payments = [
    receipt({ month: 'Octobre', amount: 1050, tuitionAmount: 700, examFee: 150, registrationFee: 200 }),
    receipt({ month: 'Novembre', amount: 750, tuitionAmount: 700, supportFee: 50, examFee: 999 }),
  ];
  const [row] = buildStudentFinanceReportRows({ ...options, payments });
  assert.equal(month(row, 'Octobre').amount, 700);
  assert.equal(month(row, 'Novembre'), undefined);
  assert.equal(row.monthlyPaidTotal, 700);
  assert.deepEqual(row.fees, {
    examFee: { amount: 1149, status: 'paid' },
    registrationFee: { amount: 200, status: 'paid' },
    supportFee: { amount: 50, status: 'paid' },
  });
  const [november] = buildStudentFinanceReportRows({ ...options, month: 'Novembre', payments });
  assert.equal(november.monthlyPaidTotal, 700);
  assert.equal(november.fees.supportFee.amount, 50);
  assert.equal(november.fees.registrationFee.status, 'paid');
});

test('annual fees without a month remain paid for every selected month', () => {
  const payments = [receipt({
    month: '', amount: 350, tuitionAmount: 0, examFee: 150, registrationFee: 200,
  })];
  const [row] = buildStudentFinanceReportRows({ ...options, month: 'Mars', payments });

  assert.equal(month(row, 'Mars').status, 'upcoming');
  assert.equal(row.fees.examFee.status, 'paid');
  assert.equal(row.fees.registrationFee.status, 'paid');
  assert.equal(row.fees.examFee.amount, 150);
});

test('fee-only receipts never turn a monthly payment into paid', () => {
  const payments = [
    receipt({ month: 'Octobre', amount: 350, examFee: 150, registrationFee: 200 }),
    receipt({ month: 'Novembre', amount: 50, tuitionAmount: 0, supportFee: 50 }),
  ];
  const [row] = buildStudentFinanceReportRows({ ...options, payments });
  assert.equal(row.monthlyPaidTotal, 0);
  assert.equal(month(row, 'Octobre').status, 'unpaid');
  assert.equal(row.fees.examFee.status, 'paid');
  assert.equal(row.fees.registrationFee.status, 'paid');
  assert.equal(row.fees.supportFee.status, 'paid');
  const [november] = buildStudentFinanceReportRows({ ...options, month: 'Novembre', payments });
  assert.equal(november.monthlyPaidTotal, 0);
  assert.equal(month(november, 'Novembre').status, 'upcoming');
  assert.equal(november.fees.supportFee.status, 'paid');
});

test('legacy tuition excludes direct and legacy fees exactly once and accepts French decimals', () => {
  const [row] = buildStudentFinanceReportRows({ ...options, payments: [receipt({
    month: 'Octobre', amount: '1050,50', examFee: '150', registrationFee: 0,
    fees: [
      { label: "Frais d'examen", amount: 150 },
      { label: 'Frais d’inscription', amount: '200' },
      { key: 'supportFee', amount: '12,50' },
    ],
  })] });
  assert.equal(month(row, 'Octobre').amount, 688);
  assert.equal(row.monthlyPaidTotal, 688);
  assert.equal(row.fees.examFee.amount, 150);
  assert.equal(row.fees.registrationFee.amount, 200);
  assert.equal(row.fees.supportFee.amount, 12.5);
});

test('other legacy charges are excluded from tuition without duplicating known fee formats', () => {
  const payments = [
    receipt({ month: 'Octobre', amount: 800, fees: [{ label: 'Autres frais', amount: 100 }] }),
    receipt({ month: 'Novembre', amount: 850, supportFee: 50, fees: [
      { label: 'Support', amount: 50 },
      { label: 'Autres frais', amount: 100 },
      { label: 'Charge invalide', amount: 'incorrect' },
      { label: 'Charge négative', amount: -50 },
      { label: 'Charge non finie', amount: Infinity },
    ] }),
  ];
  const [row] = buildStudentFinanceReportRows({ ...options, payments });
  assert.equal(month(row, 'Octobre').amount, 700);
  assert.equal(row.monthlyPaidTotal, 700);
  assert.equal(row.fees.supportFee.amount, 50);
  const [november] = buildStudentFinanceReportRows({ ...options, month: 'Novembre', payments });
  assert.equal(month(november, 'Novembre').amount, 700);
  assert.equal(november.fees.supportFee.amount, 50);
});

test('explicit tuition takes precedence over legacy charges including an explicit zero', () => {
  const payments = [
    receipt({ month: 'Octobre', amount: 850, tuitionAmount: 600, supportFee: 50,
      fees: [{ label: 'Support', amount: 50 }, { label: 'Autres frais', amount: 100 }] }),
    receipt({ month: 'Novembre', amount: 800, tuitionAmount: 0,
      fees: [{ label: 'Autres frais', amount: 100 }] }),
  ];
  const [row] = buildStudentFinanceReportRows({ ...options, payments });
  assert.equal(month(row, 'Octobre').amount, 600);
  assert.equal(row.monthlyPaidTotal, 600);
  const [november] = buildStudentFinanceReportRows({ ...options, month: 'Novembre', payments });
  assert.equal(month(november, 'Novembre').amount, 0);
  assert.equal(month(november, 'Novembre').status, 'upcoming');
});

test('only recorded paid receipts count, excluding unpaid and synthetic rows', () => {
  const [row] = buildStudentFinanceReportRows({ ...options, payments: [
    receipt({ month: 'Octobre', amount: 700, examFee: 150, status: 'Non payé' }),
    receipt({ month: 'Octobre', amount: 700, registrationFee: 200, status: 'impayé' }),
    receipt({ month: 'Octobre', amount: 700, supportFee: 50, isVirtualUnpaid: true }),
    receipt({ month: 'Novembre', amount: 700 }),
  ] });
  assert.equal(month(row, 'Octobre').status, 'unpaid');
  assert.equal(row.monthlyPaidTotal, 0);
  assert.equal(row.fees.examFee.status, 'unpaid');
  assert.equal(row.fees.registrationFee.status, 'unpaid');
  assert.equal(row.fees.supportFee.status, 'unpaid');
});

test('duplicate student and receipt IDs are counted once while distinct installments add up', () => {
  const payment = receipt({ id: 'p1', month: 'Octobre', amount: 320, tuitionAmount: 300, supportFee: 20 });
  const rows = buildStudentFinanceReportRows({ ...options, students: [student, student], payments: [
    payment, { ...payment },
    receipt({ id: 'p2', month: 'Octobre', amount: 450, tuitionAmount: 400, supportFee: 50 }),
  ] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].monthlyPaidTotal, 700);
  assert.equal(rows[0].fees.supportFee.amount, 70);
});

test('all-year reports keep October payments separate and use each historical class snapshot', () => {
  const secondYear = { ...student, year: SECOND_YEAR, major: 'Classe actuelle', classHistory: [
    { academicYear: '2025-2026', year: FIRST_YEAR, major: 'Classe historique' },
  ] };
  const payments = [
    receipt({ academicYear: '2025-2026', month: 'Octobre', amount: 650, tuitionAmount: 600, examFee: 50 }),
    receipt({ month: 'Octobre', amount: 800, tuitionAmount: 700, examFee: 100 }),
    receipt({ academicYear: '2025-2026', month: 'Septembre', amount: 5000, tuitionAmount: 4000, examFee: 1000 }),
    receipt({ month: 'Septembre', amount: 8000, tuitionAmount: 7000, examFee: 1000 }),
  ];
  const rows = buildStudentFinanceReportRows({ ...options, academicYear: '', students: [secondYear], payments });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].academicYear, '2025-2026');
  assert.equal(rows[0].year, FIRST_YEAR);
  assert.equal(rows[0].major, 'Classe historique');
  assert.equal(rows[0].monthlyPaidTotal, 600);
  assert.equal(rows[0].fees.examFee.amount, 1050);
  assert.equal(rows[0].month, 'Octobre');
  assert.equal(rows[1].academicYear, academicYear);
  assert.equal(rows[1].year, SECOND_YEAR);
  assert.equal(rows[1].monthlyPaidTotal, 700);
  assert.equal(rows[1].fees.examFee.amount, 1100);
  assert.equal(rows[1].month, 'Octobre');
  assert.equal(buildStudentFinanceReportRows({ ...options, students: [secondYear], payments })[0].monthlyPaidTotal, 700);
});

test('all-year reports retain repeated academic years rather than merging a study level', () => {
  const repeated = { ...student, classHistory: [
    { academicYear: '2024-2025', year: FIRST_YEAR },
    { academicYear: '2025-2026', year: FIRST_YEAR },
  ] };
  const rows = buildStudentFinanceReportRows({ ...options, academicYear: '', students: [repeated] });
  assert.deepEqual(rows.map(row => row.academicYear), ['2024-2025', '2025-2026', academicYear]);
});

test('missing enrollment years require a real receipt snapshot and do not invent membership', () => {
  assert.deepEqual(buildStudentFinanceReportRows({ ...options, academicYear: '2024-2025' }), []);
  const payments = [receipt({
    academicYear: '2024-2025', month: 'Octobre', amount: 600,
    studentSnapshot: { firstName: 'Ancien prénom', major: 'Ancienne classe', year: FIRST_YEAR },
  })];
  const [oldRow] = buildStudentFinanceReportRows({ ...options, academicYear: '2024-2025', payments });
  assert.equal(oldRow.firstName, 'Ancien prénom');
  assert.equal(oldRow.major, 'Ancienne classe');
  assert.equal(oldRow.monthlyPaidTotal, 600);
  assert.equal(buildStudentFinanceReportRows({ ...options, academicYear: '', payments }).length, 2);
});

test('legacy receipt years derive from dates while monthly totals exclude unknown months', () => {
  const payments = [
    { studentId: 's1', date: '2027-02-10', month: '  FEVRIER ', amount: 700 },
    receipt({ month: 'Autres', amount: 900, supportFee: 50 }),
    { studentId: 's1', date: '-', month: 'Octobre', amount: 700, examFee: 150 },
  ];
  const [row] = buildStudentFinanceReportRows({ ...options, month: ' fevrier ', payments });
  assert.equal(row.month, 'Février');
  assert.equal(month(row, 'Février').amount, 700);
  assert.equal(month(row, 'Février').status, 'paid');
  assert.equal(row.monthlyPaidTotal, 700);
  assert.equal(row.fees.supportFee.amount, 50);
  assert.equal(row.fees.examFee.amount, 0);
  const [october] = buildStudentFinanceReportRows({ ...options, payments });
  assert.equal(month(october, 'Octobre').status, 'unpaid');
  assert.equal(october.monthlyPaidTotal, 0);
});

test('positive payments take priority over future and vacation flags without fabricating remaining balances', () => {
  const scopedOptions = { ...options, students: [{ ...student, year: SECOND_YEAR }], payments: [
    receipt({ month: 'Août', amount: 20, tuitionAmount: 20 }),
    receipt({ month: 'Novembre', amount: 10, tuitionAmount: 10 }),
    receipt({ month: 'Décembre', amount: 0, tuitionAmount: -50 }),
  ] };
  const [row] = buildStudentFinanceReportRows({ ...scopedOptions, month: 'Août' });
  assert.deepEqual(month(row, 'Août'), { month: 'Août', amount: 20, status: 'paid' });
  assert.equal(row.monthlyPaidTotal, 20);
  const [november] = buildStudentFinanceReportRows({ ...scopedOptions, month: 'Novembre' });
  assert.equal(month(november, 'Novembre').status, 'paid');
  const [december] = buildStudentFinanceReportRows({ ...scopedOptions, month: 'Décembre' });
  assert.equal(month(december, 'Décembre').amount, 0);
  assert.equal(month(december, 'Décembre').status, 'upcoming');
  assert.equal(Object.hasOwn(row, 'remainingBalance'), false);
});

test('non-payable vacation months depend on the historical study year of the selected month', () => {
  const firstYearSeptember = buildStudentFinanceReportRows({ ...options, month: 'Septembre' })[0];
  assert.equal(firstYearSeptember.monthly[0].status, 'not_due');
  const secondYear = { ...student, year: SECOND_YEAR };
  const secondYearSeptember = buildStudentFinanceReportRows({ ...options, students: [secondYear], month: 'Septembre' })[0];
  assert.equal(secondYearSeptember.monthly[0].status, 'unpaid');
  const secondYearJuly = buildStudentFinanceReportRows({ ...options, students: [secondYear], month: 'Juillet' })[0];
  assert.equal(secondYearJuly.monthly[0].status, 'not_due');
});

test('invalid scope and absent input return an empty list safely', () => {
  assert.deepEqual(buildStudentFinanceReportRows(), []);
  assert.deepEqual(buildStudentFinanceReportRows({ ...options, academicYear: '2026-2026' }), []);
  assert.deepEqual(buildStudentFinanceReportRows({ ...options, students: null, payments: null }), []);
  assert.deepEqual(buildStudentFinanceReportRows({ ...options, month: '' }), []);
  assert.deepEqual(buildStudentFinanceReportRows({ ...options, month: 'Autres' }), []);
});
