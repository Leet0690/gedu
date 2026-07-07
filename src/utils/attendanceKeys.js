export const sanitizeAttendancePart = (value, fallback = 'global') => {
  const raw = value || fallback;
  return String(raw).replace(/[^a-zA-Z0-9]/g, '_');
};

export const sanitizeAttendanceTime = (timeSlot = '') => {
  return String(timeSlot || '').replace(/[^0-9]/g, '');
};

export const makeStudentAttendanceDocId = (studentId, moduleId, date, timeSlot = '') => {
  const safeModule = sanitizeAttendancePart(moduleId);
  const safeTime = sanitizeAttendanceTime(timeSlot);
  return safeTime
    ? `${studentId}_${safeModule}_${safeTime}_${date}`
    : `${studentId}_${safeModule}_${date}`;
};

export const getStudentAttendanceWriteTarget = (studentId, moduleId, date, timeSlot = '', recordId = '') => {
  const canonicalId = makeStudentAttendanceDocId(studentId, moduleId, date, timeSlot);
  return {
    canonicalId,
    previousId: recordId && recordId !== canonicalId ? recordId : '',
  };
};

export const makeAttendanceColumnKey = (date, moduleId, timeSlot = '') => {
  const safeModule = sanitizeAttendancePart(moduleId);
  const safeTime = sanitizeAttendanceTime(timeSlot) || 'legacy';
  return `${date}_${safeModule}_${safeTime}`;
};

export const isFinalAttendanceStatus = status => status === 'present' || status === 'absent';

export const findStudentAttendanceRecord = (
  records = [],
  studentId,
  moduleId,
  date,
  timeSlot = '',
  { allowLegacy = true, legacyOnly = false } = {},
) => {
  const safeModule = sanitizeAttendancePart(moduleId);
  const candidates = (records || []).filter(record =>
    record.studentId === studentId &&
    sanitizeAttendancePart(record.moduleId || record.module || '') === safeModule &&
    record.date === date
  );
  if (!candidates.length) return null;

  const legacyRecord = candidates.find(record => !sanitizeAttendanceTime(record.timeSlot)) || null;
  if (legacyOnly) return legacyRecord;

  const safeTime = sanitizeAttendanceTime(timeSlot);
  if (safeTime) {
    const exact = candidates.find(record => sanitizeAttendanceTime(record.timeSlot) === safeTime);
    if (exact) return exact;
    return allowLegacy ? legacyRecord : null;
  }
  return candidates[0];
};

export const isTeacherSessionComplete = (teacherRecord, studentAttendanceComplete) => {
  if (teacherRecord?.status === 'absent') return true;
  return teacherRecord?.status === 'present' && studentAttendanceComplete === true;
};
