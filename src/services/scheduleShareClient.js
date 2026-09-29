import { collection, doc, getDocFromServer, getDocsFromServer, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { buildSchedulePublication, isScheduleShareToken } from '../utils/schedulePublication.js';

const randomToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

export const createScheduleShareClient = (db, auth) => {
  const createScheduleShare = async (input, source) => {
    if (!auth.currentUser) throw new Error('Connectez-vous pour publier cet emploi du temps.');
    const { scope, rows } = buildSchedulePublication(input, source);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(scope)));
    const scopeId = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    const indexRef = doc(db, 'schedule_share_scopes', scopeId);
    const token = await runTransaction(db, async transaction => {
      const current = await transaction.get(indexRef);
      if (current.exists()) {
        if (!isScheduleShareToken(current.data().token)) throw new Error('Le lien enregistré est invalide.');
        return current.data().token;
      }
      const nextToken = randomToken();
      transaction.set(indexRef, { token: nextToken });
      return nextToken;
    });
    const parent = doc(db, 'public_schedules', token);
    const sessions = collection(parent, 'sessions');
    const previous = await getDocsFromServer(sessions);
    if (previous.size > 200) throw new Error('La publication précédente dépasse la limite autorisée.');
    // Atomic publication: no partially written schedule, no private source fields.
    const batch = writeBatch(db);
    batch.set(parent, { ...scope, publishedAt: serverTimestamp() });
    previous.docs.forEach(item => batch.delete(item.ref));
    rows.forEach(row => batch.set(doc(sessions), row));
    await batch.commit();
    return { token };
  };

  const getPublicSchedule = async token => {
    if (!isScheduleShareToken(token)) throw new Error('Ce lien de consultation est invalide.');
    const parent = doc(db, 'public_schedules', token);
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await getDocFromServer(parent);
      if (!before.exists()) throw new Error('Ce lien de consultation n’est plus disponible.');
      const sessions = await getDocsFromServer(collection(parent, 'sessions'));
      const after = await getDocFromServer(parent);
      if (after.exists() && before.data().publishedAt.isEqual(after.data().publishedAt)) {
        const { publishedAt, ...scope } = after.data();
        return { ...scope, publishedAt: publishedAt.toDate().toISOString(), schedules: sessions.docs.map(item => ({ id: item.id, ...item.data() })) };
      }
    }
    throw new Error('Le planning est en cours de publication. Réessayez dans quelques instants.');
  };

  return { createScheduleShare, getPublicSchedule };
};

export const getScheduleShareErrorMessage = (error, action = 'load') => {
  if (error?.code === 'permission-denied') return action === 'create'
    ? 'Publication refusée : vérifiez votre droit de consultation des emplois du temps et les règles Firestore de partage.'
    : 'Ce lien n’est pas accessible. Demandez un lien actualisé à votre établissement.';
  if (!error?.code && error?.message) return error.message;
  return action === 'create'
    ? 'Impossible de publier le planning. Vérifiez votre connexion puis réessayez.'
    : 'Impossible de charger l’emploi du temps. Vérifiez votre connexion puis réessayez.';
};
