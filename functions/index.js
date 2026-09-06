import { createHash } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onDocumentWrittenWithAuthContext } from 'firebase-functions/v2/firestore';
import { describeAuditChange } from './auditEvent.js';

initializeApp();
const db = getFirestore();

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
