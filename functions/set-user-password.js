import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { toAuthEmail } from '../src/utils/loginIdentifier.js';

const [projectId, identifier, newPassword] = process.argv.slice(2);
if (!projectId || !identifier || !newPassword) {
  console.error('Usage : node functions/set-user-password.js PROJECT_ID IDENTIFIANT_OU_EMAIL NOUVEAU_MOT_DE_PASSE');
  process.exit(1);
}

if (typeof newPassword !== 'string' || newPassword.length < 6) {
  console.error('Erreur : Le mot de passe doit comporter au moins 6 caractères.');
  process.exit(1);
}

initializeApp({ projectId, credential: applicationDefault() });
const cleanEmail = toAuthEmail(identifier);
const auth = getAuth();
const db = getFirestore();

try {
  const account = await auth.getUserByEmail(cleanEmail);
  await auth.updateUser(account.uid, { password: newPassword });
  
  const userRef = db.doc(`users/${account.uid}`);
  const userDoc = await userRef.get();
  const displayName = userDoc.exists ? userDoc.data().displayName : (account.displayName || cleanEmail);

  await db.collection('activity_logs').add({
    userId: 'cli-admin',
    userName: 'Administrateur CLI',
    userRole: 'admin',
    actionType: 'PASSWORD_CHANGED',
    module: 'users',
    metadata: { targetId: account.uid },
    message: `Mot de passe mis à jour manuellement via CLI pour ${displayName}`,
    type: 'info',
    timestamp: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`✓ Mot de passe mis à jour avec succès pour "${displayName}" (${cleanEmail}).`);
} catch (error) {
  console.error('Erreur lors de la mise à jour du mot de passe :', error.message);
  process.exit(1);
}
