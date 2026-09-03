import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import process, { argv, env, loadEnvFile } from 'node:process';
import readline from 'node:readline';

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

const DRY_RUN = !argv.includes('--apply');

const ask = (question) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
};

async function undoLastClosure() {
  console.log(DRY_RUN
    ? '🔍 MODE SIMULATION (--dry-run par défaut). Utilisez --apply pour appliquer.\n'
    : '⚡ MODE APPLICATION. Les modifications seront écrites dans Firestore.\n'
  );

  // 1. Read current settings
  const settingsSnap = await getDoc(doc(db, 'settings', 'app'));
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  const currentOperationalYear = settings.operationalAcademicYear;
  console.log(`Année opérationnelle actuelle: ${currentOperationalYear}`);

  // 2. Find the operationId of the last closure
  const opsSnap = await getDocs(collection(db, 'operations'));
  const closures = opsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(op => op.type === 'academic_year_closure')
    .sort((a, b) => String(b.fromAcademicYear || '').localeCompare(String(a.fromAcademicYear || '')));

  if (closures.length === 0) {
    console.log('Aucune opération de clôture trouvée.');
    process.exit(0);
  }

  const lastClosure = closures[0];
  console.log(`\nDernière clôture: ${lastClosure.fromAcademicYear} → ${lastClosure.toAcademicYear}`);
  console.log(`   operationId: ${lastClosure.operationId}`);
  console.log(`   promus: ${lastClosure.promotedCount}, lauréats: ${lastClosure.graduatedCount}`);

  // 3. Find affected students
  const stuSnap = await getDocs(collection(db, 'students'));
  const allStudents = stuSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const affected = allStudents.filter(s =>
    Array.isArray(s.classHistory) &&
    s.classHistory.length > 0 &&
    s.classHistory[s.classHistory.length - 1].operationId === lastClosure.operationId
  );

  console.log(`\nStagiaires affectés: ${affected.length}`);
  if (affected.length === 0) {
    console.log('Aucun stagiaire à restaurer.');
    process.exit(0);
  }

  // 4. Build restore updates
  const restoreYear = lastClosure.fromAcademicYear;
  console.log(`\nRestauration vers: operationalAcademicYear = ${restoreYear}`);

  const updates = affected.map(student => {
    const lastEntry = student.classHistory[student.classHistory.length - 1];
    const restoredHistory = student.classHistory.slice(0, -1);

    return {
      id: student.id,
      name: `${student.lastName || ''} ${student.firstName || ''}`.trim(),
      regNo: student.regNo || '?',
      currentStatus: student.status,
      currentYear: student.year,
      restoredYear: lastEntry.year,
      restoredStatus: lastEntry.status || 'active',
      firestoreData: {
        year: lastEntry.year,
        status: lastEntry.status || 'active',
        academicYear: lastEntry.academicYear || '',
        classHistory: restoredHistory,
        graduationAcademicYear: '',
        graduatedAt: '',
        previousAcademicYear: '',
        promotedFromYear: '',
        promotedAt: '',
        updatedAt: serverTimestamp(),
      },
    };
  });

  console.log('\nAperçu des restaurations:');
  updates.forEach(u => {
    console.log(`   ${u.name} (${u.regNo}): ${u.currentStatus}/${u.currentYear} → ${u.restoredStatus}/${u.restoredYear}`);
  });

  // Build archived years
  const currentArchived = settings.archivedAcademicYears || [];
  const restoredArchived = currentArchived.filter(y => y < restoreYear);
  console.log(`\narchivedAcademicYears: ${JSON.stringify(currentArchived)} → ${JSON.stringify(restoredArchived)}`);

  if (DRY_RUN) {
    console.log('\n✅ Simulation terminée. Lancez avec --apply pour appliquer les modifications.');
    process.exit(0);
  }

  // Confirm
  const answer = await ask(`\n⚠️  Vous êtes sur le point de restaurer ${updates.length} stagiaire(s) et de remettre l'année à ${restoreYear}. Continuer ? (oui/non) `);
  if (answer.toLowerCase() !== 'oui') {
    console.log('Annulé.');
    process.exit(0);
  }

  // 5. Apply in batches
  for (let i = 0; i < updates.length; i += 450) {
    const batch = writeBatch(db);
    const chunk = updates.slice(i, i + 450);
    const isFinal = i + 450 >= updates.length;

    chunk.forEach(({ id, firestoreData }) => {
      batch.update(doc(db, 'students', id), firestoreData);
    });

    if (isFinal) {
      batch.set(doc(db, 'settings', 'app'), {
        operationalAcademicYear: restoreYear,
        archivedAcademicYears: restoredArchived,
        academicYearUpdatedAt: serverTimestamp(),
      }, { merge: true });
    }

    await batch.commit();
    console.log(`   Batch ${Math.floor(i / 450) + 1}: ${chunk.length} stagiaire(s) restauré(s)`);
  }

  console.log(`\n✅ Restauration terminée. ${updates.length} stagiaire(s) restauré(s).`);
  console.log(`   operationalAcademicYear: ${restoreYear}`);
  console.log(`   archivedAcademicYears: ${JSON.stringify(restoredArchived)}`);
  console.log('\n⚠️  Videz le cache du navigateur (localStorage) et rechargez l\'application.');
  process.exit(0);
}

undoLastClosure().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
