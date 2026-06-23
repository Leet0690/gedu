import { jsPDF } from 'jspdf';
import { loadLogoDataUrl } from './loadLogoDataUrl.js';

/* ── Constants ── */
const ACCREDITATION_TEXT = [
  'Institut de formation professionnelle « établissement privé »',
  'agréé par le ministère de l’Inclusion économique, de la Petite entreprise,',
  'de l’Emploi et des Compétences, sous le numéro 4/01/6/2022'
];

/**
 * Common header for all official documents
 */
const drawHeader = (doc, title, logoDataUrl, withLine = true) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Set white background for the entire page
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, 'F');
  doc.setTextColor(0); // Reset text color to black

  // Logo
  try {
    doc.addImage(logoDataUrl, 'JPEG', margin, 8, 50, 22);
  } catch (e) {
    console.error("Logo not found", e);
  }

  // Accreditation Text (Right side)
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  let textY = 12;
  ACCREDITATION_TEXT.forEach(line => {
    doc.text(line, w - margin, textY, { align: 'right' });
    textY += 4;
  });

  // Main Title
  if (title === "Notes d'obtention de diplôme") {
    doc.setTextColor(91, 155, 213); // Light Blue
    doc.setFont('times', 'normal');
    doc.setFontSize(26);
    doc.text(title, w / 2, 40, { align: 'center' });
    doc.setDrawColor(91, 155, 213);
    doc.setLineWidth(0.5);
    doc.line(margin + 20, 42, w - margin - 20, 42);
  } else {
    doc.setTextColor(91, 155, 213); // Changed to match blue theme for Releve
    if (title === "RELEVÉ DES NOTES") {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
    }
    doc.text(title, w / 2, 45, { align: 'center' });
    if (withLine) {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, 50, w - margin, 50);
    }
  }

  return title === "Notes d'obtention de diplôme" ? 55 : 55;
};

/* ════════════════════════════════════════════════════════════════════
 *  1. FICHE DE SIGNATURE — Par module / par CC
 * ════════════════════════════════════════════════════════════════════ */
export const generateFicheSignature = async ({ students, filiere, niveau, module, ccNumber, formateur, allGrades }) => {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const margin = 15;
  const tableW = w - margin * 2;

  let y = drawHeader(doc, 'FICHE DES NOTES', logoDataUrl);
  doc.setTextColor(0); // Ensure black text after header

  // ── Header Info ──
  const rowH = 10;
  y += 5;

  // Row 1: Filière | Niveau
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, tableW / 2, rowH);
  doc.rect(margin + tableW / 2, y, tableW / 2, rowH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Filière : ', margin + 3, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.text(filiere || '', margin + 22, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text('Niveau : ', margin + tableW / 2 + 3, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.text(niveau || '', margin + tableW / 2 + 22, y + 7);

  // Row 2: Formateur | UF N°
  y += rowH;
  doc.rect(margin, y, tableW / 2, rowH);
  doc.rect(margin + tableW / 2, y, tableW / 2, rowH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Formateur :', margin + 3, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.text(formateur || '', margin + 28, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text('UF N° :', margin + tableW / 2 + 3, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.text(module || '', margin + tableW / 2 + 20, y + 7);

  // Row 3: Séquence pédagogique | SQ. Intitulé
  y += rowH;
  doc.rect(margin, y, tableW / 2, rowH);
  doc.rect(margin + tableW / 2, y, tableW / 2, rowH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Séquence pédagogique N°: `, margin + 3, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.text(`CC${ccNumber}`, margin + 55, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text('SQ. Intitulé :', margin + tableW / 2 + 3, y + 7);

  // Row 4: Date | Durée
  y += rowH;
  doc.rect(margin, y, tableW / 2, rowH);
  doc.rect(margin + tableW / 2, y, tableW / 2, rowH);
  doc.setFont('helvetica', 'normal');
  doc.text('Date :', margin + 3, y + 7);
  doc.text("Durée de l'épreuve :", margin + tableW / 2 + 3, y + 7);

  // ── Table Header ──
  y += rowH + 4;
  const col1W = 35;
  const col3W = 50;
  const col2W = tableW - col1W - col3W;

  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, col1W, rowH, 'FD');
  doc.rect(margin + col1W, y, col2W, rowH, 'FD');
  doc.rect(margin + col1W + col2W, y, col3W, rowH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('MATRICULE', margin + col1W / 2, y + 7, { align: 'center' });
  doc.text('NOM & PRENOM', margin + col1W + col2W / 2, y + 7, { align: 'center' });
  doc.text('NOTES /20', margin + col1W + col2W + col3W / 2, y + 7, { align: 'center' });

  // ── Table Rows ──
  y += rowH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  students.forEach((student) => {
    if (y > 260) {
      doc.addPage();
      y = drawHeader(doc, 'FICHE DES NOTES (Suite)', logoDataUrl);
      y += 10;
    }
    doc.rect(margin, y, col1W, rowH);
    doc.rect(margin + col1W, y, col2W, rowH);
    doc.rect(margin + col1W + col2W, y, col3W, rowH);

    doc.setFont('helvetica', 'bold');
    doc.text(student.regNo || '', margin + 3, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${student.lastName || ''} ${student.firstName || ''}`, margin + col1W + 3, y + 7);

    const studentGrades = allGrades && allGrades[student.id] && allGrades[student.id][module] ? allGrades[student.id][module] : {};
    const gradeVal = studentGrades[`c${ccNumber}`];
    const displayGrade = gradeVal !== undefined && gradeVal !== '' ? `${parseFloat(gradeVal).toFixed(2).replace('.', ',')} / 20` : '..................../20';

    doc.text(displayGrade, margin + col1W + col2W + 5, y + 7);

    y += rowH;
  });

  // ── Footer ──
  y += 10;
  if (y > 250) { doc.addPage(); y = 40; }

  doc.rect(margin, y, tableW / 2, 30);
  doc.rect(margin + tableW / 2, y, tableW / 2, 30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SIGNATURE DU FORMATEUR', margin + tableW / 4, y + 8, { align: 'center' });
  doc.text('Visa du président du jury', margin + tableW * 3 / 4, y + 8, { align: 'center' });

  const safeMod = (module || 'module').replace(/[^a-z0-9]/gi, '_').substring(0, 20);
  doc.save(`Fiche_Notes_CC${ccNumber}_${safeMod}.pdf`);
};


/* ════════════════════════════════════════════════════════════════════
 *  2. FICHE DES NOTES — Par module, EFCFP & EFCFT seulement
 * ════════════════════════════════════════════════════════════════════ */
export const generateFicheNotes = async ({ students, filiere, classe, anneeFormation, module, formateur, allGrades }) => {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const margin = 15;
  const tableW = w - margin * 2;

  let y = drawHeader(doc, 'FICHE DES NOTES', logoDataUrl);
  doc.setTextColor(0); // Ensure black text after header

  // ── Header Info ──
  const rowH = 12;
  y += 5;

  const col1H = tableW * 0.5;
  const col2H = tableW * 0.25;
  const col3H = tableW * 0.25;

  doc.setDrawColor(0);
  doc.rect(margin, y, col1H, rowH);
  doc.rect(margin + col1H, y, col2H, rowH);
  doc.rect(margin + col1H + col2H, y, col3H, rowH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Intitulé de la filière', margin + col1H / 2, y + 5, { align: 'center' });
  doc.text('Classe', margin + col1H + col2H / 2, y + 5, { align: 'center' });
  doc.text('Année de formation', margin + col1H + col2H + col3H / 2, y + 5, { align: 'center' });

  y += rowH;
  doc.rect(margin, y, col1H, rowH);
  doc.rect(margin + col1H, y, col2H, rowH);
  doc.rect(margin + col1H + col2H, y, col3H, rowH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(filiere || '', margin + col1H / 2, y + 8, { align: 'center' });
  doc.text(classe || '', margin + col1H + col2H / 2, y + 8, { align: 'center' });
  doc.text(anneeFormation || '2025-2026', margin + col1H + col2H + col3H / 2, y + 8, { align: 'center' });

  y += rowH;
  doc.rect(margin, y, tableW / 2, rowH);
  doc.rect(margin + tableW / 2, y, tableW / 2, rowH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text("Unité de Formation (Module)", margin + tableW / 4, y + 5, { align: 'center' });
  doc.text('Formateur', margin + tableW * 3 / 4, y + 5, { align: 'center' });

  y += rowH;
  doc.rect(margin, y, tableW / 2, rowH);
  doc.rect(margin + tableW / 2, y, tableW / 2, rowH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(module || '', margin + tableW / 4, y + 8, { align: 'center' });
  doc.text(formateur || '', margin + tableW * 3 / 4, y + 8, { align: 'center' });

  // ── Table Header ──
  y += rowH + 4;
  const tCol1 = 35;
  const tCol3 = 30;
  const tCol4 = 30;
  const tCol2 = tableW - tCol1 - tCol3 - tCol4;

  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, tCol1, rowH, 'FD');
  doc.rect(margin + tCol1, y, tCol2, rowH, 'FD');
  doc.rect(margin + tCol1 + tCol2, y, tCol3, rowH, 'FD');
  doc.rect(margin + tCol1 + tCol2 + tCol3, y, tCol4, rowH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('MATRICULE', margin + tCol1 / 2, y + 7, { align: 'center' });
  doc.text('NOM ET PRENOM DU STAGIAIRE', margin + tCol1 + tCol2 / 2, y + 7, { align: 'center' });
  doc.text('EFCFP', margin + tCol1 + tCol2 + tCol3 / 2, y + 7, { align: 'center' });
  doc.text('EFCFT', margin + tCol1 + tCol2 + tCol3 + tCol4 / 2, y + 7, { align: 'center' });

  // ── Table Rows ──
  y += rowH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  students.forEach((student) => {
    if (y > 255) {
      doc.addPage();
      y = drawHeader(doc, 'FICHE DES NOTES (Suite)', logoDataUrl);
      y += 15;
    }
    doc.rect(margin, y, tCol1, rowH);
    doc.rect(margin + tCol1, y, tCol2, rowH);
    doc.rect(margin + tCol1 + tCol2, y, tCol3, rowH);
    doc.rect(margin + tCol1 + tCol2 + tCol3, y, tCol4, rowH);

    doc.setFont('helvetica', 'bold');
    doc.text(student.regNo || '', margin + tCol1 / 2, y + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(`${student.lastName || ''} ${student.firstName || ''}`, margin + tCol1 + 3, y + 8);

    const studentGrades = allGrades && allGrades[student.id] && allGrades[student.id][module] ? allGrades[student.id][module] : {};
    const valEFCFP = studentGrades.efcfp;
    const valEFCFT = studentGrades.efcft;

    const displayEFCFP = valEFCFP !== undefined && valEFCFP !== '' ? `${parseFloat(valEFCFP).toFixed(2).replace('.', ',')} / 20` : '........./20';
    const displayEFCFT = valEFCFT !== undefined && valEFCFT !== '' ? `${parseFloat(valEFCFT).toFixed(2).replace('.', ',')} / 20` : '........./20';

    doc.text(displayEFCFP, margin + tCol1 + tCol2 + 5, y + 8);
    doc.text(displayEFCFT, margin + tCol1 + tCol2 + tCol3 + 5, y + 8);

    y += rowH;
  });

  // ── Footer ──
  y += 10;
  if (y > 250) { doc.addPage(); y = 40; }

  doc.rect(margin, y, tableW / 2, 25);
  doc.rect(margin + tableW / 2, y, tableW / 2, 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SIGNATURE DU FORMATEUR', margin + tableW / 4, y + 10, { align: 'center' });
  doc.text("SIGNATURE DU JURY D'EXAMEN", margin + tableW * 3 / 4, y + 10, { align: 'center' });

  const safeMod = (module || 'module').replace(/[^a-z0-9]/gi, '_').substring(0, 20);
  doc.save(`Fiche_Notes_EFC_${safeMod}.pdf`);
};


/* ════════════════════════════════════════════════════════════════════
 *  3. RELEVÉ DES NOTES — Par stagiaire, toutes les notes
 * ════════════════════════════════════════════════════════════════════ */
export const generateBulletinGlobal = async (student, allGrades, modules) => {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const margin = 10;
  const tableW = w - margin * 2;
  const grades = allGrades[student.id] || {};

  let y = drawHeader(doc, 'RELEVÉ DES NOTES', logoDataUrl);

  // ── Student Info Table ──
  y += 3;
  const infoH = 8;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.setFontSize(8);

  // Row 1: NOM ET PRENOM | N° d'inscription
  doc.setFillColor(230, 230, 245);
  doc.rect(margin, y, tableW * 0.5, infoH, 'FD');
  doc.rect(margin + tableW * 0.5, y, tableW * 0.25, infoH, 'FD');
  doc.rect(margin + tableW * 0.75, y, tableW * 0.25, infoH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('NOM ET PRENOM :', margin + 2, y + 5.5);
  doc.setFont('helvetica', 'normal');
  const fullName = `${(student.lastName || '').toUpperCase()} ${student.firstName || ''}`.trim();
  if (fullName.length > 20) {
    const mid = Math.floor(fullName.length / 2);
    let splitIdx = fullName.indexOf(' ', mid);
    if (splitIdx === -1) splitIdx = fullName.lastIndexOf(' ', mid);
    if (splitIdx === -1) splitIdx = mid;
    doc.text(fullName.substring(0, splitIdx).trim(), margin + 38, y + 3.5);
    doc.text(fullName.substring(splitIdx).trim(), margin + 38, y + 7.5);
  } else {
    doc.text(fullName, margin + 38, y + 5.5);
  }
  doc.setFont('helvetica', 'bold');
  doc.text("N° d'inscription", margin + tableW * 0.5 + 2, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(student.regNo || '', margin + tableW * 0.75 + 2, y + 5.5);

  // Row 2: Classement | empty
  y += infoH;
  doc.setFillColor(230, 230, 245);
  doc.rect(margin, y, tableW * 0.5, infoH, 'FD');
  doc.rect(margin + tableW * 0.5, y, tableW * 0.5, infoH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text('Classement par ordre de mérite :', margin + 2, y + 5.5);

  // Row 3: FILIERE | Niveau
  y += infoH;
  doc.setFillColor(230, 230, 245);
  doc.rect(margin, y, tableW * 0.5, infoH, 'FD');
  doc.rect(margin + tableW * 0.5, y, tableW * 0.25, infoH, 'FD');
  doc.rect(margin + tableW * 0.75, y, tableW * 0.25, infoH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text('FILIERE :', margin + 2, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(student.major || '', margin + 20, y + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Niveau:', margin + tableW * 0.5 + 2, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(student.year || '', margin + tableW * 0.75 + 2, y + 5.5);

  // Year bar
  y += infoH;
  doc.setFillColor(210, 210, 230);
  doc.rect(margin, y, tableW, infoH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ANNEE DE FORMATION : 2025-2026', w / 2, y + 5.5, { align: 'center' });

  // ── Grades Table ──
  y += infoH + 2;
  const rH = 9;
  const c = [14, 62, 11, 20, 20, 20, 20, 23];
  const hdr = ['N° UF', 'Unité de formation', 'Coeff', 'Contrôles\ncontinus', 'EFCF\nthéorique', 'EFCF\nPratique', 'Moyenne\ngénérale', 'Appréciations des\nformateurs'];

  // Table header
  doc.setFillColor(210, 210, 230);
  let xP = margin;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  hdr.forEach((h, i) => {
    doc.setFillColor(210, 210, 230);
    doc.rect(xP, y, c[i], rH * 1.5, 'FD');
    const lines = h.split('\n');
    if (lines.length > 1) {
      doc.text(lines[0], xP + c[i] / 2, y + 5, { align: 'center' });
      doc.text(lines[1], xP + c[i] / 2, y + 9, { align: 'center' });
    } else {
      doc.text(h, xP + c[i] / 2, y + 7, { align: 'center' });
    }
    xP += c[i];
  });

  y += rH * 1.5;
  let totalWeighted = 0, totalCoeff = 0;
  let sumCC = 0, sumEFCFT = 0, sumEFCFP = 0, sumAvg = 0;
  let countCC = 0, countEFCFT = 0, countEFCFP = 0, countAvg = 0;

  modules.forEach((mod, idx) => {
    if (y > 265) { doc.addPage(); y = drawHeader(doc, 'RELEVÉ DES NOTES (Suite)', logoDataUrl); y += 10; }

    const g = grades[mod] || {};
    const { c1 = '', c2 = '', c3 = '', efcfp = '', efcft = '' } = g;
    const coeff = 2;

    let moyCC = null;
    if (c1 !== '' && c2 !== '') {
      const n1 = parseFloat(c1), n2 = parseFloat(c2);
      if (!isNaN(n1) && !isNaN(n2)) {
        const n3 = (c3 !== '' && c3 != null) ? parseFloat(c3) : NaN;
        moyCC = !isNaN(n3) ? (n1 + n2 + n3) / 3 : (n1 + n2) / 2;
        sumCC += moyCC; countCC++;
      }
    }

    const nP = efcfp !== '' ? parseFloat(efcfp) : NaN;
    const nT = efcft !== '' ? parseFloat(efcft) : NaN;
    if (!isNaN(nT)) { sumEFCFT += nT; countEFCFT++; }
    if (!isNaN(nP)) { sumEFCFP += nP; countEFCFP++; }

    let avg = null;
    if (moyCC !== null && !isNaN(nP) && !isNaN(nT)) {
      // New Formula: ((moyCC*3) + (EFCFT*2) + (EFCFP*3)) / 8
      avg = (moyCC * 3 + nT * 2 + nP * 3) / 8;
      totalWeighted += avg * coeff;
      totalCoeff += coeff;
      sumAvg += avg; countAvg++;
    }

    // Appreciation: Faible, Passable, A.Bien, Bien, T.bien, Excellent
    let appreciation = '';
    if (avg !== null) {
      if (avg >= 18) appreciation = 'Excellent';
      else if (avg >= 16) appreciation = 'T.Bien';
      else if (avg >= 14) appreciation = 'Bien';
      else if (avg >= 12) appreciation = 'A.Bien';
      else if (avg >= 10) appreciation = 'Passable';
      else appreciation = 'Faible';
    }

    // Alternate row color
    if (idx % 2 === 0) {
      doc.setFillColor(245, 245, 252);
      let rx = margin; c.forEach(cw => { doc.rect(rx, y, cw, rH, 'F'); rx += cw; });
    }

    xP = margin;
    c.forEach(cw => { doc.rect(xP, y, cw, rH); xP += cw; });

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    xP = margin;
    const ufNum = `UF ${(idx + 1).toString().padStart(1, '0')}.${idx + 1}`;
    doc.text(ufNum, xP + c[0] / 2, y + 6, { align: 'center' });
    xP += c[0];
    const dispMod = mod.length > 32 ? mod.substring(0, 30) + '…' : mod;
    doc.text(dispMod, xP + 1.5, y + 6);
    xP += c[1];
    doc.text(String(coeff), xP + c[2] / 2, y + 6, { align: 'center' });
    xP += c[2];
    doc.setFont('helvetica', 'bold');
    doc.text(moyCC !== null ? moyCC.toFixed(2) : '', xP + c[3] / 2, y + 6, { align: 'center' });
    xP += c[3];
    doc.text(!isNaN(nT) ? nT.toFixed(2) : '', xP + c[4] / 2, y + 6, { align: 'center' });
    xP += c[4];
    doc.text(!isNaN(nP) ? nP.toFixed(2) : '', xP + c[5] / 2, y + 6, { align: 'center' });
    xP += c[5];
    doc.text(avg !== null ? avg.toFixed(2) : '', xP + c[6] / 2, y + 6, { align: 'center' });
    xP += c[6];
    doc.setFont('helvetica', 'normal');
    doc.text(appreciation, xP + c[7] / 2, y + 6, { align: 'center' });

    y += rH;
  });

  // ── Moyennes pondérées row ──
  // ── Moyenne générale (Using the new global formula) ──
  // Formula: ((moyCC*3) + (avgEFCFT*2) + (avgEFCFP*3)) / 8
  const avgCC_num = countCC > 0 ? (sumCC / countCC) : 0;
  const avgEFCFT_num = countEFCFT > 0 ? (sumEFCFT / countEFCFT) : 0;
  const avgEFCFP_num = countEFCFP > 0 ? (sumEFCFP / countEFCFP) : 0;
  
  const finalAvgNum = (countAvg === modules.length && modules.length > 0) 
    ? ((avgCC_num * 3) + (avgEFCFT_num * 2) + (avgEFCFP_num * 3)) / 8 
    : 0;

  const finalAvg = (finalAvgNum > 0 && countAvg === modules.length) ? finalAvgNum.toFixed(2).replace('.', ',') : '—';
  const avgCC = countCC > 0 ? avgCC_num.toFixed(2) : '';
  const avgEFCFT = countEFCFT > 0 ? avgEFCFT_num.toFixed(2) : '';
  const avgEFCFP = countEFCFP > 0 ? avgEFCFP_num.toFixed(2) : '';
  const avgMoy = finalAvg;

  if (y > 265) { doc.addPage(); y = 40; }
  doc.setFillColor(230, 230, 245);
  const lblW = c[0] + c[1];
  doc.rect(margin, y, lblW, rH, 'FD'); // Label cell
  doc.rect(margin + lblW, y, c[2], rH, 'FD'); // Coeff cell
  doc.rect(margin + lblW + c[2], y, c[3], rH, 'FD'); // CC cell
  doc.rect(margin + lblW + c[2] + c[3], y, c[4], rH, 'FD'); // EFCFT cell
  doc.rect(margin + lblW + c[2] + c[3] + c[4], y, c[5], rH, 'FD'); // EFCFP cell
  doc.rect(margin + lblW + c[2] + c[3] + c[4] + c[5], y, c[6] + c[7], rH, 'FD'); // Final cell
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(`Moyennes pondérées`, margin + 2, y + 6);
  doc.text(String(totalCoeff || 0), margin + lblW + c[2] / 2, y + 6, { align: 'center' });
  doc.text(avgCC, margin + lblW + c[2] + c[3] / 2, y + 6, { align: 'center' });
  doc.text(avgEFCFT, margin + lblW + c[2] + c[3] + c[4] / 2, y + 6, { align: 'center' });
  doc.text(avgEFCFP, margin + lblW + c[2] + c[3] + c[4] + c[5] / 2, y + 6, { align: 'center' });
  doc.text(avgMoy, margin + lblW + c[2] + c[3] + c[4] + c[5] + (c[6] + c[7]) / 2, y + 6, { align: 'center' });

  y += rH;
  const fullLabelW = c[0] + c[1] + c[2] + c[3] + c[4] + c[5];
  const resultW = c[6] + c[7];
  
  doc.setFillColor(200, 210, 230);
  doc.rect(margin, y, fullLabelW, rH, 'FD');
  doc.rect(margin + fullLabelW, y, resultW, rH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Moyenne générale', margin + 2, y + 6);
  doc.setFontSize(10);
  doc.text(finalAvg, margin + fullLabelW + resultW / 2, y + 6.5, { align: 'center' });

  // ── Décision jury ──
  y += rH;
  const isPassed = totalCoeff > 0 && parseFloat(finalAvg.replace(',', '.')) >= 10;
  doc.setFillColor(220, 210, 240);
  doc.rect(margin, y, fullLabelW, rH, 'FD');
  doc.rect(margin + fullLabelW, y, resultW, rH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text("Décision jury d'examen", margin + 2, y + 6);
  doc.setTextColor(isPassed ? 0 : 200, isPassed ? 128 : 0, isPassed ? 0 : 0);
  doc.text(isPassed ? 'Admis(e)' : 'Ajourné(e)', margin + fullLabelW + resultW / 2, y + 6.5, { align: 'center' });
  doc.setTextColor(0);

  // ── Footer ──
  y += rH + 15;
  if (y > 275) { doc.addPage(); y = 40; }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text("Visa de l'administration", w / 2, y, { align: 'center' });

  const safeName = student.lastName.replace(/[^a-z0-9]/gi, '_');
  doc.save(`Releve_Notes_${safeName}_${student.regNo.replace(/[^a-z0-9]/gi, '_')}.pdf`);
};


/* ════════════════════════════════════════════════════════════════════
 *  4. NOTE D'OBTENTION DE DIPLÔME
 * ════════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════
 *  4. NOTE D'OBTENTION DE DIPLÔME
 * ════════════════════════════════════════════════════════════════════ */
export const generateNoteObtentionDiplome = async (student, allGrades, modules) => {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const margin = 20;
  const grades = allGrades[student.id] || {};

  let y = drawHeader(doc, "Notes d'obtention de diplôme", logoDataUrl);

  // ── Student Info Blocks (Light Blue) ──
  y += 5;
  const iH = 9;
  const cL = 60, cR = (w - margin * 2 - cL) / 2;
  const lightBlue = [218, 235, 245];

  // Block: Nom et prénom | Année de formation
  doc.setFillColor(...lightBlue);
  doc.rect(margin, y, cL, iH, 'F');
  doc.rect(margin + cL + 10, y, cR - 10, iH, 'F');
  doc.rect(margin + cL + cR + 10, y, cR - 10, iH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text('Nom et prénom :', margin + 2, y + 6);
  doc.setFont('helvetica', 'normal');
  //const lastname = student.lastName && student.major.length > 30 ? student.major.substring(0, 25) + '…' : (student.major || '');
  //const name = student.lastName.length + student.firstName.length > 30 ? margin += 40 : margin;
  //const firstname =student.lastName && student.major.length > 30 ? student.major.substring(0, 25) + '…' : (student.major || '');
  const fullName = `${(student.lastName || '').toUpperCase()} ${student.firstName || ''}`.trim();
  if (fullName.length > 20) {
    doc.setFontSize(6.5);
    const splitName = doc.splitTextToSize(fullName, 34);
    doc.text(splitName[0] || '', margin + 25, y + 4);
    doc.text(splitName.slice(1).join(' '), margin + 25, y + 7.5);
  } else {
    doc.setFontSize(8);
    doc.text(fullName, margin + 25, y + 6);
  }
  doc.setFontSize(8); // Restore for next blocks

  doc.setFont('helvetica', 'bold');
  doc.text('Année de formation', margin + cL + 12, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text('2024-2025', margin + cL + cR + 12, y + 6);

  // Block: Filière | N° d'inscription
  doc.setFillColor(...lightBlue);
  y += iH + 4;
  doc.rect(margin, y, cL, iH * 1.5, 'F');
  doc.rect(margin + cL + 10, y, cR - 10, iH, 'F');
  doc.rect(margin + cL + cR + 10, y, cR - 10, iH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.text('Filière :', margin + 2, y + 6);
  doc.setFont('helvetica', 'normal');
  const dispMajor = student.major && student.major.length > 30 ? student.major.substring(0, 25) + '…' : (student.major || '');
  doc.text(dispMajor, margin + 14, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text("N° d'inscription", margin + cL + 12, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(student.regNo || '', margin + cL + cR + 12, y + 6);

  // Block: Niveau
  doc.setFillColor(...lightBlue);
  y += iH + 4;
  doc.rect(margin + cL + 10, y, cR - 10, iH, 'F');
  doc.rect(margin + cL + cR + 10, y, cR - 10, iH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Niveau', margin + cL + 12, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(student.year || '', margin + cL + cR + 12, y + 6);

  // ── Compute averages ──
  let sumCC = 0, sumEFCFT = 0, sumEFCFP = 0, cnt = 0;
  modules.forEach(mod => {
    const g = grades[mod] || {};
    const { c1, c2, c3, efcfp, efcft } = g;
    if (c1 && c2 && efcfp && efcft) {
      const n1 = parseFloat(c1), n2 = parseFloat(c2);
      const n3 = c3 ? parseFloat(c3) : null;
      const moyCC = n3 !== null && !isNaN(n3) ? (n1 + n2 + n3) / 3 : (n1 + n2) / 2;
      sumCC += moyCC;
      sumEFCFT += parseFloat(efcft);
      sumEFCFP += parseFloat(efcfp);
      cnt++;
    }
  });
  const mCC = cnt > 0 ? (sumCC / cnt).toFixed(2) : '—';
  const mEFCFT = cnt > 0 ? (sumEFCFT / cnt).toFixed(2) : '—';
  const mEFCFP = cnt > 0 ? (sumEFCFP / cnt).toFixed(2) : '—';

  const firstYear = grades.firstYear || {};
  const fyCC = firstYear.moyCC ? parseFloat(firstYear.moyCC).toFixed(2) : '—';
  const fyEFCFT = firstYear.moyEFCFT ? parseFloat(firstYear.moyEFCFT).toFixed(2) : '—';
  const fyEFCFP = firstYear.moyEFCFP ? parseFloat(firstYear.moyEFCFP).toFixed(2) : '—';
  const nstiFinalAvg = firstYear.nsti ? parseFloat(firstYear.nsti).toFixed(2).replace('.', ',') : '—';

  // Average combined computation
  const calcAvgY = (cc, efcft, efcfp) => {
    if (cc === '—' || efcft === '—' || efcfp === '—') return null;
    return parseFloat(cc) * 0.4 + ((parseFloat(efcfp) + parseFloat(efcft)) / 2) * 0.6;
  };

  const avgY1 = calcAvgY(fyCC, fyEFCFT, fyEFCFP);
  const avgY2 = calcAvgY(mCC, mEFCFT, mEFCFP);

  const combinedCC = (fyCC !== '—' && mCC !== '—') ? ((parseFloat(fyCC) + parseFloat(mCC)) / 2).toFixed(2) : '—';
  const combinedEFCFT = (fyEFCFT !== '—' && mEFCFT !== '—') ? ((parseFloat(fyEFCFT) + parseFloat(mEFCFT)) / 2).toFixed(2) : '—';
  const combinedEFCFP = (fyEFCFP !== '—' && mEFCFP !== '—') ? ((parseFloat(fyEFCFP) + parseFloat(mEFCFP)) / 2).toFixed(2) : '—';

  // ── Report Table ──
  y += iH + 15;
  const tblL = 75, colW = 22, nsti = 29;

  // Header blocks
  doc.setFillColor(...lightBlue);
  doc.rect(margin + tblL + 5, y, colW, 12, 'F');
  doc.rect(margin + tblL + 5 + colW + 2, y, colW, 12, 'F');
  doc.rect(margin + tblL + 5 + colW * 2 + 4, y, colW, 12, 'F');
  doc.rect(margin + tblL + 5 + colW * 3 + 6, y, nsti, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Contrôles\nContinus', margin + tblL + 5 + colW / 2, y + 5, { align: 'center' });
  doc.text('EFCF\nThéorique', margin + tblL + 5 + colW + 2 + colW / 2, y + 5, { align: 'center' });
  doc.text('EFCF\nPratique', margin + tblL + 5 + colW * 2 + 4 + colW / 2, y + 5, { align: 'center' });
  doc.text('NSTI', margin + tblL + 5 + colW * 3 + 6 + nsti / 2, y + 7, { align: 'center' });

  // 1st year row (dummy text to match template)
  y += 15;
  doc.setFillColor(...lightBlue);
  doc.rect(margin, y, tblL, 10, 'F');
  doc.rect(margin + tblL + 5, y, colW, 10, 'S');
  doc.rect(margin + tblL + 5 + colW + 2, y, colW, 10, 'S');
  doc.rect(margin + tblL + 5 + colW * 2 + 4, y, colW, 10, 'S');
  doc.rect(margin + tblL + 5 + colW * 3 + 6, y, nsti, 22, 'S'); // Spans two rows

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text("Moyenne des notes obtenues en 1ère année", margin + 2, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(fyCC, margin + tblL + 5 + colW / 2, y + 6, { align: 'center' });
  doc.text(fyEFCFT, margin + tblL + 5 + colW + 2 + colW / 2, y + 6, { align: 'center' });
  doc.text(fyEFCFP, margin + tblL + 5 + colW * 2 + 4 + colW / 2, y + 6, { align: 'center' });

  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text("Note Globale\nattribuée à la\nsoutenance des\ntravaux individuels\nde formation", margin + tblL + 5 + colW * 3 + 6 + nsti / 2, y + 6, { align: 'center' });

  // 2nd year row
  y += 12;
  doc.setFillColor(...lightBlue);
  doc.rect(margin, y, tblL, 10, 'F');
  doc.rect(margin + tblL + 5, y, colW, 10, 'S');
  doc.rect(margin + tblL + 5 + colW + 2, y, colW, 10, 'S');
  doc.rect(margin + tblL + 5 + colW * 2 + 4, y, colW, 10, 'S');

  doc.setFontSize(8);
  doc.text("Moyenne des notes obtenues en 2ème année", margin + 2, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(mCC, margin + tblL + 5 + colW / 2, y + 6, { align: 'center' });
  doc.text(mEFCFT, margin + tblL + 5 + colW + 2 + colW / 2, y + 6, { align: 'center' });
  doc.text(mEFCFP, margin + tblL + 5 + colW * 2 + 4 + colW / 2, y + 6, { align: 'center' });

  // Combined row
  y += 14;
  doc.setFillColor(...lightBlue);
  doc.rect(margin, y, tblL, 10, 'F');
  doc.rect(margin + tblL + 5, y, colW, 10, 'S');
  doc.rect(margin + tblL + 5 + colW + 2, y, colW, 10, 'S');
  doc.rect(margin + tblL + 5 + colW * 2 + 4, y, colW, 10, 'S');
  doc.rect(margin + tblL + 5 + colW * 3 + 6, y, nsti, 10, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text("Moyenne des notes 1ère année + 2ème année", margin + 2, y + 6);
  doc.setFontSize(9);
  doc.text(combinedCC, margin + tblL + 5 + colW / 2, y + 6, { align: 'center' });
  doc.text(combinedEFCFT, margin + tblL + 5 + colW + 2 + colW / 2, y + 6, { align: 'center' });
  doc.text(combinedEFCFP, margin + tblL + 5 + colW * 2 + 4 + colW / 2, y + 6, { align: 'center' });
  doc.text(nstiFinalAvg, margin + tblL + 5 + colW * 3 + 6 + nsti / 2, y + 6, { align: 'center' });

  // ── Summary boxes ──
  y += 20;
  const boxLbl = 55, boxVal = 35, boxH = 10, gap = 6;

  // ── Compute averages (New Formula for 2 Years) ──
  // Formula: ((moyenne CC 2ans * 3) + (moyenne EFCFT 2ans * 2) + (moyenne EFCFP 2ans * 3) + nsti*2) / 10
  
  let finalAvgNum = null;
  if (combinedCC !== '—' && combinedEFCFT !== '—' && combinedEFCFP !== '—') {
    const cc2 = parseFloat(combinedCC);
    const ft2 = parseFloat(combinedEFCFT);
    const fp2 = parseFloat(combinedEFCFP);
    const nstiVal = (firstYear.nsti && firstYear.nsti !== '') ? parseFloat(firstYear.nsti) : 0;
    
    finalAvgNum = (cc2 * 3 + ft2 * 2 + fp2 * 3 + nstiVal * 2) / 10;
  }

  const finalAvg = finalAvgNum !== null ? finalAvgNum.toFixed(2).replace('.', ',') : '—';
  const isPassed = finalAvgNum !== null && finalAvgNum >= 10;

  let mention = '';
  if (finalAvgNum !== null) {
    const fa = parseFloat(finalAvgNum.toFixed(2));
    if (fa >= 18) mention = 'Excellent';
    else if (fa >= 16) mention = 'T.Bien';
    else if (fa >= 14) mention = 'Bien';
    else if (fa >= 12) mention = 'A.Bien';
    else if (fa >= 10) mention = 'Passable';
    else mention = 'Insuffisant';
  }

  const cx = margin + 30;
  const vx = cx + boxLbl + 10;

  // Moyenne Générale
  doc.rect(cx, y, boxLbl, boxH, 'S');
  doc.setFillColor(200, 200, 200); // Gray fill for values
  doc.rect(vx, y, boxVal, boxH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Moyenne Générale', cx + boxLbl / 2, y + 6.5, { align: 'center' });
  doc.setTextColor(0, 128, 0);
  doc.text(finalAvg, vx + boxVal / 2, y + 6.5, { align: 'center' });
  doc.setTextColor(0);

  // Décision
  y += boxH + gap;
  doc.rect(cx, y, boxLbl, boxH, 'S');
  doc.setFillColor(200, 200, 200);
  doc.rect(vx, y, boxVal, boxH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text('Décision', cx + boxLbl / 2, y + 6.5, { align: 'center' });
  doc.setTextColor(isPassed ? 0 : 200, isPassed ? 128 : 0, 0);
  doc.text(isPassed ? 'Admis' : 'Ajourné', vx + boxVal / 2, y + 6.5, { align: 'center' });
  doc.setTextColor(0);

  // Mention
  y += boxH + gap;
  doc.rect(cx, y, boxLbl, boxH, 'S');
  doc.setFillColor(200, 200, 200);
  doc.rect(vx, y, boxVal, boxH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text('Mention', cx + boxLbl / 2, y + 6.5, { align: 'center' });
  doc.setTextColor(0, 128, 0);
  doc.text(mention, vx + boxVal / 2, y + 6.5, { align: 'center' });
  doc.setTextColor(0);

  // Direction
  y += boxH + gap;
  doc.rect(cx, y, boxLbl, boxH, 'S');
  doc.rect(vx, y, boxVal, boxH, 'S');
  doc.setFont('helvetica', 'bold');
  doc.text('Direction', cx + boxLbl / 2, y + 6.5, { align: 'center' });
  doc.setTextColor(0, 128, 0);
  doc.text("P.E d'examens", vx + boxVal / 2, y + 6.5, { align: 'center' });
  doc.setTextColor(0);

  const safeName = student.lastName.replace(/[^a-z0-9]/gi, '_');
  doc.save(`Note_Obtention_Diplome_${safeName}.pdf`);
};
