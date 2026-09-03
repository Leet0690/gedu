import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";
import process, { argv, env, loadEnvFile } from 'node:process';

try { loadEnvFile(); } catch { /* Environment variables may already be exported. */ }

if (!env.VITE_FIREBASE_API_KEY) {
  throw new Error("Firebase config manquante.");
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const APPLY = argv.includes('--apply');

async function migrateSchedules() {
  console.log(APPLY
    ? '⚡ MODE APPLICATION: Les modifications seront écrites dans Firestore.\n'
    : '🔍 MODE SIMULATION: Utilisez --apply pour écrire les modifications.\n'
  );

  const snap = await getDocs(collection(db, 'schedules'));
  const allSchedules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Total séances trouvées: ${allSchedules.length}`);

  const toMigrate = allSchedules.filter(s => !s.academicYear);
  console.log(`Séances sans academicYear (à associer à 2025-2026): ${toMigrate.length}`);

  if (toMigrate.length === 0) {
    console.log('✅ Toutes les séances ont déjà une année académique définie.');
    process.exit(0);
  }

  if (!APPLY) {
    console.log('\nExemples de séances à mettre à jour:');
    toMigrate.slice(0, 5).forEach(s => {
      console.log(` - [${s.id}] ${s.day} ${s.time} | ${s.module || s.moduleS1} | ${s.filiere} ${s.annee}`);
    });
    console.log('\nRelancez avec --apply pour appliquer la migration dans Firestore.');
    process.exit(0);
  }

  const BATCH_SIZE = 450;
  for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = toMigrate.slice(i, i + BATCH_SIZE);
    chunk.forEach(s => {
      batch.update(doc(db, 'schedules', s.id), { academicYear: '2025-2026' });
    });
    await batch.commit();
    console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} séances mises à jour.`);
  }

  console.log(`\n✅ Migration terminée avec succès : ${toMigrate.length} séances associées à 2025-2026.`);
  process.exit(0);
}

migrateSchedules().catch(err => {
  console.error('Erreur migration:', err);
  process.exit(1);
});
