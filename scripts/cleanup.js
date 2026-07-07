import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
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

async function cleanupDuplicates() {
  console.log("Démarrage du nettoyage des doublons...");
  
  try {
    const snapshot = await getDocs(collection(db, 'students'));
    const students = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    console.log(`Total des stagiaires trouvés : ${students.length}`);
    
    const seen = new Set();
    const toDelete = [];
    
    for (const s of students) {
      const nameKey = `${(s.firstName || '').toLowerCase().trim()}_${(s.lastName || '').toLowerCase().trim()}`;
      const key = s.regNo ? s.regNo.trim() : nameKey;
      
      if (!key || key === '_') continue; // Skip empty documents to be safe

      if (seen.has(key)) {
        toDelete.push(s);
      } else {
        seen.add(key);
      }
    }
    
    console.log(`Doublons identifiés : ${toDelete.length}`);
    
    let deletedCount = 0;
    for (const s of toDelete) {
      await deleteDoc(doc(db, 'students', s.id));
      deletedCount++;
      console.log(`Supprimé : ${s.firstName} ${s.lastName} (ID: ${s.id})`);
    }
    
    console.log(`✅ Nettoyage terminé ! ${deletedCount} doublons ont été supprimés.`);
    exit(0);
  } catch (error) {
    console.error("Erreur lors du nettoyage :", error);
    exit(1);
  }
}

cleanupDuplicates();
