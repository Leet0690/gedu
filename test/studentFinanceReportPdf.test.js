import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentFinanceReportPdf } from '../src/utils/studentFinanceReportPdf.js';

const makeRow = index => ({
  studentId: `student-${index}`,
  firstName: `Prenom${index}`,
  lastName: `Nom${index}`,
  regNo: `PDF-STUDENT-${String(index).padStart(3, '0')}`,
  major: 'Gestion de transport et logistique',
  year: '1ère année',
  academicYear: '2026/2027',
  month: 'Octobre',
  monthlyPaidTotal: 625.25,
  fees: {
    examFee: { amount: 0, status: 'unpaid' },
    registrationFee: { amount: 350, status: 'paid' },
    supportFee: { amount: 100, status: 'paid' },
  },
  monthly: [{ month: 'Octobre', amount: 625.25, status: 'paid' }],
});

const pageText = doc => doc.internal.pages.slice(1).map(page => page.join('\n'));

test('student finance PDF contains the selected month and all four fee types with payment statuses', () => {
  const rows = ['paid', 'unpaid', 'upcoming', 'not_due'].map((status, index) => {
    const row = makeRow(index + 1);
    row.monthlyPaidTotal = 9999;
    row.monthly = [{ month: 'Octobre', amount: status === 'paid' ? 625.25 : 0, status }];
    return row;
  });
  const doc = buildStudentFinanceReportPdf({
    rows,
    monthLabel: 'Octobre',
    academicYearLabel: '2026/2027',
    generatedDate: new Date('2026-10-14T12:00:00Z'),
    filters: ['Examen : Impayé', 'Inscription : Payé'],
  });
  const pages = pageText(doc);
  const text = pages.join('\n');
  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight());
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 297) < 1);
  assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 210) < 1);
  assert.ok(text.includes('14/10/2026'));
  assert.ok(text.includes('2026/2027'));
  assert.ok(text.includes('Mois : Octobre'));
  assert.ok(text.includes('Examen : Impay'));
  assert.ok(text.includes('Inscription : Pay'));
  assert.ok(!text.includes('9 999,00'), 'The PDF must use the selected monthly entry, not an annual total');
  assert.ok(text.includes('Mensualit'));
  assert.ok(text.includes('Inscription'));
  assert.ok(text.includes('Support'));
  assert.ok(text.includes('Examen'));
  assert.ok(text.includes('350,00'));
  assert.ok(text.includes('100,00'));
  assert.equal((text.match(/625,25/g) || []).length, 1);
  assert.ok(!text.includes('Sept.'));
  assert.ok(!text.includes('Détail des mensualités'));
  for (const status of ['Pay', 'Impay', 'venir', 'Non d']) assert.ok(text.includes(status));
  pages.forEach((page, index) => assert.ok(page.includes(`Page ${index + 1} / 1`)));
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), '%PDF-');
});

test('student finance PDF paginates the entire unpaginated selection with repeated table headers', () => {
  const rows = Array.from({ length: 65 }, (_, index) => makeRow(index + 1));
  rows[13].firstName = 'Un prénom composé particulièrement long pour conserver toute son identité';
  rows[13].lastName = 'Nom composé avec plusieurs éléments nécessaires à une identification complète';
  rows[13].major = 'Formation longue en administration des systèmes informatiques et des réseaux de communication';
  const doc = buildStudentFinanceReportPdf({
    rows,
    monthLabel: 'Octobre',
    academicYearLabel: '2026/2027',
    generatedDate: '14/10/2026',
    filters: ['Frais d’examen : Impayé', 'Filière : Toutes'],
  });
  const pages = pageText(doc);
  const text = pages.join('\n');
  assert.ok(doc.getNumberOfPages() > 3);
  for (const row of rows) {
    assert.equal((text.match(new RegExp(row.regNo, 'g')) || []).length, 1, `${row.regNo} must appear once in the full monthly list`);
  }
  assert.ok(text.includes('son identit'));
  assert.ok(text.includes('identification'));
  assert.ok(text.includes('communication'));
  pages.forEach((page, index) => {
    assert.ok(page.includes('Matricule'), `Missing repeated table header on page ${index + 1}`);
    assert.ok(page.includes('Ann'), `Missing repeated report context on page ${index + 1}`);
    assert.ok(page.includes('Mois : Octobre'), `Missing repeated selected month on page ${index + 1}`);
    assert.ok(page.includes(`Page ${index + 1} / ${pages.length}`));
    assert.ok(page.includes('IPFP'));
  });
});

test('exceptionally long student names continue across pages without losing their ending', () => {
  const row = makeRow(1);
  row.lastName = `${'Nomcompose '.repeat(400)}ENDING-OF-LONG-NAME`;
  const doc = buildStudentFinanceReportPdf({ rows: [row], monthLabel: 'Octobre', academicYearLabel: '2026/2027' });
  const text = pageText(doc).join('\n');
  assert.ok(doc.getNumberOfPages() > 2);
  assert.equal((text.match(/ENDING-OF-LONG-NAME/g) || []).length, 1);
  assert.equal((text.match(/Nomcompose/g) || []).length, 400);
});

test('student finance PDF rejects an empty selection before offering a download', () => {
  assert.throws(() => buildStudentFinanceReportPdf({ rows: [] }), /Aucun stagiaire/);
});
