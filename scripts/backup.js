import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { argv, cwd, env, exit, loadEnvFile } from 'node:process';

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
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const academicYearArgument = argv.find(argument => argument.startsWith('--academic-year='));
const academicYear = academicYearArgument?.split('=')[1] || env.BACKUP_ACADEMIC_YEAR || '';

const collections = [
  'students',
  'teachers',
  'grades',
  'schedules',
  'attendance_stagiaires',
  'attendance_formateurs',
  'payments',
  'salaries',
  'expenses',
  'modules',
  'settings',
  'activity_logs',
  'access_logs',
  'operations',
  'receipt_counters',
  'continuousTrainings',
  'continuousTrainingTypes',
  'ctStudents',
  'ctSessions',
  'tokens'
];

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backup-${timestamp}`;
  const backupRoot = path.join(cwd(), 'backups');
  const backupDir = path.join(backupRoot, backupName);
  const temporaryDir = path.join(backupRoot, `.${backupName}.partial`);
  const manifest = {
    schemaVersion: 2,
    status: 'creating',
    generatedAt: new Date().toISOString(),
    projectId: firebaseConfig.projectId,
    databaseId: '(default)',
    academicYear: academicYear || null,
    scope: 'full_database',
    collections: {},
  };

  fs.mkdirSync(temporaryDir, { recursive: true });

  console.log(`Starting backup to ${backupDir}...`);

  const errors = [];

  for (const colName of collections) {
    try {
      console.log(`Fetching collection: ${colName}...`);
      const querySnapshot = await getDocs(collection(db, colName));
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const serialized = JSON.stringify(data, null, 2);
      JSON.parse(serialized);
      const bytes = Buffer.from(serialized, 'utf8');
      const filePath = path.join(temporaryDir, `${colName}.json`);
      fs.writeFileSync(filePath, bytes);
      manifest.collections[colName] = {
        documents: data.length,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
      console.log(`Saved ${data.length} documents to ${colName}.json`);
    } catch (error) {
      const message = String(error?.message || error);
      manifest.collections[colName] = { status: 'failed', error: message };
      errors.push({ collection: colName, error: message });
      console.error(`Error backing up ${colName}:`, error.message);
    }
  }

  manifest.totalDocuments = Object.values(manifest.collections)
    .reduce((total, entry) => total + (Number(entry.documents) || 0), 0);
  manifest.totalBytes = Object.values(manifest.collections)
    .reduce((total, entry) => total + (Number(entry.bytes) || 0), 0);

  if (errors.length > 0) {
    manifest.status = 'failed';
    manifest.errors = errors;
    fs.writeFileSync(
      path.join(temporaryDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    console.error(`Backup failed: ${errors.length} collection(s) could not be exported.`);
    exit(1);
  }

  for (const [colName, expected] of Object.entries(manifest.collections)) {
    const filePath = path.join(temporaryDir, `${colName}.json`);
    const bytes = fs.readFileSync(filePath);
    const parsed = JSON.parse(bytes.toString('utf8'));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (
      !Array.isArray(parsed) ||
      parsed.length !== expected.documents ||
      bytes.length !== expected.bytes ||
      sha256 !== expected.sha256
    ) {
      throw new Error(`Validation failed for ${colName}.json`);
    }
  }

  manifest.status = 'completed';
  manifest.completedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(temporaryDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  fs.renameSync(temporaryDir, backupDir);
  console.log(`Backup completed and verified: ${manifest.totalDocuments} documents.`);
  exit(0);
}

backup().catch(error => {
  console.error('Backup failed:', error);
  exit(1);
});
