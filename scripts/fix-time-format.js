import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { env, exit, loadEnvFile } from 'node:process';

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

/**
 * Normalize a time string:
 *  - "08h30 - 10h30" => "08:30-10:30"
 *  - "9:00-10:30"    => "09:00-10:30"
 *  - "10h30 - 12h00" => "10:30-12:00"
 */
function normalizeTime(time) {
  if (!time) return time;

  // Replace "h" with ":"
  let normalized = time.replace(/h/gi, ':');

  // Remove extra spaces around dash
  normalized = normalized.replace(/\s*-\s*/g, '-');

  // Pad each part: ensure HH:mm format
  const parts = normalized.split('-');
  const formatted = parts.map(part => {
    const trimmed = part.trim();
    const [h, m] = trimmed.split(':');
    const hh = h.padStart(2, '0');
    const mm = (m || '00').padStart(2, '0');
    return `${hh}:${mm}`;
  });

  return formatted.join('-');
}

async function fixTimeFormats() {
  console.log('Fetching all schedules from Firestore...');
  const snapshot = await getDocs(collection(db, 'schedules'));
  
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const original = data.time;
    
    if (!original) {
      skipped++;
      continue;
    }

    const normalized = normalizeTime(original);

    if (normalized !== original) {
      console.log(`  FIX: "${original}" => "${normalized}"  (doc: ${docSnap.id})`);
      await updateDoc(doc(db, 'schedules', docSnap.id), { time: normalized });
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, Skipped (already correct): ${skipped}`);
  exit(0);
}

fixTimeFormats();
