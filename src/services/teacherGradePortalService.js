import { deleteUser } from 'firebase/auth';
import { getFirestore, terminate } from 'firebase/firestore';
import { createSecondaryAuth } from '../firebase';
import { createTemporaryPortalIdentity, readTeacherPortalGrades, readStudentPortalGrades } from './teacherGradePortalClient.js';
import { createSerialTaskQueue } from '../utils/serialTaskQueue.js';

let connectionPromise;

async function createPortalConnection() {
  // Isolate temporary portal authentication from any administrator session.
  const { secondaryAuth, cleanup } = await createSecondaryAuth();
  try {
    const { user } = await createTemporaryPortalIdentity(secondaryAuth);
    return { portalDb: getFirestore(secondaryAuth.app), uid: user.uid, secondaryAuth, cleanup, reads: createSerialTaskQueue() };
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
  const connection = await connectionPromise;
  return connection.reads.run(() => readTeacherPortalGrades(connection.portalDb, connection.uid, teacherId, tokenGrades, studentIds));
}

export async function closeTeacherGradePortalConnection() {
  const previous = connectionPromise;
  connectionPromise = undefined;
  if (!previous) return;
  const connection = await previous.catch(() => null);
  if (!connection) return;
  try {
    await connection.reads.drain();
    await terminate(connection.portalDb);
    if (connection.secondaryAuth.currentUser) await deleteUser(connection.secondaryAuth.currentUser).catch(() => {});
  } finally {
    await connection.cleanup();
  }
}

export async function loadStudentPortalGrades(studentId, token) {
  if (!connectionPromise) connectionPromise = createPortalConnection().catch(error => {
    connectionPromise = undefined;
    throw error;
  });
  const connection = await connectionPromise;
  return connection.reads.run(() => readStudentPortalGrades(connection.portalDb, connection.uid, studentId, token));
}
