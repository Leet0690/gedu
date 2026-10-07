import { doc, setDoc, getDocFromServer, deleteDoc, serverTimestamp } from 'firebase/firestore';

export async function readTeacherPortalGrades(db, uid, teacherId, tokenGrades, studentIds = []) {
  const sessionRef = doc(db, 'teacher_grade_sessions', uid);
  await setDoc(sessionRef, { teacherId, tokenGrades, createdAt: serverTimestamp() });
  try {
    const result = {};
    const ids = [...new Set(studentIds)];
    // Each individual read is authorized against the student's assigned group.
    for (let i = 0; i < ids.length; i += 10) {
      const snapshots = await Promise.all(ids.slice(i, i + 10).map(id => getDocFromServer(doc(db, 'grades', id))));
      snapshots.forEach(snapshot => {
        if (snapshot.exists()) result[snapshot.id] = snapshot.data();
      });
    }
    return result;
  } finally {
    await deleteDoc(sessionRef).catch(() => {
      console.warn('La session de lecture des notes expirera automatiquement.');
    });
  }
}
