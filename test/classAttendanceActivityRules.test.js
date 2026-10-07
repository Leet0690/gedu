import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  initializeFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer,
  getDocsFromServer, collection, query, where, serverTimestamp, terminate,
  setLogLevel, deleteDoc, updateDoc, onSnapshot, orderBy, limit,
} from 'firebase/firestore';
import {
  makeClassAttendanceActivityId,
  makeClassAttendanceActivityMessage,
  recordClassAttendanceActivity,
} from '../src/services/classAttendanceActivity.js';

test('class completion activities distinguish classes and dates and identify the teacher', () => {
  assert.equal(makeClassAttendanceActivityId('class-one', '2026-10-07'), 'teacher-attendance-class-one-2026-10-07');
  assert.notEqual(makeClassAttendanceActivityId('class-one', '2026-10-07'), makeClassAttendanceActivityId('class-two', '2026-10-07'));
  assert.notEqual(makeClassAttendanceActivityId('class-one', '2026-10-07'), makeClassAttendanceActivityId('class-one', '2026-10-08'));
  assert.equal(
    makeClassAttendanceActivityMessage({ name: 'Formateur de test' }, { filiere: 'Classe fictive', annee: '1ère année' }),
    'Formateur de test a pris la présence de la classe Classe fictive (1ère année).',
  );
});

test('class attendance notification transaction rejects incomplete inputs before any write', async () => {
  await assert.rejects(recordClassAttendanceActivity(null, { teacher: {}, schedule: {} }), { code: 'invalid-argument' });
});

test('class attendance activities are authenticated by the portal token, atomic and unique', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 60000,
}, async t => {
  setLogLevel('silent');
  const resources = [];
  const seededDocuments = [];
  const prefix = 'class-activity';
  const database = uid => {
    const app = initializeApp({ projectId: 'demo-ipfp-rbac', apiKey: 'test-only' }, `${prefix}-${uid}`);
    const db = initializeFirestore(app, {});
    connectFirestoreEmulator(db, '127.0.0.1', 8085, uid === 'anonymous' ? {} : {
      mockUserToken: uid === 'owner' ? 'owner' : { sub: `${prefix}-${uid}`, user_id: `${prefix}-${uid}` },
    });
    resources.push({ app, db });
    return db;
  };
  const owner = database('owner');
  const portal = database('anonymous');
  const admin = database('admin');
  const dashboard = database('dashboard');
  const other = database('other');
  const denied = promise => assert.rejects(promise, { code: 'permission-denied' });
  const teacher = { id: `${prefix}-teacher`, name: 'Formateur fictif', tokenAttendance: 'fictional-attendance-token' };
  const date = '2026-10-07';
  const time = '08:30-10:30';
  const seed = async (name, id, data) => {
    const ref = doc(owner, name, id);
    seededDocuments.push(ref);
    await setDoc(ref, data);
  };
  const fixture = async suffix => {
    const schedule = {
      id: `${prefix}-${suffix}`, teacherId: teacher.id, filiere: 'Classe fictive',
      annee: '1ère année', time, day: 'Mercredi', academicYear: '2026-2027',
    };
    const teacherAttendanceId = `${prefix}-presence-${suffix}`;
    await seed('schedules', schedule.id, { ...schedule });
    await seed('attendance_formateurs', teacherAttendanceId, {
      teacherId: teacher.id, date, status: 'present', timeSlot: time,
      tokenAttendance: teacher.tokenAttendance, moduleId: 'Module fictif',
      hours: 2, timestamp: serverTimestamp(),
    });
    const eventId = makeClassAttendanceActivityId(schedule.id, date);
    await deleteDoc(doc(owner, 'activity_logs', eventId));
    seededDocuments.push(doc(owner, 'activity_logs', eventId));
    return { teacher, schedule, date, teacherAttendanceId, tokenAttendance: teacher.tokenAttendance };
  };
  const marker = async input => {
    const presence = (await getDocFromServer(doc(owner, 'attendance_formateurs', input.teacherAttendanceId))).data();
    return presence.classAttendanceEvents?.[makeClassAttendanceActivityId(input.schedule.id, input.date)];
  };

  try {
    await seed('teachers', teacher.id, teacher);
    await seed('users', `${prefix}-admin`, { isActive: true, role: 'admin', displayName: 'Admin fictif' });
    await seed('users', `${prefix}-dashboard`, { isActive: true, role: 'custom', permissions: { dashboard: 'view', logs: 'none' } });
    await seed('users', `${prefix}-other`, { isActive: true, role: 'custom', displayName: 'Membre fictif', permissions: { dashboard: 'none', logs: 'none' } });

    await t.test('completion creates exactly one activity and contains no portal token', async () => {
      const input = await fixture('once');
      assert.equal(await recordClassAttendanceActivity(portal, input), true);
      assert.equal(await recordClassAttendanceActivity(portal, input), false);
      const eventRef = doc(admin, 'activity_logs', makeClassAttendanceActivityId(input.schedule.id, date));
      const event = (await getDocFromServer(eventRef)).data();
      assert.equal(event.userName, teacher.name);
      assert.equal(event.userRole, 'formateur');
      assert.equal(event.metadata.major, input.schedule.filiere);
      assert.equal(event.actionType, 'CLASS_ATTENDANCE_COMPLETED');
      assert.equal(event.timestamp.isEqual(event.createdAt), true);
      assert.equal(JSON.stringify(event).includes(teacher.tokenAttendance), false);
      assert.equal(await marker(input), true);
    });

    await t.test('concurrent completion attempts produce one event', async () => {
      const input = await fixture('concurrent');
      const results = await Promise.all([
        recordClassAttendanceActivity(portal, input), recordClassAttendanceActivity(portal, input),
      ]);
      assert.deepEqual(results.sort(), [false, true]);
      assert.equal(await marker(input), true);
    });

    await t.test('historical time-slot spacing is accepted and normalized to the schedule', async () => {
      const input = await fixture('historical-time');
      await updateDoc(doc(owner, 'attendance_formateurs', input.teacherAttendanceId), { timeSlot: '08:30 - 10:30' });
      assert.equal(await recordClassAttendanceActivity(portal, input), true);
      assert.equal(await marker(input), true);
      const presence = (await getDocFromServer(doc(owner, 'attendance_formateurs', input.teacherAttendanceId))).data();
      assert.equal(presence.timeSlot, input.schedule.time);
    });

    await t.test('two classes sharing one formateur attendance record have separate activities', async () => {
      const first = await fixture('shared-one');
      const second = {
        ...first,
        schedule: { ...first.schedule, id: `${prefix}-shared-two`, filiere: 'Autre classe fictive' },
      };
      await seed('schedules', second.schedule.id, second.schedule);
      const secondRef = doc(owner, 'activity_logs', makeClassAttendanceActivityId(second.schedule.id, date));
      await deleteDoc(secondRef); seededDocuments.push(secondRef);
      assert.equal(await recordClassAttendanceActivity(portal, first), true);
      assert.equal(await recordClassAttendanceActivity(portal, second), true);
      assert.equal(await marker(first), true);
      assert.equal(await marker(second), true);
    });

    await t.test('dashboard members can read class activities and anonymous visitors cannot', async () => {
      const input = await fixture('visible');
      const id = makeClassAttendanceActivityId(input.schedule.id, date);
      const feedQuery = query(collection(dashboard, 'activity_logs'),
        where('actionType', '==', 'CLASS_ATTENDANCE_COMPLETED'), orderBy('timestamp', 'desc'), limit(50));
      let unsubscribe = () => {};
      let timeout;
      let completion;
      const appeared = new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('La notification doit apparaître dans le flux en direct.')), 8000);
        unsubscribe = onSnapshot(feedQuery, snapshot => {
          if (snapshot.docs.some(item => item.id === id)) {
            resolve();
          } else if (!completion) {
            // Save only after the dashboard listener has delivered its initial state.
            completion = recordClassAttendanceActivity(portal, input);
            completion.catch(reject);
          }
        }, reject);
      });
      try {
        await appeared;
        assert.equal(await completion, true);
      } finally {
        clearTimeout(timeout);
        unsubscribe();
      }
      assert.equal((await getDocFromServer(doc(admin, 'activity_logs', id))).exists(), true);
      assert.equal((await getDocFromServer(doc(dashboard, 'activity_logs', id))).exists(), true);
      const events = await getDocsFromServer(query(collection(dashboard, 'activity_logs'), where('actionType', '==', 'CLASS_ATTENDANCE_COMPLETED')));
      assert.ok(events.docs.some(item => item.id === id));
      await denied(getDocsFromServer(collection(portal, 'activity_logs')));
      await denied(getDocFromServer(doc(portal, 'activity_logs', id)));
      await denied(getDocFromServer(doc(other, 'activity_logs', id)));
      await denied(getDocsFromServer(collection(dashboard, 'activity_logs')));
    });

    await t.test('attributed member events cannot forge the reserved attendance action or document prefix', async () => {
      const input = await fixture('reserved-member');
      await updateDoc(doc(owner, 'attendance_formateurs', input.teacherAttendanceId), { status: 'absent' });
      const ordinaryId = `${prefix}-ordinary-member-event`;
      const forgedId = `${prefix}-forged-member-event`;
      for (const id of [ordinaryId, forgedId]) {
        const ref = doc(owner, 'activity_logs', id);
        await deleteDoc(ref); seededDocuments.push(ref);
      }
      const event = {
        userId: `${prefix}-other`, userName: 'Membre fictif', userRole: 'custom',
        message: 'Mise à jour fictive.', actionType: 'UPDATE', module: 'app', type: 'info',
        timestamp: serverTimestamp(), createdAt: serverTimestamp(),
      };
      await setDoc(doc(other, 'activity_logs', ordinaryId), event);
      assert.equal((await getDocFromServer(doc(owner, 'activity_logs', ordinaryId))).exists(), true);
      await denied(setDoc(doc(other, 'activity_logs', forgedId), {
        ...event, actionType: 'CLASS_ATTENDANCE_COMPLETED',
      }));
      const reservedId = makeClassAttendanceActivityId(input.schedule.id, date);
      await denied(setDoc(doc(other, 'activity_logs', reservedId), event));
      assert.equal((await getDocFromServer(doc(owner, 'activity_logs', forgedId))).exists(), false);
      assert.equal((await getDocFromServer(doc(owner, 'activity_logs', reservedId))).exists(), false);
      assert.equal(await marker(input), undefined);
    });

    await t.test('invalid tokens reject both the activity and its presence marker', async () => {
      const input = await fixture('wrong-token');
      await denied(recordClassAttendanceActivity(portal, { ...input, tokenAttendance: 'invalid-token' }));
      assert.equal(await marker(input), undefined);
      assert.equal((await getDocFromServer(doc(owner, 'activity_logs', makeClassAttendanceActivityId(input.schedule.id, date)))).exists(), false);
      const presence = (await getDocFromServer(doc(owner, 'attendance_formateurs', input.teacherAttendanceId))).data();
      assert.equal(presence.tokenAttendance, teacher.tokenAttendance);
    });

    await t.test('an immutable activity without its receipt does not hide a permission rejection', async () => {
      const input = await fixture('missing-receipt');
      assert.equal(await recordClassAttendanceActivity(portal, input), true);
      await updateDoc(doc(owner, 'attendance_formateurs', input.teacherAttendanceId), { classAttendanceEvents: {} });
      await denied(recordClassAttendanceActivity(portal, input));
      assert.equal(await marker(input), undefined);
    });

    await t.test('a forged teacher name is rejected without a completion marker', async () => {
      const input = await fixture('wrong-name');
      await denied(recordClassAttendanceActivity(portal, { ...input, teacher: { ...teacher, name: 'Faux auteur' } }));
      assert.equal(await marker(input), undefined);
    });

    await t.test('a forged class or schedule assignment is rejected atomically', async () => {
      const input = await fixture('wrong-class');
      await denied(recordClassAttendanceActivity(portal, { ...input, schedule: { ...input.schedule, filiere: 'Fausse classe' } }));
      assert.equal(await marker(input), undefined);
      await updateDoc(doc(owner, 'schedules', input.schedule.id), { teacherId: 'other-teacher' });
      await denied(recordClassAttendanceActivity(portal, input));
      assert.equal(await marker(input), undefined);
    });

    await t.test('missing, absent or mismatched teacher attendance cannot create an activity', async () => {
      const input = await fixture('incomplete');
      const precondition = input => assert.rejects(recordClassAttendanceActivity(portal, input), { code: 'failed-precondition' });
      await precondition({ ...input, teacherAttendanceId: `${prefix}-missing` });
      for (const patch of [{ status: 'absent' }, { status: 'present', teacherId: 'other-teacher' },
        { teacherId: teacher.id, date: '2026-10-08' }, { date, timeSlot: '10:30-12:00' }]) {
        await updateDoc(doc(owner, 'attendance_formateurs', input.teacherAttendanceId), patch);
        await precondition(input);
      }
      assert.equal(await marker(input), undefined);
    });
  } finally {
    await Promise.all(seededDocuments.map(ref => deleteDoc(ref)));
    await Promise.all(resources.map(async ({ app, db }) => { await terminate(db); await deleteApp(app); }));
  }
});
