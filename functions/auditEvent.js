const COLLECTIONS = {
  users: 'users', students: 'students', teachers: 'teachers', grades: 'grades',
  schedules: 'schedules', modules: 'modules', payments: 'finance', salaries: 'finance',
  expenses: 'finance', attendance_stagiaires: 'attendance_students',
  attendance_formateurs: 'attendance_teachers', continuousTrainings: 'continuous',
  continuousTrainingTypes: 'continuous', ctStudents: 'continuous', ctSessions: 'continuous',
  settings: 'administration', operations: 'administration', tokens: 'administration',
};

export function describeAuditChange(collectionId, documentId, before, after) {
  if (!Object.hasOwn(COLLECTIONS, collectionId)) return null; // Includes audit collections: no recursion.
  const changedFields = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    .filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]));
  const actionType = before == null ? 'CREATE' : after == null ? 'DELETE' : 'UPDATE';
  if (before == null && after == null) return null;
  if (!changedFields.length && actionType === 'UPDATE') return null;
  const safeDocumentId = collectionId === 'tokens' ? '[redacted]' : documentId;
  return {
    source: 'server', module: COLLECTIONS[collectionId], actionType, type: 'info',
    message: `${actionType} : ${collectionId}/${safeDocumentId}`,
    // Never copy passwords, tokens, student records or financial values to the audit log.
    metadata: { collectionId, documentId: safeDocumentId, changedFields },
  };
}
