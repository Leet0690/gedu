import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { MODULES_DATA, getStudyYearsForDiploma } from '../data/modules';
import EmptyState from '../components/EmptyState';
import { FilterSelect } from '../components/ui/FilterSelect';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell, PieChart, Pie, Legend
} from 'recharts';
import { isActiveStudent } from '../utils/studentStatus';
import {
  ChartLine, Users, TrendingUp, TrendingDown, Download,
  Award, AlertTriangle, ChevronUp, ChevronDown, Minus,
  CheckCircle, XCircle
} from 'lucide-react';
import {
  calcCcAverage,
  calcModuleAverage,
  calcStudentSynthesisAverages,
  getModuleCoefficient,
  parseScore,
} from '../utils/gradeCalculations';

const labelStyle = {
  fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em'
};

const KPICard = ({ label, value, sub, color = 'var(--primary)', icon: Icon, iconBg, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card reports-premium-kpi"
    style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}
  >
    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: iconBg || 'var(--primary-ultra-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={18} style={{ color }} />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: '900', color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</p>}
    </div>
  </motion.div>
);

const SortBtn = ({ label, field, sort, onSort }) => {
  const active = sort.startsWith(field);
  const asc = sort === `${field}_asc`;
  return (
    <button onClick={() => onSort(field)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '800', fontSize: 'var(--text-xs)', color: active ? 'var(--primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: 0 }}>
      {label}
      {active ? (asc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <Minus size={10} style={{ opacity: 0.3 }} />}
    </button>
  );
};

const CustomDonutLabel = ({ cx, cy, value, label }) => (
  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
    <tspan x={cx} dy="-6" fontSize="22" fontWeight="900" fill="var(--text-primary)">{value}</tspan>
    <tspan x={cx} dy="18" fontSize="10" fontWeight="700" fill="var(--text-muted)">{label}</tspan>
  </text>
);

const gradeModuleKey = (moduleName = '') => moduleName.replace(/\./g, '_');

const formatExcelScore = (value) => value === null ? '—' : value.toFixed(2);

const formatCoefficient = (value) => {
  const coefficient = Number(value);
  if (Number.isNaN(coefficient)) return '';
  return Number.isInteger(coefficient) ? String(coefficient) : String(coefficient);
};

const getStudyYearNumber = (year = '') =>
  String(year).includes('2') ? 2 : 1;

const getModuleExportCode = (module, index, year) =>
  module?.code || module?.moduleCode || module?.uf || module?.reference || `UF-${getStudyYearNumber(year)}.${String(index + 1).padStart(2, '0')}`;

const getJuryDecision = (average) => {
  if (average === null) return 'Redoublant(e)';
  if (average < 8) return 'Redoublant(e)';
  if (average < 10) return 'Racheté(e)';
  return 'Admis(e)';
};

const escapeHtml = (value = '') =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeFileNamePart = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'classe';

const getCurrentProfessionalYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
};

const getAutoExcelColumnWidth = (values, { min = 44, max = 260, charWidth = 7, padding = 18 } = {}) => {
  const longest = values.reduce((maxLength, value) => {
    const text = String(value ?? '').trim();
    const weightedLength = Array.from(text).reduce((length, char) => {
      const isWideChar = char.charCodeAt(0) > 255;
      return length + (isWideChar ? 1.15 : 1);
    }, 0);
    return Math.max(maxLength, weightedLength);
  }, 0);

  return Math.min(max, Math.max(min, Math.ceil((longest * charWidth) + padding)));
};

const A4_LANDSCAPE_PRINTABLE_WIDTH_PX = 1088;
const A4_LANDSCAPE_PRINTABLE_HEIGHT_PX = 710;
const EXCEL_HEADER_ROW_HEIGHT_PX = 24;
const EXCEL_HEADER_BOTTOM_MARGIN_PX = 12;
const EXCEL_TABLE_HEADER_ROW_HEIGHT_PX = 27;
const EXCEL_DATA_ROW_MIN_HEIGHT_PX = 22;
const EXCEL_SIGNATURE_SPACER_HEIGHT_PX = 14;
const EXCEL_SIGNATURE_LABEL_HEIGHT_PX = 24;
const EXCEL_SIGNATURE_AREA_HEIGHT_PX = 44;
const EXCEL_SIGNATURE_TOTAL_HEIGHT_PX =
  EXCEL_SIGNATURE_SPACER_HEIGHT_PX +
  EXCEL_SIGNATURE_LABEL_HEIGHT_PX +
  EXCEL_SIGNATURE_AREA_HEIGHT_PX;

const expandExcelColumnWidthsToTarget = (widths, targetWidth) => {
  const currentWidth = widths.reduce((sum, width) => sum + width, 0);
  if (currentWidth <= 0 || currentWidth >= targetWidth) return widths;

  const scale = targetWidth / currentWidth;
  const expandedWidths = widths.map(width => Math.round(width * scale));
  const roundingGap = Math.round(targetWidth - expandedWidths.reduce((sum, width) => sum + width, 0));

  if (roundingGap !== 0) {
    expandedWidths[expandedWidths.length - 1] += roundingGap;
  }

  return expandedWidths;
};

const getExcelPageColumnRanges = (columnWidths, pageWidth, pageCount) => {
  const ranges = [];
  let startCol = 1;
  let width = 0;

  columnWidths.forEach((columnWidth, index) => {
    const currentCol = index + 1;
    if (
      ranges.length < pageCount - 1 &&
      width > 0 &&
      width + columnWidth > pageWidth
    ) {
      ranges.push({ startCol, endCol: currentCol - 1 });
      startCol = currentCol;
      width = 0;
    }
    width += columnWidth;
  });

  ranges.push({ startCol, endCol: columnWidths.length });
  return ranges;
};

const getExcelRowHeights = (studentCount, targetHeight, extraFixedHeight = 0) => {
  const fixedHeight =
    (EXCEL_HEADER_ROW_HEIGHT_PX * 3) +
    EXCEL_HEADER_BOTTOM_MARGIN_PX +
    (EXCEL_TABLE_HEADER_ROW_HEIGHT_PX * 4) +
    extraFixedHeight;
  const availableStudentHeight = Math.max(0, targetHeight - fixedHeight);
  const studentRowHeight = studentCount > 0
    ? Math.max(EXCEL_DATA_ROW_MIN_HEIGHT_PX, Math.floor(availableStudentHeight / studentCount))
    : EXCEL_DATA_ROW_MIN_HEIGHT_PX;

  return {
    headerRowHeight: EXCEL_HEADER_ROW_HEIGHT_PX,
    tableHeaderRowHeight: EXCEL_TABLE_HEADER_ROW_HEIGHT_PX,
    studentRowHeight,
    signatureSpacerRowHeight: EXCEL_SIGNATURE_SPACER_HEIGHT_PX,
    signatureLabelRowHeight: EXCEL_SIGNATURE_LABEL_HEIGHT_PX,
    signatureAreaRowHeight: EXCEL_SIGNATURE_AREA_HEIGHT_PX,
  };
};

const columnName = (index) => {
  let name = '';
  let n = index;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};

const pxToExcelWidth = (px) => Math.max(4, Math.round((px / 7) * 100) / 100);
const pxToPoints = (px) => Math.round(px * 0.75 * 100) / 100;
const escapeSheetNameForFormula = (value = '') => String(value || '').replace(/'/g, "''");

const xlsxStyleId = {
  title: 1,
  subtitle: 2,
  header: 3,
  text: 4,
  number: 5,
  strongNumber: 6,
  strongText: 7,
  signature: 8,
};

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
};

const getDosDateTime = (date = new Date()) => {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
};

const createZipBlob = (files) => {
  const encoder = new TextEncoder();
  const now = getDosDateTime();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  const writeHeader = (length) => {
    const bytes = new Uint8Array(length);
    const view = new DataView(bytes.buffer);
    return { bytes, view };
  };

  files.forEach(({ name, content }) => {
    const nameBytes = encoder.encode(name);
    const contentBytes = typeof content === 'string' ? encoder.encode(content) : content;
    const fileCrc = crc32(contentBytes);

    const local = writeHeader(30 + nameBytes.length);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0, true);
    local.view.setUint16(8, 0, true);
    local.view.setUint16(10, now.dosTime, true);
    local.view.setUint16(12, now.dosDate, true);
    local.view.setUint32(14, fileCrc, true);
    local.view.setUint32(18, contentBytes.length, true);
    local.view.setUint32(22, contentBytes.length, true);
    local.view.setUint16(26, nameBytes.length, true);
    local.view.setUint16(28, 0, true);
    local.bytes.set(nameBytes, 30);
    localParts.push(local.bytes, contentBytes);

    const central = writeHeader(46 + nameBytes.length);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0, true);
    central.view.setUint16(10, 0, true);
    central.view.setUint16(12, now.dosTime, true);
    central.view.setUint16(14, now.dosDate, true);
    central.view.setUint32(16, fileCrc, true);
    central.view.setUint32(20, contentBytes.length, true);
    central.view.setUint32(24, contentBytes.length, true);
    central.view.setUint16(28, nameBytes.length, true);
    central.view.setUint16(30, 0, true);
    central.view.setUint16(32, 0, true);
    central.view.setUint16(34, 0, true);
    central.view.setUint16(36, 0, true);
    central.view.setUint32(38, 0, true);
    central.view.setUint32(42, offset, true);
    central.bytes.set(nameBytes, 46);
    centralParts.push(central.bytes);

    offset += local.bytes.length + contentBytes.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = writeHeader(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, files.length, true);
  end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, end.bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

const buildXlsxBlob = ({
  rows,
  merges,
  columnWidths,
  rowHeights,
  footerText,
  printWidthPages,
  printHeightPages,
  repeatTitleRows = [1, 3],
  sheetName = 'Synthese des notes',
}) => {
  const lastColumn = columnName(columnWidths.length);
  const lastRow = rows.length;
  const escapedSheetName = escapeHtml(sheetName);
  const escapedFormulaSheetName = escapeHtml(escapeSheetNameForFormula(sheetName));
  const printTitleRowsXml = repeatTitleRows
    ? `<definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${escapedFormulaSheetName}'!$${repeatTitleRows[0]}:$${repeatTitleRows[1]}</definedName></definedNames>`
    : '';
  const colsXml = columnWidths.map((width, index) =>
    `<col min="${index + 1}" max="${index + 1}" width="${pxToExcelWidth(width)}" customWidth="1"/>`
  ).join('');
  const rowsXml = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const height = rowHeights[rowIndex];
    const heightAttributes = height ? ` ht="${pxToPoints(height)}" customHeight="1"` : '';
    const cellsXml = row.map((cell, colIndex) => {
      if (!cell) return '';
      const ref = `${columnName(colIndex + 1)}${rowNumber}`;
      const style = cell.style ? ` s="${xlsxStyleId[cell.style] ?? xlsxStyleId.text}"` : '';
      if (typeof cell.value === 'number') {
        return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"${style}><is><t>${escapeHtml(cell.value ?? '')}</t></is></c>`;
    }).join('');
    return `<row r="${rowNumber}"${heightAttributes}>${cellsXml}</row>`;
  }).join('');
  const mergeXml = merges.length > 0
    ? `<mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : '';
  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml}</sheetData>
  ${mergeXml}
  <printOptions horizontalCentered="1"/>
  <pageMargins left="0.18" right="0.18" top="0.25" bottom="0.25" header="0.12" footer="0.18"/>
  <pageSetup paperSize="9" orientation="landscape" fitToWidth="${printWidthPages}" fitToHeight="${printHeightPages}"/>
  <headerFooter><oddFooter>${escapeHtml(footerText)}</oddFooter></headerFooter>
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><color theme="1"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="11"/><color theme="1"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="15"/><color theme="1"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="13"/><color theme="1"/><name val="Arial"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEDE9FE"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD9D9D9"/></left>
      <right style="thin"><color rgb="FFD9D9D9"/></right>
      <top style="thin"><color rgb="FFD9D9D9"/></top>
      <bottom style="thin"><color rgb="FFD9D9D9"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="2" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;

  return createZipBlob([
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    },
    {
      name: 'docProps/app.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>IPFP</Application>
</Properties>`,
    },
    {
      name: 'docProps/core.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>IPFP</dc:creator>
  <dc:title>${escapedSheetName}</dc:title>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`,
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapedSheetName}" sheetId="1" r:id="rId1"/></sheets>
  ${printTitleRowsXml}
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml },
  ]);
};

const Reports = () => {
  const {
    students = [], grades = {}, modules: allModules = [],
    studentAttendance = [], loadStudentAttendanceForMonth
  } = useApp() || {};

  const [selectedDiploma, setSelectedDiploma] = useState(Object.keys(MODULES_DATA)[0]);
  const [selectedMajor, setSelectedMajor] = useState('');
  const [selectedYear, setSelectedYear] = useState('1ère année');
  const [selectedModule, setSelectedModule] = useState('');
  const [rankSort, setRankSort] = useState('avg_desc');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const activeStudents = useMemo(() => (students || []).filter(isActiveStudent), [students]);

  useEffect(() => {
    if (loadStudentAttendanceForMonth) {
      const now = new Date();
      loadStudentAttendanceForMonth(now.getMonth(), now.getFullYear());
    }
  }, [loadStudentAttendanceForMonth]);

  const availableMajors = useMemo(() =>
    selectedDiploma ? Object.keys(MODULES_DATA[selectedDiploma] || {}) : [],
    [selectedDiploma]
  );
  const availableStudyYears = useMemo(() => getStudyYearsForDiploma(selectedDiploma), [selectedDiploma]);

  const availableModulesList = useMemo(() => {
    if (!selectedDiploma || !selectedMajor || !selectedYear) return [];
    return allModules.filter(m =>
      m.diploma === selectedDiploma &&
      m.major === selectedMajor &&
      m.year === selectedYear
    );
  }, [selectedDiploma, selectedMajor, selectedYear, allModules]);

  const availableModules = useMemo(() => availableModulesList.map(m => m.name), [availableModulesList]);

  useEffect(() => {
    if (availableMajors.length > 0 && !availableMajors.includes(selectedMajor))
      setSelectedMajor(availableMajors[0]);
  }, [availableMajors, selectedMajor]);

  useEffect(() => {
    if (availableModules.length > 0 && !availableModules.includes(selectedModule))
      setSelectedModule(availableModules[0]);
    else if (availableModules.length === 0 && selectedModule)
      setSelectedModule('');
  }, [availableModules, selectedModule]);

  const analytics = useMemo(() => {
    const filteredStudents = activeStudents.filter(s =>
      s.diploma === selectedDiploma && s.major === selectedMajor && s.year === selectedYear
    );

    const getModuleScore = (studentId, modName) => {
      const g = grades[studentId]?.[modName.replace(/\./g, '_')];
      if (!g) return null;
      const ccAverage = calcCcAverage(g);
      const efcfp = parseFloat(g.efcfp), efcft = parseFloat(g.efcft);
      const moduleAverage = calcModuleAverage({
        ccAverage,
        theoretical: Number.isNaN(efcft) ? null : efcft,
        practical: Number.isNaN(efcfp) ? null : efcfp,
      });
      if (moduleAverage !== null) return moduleAverage;
      if (!isNaN(efcfp) && !isNaN(efcft)) return (efcfp + efcft) / 2;
      const c1 = parseFloat(g.c1), c2 = parseFloat(g.c2), c3 = parseFloat(g.c3);
      const vals = [c1, c2, c3].filter(v => !isNaN(v));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const computeWeightedAvg = (studentId) => {
      let totalWeight = 0, totalScore = 0;
      availableModulesList.forEach(({ name, coefficient }) => {
        const score = getModuleScore(studentId, name);
        if (score !== null) {
          const weight = getModuleCoefficient({ coefficient });
          totalScore += score * weight;
          totalWeight += weight;
        }
      });
      return totalWeight > 0 ? totalScore / totalWeight : null;
    };

    const studentRankings = filteredStudents.map(s => {
      const avg = computeWeightedAvg(s.id);
      const sAtt = studentAttendance.filter(a => a.studentId === s.id);
      const absences = sAtt.filter(a => a.status === 'absent').length;
      const absenceRate = sAtt.length > 0 ? Math.round((absences / sAtt.length) * 100) : null;
      return { ...s, avg, absenceRate };
    });

    const toggleSort = (field) => {
      setRankSort(prev => prev === `${field}_desc` ? `${field}_asc` : `${field}_desc`);
    };

    // Module progression for selected module
    let avgC1 = 0, avgC2 = 0, avgC3 = 0, avgEFC = 0;
    let countC1 = 0, countC2 = 0, countC3 = 0, countEFC = 0;
    filteredStudents.forEach(s => {
      const g = grades[s.id]?.[selectedModule.replace(/\./g, '_')];
      if (g) {
        if (g.c1 && !isNaN(parseFloat(g.c1))) { avgC1 += parseFloat(g.c1); countC1++; }
        if (g.c2 && !isNaN(parseFloat(g.c2))) { avgC2 += parseFloat(g.c2); countC2++; }
        if (g.c3 && !isNaN(parseFloat(g.c3))) { avgC3 += parseFloat(g.c3); countC3++; }
        const efcfp = parseFloat(g.efcfp), efcft = parseFloat(g.efcft);
        if (!isNaN(efcfp) && !isNaN(efcft)) { avgEFC += (efcfp + efcft) / 2; countEFC++; }
      }
    });
    const progressionData = [
      { name: 'C1', val: countC1 > 0 ? parseFloat((avgC1 / countC1).toFixed(2)) : 0 },
      { name: 'C2', val: countC2 > 0 ? parseFloat((avgC2 / countC2).toFixed(2)) : 0 },
      ...(countC3 > 0 ? [{ name: 'C3', val: parseFloat((avgC3 / countC3).toFixed(2)) }] : []),
      { name: 'EFC', val: countEFC > 0 ? parseFloat((avgEFC / countEFC).toFixed(2)) : 0 },
    ];

    // Global module comparison
    const globalModuleData = availableModules.map(mod => {
      let total = 0, count = 0;
      filteredStudents.forEach(s => {
        const score = getModuleScore(s.id, mod);
        if (score !== null) { total += score; count++; }
      });
      return {
        name: mod.length > 22 ? mod.substring(0, 22) + '…' : mod,
        fullName: mod,
        moyenne: count > 0 ? parseFloat((total / count).toFixed(2)) : 0
      };
    }).sort((a, b) => b.moyenne - a.moyenne);

    const studentsWithAvg = studentRankings.filter(s => s.avg !== null);
    const classAvg = studentsWithAvg.length > 0
      ? studentsWithAvg.reduce((sum, s) => sum + s.avg, 0) / studentsWithAvg.length
      : null;
    const passCount = studentsWithAvg.filter(s => s.avg >= 10).length;
    const failCount = studentsWithAvg.filter(s => s.avg < 10).length;

    const donutData = [
      { name: `Admis (≥10)`, value: passCount, color: '#16a34a' },
      { name: `Non admis (<10)`, value: failCount, color: '#dc2626' },
    ];

    return {
      progressionData, globalModuleData, donutData,
      filteredStudentsCount: filteredStudents.length,
      studentRankings,
      toggleSort,
      classAvg,
      passCount,
      failCount,
      bestModule: globalModuleData[0] || null,
      worstModule: globalModuleData[globalModuleData.length - 1] || null,
    };
  }, [activeStudents, grades, selectedDiploma, selectedMajor, selectedYear, selectedModule, availableModules, availableModulesList, studentAttendance]);

  const sortedRankings = useMemo(() => {
    const copy = [...(analytics.studentRankings || [])];
    if (rankSort === 'avg_desc') return copy.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
    if (rankSort === 'avg_asc') return copy.sort((a, b) => (a.avg ?? -1) - (b.avg ?? -1));
    if (rankSort === 'name_asc') return copy.sort((a, b) => {
      const nameA = a.lastName ? `${a.lastName} ${a.firstName}` : (a.name || '');
      const nameB = b.lastName ? `${b.lastName} ${b.firstName}` : (b.name || '');
      return nameA.localeCompare(nameB);
    });
    if (rankSort === 'name_desc') return copy.sort((a, b) => {
      const nameA = a.lastName ? `${a.lastName} ${a.firstName}` : (a.name || '');
      const nameB = b.lastName ? `${b.lastName} ${b.firstName}` : (b.name || '');
      return nameB.localeCompare(nameA);
    });
    if (rankSort === 'abs_desc') return copy.sort((a, b) => (b.absenceRate ?? -1) - (a.absenceRate ?? -1));
    if (rankSort === 'abs_asc') return copy.sort((a, b) => (a.absenceRate ?? -1) - (b.absenceRate ?? -1));
    return copy;
  }, [analytics.studentRankings, rankSort]);

  const handleSortToggle = (field) => {
    setRankSort(prev => prev === `${field}_desc` ? `${field}_asc` : `${field}_desc`);
  };

  const hasAttendanceData = studentAttendance.length > 0;

  const allReportGroups = useMemo(() => {
    const groups = new Map();
    const addGroup = ({ diploma, major, year }) => {
      if (!diploma || !major || !year) return;
      const key = `${diploma}__${major}__${year}`;
      if (!groups.has(key)) groups.set(key, { diploma, major, year });
    };

    activeStudents.forEach(addGroup);
    allModules.forEach(addGroup);

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        studentsCount: activeStudents.filter(s => s.diploma === group.diploma && s.major === group.major && s.year === group.year).length,
        modulesCount: allModules.filter(m => m.diploma === group.diploma && m.major === group.major && m.year === group.year).length,
      }))
      .sort((a, b) => `${a.diploma} ${a.major} ${a.year}`.localeCompare(`${b.diploma} ${b.major} ${b.year}`));
  }, [activeStudents, allModules]);

  const getReportModuleDetails = useCallback((studentId, moduleName) => {
    const g = grades[studentId]?.[gradeModuleKey(moduleName)];
    const c1 = parseScore(g?.c1);
    const c2 = parseScore(g?.c2);
    const c3 = parseScore(g?.c3);
    const efcfp = parseScore(g?.efcfp);
    const efcft = parseScore(g?.efcft);
    const ccAverage = calcCcAverage(g);
    const moduleAverage = calcModuleAverage({
      ccAverage,
      theoretical: efcft,
      practical: efcfp,
    });
    let score = null;

    if (moduleAverage !== null) {
      score = moduleAverage;
    } else if (efcfp !== null && efcft !== null) {
      score = (efcfp + efcft) / 2;
    } else {
      const vals = [c1, c2, c3].filter(v => v !== null);
      score = vals.length > 0 ? vals.reduce((sum, val) => sum + val, 0) / vals.length : null;
    }

    return { c1, c2, c3, efcfp, efcft, ccAverage, score };
  }, [grades]);

  const getGroupModules = useCallback((group) => {
    const modulesMap = new Map();
    allModules
      .filter(m => m.diploma === group.diploma && m.major === group.major && m.year === group.year)
      .forEach(module => {
        if (!modulesMap.has(module.name)) modulesMap.set(module.name, module);
      });
    return Array.from(modulesMap.values());
  }, [allModules]);

  const getGroupStudents = useCallback((group) =>
    activeStudents.filter(s => s.diploma === group.diploma && s.major === group.major && s.year === group.year),
  [activeStudents]);

  const buildGroupStats = useCallback((group) => {
    const groupStudents = getGroupStudents(group);
    const groupModules = getGroupModules(group);

    const rankings = groupStudents.map(student => {
      let totalWeight = 0;
      let totalScore = 0;

      groupModules.forEach(module => {
        const { score } = getReportModuleDetails(student.id, module.name);
        if (score !== null) {
          const weight = getModuleCoefficient(module);
          totalScore += score * weight;
          totalWeight += weight;
        }
      });

      const studentMonthAttendance = studentAttendance.filter(a => a.studentId === student.id);
      const absences = studentMonthAttendance.filter(a => a.status === 'absent').length;

      return {
        student,
        avg: totalWeight > 0 ? totalScore / totalWeight : null,
        absenceRate: studentMonthAttendance.length > 0 ? Math.round((absences / studentMonthAttendance.length) * 100) : null,
      };
    }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

    const rankedWithAvg = rankings.filter(item => item.avg !== null);
    const classAvg = rankedWithAvg.length > 0
      ? rankedWithAvg.reduce((sum, item) => sum + item.avg, 0) / rankedWithAvg.length
      : null;

    const moduleStats = groupModules.map(module => {
      const scores = groupStudents
        .map(student => getReportModuleDetails(student.id, module.name).score)
        .filter(score => score !== null);
      const avg = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

      return {
        name: module.name,
        coefficient: module.coefficient || 1,
        enteredCount: scores.length,
        avg,
        passCount: scores.filter(score => score >= 10).length,
        failCount: scores.filter(score => score < 10).length,
      };
    }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

    return {
      group,
      students: groupStudents,
      modules: groupModules,
      rankings,
      moduleStats,
      classAvg,
      passCount: rankedWithAvg.filter(item => item.avg >= 10).length,
      failCount: rankedWithAvg.filter(item => item.avg < 10).length,
    };
  }, [getGroupModules, getGroupStudents, getReportModuleDetails, studentAttendance]);

  const buildModuleStats = useCallback((group, moduleName) => {
    const groupStudents = getGroupStudents(group);
    const moduleRows = groupStudents.map(student => {
      const details = getReportModuleDetails(student.id, moduleName);
      return { student, ...details };
    });
    const scoredRows = moduleRows.filter(row => row.score !== null);
    const avg = scoredRows.length > 0
      ? scoredRows.reduce((sum, row) => sum + row.score, 0) / scoredRows.length
      : null;

    return {
      group,
      moduleName,
      rows: moduleRows,
      avg,
      enteredCount: scoredRows.length,
      passCount: scoredRows.filter(row => row.score >= 10).length,
      failCount: scoredRows.filter(row => row.score < 10).length,
    };
  }, [getGroupStudents, getReportModuleDetails]);

  const getExcelModuleDetails = useCallback((studentId, moduleName) => {
    const grade = grades[studentId]?.[gradeModuleKey(moduleName)];
    const ccAverage = calcCcAverage(grade);
    const theoretical = parseScore(grade?.efcft);
    const practical = parseScore(grade?.efcfp);
    const moduleAverage = calcModuleAverage({ ccAverage, theoretical, practical });

    return { ccAverage, theoretical, practical, moduleAverage };
  }, [grades]);

  const handleExportClassExcel = useCallback(async () => {
    setIsExportingExcel(true);
    try {
      const group = { diploma: selectedDiploma, major: selectedMajor, year: selectedYear };
      const classStudents = getGroupStudents(group)
        .sort((a, b) => {
          const regCompare = String(a.regNo || '').localeCompare(String(b.regNo || ''), 'fr', { numeric: true, sensitivity: 'base' });
          if (regCompare !== 0) return regCompare;
          const nameA = `${a.lastName || ''} ${a.firstName || ''} ${a.name || ''}`.trim();
          const nameB = `${b.lastName || ''} ${b.firstName || ''} ${b.name || ''}`.trim();
          return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
        });
      const classModules = getGroupModules(group);

      if (classStudents.length === 0) return;

      const coefficientTotal = classModules.reduce((sum, module) => sum + getModuleCoefficient(module), 0);
      const averageHeaderTitle = `Moyennes générales de la ${selectedYear}`;
      const moduleExportColumns = classModules.map((module, index) => ({
        module,
        code: getModuleExportCode(module, index, selectedYear),
        coefficient: formatCoefficient(getModuleCoefficient(module)),
      }));
      const registrationHeader = `N° d'insc.`;
      const nameHeader = 'Nom et prénoms';
      const generalAverageHeader = 'Moyenne Générale';
      const decisionHeader = `Décision jury d'examen`;
      const registrationWidthValues = [registrationHeader];
      const nameWidthValues = [nameHeader];
      const moduleWidthValues = moduleExportColumns.map(({ coefficient }) => ({
        cc: ['CC', coefficient],
        theoretical: ['EFCFT', coefficient],
        practical: ['EFCFP', coefficient],
      }));
      const summaryWidthValues = {
        mcc: ['MCC1', formatCoefficient(coefficientTotal)],
        met: ['MET1', formatCoefficient(coefficientTotal)],
        mep: ['MEP1', formatCoefficient(coefficientTotal)],
        general: [generalAverageHeader, formatCoefficient(coefficientTotal)],
      };
      const decisionWidthValues = [decisionHeader, 'Admis(e)', 'Racheté(e)', 'Redoublant(e)'];

      const studentRows = classStudents.map((student) => {
        const registrationNumber = student.regNo || student.registrationNumber || student.matricule || student.id || '';
        const fullName = student.lastName || student.firstName
          ? `${student.lastName || ''} ${student.firstName || ''}`.trim()
          : (student.name || '');

        registrationWidthValues.push(registrationNumber);
        nameWidthValues.push(fullName);

        const moduleScores = moduleExportColumns.map(({ module }, moduleIndex) => {
          const details = getExcelModuleDetails(student.id, module.name);
          const ccLabel = formatExcelScore(details.ccAverage);
          const theoreticalLabel = formatExcelScore(details.theoretical);
          const practicalLabel = formatExcelScore(details.practical);

          moduleWidthValues[moduleIndex].cc.push(ccLabel);
          moduleWidthValues[moduleIndex].theoretical.push(theoreticalLabel);
          moduleWidthValues[moduleIndex].practical.push(practicalLabel);

          return {
            ccAverage: details.ccAverage,
            theoretical: details.theoretical,
            practical: details.practical,
          };
        });

        const { mcc, met, mep, generalAverage } = calcStudentSynthesisAverages(
          grades[student.id] || {},
          classModules
        );
        const juryDecision = getJuryDecision(generalAverage);
        const mccLabel = formatExcelScore(mcc);
        const metLabel = formatExcelScore(met);
        const mepLabel = formatExcelScore(mep);
        const generalAverageLabel = formatExcelScore(generalAverage);

        summaryWidthValues.mcc.push(mccLabel);
        summaryWidthValues.met.push(metLabel);
        summaryWidthValues.mep.push(mepLabel);
        summaryWidthValues.general.push(generalAverageLabel);
        decisionWidthValues.push(juryDecision);

        return {
          registrationNumber,
          fullName,
          moduleScores,
          mcc,
          met,
          mep,
          generalAverage,
          juryDecision,
        };
      });
      const moduleColumnWidths = moduleExportColumns.flatMap(({ module, code }, index) => {
        const mergedHeaderWidth = getAutoExcelColumnWidth([code, module.name], {
          min: 132,
          max: 300,
          charWidth: 6.4,
          padding: 24,
        });
        const minimumFromMergedHeader = Math.ceil(mergedHeaderWidth / 3);

        return [
          Math.max(minimumFromMergedHeader, getAutoExcelColumnWidth(moduleWidthValues[index].cc, { min: 44, max: 72, padding: 12 })),
          Math.max(minimumFromMergedHeader, getAutoExcelColumnWidth(moduleWidthValues[index].theoretical, { min: 54, max: 78, padding: 12 })),
          Math.max(minimumFromMergedHeader, getAutoExcelColumnWidth(moduleWidthValues[index].practical, { min: 54, max: 78, padding: 12 })),
        ];
      });
      const printWidthPages = 2;
      const printHeightPages = 1;
      const signatureLabels = ['Président', 'Membre professionnel', 'Formateur 1', 'Formateur 2', 'Formateur 3'];
      const rowHeights = getExcelRowHeights(
        classStudents.length,
        A4_LANDSCAPE_PRINTABLE_HEIGHT_PX * printHeightPages,
        EXCEL_SIGNATURE_TOTAL_HEIGHT_PX
      );
      const rawReportColumnWidths = [
        getAutoExcelColumnWidth(registrationWidthValues, { min: 74, max: 140, padding: 16 }),
        getAutoExcelColumnWidth(nameWidthValues, { min: 140, max: 280, padding: 18 }),
        ...moduleColumnWidths,
        getAutoExcelColumnWidth(summaryWidthValues.mcc, { min: 56, max: 78, padding: 12 }),
        getAutoExcelColumnWidth(summaryWidthValues.met, { min: 56, max: 78, padding: 12 }),
        getAutoExcelColumnWidth(summaryWidthValues.mep, { min: 56, max: 78, padding: 12 }),
        getAutoExcelColumnWidth(summaryWidthValues.general, { min: 96, max: 128, padding: 14 }),
        getAutoExcelColumnWidth(decisionWidthValues, { min: 128, max: 178, padding: 18 }),
      ];
      const reportColumnWidths = expandExcelColumnWidthsToTarget(
        rawReportColumnWidths,
        A4_LANDSCAPE_PRINTABLE_WIDTH_PX * printWidthPages
      );
      const reportColumnCount = 2 + (moduleExportColumns.length * 3) + 4 + 1;
      const pageColumnRanges = getExcelPageColumnRanges(
        reportColumnWidths,
        A4_LANDSCAPE_PRINTABLE_WIDTH_PX,
        printWidthPages
      );
      const professionalYear = getCurrentProfessionalYear();
      const rows = [];
      const rowHeightsPx = [];
      const merges = [];
      const makeRow = () => Array(reportColumnCount).fill(null);
      const setCell = (row, col, value, style = 'text') => {
        row[col - 1] = { value, style };
      };
      const toScoreCell = (value, style = 'number') => ({
        value: value === null ? '—' : Number(value.toFixed(2)),
        style,
      });
      const mergeRangeIfNeeded = (startCol, endCol, rowNumber) => {
        if (endCol > startCol) {
          merges.push(`${columnName(startCol)}${rowNumber}:${columnName(endCol)}${rowNumber}`);
        }
      };
      const addRepeatedPageTitleRow = (value, style) => {
        const rowNumber = rows.length + 1;
        const row = makeRow();
        pageColumnRanges.forEach(({ startCol, endCol }) => {
          setCell(row, startCol, value, style);
          mergeRangeIfNeeded(startCol, endCol, rowNumber);
        });
        rows.push(row);
        rowHeightsPx.push(rowHeights.headerRowHeight);
      };
      const addSignatureRows = () => {
        rows.push([]);
        rowHeightsPx.push(rowHeights.signatureSpacerRowHeight);

        const labelRowNumber = rows.length + 1;
        const areaRowNumber = labelRowNumber + 1;
        const labelRow = makeRow();
        const areaRow = makeRow();

        pageColumnRanges.forEach(({ startCol: pageStartCol, endCol: pageEndCol }) => {
          const pageColumnCount = pageEndCol - pageStartCol + 1;
          signatureLabels.forEach((label, index) => {
            const startCol = pageStartCol + Math.floor((index * pageColumnCount) / signatureLabels.length);
            const rawEndCol = pageStartCol + Math.floor(((index + 1) * pageColumnCount) / signatureLabels.length) - 1;
            const endCol = Math.max(startCol, Math.min(pageEndCol, rawEndCol));
            if (startCol > pageEndCol) return;
            setCell(labelRow, startCol, label, 'signature');
            mergeRangeIfNeeded(startCol, endCol, labelRowNumber);
            mergeRangeIfNeeded(startCol, endCol, areaRowNumber);
          });
        });

        rows.push(labelRow);
        rowHeightsPx.push(rowHeights.signatureLabelRowHeight);
        rows.push(areaRow);
        rowHeightsPx.push(rowHeights.signatureAreaRowHeight);
      };

      addRepeatedPageTitleRow('Synthèse des notes', 'title');
      addRepeatedPageTitleRow(`Filière: ${selectedDiploma} - ${selectedMajor} - ${selectedYear}`, 'subtitle');
      addRepeatedPageTitleRow(professionalYear, 'subtitle');

      rows.push([]);
      rowHeightsPx.push(EXCEL_HEADER_BOTTOM_MARGIN_PX);

      const tableStartRow = rows.length + 1;
      const moduleStartCol = 3;
      const averageStartCol = moduleStartCol + (moduleExportColumns.length * 3);
      const decisionCol = averageStartCol + 4;

      const headerRow1 = makeRow();
      setCell(headerRow1, 1, registrationHeader, 'header');
      setCell(headerRow1, 2, nameHeader, 'header');
      moduleExportColumns.forEach(({ code }, index) => {
        const startCol = moduleStartCol + (index * 3);
        setCell(headerRow1, startCol, code, 'header');
        merges.push(`${columnName(startCol)}${tableStartRow}:${columnName(startCol + 2)}${tableStartRow}`);
      });
      setCell(headerRow1, averageStartCol, averageHeaderTitle, 'header');
      setCell(headerRow1, decisionCol, decisionHeader, 'header');
      rows.push(headerRow1);
      rowHeightsPx.push(rowHeights.tableHeaderRowHeight);

      const headerRow2 = makeRow();
      moduleExportColumns.forEach(({ module }, index) => {
        const startCol = moduleStartCol + (index * 3);
        setCell(headerRow2, startCol, module.name, 'header');
        merges.push(`${columnName(startCol)}${tableStartRow + 1}:${columnName(startCol + 2)}${tableStartRow + 1}`);
      });
      rows.push(headerRow2);
      rowHeightsPx.push(rowHeights.tableHeaderRowHeight);

      const headerRow3 = makeRow();
      moduleExportColumns.forEach(({ coefficient }, index) => {
        const startCol = moduleStartCol + (index * 3);
        setCell(headerRow3, startCol, coefficient, 'header');
        setCell(headerRow3, startCol + 1, coefficient, 'header');
        setCell(headerRow3, startCol + 2, coefficient, 'header');
      });
      setCell(headerRow3, averageStartCol, formatCoefficient(coefficientTotal), 'header');
      merges.push(`${columnName(averageStartCol)}${tableStartRow + 2}:${columnName(averageStartCol + 3)}${tableStartRow + 2}`);
      rows.push(headerRow3);
      rowHeightsPx.push(rowHeights.tableHeaderRowHeight);

      const headerRow4 = makeRow();
      moduleExportColumns.forEach((_, index) => {
        const startCol = moduleStartCol + (index * 3);
        setCell(headerRow4, startCol, 'CC', 'header');
        setCell(headerRow4, startCol + 1, 'EFCFT', 'header');
        setCell(headerRow4, startCol + 2, 'EFCFP', 'header');
      });
      setCell(headerRow4, averageStartCol, 'MCC1', 'header');
      setCell(headerRow4, averageStartCol + 1, 'MET1', 'header');
      setCell(headerRow4, averageStartCol + 2, 'MEP1', 'header');
      setCell(headerRow4, averageStartCol + 3, generalAverageHeader, 'header');
      rows.push(headerRow4);
      rowHeightsPx.push(rowHeights.tableHeaderRowHeight);

      merges.push(`A${tableStartRow}:A${tableStartRow + 3}`);
      merges.push(`B${tableStartRow}:B${tableStartRow + 3}`);
      merges.push(`${columnName(averageStartCol)}${tableStartRow}:${columnName(averageStartCol + 3)}${tableStartRow + 1}`);
      merges.push(`${columnName(decisionCol)}${tableStartRow}:${columnName(decisionCol)}${tableStartRow + 3}`);

      studentRows.forEach((studentRow) => {
        const row = makeRow();
        setCell(row, 1, studentRow.registrationNumber, 'text');
        setCell(row, 2, studentRow.fullName, 'text');
        studentRow.moduleScores.forEach((scores, index) => {
          const startCol = moduleStartCol + (index * 3);
          row[startCol - 1] = toScoreCell(scores.ccAverage);
          row[startCol] = toScoreCell(scores.theoretical);
          row[startCol + 1] = toScoreCell(scores.practical);
        });
        row[averageStartCol - 1] = toScoreCell(studentRow.mcc, 'strongNumber');
        row[averageStartCol] = toScoreCell(studentRow.met, 'strongNumber');
        row[averageStartCol + 1] = toScoreCell(studentRow.mep, 'strongNumber');
        row[averageStartCol + 2] = toScoreCell(studentRow.generalAverage, 'strongNumber');
        setCell(row, decisionCol, studentRow.juryDecision, 'strongText');
        rows.push(row);
        rowHeightsPx.push(rowHeights.studentRowHeight);
      });

      addSignatureRows();

      const blob = buildXlsxBlob({
        rows,
        merges,
        columnWidths: reportColumnWidths,
        rowHeights: rowHeightsPx,
        footerText: '',
        printWidthPages,
        printHeightPages,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `synthese-des-notes-${safeFileNamePart(selectedMajor)}-${safeFileNamePart(selectedYear)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel export error', error);
    } finally {
      setIsExportingExcel(false);
    }
  }, [getExcelModuleDetails, getGroupModules, getGroupStudents, grades, selectedDiploma, selectedMajor, selectedYear]);

  const reportGroupStats = useMemo(() =>
    allReportGroups.map(group => buildGroupStats(group)),
  [allReportGroups, buildGroupStats]);

  const groupChartData = useMemo(() =>
    reportGroupStats.map(stats => ({
      name: `${stats.group.major} ${stats.group.year}`.replace('annÃ©e', '').trim(),
      fullName: `${stats.group.diploma} Â· ${stats.group.major} Â· ${stats.group.year}`,
      moyenne: stats.classAvg !== null ? parseFloat(stats.classAvg.toFixed(2)) : 0,
      stagiaires: stats.students.length,
      modules: stats.modules.length,
      admis: stats.passCount,
      nonAdmis: stats.failCount,
      hasAverage: stats.classAvg !== null,
    })).sort((a, b) => b.moyenne - a.moyenne),
  [reportGroupStats]);

  const moduleChartData = useMemo(() => {
    const group = { diploma: selectedDiploma, major: selectedMajor, year: selectedYear };
    return getGroupModules(group).map(module => {
      const stats = buildModuleStats(group, module.name);
      return {
        name: module.name.length > 18 ? `${module.name.substring(0, 18)}...` : module.name,
        fullName: module.name,
        moyenne: stats.avg !== null ? parseFloat(stats.avg.toFixed(2)) : 0,
        notes: stats.enteredCount,
        admis: stats.passCount,
        nonAdmis: stats.failCount,
        hasAverage: stats.avg !== null,
      };
    }).sort((a, b) => b.moyenne - a.moyenne);
  }, [buildModuleStats, getGroupModules, selectedDiploma, selectedMajor, selectedYear]);

  const globalChartStats = useMemo(() => {
    const rankedStudents = reportGroupStats.flatMap(stats => stats.rankings);
    const studentsWithAvg = rankedStudents.filter(item => item.avg !== null);
    const globalAvg = studentsWithAvg.length > 0
      ? studentsWithAvg.reduce((sum, item) => sum + item.avg, 0) / studentsWithAvg.length
      : null;
    const passCount = studentsWithAvg.filter(item => item.avg >= 10).length;
    const failCount = studentsWithAvg.filter(item => item.avg < 10).length;
    const moduleCount = reportGroupStats.reduce((sum, stats) => sum + stats.modules.length, 0);

    return {
      globalAvg,
      groupCount: reportGroupStats.length,
      studentCount: reportGroupStats.reduce((sum, stats) => sum + stats.students.length, 0),
      moduleCount,
      passCount,
      failCount,
      withoutGrades: Math.max(0, rankedStudents.length - studentsWithAvg.length),
    };
  }, [reportGroupStats]);

  const globalDonutData = useMemo(() => [
    { name: 'Admis', value: globalChartStats.passCount, color: '#16a34a' },
    { name: 'Non admis', value: globalChartStats.failCount, color: '#dc2626' },
    ...(globalChartStats.withoutGrades > 0 ? [{ name: 'Sans notes', value: globalChartStats.withoutGrades, color: '#94a3b8' }] : []),
  ].filter(item => item.value > 0), [globalChartStats]);

  const globalModuleChartData = useMemo(() =>
    reportGroupStats.flatMap(stats =>
      stats.moduleStats.map(module => ({
        name: module.name.length > 16 ? `${module.name.substring(0, 16)}...` : module.name,
        fullName: module.name,
        group: `${stats.group.major} ${stats.group.year}`,
        moyenne: module.avg !== null ? parseFloat(module.avg.toFixed(2)) : 0,
        notes: module.enteredCount,
      }))
    ).filter(module => module.notes > 0).sort((a, b) => b.moyenne - a.moyenne).slice(0, 10),
  [reportGroupStats]);

  const avgColor = analytics.classAvg === null ? 'var(--text-muted)'
    : analytics.classAvg >= 14 ? '#16a34a'
    : analytics.classAvg >= 10 ? '#d97706'
    : '#dc2626';

  return (
    <div className="section-padding reports-premium-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <header className="reports-premium-header">
        <div className="reports-premium-header-icon">
          <ChartLine size={24} />
        </div>
        <div className="reports-premium-header-copy">
          <span className="reports-premium-eyebrow">Pilotage académique</span>
          <h1>Analytique & Rapports</h1>
          <p>Suivi visuel des performances académiques et de la progression.</p>
        </div>
        <div className="reports-premium-header-orb" aria-hidden="true">
          <BarChart size={112} />
        </div>
      </header>

      {/* Filter bar */}
      <div className="glass-card reports-premium-filter-card" style={{ padding: 'var(--space-5)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle}>Niveau</label>
          <FilterSelect value={selectedDiploma} onChange={val => { setSelectedDiploma(val); setSelectedYear(getStudyYearsForDiploma(val)[0]); }} options={Object.keys(MODULES_DATA).map(d => ({ label: d, value: d }))} style={{ minWidth: '180px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle}>Filière</label>
          <FilterSelect value={selectedMajor} onChange={val => setSelectedMajor(val)} options={availableMajors.map(m => ({ label: m, value: m }))} style={{ minWidth: '200px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle}>Année</label>
          <FilterSelect value={selectedYear} onChange={val => setSelectedYear(val)} options={availableStudyYears.map(year => ({ label: year, value: year }))} />
        </div>
        <button
          onClick={handleExportClassExcel}
          disabled={isExportingExcel || analytics.filteredStudentsCount === 0}
          className="reports-excel-export-btn"
        >
          <span className="reports-excel-export-icon">
            <Download size={16} />
          </span>
          <span className="reports-excel-export-copy">
            <span>{isExportingExcel ? 'Génération…' : 'Synthèse des notes'}</span>
            <small>Exporter en Excel</small>
          </span>
        </button>
        
      </div>

      {/* Student ranking table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass-card reports-premium-ranking-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '800' }}>Classement des Stagiaires</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Moyenne pondérée par coefficient · {analytics.filteredStudentsCount} stagiaire{analytics.filteredStudentsCount !== 1 ? 's' : ''}</p>
          </div>
          {!hasAttendanceData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-faint)', background: 'var(--bg-subtle)', padding: '4px 10px', borderRadius: '20px' }}>
              <AlertTriangle size={10} /> Données présences non chargées
            </div>
          )}
        </div>

        {sortedRankings.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
            <Users size={28} style={{ opacity: 0.2, marginBottom: '8px' }} />
            <p>Aucun stagiaire dans ce groupe</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                <th style={{ padding: '10px 16px', width: '48px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>RG</span>
                </th>
                <th style={{ padding: '10px 16px' }}>
                  <SortBtn label="Nom & Prénom" field="name" sort={rankSort} onSort={handleSortToggle} />
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <SortBtn label="Moy. pond." field="avg" sort={rankSort} onSort={handleSortToggle} />
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Résultat</span>
                </th>
                {hasAttendanceData && (
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <SortBtn label="Absences" field="abs" sort={rankSort} onSort={handleSortToggle} />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedRankings.map((s, idx) => {
                const isPass = s.avg !== null && s.avg >= 10;
                const isMedal = idx < 3 && s.avg !== null;
                const medalColor = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#cd7f32';
                return (
                  <tr key={s.id} className="reports-premium-table-row" style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      {isMedal ? (
                        <Award size={15} style={{ color: medalColor }} />
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-faint)' }}>{idx + 1}</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <p style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                        {s.lastName ? `${s.lastName} ${s.firstName}` : (s.name || '—')}
                      </p>
                      {s.cin && <p style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '1px' }}>{s.cin}</p>}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      {s.avg !== null ? (
                        <span style={{
                          fontSize: '14px', fontWeight: '900',
                          color: s.avg >= 14 ? '#16a34a' : s.avg >= 10 ? '#d97706' : '#dc2626'
                        }}>
                          {s.avg.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      {s.avg !== null ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '800',
                          background: isPass ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)',
                          color: isPass ? '#16a34a' : '#dc2626',
                          border: `1px solid ${isPass ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.15)'}`,
                        }}>
                          {isPass ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {isPass ? 'Admis' : 'Non admis'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                    {hasAttendanceData && (
                      <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                        {s.absenceRate !== null ? (
                          <span style={{
                            fontSize: '12px', fontWeight: '800',
                            color: s.absenceRate > 30 ? '#dc2626' : s.absenceRate > 15 ? '#d97706' : '#16a34a'
                          }}>
                            {s.absenceRate}%
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>

      

      {/* KPI strip */}
      <div className="reports-premium-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
        <KPICard
          delay={0} label="Stagiaires" icon={Users}
          iconBg="rgba(99,102,241,0.08)" color="#6366f1"
          value={analytics.filteredStudentsCount}
          sub={`${selectedMajor} · ${selectedYear}`}
        />
        <KPICard
          delay={0.05} label="Moy. pondérée" icon={ChartLine}
          iconBg={analytics.classAvg === null ? 'var(--bg-subtle)' : analytics.classAvg >= 10 ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)'}
          color={avgColor}
          value={analytics.classAvg !== null ? analytics.classAvg.toFixed(2) + '/20' : '—'}
          sub={analytics.classAvg !== null ? (analytics.classAvg >= 10 ? 'Classe admissible' : 'Classe en difficulté') : 'Aucune note saisie'}
        />
        <KPICard
          delay={0.1} label="Meilleur module" icon={TrendingUp}
          iconBg="rgba(22,163,74,0.08)" color="#16a34a"
          value={analytics.bestModule ? analytics.bestModule.moyenne + '/20' : '—'}
          sub={analytics.bestModule?.fullName || ''}
        />
        <KPICard
          delay={0.15} label="Module à risque" icon={TrendingDown}
          iconBg="rgba(220,38,38,0.07)" color="#dc2626"
          value={analytics.worstModule ? analytics.worstModule.moyenne + '/20' : '—'}
          sub={analytics.worstModule?.fullName || ''}
        />
      </div>

      {/* Charts row */}
      <div className="reports-premium-chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-5)' }}>

        

        {/* Donut: Pass/fail */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card reports-premium-chart-card" style={{ padding: 'var(--space-6)', minHeight: '360px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '800' }}>Admis / Non admis</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Basé sur la moyenne pondérée</p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {analytics.filteredStudentsCount === 0 || (analytics.passCount + analytics.failCount) === 0 ? (
              <div style={{ color: 'var(--text-faint)', fontSize: '12px', textAlign: 'center' }}>
                <Award size={32} style={{ opacity: 0.2, marginBottom: '8px' }} />
                <p>Aucune donnée disponible</p>
              </div>
            ) : (
              <>
                <div style={{ height: '220px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.donutData}
                        cx="50%" cy="50%"
                        innerRadius={62} outerRadius={88}
                        paddingAngle={3}
                        dataKey="value"
                        startAngle={90} endAngle={-270}
                      >
                        {analytics.donutData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, name) => [v + ' stagiaire' + (v > 1 ? 's' : ''), name]} contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: 'var(--shadow-md)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                  {analytics.donutData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                        {d.name} — <span style={{ color: d.color }}>{d.value}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Bar: Inter-module comparison */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass-card reports-premium-chart-card" style={{ padding: 'var(--space-6)', minHeight: '360px' }}>
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: '800' }}>Comparatif Inter-Modules</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Classement par moyenne finale (pondérée)</p>
          </div>
          <div style={{ height: '270px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.globalModuleData.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" domain={[0, 20]} hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 9.5, fontWeight: 700, fill: 'var(--text-primary)' }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: 'var(--shadow-md)' }} formatter={(v, _, p) => [v + '/20', p.payload.fullName || '']} />
                <Bar dataKey="moyenne" radius={[0, 8, 8, 0]} barSize={16}>
                  {analytics.globalModuleData.slice(0, 8).map((entry, i) => (
                    <Cell key={i} fill={parseFloat(entry.moyenne) >= 10 ? 'var(--primary)' : 'var(--danger)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      
    </div>
  );
};

export default Reports;
