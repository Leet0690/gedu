import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDocs,
  getFirestore,
  updateDoc,
} from 'firebase/firestore';
import { argv, env, exit, loadEnvFile } from 'node:process';

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

const dryRun = argv.includes('--dry-run');
const gradeFields = ['c1', 'c2', 'c3', 'efcfp', 'efcft', 'moyCC', 'moyEFCFT', 'moyEFCFP', 'nsti'];

const gradeMigrations = [
  {
    fromKey: 'SOFTSKILS',
    toModules: ['Soft skills'],
  },
  {
    fromKey: 'ERP',
    toModules: ['ERP avec ODOO'],
  },
  {
    fromKey: 'Soft skills et Techniques de communication',
    toModules: ['Soft skills'],
  },
  {
    fromKey: 'Développement web (HTML/PHP/CSS/JavaScript)',
    toModules: ['Développement web (HTML / PHP / CSS / JavaScript)'],
  },
  {
    fromKey: 'Management et Organisation des E/ses',
    toModules: [
      'Management et organisation des entreprises',
      'Management et Organisation des entreprises',
    ],
  },
];

const isFilled = (value) => value !== undefined && value !== null && value !== '';
const sanitizeGradeKey = (subject = '') => String(subject || '').replace(/\./g, '_');
const classKey = (item = {}) => `${item.diploma || ''}__${item.major || ''}__${item.year || ''}`;
const displayStudent = (student = {}) => `${student.lastName || ''} ${student.firstName || ''}`.trim() || student.id;
const displayClass = (student = {}) => `${student.diploma || '—'} | ${student.major || '—'} | ${student.year || '—'}`;
const normalizeText = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('fr');

const hasEnteredGrade = (grade) =>
  !!grade && typeof grade === 'object' && gradeFields.some(field => isFilled(grade[field]));

const mergeGrade = (targetGrade = {}, sourceGrade = {}) => {
  const merged = { ...(targetGrade || {}) };

  Object.entries(sourceGrade || {}).forEach(([field, value]) => {
    if (!isFilled(merged[field]) && isFilled(value)) {
      merged[field] = value;
    } else if (merged[field] === undefined && value !== undefined) {
      merged[field] = value;
    }
  });

  return merged;
};

const getConflicts = (targetGrade = {}, sourceGrade = {}) => {
  const conflicts = [];

  gradeFields.forEach(field => {
    if (
      isFilled(sourceGrade?.[field]) &&
      isFilled(targetGrade?.[field]) &&
      String(sourceGrade[field]) !== String(targetGrade[field])
    ) {
      conflicts.push(`${field}: ancien=${sourceGrade[field]}, officiel=${targetGrade[field]}`);
    }
  });

  return conflicts;
};

const createdAtMillis = (module = {}) => {
  const createdAt = module.createdAt;
  if (!createdAt) return Number.MAX_SAFE_INTEGER;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt.seconds === 'number') return createdAt.seconds * 1000 + Math.floor((createdAt.nanoseconds || 0) / 1000000);
  return Number.MAX_SAFE_INTEGER;
};

async function readCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function migrateGrades(students, modules, gradesDocs) {
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
  let conflictCount = 0;

  for (const gradeDoc of gradesDocs) {
    const student = studentsById.get(gradeDoc.id);
    if (!student) continue;

    const classModules = modulesByClass.get(classKey(student)) || new Set();
    const setFields = new Map();
    const deleteFields = new Set();
    let hasUpdates = false;

    for (const { fromKey, toModules } of gradeMigrations) {
      if (!Object.prototype.hasOwnProperty.call(gradeDoc, fromKey)) continue;
      if (!hasEnteredGrade(gradeDoc[fromKey])) {
        deleteFields.add(fromKey);
        hasUpdates = true;
        console.log(`Nettoyage vide: ${displayStudent(student)} | ${fromKey}`);
        continue;
      }

      const toModule = toModules.find(candidate => classModules.has(candidate));
      if (!toModule) {
        skippedKeys++;
        console.log(`Ignoré: ${displayStudent(student)} | ${displayClass(student)} | ${fromKey} (module cible absent)`);
        continue;
      }

      const toKey = sanitizeGradeKey(toModule);
      const sourceGrade = gradeDoc[fromKey];
      const targetGrade = setFields.get(toKey) || gradeDoc[toKey] || {};
      const conflicts = getConflicts(targetGrade, sourceGrade);
      if (conflicts.length) {
        conflictCount++;
        console.log(`Conflit conservé côté officiel: ${displayStudent(student)} | ${fromKey} -> ${toKey} | ${conflicts.join('; ')}`);
      } else {
        console.log(`Migration: ${displayStudent(student)} | ${fromKey} -> ${toKey}`);
      }

      setFields.set(toKey, mergeGrade(targetGrade, sourceGrade));
      deleteFields.add(fromKey);
      hasUpdates = true;
      migratedKeys++;
    }

    if (hasUpdates) {
      updatedDocs++;
      if (!dryRun) {
        const updateArgs = [];
        setFields.forEach((value, key) => {
          updateArgs.push(new FieldPath(key), value);
        });
        deleteFields.forEach(key => {
          updateArgs.push(new FieldPath(key), deleteField());
        });
        await updateDoc(doc(db, 'grades', gradeDoc.id), ...updateArgs);
      }
    }
  }

  return { updatedDocs, migratedKeys, skippedKeys, conflictCount };
}

async function deleteDuplicateModules(modules) {
  const groups = new Map();

  modules.forEach(module => {
    const key = [
      module.diploma || '',
      module.major || '',
      module.year || '',
      normalizeText(module.name),
      String(module.coefficient ?? ''),
      module.semester || 'S1',
    ].join('__');

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(module);
  });

  let duplicateGroups = 0;
  let deletedModules = 0;

  for (const duplicates of groups.values()) {
    if (duplicates.length <= 1) continue;
    duplicateGroups++;

    const sorted = duplicates.sort((a, b) =>
      createdAtMillis(a) - createdAtMillis(b) || String(a.id).localeCompare(String(b.id))
    );
    const [kept, ...toDelete] = sorted;
    console.log(`Doublon module: on garde "${kept.name}" (${kept.id}) | ${kept.diploma} | ${kept.major} | ${kept.year}`);

    for (const module of toDelete) {
      console.log(`Suppression doublon: ${module.name} (${module.id})`);
      deletedModules++;
      if (!dryRun) {
        await deleteDoc(doc(db, 'modules', module.id));
      }
    }
  }

  return { duplicateGroups, deletedModules };
}

async function run() {
  console.log(`=== Correction notes/modules (${dryRun ? 'simulation' : 'réel'}) ===`);

  const [students, modules, gradesDocs] = await Promise.all([
    readCollection('students'),
    readCollection('modules'),
    readCollection('grades'),
  ]);

  const gradeResult = await migrateGrades(students, modules, gradesDocs);
  const duplicateResult = await deleteDuplicateModules(modules);

  console.log('Résumé notes:', gradeResult);
  console.log('Résumé doublons modules:', duplicateResult);
  console.log('=== Correction terminée ===');
  exit(0);
}

run().catch(error => {
  console.error('Erreur de correction:', error);
  exit(1);
});
