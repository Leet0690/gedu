import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteField,
  doc,
  getDocs,
  getFirestore,
  updateDoc,
} from 'firebase/firestore';
import { env, exit, loadEnvFile } from 'node:process';

try { loadEnvFile(); } catch { /* Environment variables may already be exported. */ }

if (!env.VITE_FIREBASE_API_KEY) {
  throw new Error('Firebase config manquante. Définissez VITE_FIREBASE_API_KEY et les autres variables VITE_FIREBASE_*');
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

const dryRun = process.argv.includes('--dry-run');
const isFilled = (value) => value !== undefined && value !== null && value !== '';
const sanitizeGradeKey = (subject = '') => String(subject || '').replace(/\./g, '_');
const classKey = (item = {}) => `${item.diploma || ''}__${item.major || ''}__${item.year || ''}`;

const migrations = [
  {
    fromKey: 'SOFTSKILS',
    toModule: 'Soft skills',
  },
  {
    fromKey: 'ERP',
    toModule: 'ERP avec ODOO',
  },
];

const mergeGrade = (targetGrade = {}, sourceGrade = {}) => {
  const merged = { ...targetGrade };

  Object.entries(sourceGrade || {}).forEach(([field, value]) => {
    if (!isFilled(merged[field]) && isFilled(value)) {
      merged[field] = value;
    } else if (merged[field] === undefined && value !== undefined) {
      merged[field] = value;
    }
  });

  return merged;
};

async function readCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function migrate() {
  console.log(`=== Migration des anciennes clés de notes TGI (${dryRun ? 'simulation' : 'réel'}) ===`);

  const [students, modules, gradesDocs] = await Promise.all([
    readCollection('students'),
    readCollection('modules'),
    readCollection('grades'),
  ]);

  const studentsById = new Map(students.map(student => [student.id, student]));
  const modulesByClass = new Map();

  modules.forEach(module => {
    const key = classKey(module);
    if (!modulesByClass.has(key)) modulesByClass.set(key, new Set());
    modulesByClass.get(key).add(module.name);
  });

  let updatedDocs = 0;
  let migratedKeys = 0;
  let skippedKeys = 0;

  for (const gradeDoc of gradesDocs) {
    const student = studentsById.get(gradeDoc.id);
    if (!student) continue;

    const classModules = modulesByClass.get(classKey(student)) || new Set();
    const updates = {};
    let hasUpdates = false;

    migrations.forEach(({ fromKey, toModule }) => {
      if (!Object.prototype.hasOwnProperty.call(gradeDoc, fromKey)) return;

      if (!classModules.has(toModule)) {
        skippedKeys++;
        console.log(`Ignoré: ${student.lastName || ''} ${student.firstName || ''} | ${fromKey} -> ${toModule} (module cible absent de la classe)`);
        return;
      }

      const toKey = sanitizeGradeKey(toModule);
      const mergedGrade = mergeGrade(gradeDoc[toKey], gradeDoc[fromKey]);
      updates[toKey] = mergedGrade;
      updates[fromKey] = deleteField();
      hasUpdates = true;
      migratedKeys++;

      console.log(`Migration: ${student.lastName || ''} ${student.firstName || ''} | ${fromKey} -> ${toKey}`);
    });

    if (hasUpdates) {
      updatedDocs++;
      if (!dryRun) {
        await updateDoc(doc(db, 'grades', gradeDoc.id), updates);
      }
    }
  }

  console.log(`Documents notes modifiés: ${updatedDocs}`);
  console.log(`Clés migrées: ${migratedKeys}`);
  console.log(`Clés ignorées: ${skippedKeys}`);
  console.log('=== Migration terminée ===');
  exit(0);
}

migrate().catch(error => {
  console.error('Erreur de migration:', error);
  exit(1);
});
