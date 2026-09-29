import { auth, db } from '../firebase';
import { createScheduleShareClient } from './scheduleShareClient.js';
export { getScheduleShareErrorMessage } from './scheduleShareClient.js';
export const { createScheduleShare, getPublicSchedule } = createScheduleShareClient(db, auth);
