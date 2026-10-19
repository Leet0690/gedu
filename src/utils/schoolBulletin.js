import { jsPDF } from 'jspdf';
import { loadLogoDataUrl } from './loadLogoDataUrl.js';

export async function generateSchoolBulletin({ student, academicYear, institution, report, save = true }) {
  const document = new jsPDF();
  const format = value => value === null ? '—' : value.toFixed(2);
  const heading = () => {
    document.setFontSize(15); document.setFont('helvetica', 'bold');
    document.text(institution.name, 15, 18, { maxWidth: 180 });
    document.setFontSize(12); document.text(`Bulletin scolaire · ${academicYear}`, 15, 32);
    document.setFontSize(10); document.setFont('helvetica', 'normal');
    document.text(`${student.lastName} ${student.firstName} · ${student.regNo || ''}`, 15, 41);
    document.text(`${student.diploma} · ${student.year} · Classe ${student.major}`, 15, 48);
    document.text('Matière', 15, 62); document.text('Coef.', 115, 62); document.text(`S1 /${report.scale}`, 133, 62); document.text(`S2 /${report.scale}`, 156, 62); document.text(`Année /${report.scale}`, 177, 62);
  };
  heading();
  const logo = await loadLogoDataUrl(institution.logoUrl);
  if (logo) { try { document.addImage(logo, 'PNG', 175, 23, 18, 15); } catch { /* The bulletin remains available without a logo. */ } }
  let y = 72;
  report.rows.forEach(row => {
    const lines = document.splitTextToSize(row.module.name, 92);
    const height = Math.max(9, lines.length * 5 + 4);
    if (y + height > 260) { document.addPage(); heading(); y = 72; }
    document.text(lines, 15, y); document.text(String(row.coefficient), 118, y);
    document.text(format(row.s1), 136, y); document.text(format(row.s2), 159, y); document.text(format(row.annual), 181, y);
    y += height;
  });
  if (y > 230) { document.addPage(); y = 25; }
  document.setFont('helvetica', 'bold');
  document.text(`Moyennes : S1 ${format(report.s1)} · S2 ${format(report.s2)} · Année ${format(report.annual)}`, 15, y + 8);
  document.setFontSize(9); document.setFont('helvetica', 'normal');
  document.text('La décision de passage relève du conseil de classe et de l’administration.', 15, y + 19);
  if (save) document.save(`bulletin-${student.regNo || student.id}-${academicYear}.pdf`);
  return document;
}
