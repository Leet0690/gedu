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

