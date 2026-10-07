import { deleteUser } from 'firebase/auth';
import { getFirestore, terminate } from 'firebase/firestore';
import { createSecondaryAuth } from '../firebase';
import { createTemporaryPortalIdentity, readTeacherPortalGrades } from './teacherGradePortalClient.js';

let connectionPromise;

async function createPortalConnection() {
  // Isolate temporary portal authentication from any administrator session.
  const { secondaryAuth, cleanup } = await createSecondaryAuth();
  try {
    const { user } = await createTemporaryPortalIdentity(secondaryAuth);
    return { portalDb: getFirestore(secondaryAuth.app), uid: user.uid, secondaryAuth, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export async function loadTeacherPortalGrades(teacherId, tokenGrades, studentIds) {
  // Reuse one temporary identity across refreshes to avoid repeated sign-ups.
  if (!connectionPromise) connectionPromise = createPortalConnection().catch(error => {
    connectionPromise = undefined;
    throw error;
  });
  const { portalDb, uid } = await connectionPromise;
  return readTeacherPortalGrades(portalDb, uid, teacherId, tokenGrades, studentIds);
}

export async function closeTeacherGradePortalConnection() {
  const previous = connectionPromise;
  connectionPromise = undefined;
  if (!previous) return;
  const connection = await previous.catch(() => null);
  if (!connection) return;
  try {
    await terminate(connection.portalDb);
    if (connection.secondaryAuth.currentUser) await deleteUser(connection.secondaryAuth.currentUser).catch(() => {});
  } finally {
    await connection.cleanup();
  }
}
