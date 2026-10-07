import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';

export const makeClassAttendanceActivityId = (scheduleId, date) =>
  `teacher-attendance-${scheduleId}-${date}`;

export const makeClassAttendanceActivityMessage = (teacher, schedule) =>
  `${teacher.name} a pris la présence de la classe ${schedule.filiere} (${schedule.annee}).`;

const normalizeAttendanceTime = value => String(value || '').replace(/[^0-9]/g, '') || 'x';

const matchesTeacherAttendance = (attendance, teacher, schedule, date) =>
  attendance?.status === 'present' && attendance.teacherId === teacher.id &&
  attendance.date === date && normalizeAttendanceTime(attendance.timeSlot) === normalizeAttendanceTime(schedule.time);

/** Record one class completion, including when classes share a teacher time slot. */
export async function recordClassAttendanceActivity(db, {
  teacher,
  schedule,
  date,
  teacherAttendanceId,
  tokenAttendance,
}) {
  if (!teacher?.id || !teacher.name || !schedule?.id || !schedule.filiere ||
      !schedule.annee || !schedule.time || !date || !teacherAttendanceId || !tokenAttendance) {
    const error = new Error("Les informations de la séance sont incomplètes.");
    error.code = 'invalid-argument';
    throw error;
  }

  const eventId = makeClassAttendanceActivityId(schedule.id, date);
  const attendanceRef = doc(db, 'attendance_formateurs', teacherAttendanceId);
  const activityRef = doc(db, 'activity_logs', eventId);

  try {
    return await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(attendanceRef);
      const attendance = snapshot.data();
      if (!snapshot.exists() || !matchesTeacherAttendance(attendance, teacher, schedule, date)) {
        const error = new Error("La présence du formateur doit être enregistrée pour cette séance.");
        error.code = 'failed-precondition';
        throw error;
      }

      const events = attendance.classAttendanceEvents || {};
      if (events[eventId] === true) return false;

      transaction.set(attendanceRef, {
        classAttendanceEvents: { ...events, [eventId]: true },
        timeSlot: schedule.time,
        tokenAttendance,
        timestamp: serverTimestamp(),
      }, { merge: true });
      transaction.set(activityRef, {
        userId: `teacher:${teacher.id}`,
        userName: teacher.name,
        userRole: 'formateur',
        actionType: 'CLASS_ATTENDANCE_COMPLETED',
        module: 'attendance_students',
        type: 'success',
        message: makeClassAttendanceActivityMessage(teacher, schedule),
        metadata: {
          teacherId: teacher.id,
          scheduleId: schedule.id,
          teacherAttendanceId,
          date,
          major: schedule.filiere,
          year: schedule.annee,
          timeSlot: schedule.time,
        },
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      return true;
    });
  } catch (error) {
    if (error.code === 'permission-denied') {
      // Another tab may commit the immutable activity before this transaction.
      // Confirm its receipt on the public attendance record, never on the log.
      const snapshot = await getDocFromServer(attendanceRef).catch(() => null);
      const attendance = snapshot?.data();
      if (matchesTeacherAttendance(attendance, teacher, schedule, date) &&
          attendance.classAttendanceEvents?.[eventId] === true) return false;
    }
    throw error;
  }
}
