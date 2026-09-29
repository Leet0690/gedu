import { getScheduleModuleForSemester } from './scheduleSemester.js';

export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const START_HOUR = 8;
export const END_HOUR = 20; // 12 columns: 08:00 to 19:00 (spans 08:00 to 20:00)
export const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
export const EXPORT_WIDTH = 1600;
export const BACKGROUND = '#ffffff';

export const getDeterministicEventStyles = (moduleName = '') => {
  let hash = 0;
  const str = moduleName || 'non defini';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return {
    bg: `linear-gradient(135deg, hsla(${hue}, 85%, 96%, 0.95) 0%, hsla(${hue}, 85%, 98%, 0.8) 100%)`,
    border: `hsla(${hue}, 60%, 75%, 0.8)`,
    color: `hsl(${hue}, 60%, 40%)`,
    text: `hsl(${hue}, 70%, 20%)`,
    rail: `linear-gradient(90deg, hsl(${hue}, 75%, 48%) 0%, hsl(${hue}, 75%, 32%) 100%)`
  };
};

export const getDayColors = (day = '') => {
  const normalized = (day || '').trim().toLowerCase();
  if (normalized.includes('lun')) {
    return { bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.02) 100%)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.2)' };
  }
  if (normalized.includes('mar')) {
    return { bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)', text: '#059669', border: 'rgba(16, 185, 129, 0.2)' };
  }
  if (normalized.includes('mer')) {
    return { bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)', text: '#d97706', border: 'rgba(245, 158, 11, 0.2)' };
  }
  if (normalized.includes('jeu')) {
    return { bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.2)' };
  }
  if (normalized.includes('ven')) {
    return { bg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(244, 63, 94, 0.02) 100%)', text: '#e11d48', border: 'rgba(244, 63, 94, 0.2)' };
  }
  if (normalized.includes('sam')) {
    return { bg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(14, 165, 233, 0.02) 100%)', text: '#0284c7', border: 'rgba(14, 165, 233, 0.2)' };
  }
  return { bg: 'linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(20, 184, 166, 0.02) 100%)', text: '#0d9488', border: 'rgba(20, 184, 166, 0.2)' };
};

export const getHourColors = (hour) => {
  const hue = ((hour - 8) * 30) % 360;
  return {
    bg: `linear-gradient(180deg, hsla(${hue}, 85%, 97%, 0.95) 0%, hsla(${hue}, 85%, 99%, 0.7) 100%)`,
    text: `hsl(${hue}, 70%, 35%)`,
    border: `hsla(${hue}, 60%, 80%, 0.5)`,
    accent: `hsl(${hue}, 75%, 45%)`
  };
};

const element = (tag, style, text) => {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
};

export const normalizeTime = (time = '') => String(time).replace(/(\d{1,2})\s*[h:]\s*(\d{2})/gi,
  (_, hour, minute) => `${hour.padStart(2, '0')}:${minute}`);

export const parseTimeRange = (timeStr = '') => {
  const parts = String(timeStr).split('-');
  const normalize = (val) => {
    if (!val) return '08:00';
    const cleaned = val.replace(/h/gi, ':').trim();
    const segments = cleaned.split(':');
    const h = (segments[0] || '8').trim().padStart(2, '0');
    const m = (segments[1] || '00').trim().padStart(2, '0');
    return `${h}:${m}`;
  };

  if (parts.length >= 2) {
    return {
      start: normalize(parts[0]),
      end: normalize(parts[1])
    };
  }
  const start = normalize(parts[0]);
  const [h, m] = start.split(':').map(Number);
  const endH = String(Math.min(20, (h || 8) + 2)).padStart(2, '0');
  return { start, end: `${endH}:${String(m || 0).padStart(2, '0')}` };
};

export const assignSessionLanes = (sessions = []) => {
  const sorted = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  const lanes = [];
  const result = [];

  for (const session of sorted) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      if (session.start >= lanes[i]) {
        lanes[i] = session.end;
        result.push({ ...session, lane: i });
        placed = true;
        break;
      }
    }
    if (!placed) {
      result.push({ ...session, lane: lanes.length });
      lanes.push(session.end);
    }
  }

  return { sessionsWithLanes: result, totalLanes: Math.max(1, lanes.length) };
};

// A print-oriented weekly timetable, independent of the administration UI.
export const createScheduleExportDocument = ({
  schedules = [], teachers = [], groupLabel = '', diploma = '', filiere = '', annee = '',
  academicYear = '', semester = 'S1', getModule = session => getScheduleModuleForSemester(session, semester),
} = {}) => {
  const ink = '#172b42';
  const muted = '#66778a';
  const line = '#dde5ec';
  const sessions = schedules.map(session => ({ ...session, ...parseTimeRange(session.time), displayedModule: getModule(session) }))
    .filter(session => session.displayedModule);
  const minute = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const validTimes = sessions.flatMap(session => [minute(session.start), minute(session.end)]).filter(value => Number.isFinite(value) && value >= 0 && value <= 1440);
  const firstHour = Math.floor(Math.min(START_HOUR * 60, ...validTimes) / 60);
  const lastHour = Math.ceil(Math.max(END_HOUR * 60, ...validTimes) / 60);
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const totalMinutes = hours.length * 60;
  const tones = {
    Cours: { background: '#edf4fa', border: '#cbdce9', accent: '#315e80' },
    TP: { background: '#eaf5f1', border: '#c6e1d6', accent: '#23745c' },
    TD: { background: '#faf3e7', border: '#ecdbc0', accent: '#936524' },
  };
  const root = element('section', {
    width: `${EXPORT_WIDTH}px`, padding: '38px 40px 24px', boxSizing: 'border-box',
    background: '#ffffff', color: ink, fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.4',
  });
  root.setAttribute('aria-label', `Emploi du temps ${groupLabel}`);
  const header = element('header', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '30px', borderBottom: `3px solid ${ink}`, paddingBottom: '24px', marginBottom: '18px' });
  header.dataset.exportHeader = '';
  const heading = element('div', { flex: '1', minWidth: '0' });
  heading.append(
    element('div', { fontSize: '13px', fontWeight: '700', letterSpacing: '3px', color: '#23745c', marginBottom: '7px' }, 'IPFP  /  ORGANISATION PÉDAGOGIQUE'),
    element('h1', { margin: '0 0 8px', fontSize: '36px', fontWeight: '700', letterSpacing: '-1px', lineHeight: '1.15', color: ink }, 'Emploi du temps'),
    element('div', { fontSize: '18px', fontWeight: '700', overflowWrap: 'anywhere' }, filiere || 'Planning hebdomadaire'),
    element('div', { fontSize: '14px', color: muted, marginTop: '4px' }, [diploma, annee].filter(Boolean).join('  •  ')),
  );
  const identity = element('div', { flex: '0 0 240px', textAlign: 'right', borderLeft: `1px solid ${line}`, paddingLeft: '24px', overflowWrap: 'anywhere' });
  identity.append(
    element('div', { fontSize: '12px', letterSpacing: '2px', color: muted }, 'GROUPE'),
    element('div', { fontSize: '30px', fontWeight: '700', lineHeight: '1.2', margin: '5px 0 9px', color: ink }, groupLabel || '—'),
    element('div', { fontSize: '15px', fontWeight: '700', color: '#23745c' }, `${academicYear}  ·  ${semester}`),
  );
  header.append(heading, identity);
  root.append(header);

  const legend = element('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', color: muted, fontSize: '13px' });
  legend.append(element('span', { fontWeight: '700', letterSpacing: '1px' }, 'PLANNING HEBDOMADAIRE'));
  const keys = element('div', { display: 'flex', alignItems: 'center', gap: '22px' });
  for (const [type, tone] of Object.entries(tones)) {
    const key = element('span', { display: 'flex', alignItems: 'center', gap: '7px' });
    key.append(element('span', { width: '9px', height: '9px', borderRadius: '2px', background: tone.accent }), element('span', {}, type));
    keys.append(key);
  }
  keys.append(element('span', { borderLeft: `1px solid ${line}`, paddingLeft: '20px' }, `${sessions.length} séance${sessions.length === 1 ? '' : 's'}`));
  legend.append(keys);
  root.append(legend);

  const table = element('div', { border: `1px solid ${line}`, borderRadius: '10px', overflow: 'hidden' });
  const hourRow = element('div', { display: 'flex', background: '#f1f5f8', borderBottom: `1px solid ${line}`, height: '42px' });
  hourRow.append(element('div', { flex: '0 0 128px', display: 'flex', alignItems: 'center', padding: '0 16px', boxSizing: 'border-box', fontSize: '12px', fontWeight: '700', color: muted }, 'JOUR / HEURE'));
  const hourCells = element('div', { display: 'flex', flex: '1', minWidth: '0' });
  hours.forEach(hour => hourCells.append(element('div', { flex: '1', textAlign: 'center', padding: '11px 0', borderLeft: `1px solid ${line}`, fontSize: '13px', fontWeight: '700', color: ink }, `${String(hour).padStart(2, '0')}:00`)));
  hourRow.append(hourCells);
  table.append(hourRow);

  DAYS.forEach((day, dayIndex) => {
    const daySessions = sessions.filter(session => (session.day || '').trim().toLowerCase() === day.toLowerCase());
    const { sessionsWithLanes } = assignSessionLanes(daySessions);
    const row = element('div', { display: 'flex', minHeight: daySessions.length ? '112px' : '64px', borderBottom: dayIndex < 6 ? `1px solid ${line}` : 'none' });
    row.dataset.exportDay = day;
    const label = element('div', { flex: '0 0 128px', boxSizing: 'border-box', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: daySessions.length ? '#f1f5f8' : '#f8fafb', borderRight: `1px solid ${line}` });
    label.append(
      element('div', { fontSize: '15px', fontWeight: '700', color: ink }, day),
      element('div', { fontSize: '12px', color: muted, marginTop: '5px' }, daySessions.length ? `${daySessions.length} séance${daySessions.length > 1 ? 's' : ''}` : 'Libre'),
    );
    const timeline = element('div', { flex: '1', minWidth: '0', position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${totalMinutes}, minmax(0, 1fr))`, alignItems: 'stretch', background: '#ffffff' });
    hours.forEach((_, index) => timeline.append(element('div', { position: 'absolute', top: '0', bottom: '0', left: `${index / hours.length * 100}%`, borderLeft: `1px solid ${line}`, pointerEvents: 'none' })));
    if (!daySessions.length) timeline.append(element('div', { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#95a2b1', fontSize: '13px' }, 'Aucune séance programmée'));
    sessionsWithLanes.forEach(session => {
      const start = Math.max(0, Math.min(totalMinutes - 1, minute(session.start) - firstHour * 60));
      const end = Math.min(totalMinutes, Math.max(start + 1, minute(session.end) - firstHour * 60));
      const type = session.type || 'Cours';
      const tone = tones[type] || tones.Cours;
      const card = element('article', {
        position: 'relative', gridColumn: `${start + 1} / ${end + 1}`, gridRow: String(session.lane + 1), minWidth: '0',
        margin: '7px 4px', padding: '10px 8px', boxSizing: 'border-box', borderRadius: '5px',
        background: tone.background, border: `1px solid ${tone.border}`, borderTop: `3px solid ${tone.accent}`,
        display: 'flex', flexDirection: 'column', gap: '7px', overflowWrap: 'anywhere', zIndex: '1',
      });
      card.append(
        element('div', { fontSize: '12px', fontWeight: '700', color: tone.accent, lineHeight: '1.3' }, type.toUpperCase()),
        element('div', { fontSize: '13px', fontWeight: '700', color: ink, lineHeight: '1.35' }, `${session.start} – ${session.end}`),
        element('div', { fontSize: '15px', fontWeight: '700', lineHeight: '1.35', color: ink }, String(session.displayedModule)),
      );
      const teacher = session.teacherName || teachers.find(item => item.id === session.teacherId)?.name;
      const metadata = element('div', { marginTop: 'auto', paddingTop: '7px', borderTop: `1px solid ${tone.border}`, fontSize: '12px', lineHeight: '1.4', color: '#4c6074' });
      if (teacher) metadata.append(element('div', {}, teacher));
      if (session.room) metadata.append(element('div', { fontWeight: '700', marginTop: '3px' }, `Salle ${session.room}`));
      if (teacher || session.room) card.append(metadata);
      timeline.append(card);
    });
    row.append(label, timeline);
    table.append(row);
  });
  root.append(table);
  const footer = element('footer', { marginTop: '16px', display: 'flex', justifyContent: 'space-between', color: muted, fontSize: '12px' });
  footer.append(element('span', { fontWeight: '700' }, 'IPFP  •  Planning des enseignements'), element('span', {}, `Édité le ${new Date().toLocaleDateString('fr-FR')}`));
  root.append(footer);
  return root;
};

export const captureScheduleExport = async options => {
  const { default: html2canvas } = await import('html2canvas');
  const root = createScheduleExportDocument(options);
  const wrapper = element('div', { position: 'absolute', left: '-20000px', top: '0', pointerEvents: 'none' });
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.append(root);
  document.body.append(wrapper);
  try {
    await document.fonts?.ready;
    const firstRow = root.querySelector('[data-export-day]');
    const rootTop = root.getBoundingClientRect().top;
    const rows = [...root.querySelectorAll('[data-export-day]')].map(row => {
      const bounds = row.getBoundingClientRect();
      return { top: bounds.top - rootTop, bottom: bounds.bottom - rootTop };
    });
    const height = Math.ceil(root.getBoundingClientRect().height);
    const scale = Math.min(2, Math.sqrt(16000000 / (EXPORT_WIDTH * height)));
    const canvas = await html2canvas(root, {
      scale, backgroundColor: BACKGROUND, width: EXPORT_WIDTH, height,
      windowWidth: EXPORT_WIDTH, windowHeight: height, scrollX: 0, scrollY: 0, logging: false,
    });
    const ratio = canvas.width / EXPORT_WIDTH;
    return {
      canvas,
      headerHeight: Math.floor((firstRow.getBoundingClientRect().top - rootTop) * ratio),
      rows: rows.map(row => ({ top: Math.floor(row.top * ratio), bottom: Math.ceil(row.bottom * ratio) })),
    };
  } finally {
    wrapper.remove();
  }
};

// Plan full-width A4 landscape pages. Prefer whole days; split only a day taller
// than an entire page. The document heading is repeated on each page.
export const getSchedulePdfSlices = ({ width, height, headerHeight, rows }, pageWidth = 277, pageHeight = 190) => {
  const capacity = Math.floor(pageHeight * width / pageWidth);
  const bodyCapacity = capacity - headerHeight;
  if (bodyCapacity <= 0) throw new Error('En-tête trop grand pour le format PDF.');
  const slices = [];
  let start = headerHeight;
  while (start < height) {
    const limit = Math.min(start + bodyCapacity, height);
    const boundaries = rows.map(row => row.bottom).filter(bottom => bottom > start && bottom <= limit);
    const end = limit === height ? height : boundaries.at(-1) || limit;
    slices.push({ start, end });
    start = end;
  }
  return slices;
};

export const exportSchedule = async ({ format, ...options }) => {
  if (!['png', 'pdf'].includes(format)) throw new Error('Format non pris en charge.');
  const capture = await captureScheduleExport(options);
  const filename = `Emploi_du_temps_${options.groupLabel}_${options.academicYear}_${options.semester}`.replace(/[<>:"/\\|?*]/g, '_');
  if (format === 'png') {
    const blob = await new Promise(resolve => capture.canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error("Impossible de générer l'image.");
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = url;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const height = pdf.internal.pageSize.getHeight() - margin * 2 - 6;
  const slices = getSchedulePdfSlices({ ...capture, width: capture.canvas.width, height: capture.canvas.height }, width, height);
  for (let index = 0; index < slices.length; index++) {
    const { start, end } = slices[index];
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = capture.canvas.width;
    pageCanvas.height = capture.headerHeight + end - start;
    const context = pageCanvas.getContext('2d');
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(capture.canvas, 0, 0, pageCanvas.width, capture.headerHeight, 0, 0, pageCanvas.width, capture.headerHeight);
    context.drawImage(capture.canvas, 0, start, pageCanvas.width, end - start, 0, capture.headerHeight, pageCanvas.width, end - start);
    if (index > 0) pdf.addPage();
    pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, width, pageCanvas.height * width / pageCanvas.width, undefined, 'FAST');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(102, 119, 138);
    pdf.text('IPFP | Emploi du temps', margin, pdf.internal.pageSize.getHeight() - 5);
    pdf.text(`${index + 1} / ${slices.length}`, pdf.internal.pageSize.getWidth() - margin, pdf.internal.pageSize.getHeight() - 5, { align: 'right' });
  }
  pdf.save(`${filename}.pdf`);
};
