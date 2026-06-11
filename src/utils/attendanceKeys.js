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
