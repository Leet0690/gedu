export async function readTeacherPortalSettings(db, token, ErrorType) {
  if (typeof token !== 'string' || !token.trim() || token.length > 256) {
    throw new ErrorType('invalid-argument', 'Lien formateur invalide.');
  }
  const attendance = await db.collection('teachers').where('tokenAttendance', '==', token).limit(1).get();
  const teacher = attendance.empty
    ? await db.collection('teachers').where('tokenGrades', '==', token).limit(1).get()
    : attendance;
  if (teacher.empty) throw new ErrorType('permission-denied', 'Lien formateur invalide.');

  const snapshot = await db.doc('settings/app').get();
  const settings = snapshot.data() || {};
  // Return only the scheduling scope, never closure or administration data.
  return {
    activeSemester: settings.activeSemester === 'S2' ? 'S2' : 'S1',
    operationalAcademicYear: settings.operationalAcademicYear || '2025-2026',
  };
}
