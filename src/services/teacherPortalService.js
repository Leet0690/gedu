import { doc, getDocFromServer, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { getPublicScheduleSettings, readPublicScheduleSettings } from '../utils/publicScheduleSettings.js';

export async function getTeacherPortalSettings() {
  return readPublicScheduleSettings(await getDocFromServer(doc(db, 'public_settings', 'schedule')));
}

export async function publishScheduleSettings() {
  return runTransaction(db, async transaction => {
    const settings = await transaction.get(doc(db, 'settings', 'app'));
    const publicRef = doc(db, 'public_settings', 'schedule');
    const published = await transaction.get(publicRef);
    const next = getPublicScheduleSettings(settings.data());
    if (published.data()?.activeSemester === next.activeSemester &&
        published.data()?.operationalAcademicYear === next.operationalAcademicYear) return;
    transaction.set(publicRef, next);
  });
}
