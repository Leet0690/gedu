import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from 'fs';
import path from 'path';
import { cwd, env, exit, loadEnvFile } from 'node:process';

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
  'access_logs',
  'tokens'
];

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(cwd(), 'backups', `backup-${timestamp}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`Starting backup to ${backupDir}...`);

  for (const colName of collections) {
    try {
      console.log(`Fetching collection: ${colName}...`);
      const querySnapshot = await getDocs(collection(db, colName));
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const filePath = path.join(backupDir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Saved ${data.length} documents to ${colName}.json`);
    } catch (error) {
      console.error(`Error backing up ${colName}:`, error.message);
    }
  }

  console.log('Backup completed successfully!');
  exit(0);
}

backup();
