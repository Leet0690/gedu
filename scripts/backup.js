import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from 'fs';
import path from 'path';

const firebaseConfig = {
  apiKey: "AIzaSyAG7CiN3A1ZaVDU21AFaFHTwi38CnDs-do",
  authDomain: "ipfp-4802c.firebaseapp.com",
  projectId: "ipfp-4802c",
  storageBucket: "ipfp-4802c.firebasestorage.app",
  messagingSenderId: "623262953318",
  appId: "1:623262953318:web:7b91cfbaadf810de5f22a7",
  measurementId: "G-LD4GH0PPK7"
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
  const backupDir = path.join(process.cwd(), 'backups', `backup-${timestamp}`);
  
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
  process.exit(0);
}

backup();
