import { jsPDF } from 'jspdf';

const MARGIN = 10;
const FOOTER_SPACE = 14;
const COLORS = {
  ink: [31, 41, 55],
  muted: [88, 102, 121],
  navy: [30, 58, 95],
  line: [218, 225, 234],
  stripe: [246, 248, 252],
  paid: [20, 111, 77],
  unpaid: [171, 43, 50],
};

const STATUS_LABELS = {
  paid: 'Payé',
  unpaid: 'Impayé',
  upcoming: 'À venir',
  not_due: 'Non dû',
};

const cleanText = value => String(value ?? '').replace(/[\u00a0\u202f]/g, ' ');
const formatAmount = value => {
  const amount = Number(value);
  return (Number.isFinite(amount) ? amount : 0)
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[\u00a0\u202f]/g, ' ');
};

const statusColor = status => (
  status === 'paid' ? COLORS.paid : status === 'unpaid' ? COLORS.unpaid : COLORS.muted
);

const paymentCell = payment => {
  const status = payment?.status || 'unpaid';
  const label = STATUS_LABELS[status] || STATUS_LABELS.unpaid;
  const amount = ['not_due', 'upcoming'].includes(status) ? '-' : formatAmount(payment?.amount);
  return { text: `${amount}\n${label}`, color: statusColor(status) };
};

const studentCell = row => ({
  text: `${[row.lastName, row.firstName].filter(Boolean).join(' ') || 'Stagiaire'}\n${row.regNo || row.studentId || '-'}`,
});

const formatDate = value => value instanceof Date
  ? value.toLocaleDateString('fr-FR', { timeZone: 'Africa/Casablanca' })
  : cleanText(value || '-');

/**
 * Builds a PDF from the complete filtered list. The caller controls downloading.
 * Amounts represent recorded payments, not a calculated outstanding balance.
 */
export function buildStudentFinanceReportPdf({
  rows = [],
  monthLabel = '',
  academicYearLabel = '',
  generatedDate = new Date(),
  filters = [],
} = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Aucun stagiaire à inclure dans le rapport.');
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setProperties({ title: 'Liste des stagiaires - Paiements', author: 'IPFP' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const tableWidth = width - MARGIN * 2;
  const bottom = height - FOOTER_SPACE;
  const dateLabel = formatDate(generatedDate);
  const filterLabel = filters.filter(Boolean).map(cleanText).join(' | ') || 'Tous les stagiaires';
  let y = MARGIN;

  const drawPageHeader = sectionTitle => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.navy);
    doc.text('IPFP', MARGIN, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Édité le ${dateLabel}`, width - MARGIN, 13, { align: 'right' });
    doc.setDrawColor(...COLORS.line);
    doc.line(MARGIN, 17, width - MARGIN, 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.navy);
    doc.text('Liste des stagiaires - Paiements', MARGIN, 26);
    doc.setFontSize(11);
    doc.text(sectionTitle, MARGIN, 33);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.ink);
    y = 39;
    const context = [
      `Mois : ${monthLabel || rows[0]?.month || '-'}`,
      `Année académique : ${academicYearLabel || 'Toutes les années'}`,
      `Sélection : ${rows.length} ligne${rows.length > 1 ? 's' : ''} de stagiaire / année. Filtres : ${filterLabel}`,
    ];
    for (const line of context) {
      const lines = doc.splitTextToSize(cleanText(line), tableWidth);
      doc.text(lines, MARGIN, y, { lineHeightFactor: 1.2 });
      y += lines.length * 3.7;
    }
    doc.setFontSize(7.3);
    doc.setTextColor(...COLORS.muted);
    const note = 'Mensualité : montant enregistré pour le mois sélectionné. Examen, inscription et support : montants cumulés sur l’année académique. Payé = versement enregistré ; Impayé = aucun versement ; À venir = mois futur ; Non dû = hors période de facturation. Aucun solde restant n’est calculé.';
    const notes = doc.splitTextToSize(note, tableWidth);
    doc.text(notes, MARGIN, y, { lineHeightFactor: 1.2 });
    y += notes.length * 3.2 + 4;
  };

  const drawTable = ({ title, columns, cells, fontSize, lineHeight, minimumHeight }) => {
    const padding = 1.8;
    let tableStart;
    const newPage = addPage => {
      if (addPage) doc.addPage();
      drawPageHeader(title);
      const headerHeight = 14;
      doc.setFillColor(...COLORS.navy);
      doc.rect(MARGIN, y, tableWidth, headerHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.7);
      doc.setTextColor(255, 255, 255);
      let x = MARGIN;
      for (const column of columns) {
        const lines = doc.splitTextToSize(column.label, column.width - padding * 2);
        doc.text(lines, x + column.width / 2, y + 4.6, { align: 'center', lineHeightFactor: 1.12 });
        x += column.width;
      }
      y += headerHeight;
      tableStart = y;
    };

    newPage(false);
    cells.forEach((rowCells, rowIndex) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      const remaining = rowCells.map((cell, index) => (
        doc.splitTextToSize(cleanText(cell.text), columns[index].width - padding * 2)
      ));
      const fullHeight = Math.max(minimumHeight, Math.max(...remaining.map(lines => lines.length)) * lineHeight + padding * 2);
      // Keep ordinary rows together; exceptionally long values continue on the next page.
      if (y + fullHeight > bottom && y > tableStart) newPage(true);

      let linesLeft = Math.max(...remaining.map(lines => lines.length));
      while (linesLeft > 0) {
        let availableLines = Math.floor((bottom - y - padding * 2) / lineHeight);
        if (availableLines < 1 || bottom - y < minimumHeight) {
          newPage(true);
          availableLines = Math.floor((bottom - y - padding * 2) / lineHeight);
        }
        const lineCount = Math.min(linesLeft, availableLines);
        const rowHeight = Math.max(minimumHeight, lineCount * lineHeight + padding * 2);
        doc.setFillColor(...(rowIndex % 2 ? COLORS.stripe : [255, 255, 255]));
        doc.rect(MARGIN, y, tableWidth, rowHeight, 'F');
        doc.setDrawColor(...COLORS.line);
        doc.setLineWidth(0.15);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        let x = MARGIN;
        rowCells.forEach((cell, index) => {
          doc.rect(x, y, columns[index].width, rowHeight);
          doc.setTextColor(...(cell.color || COLORS.ink));
          const lines = remaining[index].splice(0, lineCount);
          if (lines.length) {
            const centered = columns[index].align === 'center';
            doc.text(lines, centered ? x + columns[index].width / 2 : x + padding, y + padding + fontSize * 0.3528, {
              align: centered ? 'center' : 'left',
              lineHeightFactor: lineHeight / (fontSize * 0.3528),
            });
          }
          x += columns[index].width;
        });
        y += rowHeight;
        linesLeft = Math.max(...remaining.map(lines => lines.length));
        if (linesLeft > 0) newPage(true);
      }
    });
  };

  drawTable({
    title: 'Récapitulatif des frais',
    columns: [
      { label: 'N°', width: 8, align: 'center' },
      { label: 'Stagiaire / Matricule', width: 60 },
      { label: 'Formation / Niveau', width: 45 },
      { label: 'Année académique', width: 22, align: 'center' },
      { label: 'Mensualité (DH)', width: 35, align: 'center' },
      { label: 'Inscription annuel (DH)', width: 35, align: 'center' },
      { label: 'Support annuel (DH)', width: 35, align: 'center' },
      { label: 'Examen annuel (DH)', width: tableWidth - 240, align: 'center' },
    ],
    cells: rows.map((row, index) => [
      { text: index + 1 },
      studentCell(row),
      { text: `${row.major || '-'}\n${row.year || '-'}` },
      { text: row.academicYear || academicYearLabel || '-' },
      paymentCell(row.monthly?.[0]),
      paymentCell(row.fees?.registrationFee),
      paymentCell(row.fees?.supportFee),
      paymentCell(row.fees?.examFee),
    ]),
    fontSize: 8,
    lineHeight: 3.5,
    minimumHeight: 12,
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...COLORS.line);
    doc.line(MARGIN, height - 11, width - MARGIN, height - 11);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.text('IPFP - Suivi des paiements des stagiaires', MARGIN, height - 6);
    doc.text(`Page ${page} / ${pageCount}`, width - MARGIN, height - 6, { align: 'right' });
  }
  return doc;
}
