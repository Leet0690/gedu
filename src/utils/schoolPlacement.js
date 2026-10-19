import { SCHOOL_CYCLES } from '../config/educationProfiles.js';

export const getNextSchoolLevel = student => {
  const cycle = SCHOOL_CYCLES[student?.diploma];
  const index = cycle?.years.indexOf(student.year) ?? -1;
  if (index < 0) return null;
  if (cycle.years[index + 1]) return { diploma: student.diploma, year: cycle.years[index + 1] };
  if (cycle.nextCycle) return { diploma: cycle.nextCycle, year: SCHOOL_CYCLES[cycle.nextCycle].years[0] };
  return null;
};

export const getSchoolPlacementOptions = (student, catalog) => {
  const next = getNextSchoolLevel(student);
  if (!next) return [];
  return Object.entries(catalog?.groups?.[next.diploma] || {}).flatMap(([major, years]) => (
    Array.from(years).includes(next.year) ? [{ ...next, major }] : []
  ));
};

export const validateSchoolPlacement = (student, placement, catalog) => {
  const next = getNextSchoolLevel(student);
  if (!next || !placement?.major || placement.diploma !== next.diploma || placement.year !== next.year) return false;
  return !catalog || getSchoolPlacementOptions(student, catalog).some(item => item.major === placement.major);
};
