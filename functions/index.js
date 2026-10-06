import { createHash } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onDocumentWrittenWithAuthContext } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { describeAuditChange } from './auditEvent.js';

initializeApp();
const db = getFirestore();

// Callable function to set a user's password directly from the admin panel
export const adminSetUserPassword = onCall({ region: 'europe-west1' }, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Session invalide. Vous devez être connecté.');
  }
  const callerUid = request.auth.uid;
  const callerDoc = await db.doc(`users/${callerUid}`).get();
  if (!callerDoc.exists || callerDoc.data().isActive !== true) {
    throw new HttpsError('permission-denied', 'Compte inactif ou introuvable.');
  }
  const caller = callerDoc.data();
  const isAdm = ['admin', 'super_admin'].includes(caller.role);
  const canManage = isAdm || (caller.permissions?.users === 'edit' && caller.permissions?.finance === 'none');
  if (!canManage) {
    throw new HttpsError('permission-denied', 'Vous ne disposez pas du droit de modifier les mots de passe.');
  }
  const { targetUid, newPassword } = request.data || {};
  if (!targetUid || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'Identifiant utilisateur et mot de passe valide (au moins 6 caractères) requis.');
  }
  const targetDoc = await db.doc(`users/${targetUid}`).get();
  if (!targetDoc.exists) {
    throw new HttpsError('not-found', 'Utilisateur cible introuvable.');
  }
  const target = targetDoc.data();
  if (!isAdm && (['admin', 'super_admin'].includes(target.role) || target.permissions?.finance !== 'none')) {
    throw new HttpsError('permission-denied', 'Vous ne pouvez pas modifier le mot de passe d’un compte administrateur ou finance.');
  }
  await getAuth().updateUser(targetUid, { password: newPassword });
  await db.collection('activity_logs').add({
    userId: callerUid,
    userName: caller.displayName || callerUid,
    userRole: caller.role,
    actionType: 'PASSWORD_CHANGED',
    module: 'users',
    metadata: { targetId: targetUid },
    message: `Mot de passe mis à jour manuellement pour ${target.displayName || targetUid}`,
    type: 'info',
    timestamp: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
});

export const submitTeacherAttendance = onCall({ region: 'europe-west1' }, async request => {
  const data = request.data || {};
  const { token, date, status, comment = '', hours = 0, moduleId = '', timeSlot = '' } = data;
  if (typeof token !== 'string' || !token || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['present', 'absent'].includes(status)) {
    throw new HttpsError('invalid-argument', 'Données de présence invalides.');
  }
  const teacherSnap = await db.collection('teachers').where('tokenAttendance', '==', token).limit(1).get();
  if (teacherSnap.empty) throw new HttpsError('permission-denied', 'Lien formateur invalide.');
  const teacherId = teacherSnap.docs[0].id;
  const safeModule = String(moduleId || 'global').replace(/[^a-zA-Z0-9]/g, '_');
  const safeTime = String(timeSlot || '').replace(/[^0-9]/g, '') || 'x';
  const docId = `${teacherId}_${safeModule}_${safeTime}_${date}`;
  const parsedHours = Number(hours);
  await db.doc(`attendance_formateurs/${docId}`).set({
    teacherId, date, status, comment: String(comment || '').slice(0, 500),
    hours: status === 'present' && Number.isFinite(parsedHours) ? Math.max(0, Math.min(parsedHours, 24)) : 0,
    moduleId: String(moduleId || '').slice(0, 200), timeSlot: String(timeSlot || '').slice(0, 40),
    timestamp: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { success: true, id: docId };
});

export const submitTeacherStudentAttendance = onCall({ region: 'europe-west1' }, async request => {
  const { token, studentId, moduleId, date, status, comment = '', formateurId = '', timeSlot = '' } = request.data || {};
  if (typeof token !== 'string' || !token || typeof studentId !== 'string' || typeof moduleId !== 'string' ||
      typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['present', 'absent', ''].includes(status)) {
    throw new HttpsError('invalid-argument', 'Données de présence stagiaire invalides.');
  }
  const teacherSnap = await db.collection('teachers').where('tokenAttendance', '==', token).limit(1).get();
  if (teacherSnap.empty) throw new HttpsError('permission-denied', 'Lien formateur invalide.');
  const teacherId = teacherSnap.docs[0].id;
  const [studentSnap, scheduleSnap] = await Promise.all([
    db.doc(`students/${studentId}`).get(),
    db.collection('schedules').where('teacherId', '==', teacherId).get(),
  ]);
  if (!studentSnap.exists) throw new HttpsError('not-found', 'Stagiaire introuvable.');
  const dateObject = new Date(`${date}T00:00:00`);
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const student = studentSnap.data();
  const allowed = scheduleSnap.docs.some(item => {
    const session = item.data();
    return session.day === days[dateObject.getDay()] && session.filiere === student.major &&
      session.annee === student.year && String(session.time || '').replace(/[^0-9]/g, '') === String(timeSlot || '').replace(/[^0-9]/g, '') &&
      Boolean(session.module || session.moduleId || session.moduleS1 || session.moduleS2);
  });
  if (!allowed) throw new HttpsError('permission-denied', 'Cette séance ne correspond pas au groupe du formateur.');
  const safeModule = moduleId.replace(/[^a-zA-Z0-9]/g, '_');
  const safeTime = String(timeSlot || '').replace(/[^0-9]/g, '') || 'x';
  const docId = `${studentId}_${safeModule}_${safeTime ? `${safeTime}_` : ''}${date}`;
  const ref = db.doc(`attendance_stagiaires/${docId}`);
  if (!status) {
    await ref.delete();
    return { success: true, id: docId };
  }
  await ref.set({ studentId, moduleId, date, status, comment: String(comment || '').slice(0, 500), formateurId: String(formateurId || '').slice(0, 120), timeSlot: String(timeSlot || '').slice(0, 40), timestamp: FieldValue.serverTimestamp() }, { merge: true });
  return { success: true, id: docId };
});

// Independent of UI toasts: API writes, deletes and partial batches are also recorded.
export const auditDocumentWrite = onDocumentWrittenWithAuthContext({
  document: '{collectionId}/{documentId}', retry: true,
}, async event => {
  if (!event.data) return;
  const details = describeAuditChange(event.params.collectionId, event.params.documentId,
    event.data.before.exists ? event.data.before.data() : null,
    event.data.after.exists ? event.data.after.data() : null);
  if (!details) return;
  const userId = event.authId || event.authType || 'unknown';
  const user = event.authType === 'unknown' && event.authId && !event.authId.includes('/')
    ? (await db.doc(`users/${event.authId}`).get()).data() : null;
  const eventKey = createHash('sha256').update(event.id).digest('hex');
  // Cloud Functions can deliver an event more than once. A fixed ID makes retries idempotent.
  try {
    await db.doc(`activity_logs/server-${eventKey}`).create({
      ...details, userId, userName: user?.displayName || userId,
      userRole: user?.role || event.authType || 'unknown',
      authType: event.authType || 'unknown', eventId: event.id,
      timestamp: Timestamp.fromDate(new Date(event.time)), createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    if (error.code !== 6 && error.code !== 'already-exists') throw error;
  }
});

