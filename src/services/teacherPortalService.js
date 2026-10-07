import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';

export async function getTeacherPortalSettings(token) {
  const readSettings = httpsCallable(getFunctions(db.app, 'europe-west1'), 'getTeacherPortalSettings');
  const result = await readSettings({ token });
  return result.data;
}
