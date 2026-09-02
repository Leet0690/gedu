export const STUDENT_STATUS = {
  ACTIVE: 'active',
  LAUREAT: 'laureat',
};

export const FIRST_YEAR = '1\u00e8re ann\u00e9e';
export const SECOND_YEAR = '2\u00e8me ann\u00e9e';
export const INITIAL_OPERATIONAL_ACADEMIC_YEAR = '2025-2026';

export const normalizeStudentStatus = (student = {}) =>
  String(student.status || STUDENT_STATUS.ACTIVE).toLowerCase();

export const isLaureatStudent = (student = {}) =>
  normalizeStudentStatus(student) === STUDENT_STATUS.LAUREAT;

export const isActiveStudent = (student = {}) => !isLaureatStudent(student);

export const getStudentStatusLabel = (student = {}) =>
  isLaureatStudent(student) ? 'LAUR\u00c9AT' : 'ACTIF';

/** Validate academic year format: must be "YYYY-YYYY" with consecutive years */
export const validateAcademicYear = (yearStr) => {
  if (!yearStr || typeof yearStr !== 'string') return false;
  const match = yearStr.match(/^(\d{4})-(\d{4})$/);
  if (!match) return false;
  const [, startYear, endYear] = match;
  return parseInt(endYear) === parseInt(startYear) + 1;
};

export const getNextAcademicYear = (academicYear = '') => {
  if (!validateAcademicYear(academicYear)) return '';
  const end = Number(academicYear.split('-')[1]);
  return `${end}-${end + 1}`;
};

/** Build the next manual closure from the persisted operational year. */
export const getAcademicYearTransition = (operationalAcademicYear = INITIAL_OPERATIONAL_ACADEMIC_YEAR) => {
  const fromAcademicYear = validateAcademicYear(operationalAcademicYear)
    ? operationalAcademicYear
    : INITIAL_OPERATIONAL_ACADEMIC_YEAR;
  return {
    fromAcademicYear,
    toAcademicYear: getNextAcademicYear(fromAcademicYear),
  };
};

const formatLocalDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Resolve the academic year containing a local calendar date. */
export const getAcademicYearForDate = (value) => {
  const dateString = value instanceof Date ? formatLocalDate(value) : String(value || '');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return '';

  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

/** Map a month index (0-11) to its calendar year within an academic year. */
export const getCalendarYearForAcademicMonth = (academicYear, monthIndex) => {
  if (!validateAcademicYear(academicYear) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  const [startYear, endYear] = academicYear.split('-').map(Number);
  return monthIndex >= 8 ? startYear : endYear;
};

/** Attendance writes are limited to the writable academic year and non-future dates. */
export const canEditAttendanceForAcademicYear = ({
  selectedAcademicYear,
  writableAcademicYear,
  selectedDate,
  today = new Date(),
} = {}) => {
  const todayString = today instanceof Date ? formatLocalDate(today) : String(today || '');
  return (
    validateAcademicYear(selectedAcademicYear) &&
    selectedAcademicYear === writableAcademicYear &&
    getAcademicYearForDate(selectedDate) === selectedAcademicYear &&
    getAcademicYearForDate(todayString) !== '' &&
    selectedDate <= todayString
  );
};

/** Validate that toAcademicYear follows fromAcademicYear */
export const validateAcademicYearTransition = (from, to) => {
  if (!validateAcademicYear(from) || !validateAcademicYear(to)) return false;
  const fromEnd = parseInt(from.split('-')[1]);
  const toStart = parseInt(to.split('-')[0]);
  return toStart === fromEnd;
};

/** Check if a closure already exists for a given academic year in students' classHistory */
export const hasExistingClosure = (students, fromAcademicYear) => {
  return (students || []).some(s =>
    Array.isArray(s.classHistory) &&
    s.classHistory.some(h => h.academicYear === fromAcademicYear)
  );
};

/** Derive academic year from a payment object or date (ex: 2024-10-15 -> "2024-2025", 2025-02-10 -> "2024-2025") */
export const getPaymentAcademicYear = (payment = {}) => {
  if (payment.academicYear && validateAcademicYear(payment.academicYear)) {
    return payment.academicYear;
  }
  if (payment.receiptAcademicYear && validateAcademicYear(payment.receiptAcademicYear)) {
    return payment.receiptAcademicYear;
  }

  const rawDate = payment.date || payment.createdAt;
  if (!rawDate) return '';

  let d;
  if (typeof rawDate === 'string' || typeof rawDate === 'number') {
    d = new Date(rawDate);
  } else if (rawDate?.toDate && typeof rawDate.toDate === 'function') {
    d = rawDate.toDate();
  }
  if (!d || isNaN(d.getTime())) return '';

  const y = d.getFullYear();
  const m = d.getMonth(); // 0 = Jan, 8 = Sept
  if (m >= 8) {
    return `${y}-${y + 1}`;
  } else {
    return `${y - 1}-${y}`;
  }
};

/** Get the operational year and its archives without deriving a future year from the date. */
export const getAvailableAcademicYears = (
  students = [],
  payments = [],
  operationalAcademicYear = INITIAL_OPERATIONAL_ACADEMIC_YEAR,
  archivedAcademicYears = []
) => {
  const yearsSet = new Set();
  const currentYear = validateAcademicYear(operationalAcademicYear)
    ? operationalAcademicYear
    : INITIAL_OPERATIONAL_ACADEMIC_YEAR;
  const addAvailableYear = (academicYear) => {
    if (validateAcademicYear(academicYear) && academicYear <= currentYear) {
      yearsSet.add(academicYear);
    }
  };

  yearsSet.add(currentYear);
  (archivedAcademicYears || []).forEach(addAvailableYear);

  (students || []).forEach(s => {
    addAvailableYear(s.academicYear);
    addAvailableYear(s.graduationAcademicYear);
    addAvailableYear(s.previousAcademicYear);
    if (Array.isArray(s.classHistory)) {
      s.classHistory.forEach(h => addAvailableYear(h.academicYear));
    }
  });

  (payments || []).forEach(p => {
    addAvailableYear(getPaymentAcademicYear(p));
  });

  return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
};

export const STANDARD_ACADEMIC_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const normalizeFrenchValue = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

/** Vacation months are not payable and must never generate arrears. */
export const getStudentVacationMonths = (student = {}) => {
  const studyYear = normalizeFrenchValue(student.year);
  if (studyYear.includes('1')) return ['Août', 'Septembre'];
  if (studyYear.includes('2')) return ['Juillet', 'Août'];
  return [];
};

export const isStudentVacationMonth = (student = {}, month = '') => {
  const normalizedMonth = normalizeFrenchValue(month);
  return getStudentVacationMonths(student)
    .some(vacationMonth => normalizeFrenchValue(vacationMonth) === normalizedMonth);
};

export const getStudentPayableMonths = (student = {}, months = STANDARD_ACADEMIC_MONTHS) =>
  (months || []).filter(month => !isStudentVacationMonth(student, month));

/** Analyze if a student has unpaid monthly balances from previous academic year(s) (e.g. 1st year arrears) */
export const getStudentPreviousYearBalance = (student, payments = []) => {
  if (!student) return { hasUnpaid: false, unpaidCount: 0, details: [] };

  const historyEntries = [];

  if (Array.isArray(student.classHistory) && student.classHistory.length > 0) {
    student.classHistory.forEach(entry => {
      if (entry.academicYear) historyEntries.push(entry);
    });
  } else if (student.previousAcademicYear) {
    historyEntries.push({
      academicYear: student.previousAcademicYear,
      year: student.promotedFromYear || FIRST_YEAR
    });
  }

  if (historyEntries.length === 0) {
    return { hasUnpaid: false, unpaidCount: 0, details: [] };
  }

  const details = [];
  let totalUnpaidCount = 0;

  historyEntries.forEach(entry => {
    const acYear = entry.academicYear;
    const yearLevel = entry.year || FIRST_YEAR;
    const expectedMonths = getStudentPayableMonths({ year: yearLevel });

    // Find all paid payments for this student in this past academic year
    const pastPayments = (payments || []).filter(p =>
      p.studentId === student.id &&
      (String(p.status || '').toLowerCase() !== 'unpaid' && String(p.status || '').toLowerCase() !== 'impayé') &&
      getPaymentAcademicYear(p) === acYear
    );

    const paidMonthNames = new Set(pastPayments.map(p => (p.month || '').toLowerCase()));
    const unpaidMonths = expectedMonths.filter(m => !paidMonthNames.has(m.toLowerCase()));

    if (unpaidMonths.length > 0) {
      totalUnpaidCount += unpaidMonths.length;
      details.push({
        academicYear: acYear,
        yearLevel,
        unpaidCount: unpaidMonths.length,
        unpaidMonths
      });
    }
  });

  return {
    hasUnpaid: totalUnpaidCount > 0,
    unpaidCount: totalUnpaidCount,
    details
  };
};

/** Extract 1st year entry year from student registration number / matricule (ex: "FD001/26" -> 2026, "123/25" -> 2025) */
export const extractEntryYearFromMatricule = (regNo) => {
  if (!regNo || typeof regNo !== 'string') return null;
  const str = regNo.trim();

  // Match "/26" or "/2026" or "-26" or "-2026" or "/26/" pattern
  const slashMatch = str.match(/[/-](\d{2,4})(?:\b|[^\d])/);
  if (slashMatch) {
    const raw = slashMatch[1];
    if (raw.length === 2) {
      const parsed = parseInt(raw, 10);
      return parsed >= 50 ? 1900 + parsed : 2000 + parsed;
    } else if (raw.length === 4) {
      return parseInt(raw, 10);
    }
  }

  // Match 4-digit year starting with 20 (ex: 2025, 2026)
  const fourDigitMatch = str.match(/\b(20\d{2})\b/);
  if (fourDigitMatch) {
    return parseInt(fourDigitMatch[1], 10);
  }

  return null;
};

/** Calculate 2-year study cycle range string for a student (ex: "2025 - 2027") */
export const getStudentStudyCycleRange = (
  student = {},
  operationalAcademicYear = INITIAL_OPERATIONAL_ACADEMIC_YEAR
) => {
  if (!student) return '';

  let startYear = null;

  // Case A: Extract entry year directly from matricule (ex: /26 -> 2026, /25 -> 2025)
  const matriculeYear = extractEntryYearFromMatricule(
    student.regNo || student.registrationNumber || student.matricule
  );
  if (matriculeYear) {
    startYear = matriculeYear;
  }

  // Case B: Has classHistory entries
  if (!startYear && Array.isArray(student.classHistory) && student.classHistory.length > 0) {
    const validHistoryYears = student.classHistory
      .map(h => h.academicYear)
      .filter(validateAcademicYear);

    if (validHistoryYears.length > 0) {
      const sorted = [...validHistoryYears].sort();
      const earliestStr = sorted[0]; // e.g. "2024-2025"
      startYear = parseInt(earliestStr.split('-')[0]);
    }
  }

  // Case C: Has academicYear
  if (!startYear && student.academicYear && validateAcademicYear(student.academicYear)) {
    const currentYear = validateAcademicYear(operationalAcademicYear)
      ? operationalAcademicYear
      : INITIAL_OPERATIONAL_ACADEMIC_YEAR;
    const hasExplicitTransition =
      (Array.isArray(student.classHistory) && student.classHistory.length > 0) ||
      validateAcademicYear(student.previousAcademicYear);
    const resolvedAcademicYear = isActiveStudent(student) &&
      student.academicYear > currentYear &&
      !hasExplicitTransition
      ? currentYear
      : student.academicYear;
    const [fromY] = resolvedAcademicYear.split('-').map(Number);
    const yearLevel = (student.year || '').toLowerCase();

    if (yearLevel.includes('2')) {
      startYear = fromY - 1;
    } else {
      startYear = fromY;
    }
  }

  // Case D: Has graduationAcademicYear (Lauréat)
  if (!startYear && student.graduationAcademicYear && validateAcademicYear(student.graduationAcademicYear)) {
    const gradEndYear = parseInt(student.graduationAcademicYear.split('-')[1]);
    startYear = gradEndYear - 2;
  }

  // Fallback: use the manually managed operational year, never the calendar date.
  if (!startYear) {
    const currentYear = validateAcademicYear(operationalAcademicYear)
      ? operationalAcademicYear
      : INITIAL_OPERATIONAL_ACADEMIC_YEAR;
    const inferredFromY = Number(currentYear.split('-')[0]);
    const yearLevel = (student.year || '').toLowerCase();
    if (yearLevel.includes('2')) {
      startYear = inferredFromY - 1;
    } else {
      startYear = inferredFromY;
    }
  }

  const endYear = startYear + 2;
  return `${startYear} - ${endYear}`;
};

/** Resolve the academic year represented by the student's current fields. */
export const getStudentCurrentAcademicYear = (
  student = {},
  operationalAcademicYear = INITIAL_OPERATIONAL_ACADEMIC_YEAR
) => {
  const currentYear = validateAcademicYear(operationalAcademicYear)
    ? operationalAcademicYear
    : INITIAL_OPERATIONAL_ACADEMIC_YEAR;
  const history = Array.isArray(student.classHistory) ? student.classHistory : [];
  const hasExplicitTransition = history.length > 0 || validateAcademicYear(student.previousAcademicYear);

  if (validateAcademicYear(student.academicYear)) {
    if (isActiveStudent(student) && student.academicYear > currentYear && !hasExplicitTransition) {
      return currentYear;
    }
    return student.academicYear;
  }
  if (isLaureatStudent(student) && validateAcademicYear(student.graduationAcademicYear)) {
    return student.graduationAcademicYear;
  }
  if (validateAcademicYear(student.previousAcademicYear)) {
    return getNextAcademicYear(student.previousAcademicYear);
  }

  const latestHistory = [...history]
    .filter(entry => validateAcademicYear(entry?.academicYear))
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear))[0];
  if (latestHistory) {
    const currentLevel = String(student.year || '').toLowerCase();
    const historyLevel = String(latestHistory.year || '').toLowerCase();
    if (currentLevel.includes('2') && historyLevel.includes('1')) {
      return getNextAcademicYear(latestHistory.academicYear);
    }
    return latestHistory.academicYear;
  }

  const range = getStudentStudyCycleRange(student, currentYear)
    .split('-')
    .map(part => Number(part.trim()));
  if (range.length === 2 && range.every(Number.isFinite)) {
    const start = range[0];
    return String(student.year || '').includes('2')
      ? `${start + 1}-${start + 2}`
      : `${start}-${start + 1}`;
  }

  return currentYear;
};

/**
 * Return the class/profile snapshot for a specific academic year.
 * `null` means the student did not belong to that academic year.
 */
export const getStudentAcademicSnapshot = (
  student = {},
  targetAcademicYear = '',
  operationalAcademicYear = INITIAL_OPERATIONAL_ACADEMIC_YEAR
) => {
  if (!student) return null;
  const currentAcademicYear = getStudentCurrentAcademicYear(student, operationalAcademicYear);
  if (!targetAcademicYear) {
    return {
      ...student,
      academicYear: currentAcademicYear,
      isHistoricalSnapshot: false,
    };
  }
  if (!validateAcademicYear(targetAcademicYear)) return null;

  const historyEntry = (Array.isArray(student.classHistory) ? student.classHistory : [])
    .find(entry => entry?.academicYear === targetAcademicYear);
  if (historyEntry) {
    return {
      ...student,
      diploma: historyEntry.diploma || student.diploma || '',
      major: historyEntry.major || student.major || '',
      year: historyEntry.year || student.year || '',
      academicYear: targetAcademicYear,
      academicStatus: historyEntry.status || STUDENT_STATUS.ACTIVE,
      isHistoricalSnapshot: currentAcademicYear !== targetAcademicYear,
    };
  }

  if (
    currentAcademicYear === targetAcademicYear ||
    student.graduationAcademicYear === targetAcademicYear
  ) {
    return {
      ...student,
      academicYear: targetAcademicYear,
      academicStatus: student.status || STUDENT_STATUS.ACTIVE,
      isHistoricalSnapshot: false,
    };
  }

  if (student.previousAcademicYear === targetAcademicYear) {
    return {
      ...student,
      year: student.promotedFromYear || FIRST_YEAR,
      academicYear: targetAcademicYear,
      academicStatus: STUDENT_STATUS.ACTIVE,
      isHistoricalSnapshot: true,
    };
  }

  // Legacy records may not have academicYear/classHistory. Infer the two-year
  // class from the matricule or study-cycle range without mutating the record.
  // Only infer backwards: a future class must be created by an actual closure.
  const targetStart = Number(targetAcademicYear.split('-')[0]);
  const currentStart = Number(currentAcademicYear.split('-')[0]);
  const range = getStudentStudyCycleRange(student, operationalAcademicYear)
    .split('-')
    .map(part => Number(part.trim()));
  if (range.length === 2 && range.every(Number.isFinite)) {
    const [cycleStart, cycleEnd] = range;
    if (targetStart >= cycleStart && targetStart < cycleEnd && targetStart <= currentStart) {
      return {
        ...student,
        year: targetStart === cycleStart ? FIRST_YEAR : SECOND_YEAR,
        academicYear: targetAcademicYear,
        academicStatus: STUDENT_STATUS.ACTIVE,
        isHistoricalSnapshot: currentAcademicYear !== targetAcademicYear,
      };
    }
  }

  return null;
};

/** Check historical membership, including legacy records. */
export const isStudentInAcademicYear = (
  student = {},
  targetAcademicYear = '',
  operationalAcademicYear = INITIAL_OPERATIONAL_ACADEMIC_YEAR
) => !targetAcademicYear || !!getStudentAcademicSnapshot(student, targetAcademicYear, operationalAcademicYear);

/** Check the current enrollment only; classHistory must not promote a student twice. */
export const isStudentCurrentlyInAcademicYear = (
  student = {},
  targetAcademicYear = '',
  operationalAcademicYear = INITIAL_OPERATIONAL_ACADEMIC_YEAR
) =>
  isActiveStudent(student) &&
  validateAcademicYear(targetAcademicYear) &&
  getStudentCurrentAcademicYear(student, operationalAcademicYear) === targetAcademicYear;
