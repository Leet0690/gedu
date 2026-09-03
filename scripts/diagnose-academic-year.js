import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import process, { env, loadEnvFile } from 'node:process';

try { loadEnvFile(); } catch { /* Environment variables may already be exported. */ }

if (!env.VITE_FIREBASE_API_KEY) {
  throw new Error("Firebase config manquante. Définissez VITE_FIREBASE_API_KEY et les autres variables VITE_FIREBASE_*");
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

async function diagnose() {
  console.log('=== DIAGNOSTIC ANNÉE ACADÉMIQUE ===\n');

  // 1. Check settings/app
  const settingsSnap = await getDoc(doc(db, 'settings', 'app'));
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};

  console.log('📋 Paramètres actuels:');
  console.log(`   operationalAcademicYear: ${settings.operationalAcademicYear || '(non défini)'}`);
  console.log(`   archivedAcademicYears: ${JSON.stringify(settings.archivedAcademicYears || [])}`);
  console.log(`   activeSemester: ${settings.activeSemester || '(non défini)'}`);

  if (settings.academicYearClosure) {
    console.log(`   academicYearClosure:`);
    console.log(`     status: ${settings.academicYearClosure.status}`);
    console.log(`     fromAcademicYear: ${settings.academicYearClosure.fromAcademicYear}`);
    console.log(`     toAcademicYear: ${settings.academicYearClosure.toAcademicYear}`);
    console.log(`     operationId: ${settings.academicYearClosure.operationId}`);
  }
  console.log('');

  // 2. Load all students
  const stuSnap = await getDocs(collection(db, 'students'));
  const students = stuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`📊 Total stagiaires: ${students.length}\n`);

  // 3. Analyze by academic year
  const byAcademicYear = {};
  students.forEach(s => {
    const ay = s.academicYear || '(aucune)';
    if (!byAcademicYear[ay]) byAcademicYear[ay] = { active: 0, laureat: 0, students: [] };
    if ((s.status || '').toLowerCase() === 'laureat') {
      byAcademicYear[ay].laureat++;
    } else {
      byAcademicYear[ay].active++;
    }
    byAcademicYear[ay].students.push(s);
  });

  console.log('📅 Répartition par academicYear:');
  Object.entries(byAcademicYear).sort(([a], [b]) => a.localeCompare(b)).forEach(([year, data]) => {
    console.log(`   ${year}: ${data.active} actif(s), ${data.laureat} lauréat(s)`);
  });
  console.log('');

  // 4. Find students affected by potential accidental closure (classHistory with 2026-2027)
  const affectedByAccidentalClosure = students.filter(s =>
    Array.isArray(s.classHistory) &&
    s.classHistory.length > 0 &&
    s.classHistory[s.classHistory.length - 1].academicYear === '2026-2027'
  );

  console.log(`⚠️  Stagiaires avec dernière classHistory = 2026-2027 (potentiellement affectés par clôture accidentelle): ${affectedByAccidentalClosure.length}`);
  affectedByAccidentalClosure.forEach(s => {
    const last = s.classHistory[s.classHistory.length - 1];
    console.log(`   - ${s.lastName || ''} ${s.firstName || ''} (${s.regNo || '?'}) | statut actuel: ${s.status} | year actuel: ${s.year} | classHistory: ${s.classHistory.length} entrée(s)`);
    console.log(`     Dernière entrée: ${JSON.stringify(last)}`);
  });
  console.log('');

  // 5. Check operations log for closures
  const opsSnap = await getDocs(collection(db, 'operations'));
  const closures = opsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(op => op.type === 'academic_year_closure')
    .sort((a, b) => String(a.fromAcademicYear || '').localeCompare(String(b.fromAcademicYear || '')));

  console.log(`📜 Opérations de clôture trouvées: ${closures.length}`);
  closures.forEach(op => {
    console.log(`   - ${op.fromAcademicYear} → ${op.toAcademicYear} | operationId: ${op.operationId} | promus: ${op.promotedCount} | lauréats: ${op.graduatedCount}`);
  });
  console.log('');

  // 6. Check 2ème année students for 2025-2026 via classHistory
  const secondYear2025 = students.filter(s =>
    Array.isArray(s.classHistory) &&
    s.classHistory.some(h => h.academicYear === '2025-2026' && (h.year || '').includes('2'))
  );
  console.log(`🎓 Stagiaires avec classHistory 2ème année en 2025-2026: ${secondYear2025.length}`);
  secondYear2025.forEach(s => {
    const entry = s.classHistory.find(h => h.academicYear === '2025-2026' && (h.year || '').includes('2'));
    console.log(`   - ${s.lastName || ''} ${s.firstName || ''} (${s.regNo || '?'}) | filière: ${entry.major || '?'} | statut actuel: ${s.status}`);
  });
  console.log('');

  // 7. Students currently 2ème année with academicYear 2025-2026 (no classHistory)
  const directSecondYear2025 = students.filter(s =>
    s.academicYear === '2025-2026' &&
    (s.year || '').includes('2') &&
    (!Array.isArray(s.classHistory) || !s.classHistory.some(h => h.academicYear === '2025-2026'))
  );
  console.log(`📌 Stagiaires 2ème année avec academicYear=2025-2026 (sans classHistory): ${directSecondYear2025.length}`);
  directSecondYear2025.forEach(s => {
    console.log(`   - ${s.lastName || ''} ${s.firstName || ''} (${s.regNo || '?'}) | statut: ${s.status} | year: ${s.year}`);
  });

  console.log('\n=== FIN DU DIAGNOSTIC ===');
  process.exit(0);
}

diagnose().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
