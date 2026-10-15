export const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export const READ_TTLS = Object.freeze({
  catalog: 60 * 60 * 1000,
  administrative: 30 * 60 * 1000,
  attendance: 15 * 60 * 1000,
  finance: 60 * 60 * 1000,
  accessLogs: 60 * 60 * 1000,
});

const CATALOG_COLLECTIONS = new Set(['modules']);
const ADMINISTRATIVE_COLLECTIONS = new Set([
  'students',
  'teachers',
  'grades',
  'schedules',
  'continuousTrainings',
  'continuousTrainingTypes',
  'ctStudents',
  'ctSessions',
]);

export const getCollectionReadTtl = collectionName => {
  if (CATALOG_COLLECTIONS.has(collectionName)) return READ_TTLS.catalog;
  if (ADMINISTRATIVE_COLLECTIONS.has(collectionName)) return READ_TTLS.administrative;
  return READ_TTLS.administrative;
};
