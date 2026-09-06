import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { normalizePermissions } from '../src/utils/permissions.js';

const [projectId, uid] = process.argv.slice(2);
if (!projectId || !uid || uid.includes('/')) throw new Error('Usage : node functions/bootstrap-admin.js PROJECT_ID FIREBASE_AUTH_UID');
initializeApp({ projectId, credential: applicationDefault() });
const account = await getAuth().getUser(uid);
if (account.disabled || !account.email) throw new Error('Le compte Auth doit être actif et posséder une adresse email.');
const db = getFirestore();
await db.runTransaction(async transaction => {
  const admins = await transaction.get(db.collection('users').where('role', 'in', ['admin', 'super_admin']));
  if (admins.docs.some(item => item.data().isActive === true)) throw new Error('Un administrateur actif existe déjà. Utilisez la gestion des utilisateurs.');
  const ref = db.doc(`users/${uid}`);
  const existing = await transaction.get(ref);
  if (existing.exists) throw new Error('Ce profil existe déjà. Aucune modification effectuée.');
  transaction.create(ref, {
    uid, email: account.email, displayName: account.displayName || 'Administrateur principal',
    role: 'admin', isActive: true, permissions: normalizePermissions('admin'),
    createdAt: FieldValue.serverTimestamp(), lastLogin: null,
  });
});
console.log('Profil du premier administrateur créé. Aucun mot de passe enregistré dans le code.');
