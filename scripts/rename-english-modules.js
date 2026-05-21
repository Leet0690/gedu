import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, deleteField, setDoc, deleteDoc } from "firebase/firestore";

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

const TARGET_NAME = "Anglais : Techniques de communication";
const TARGET_SAFE_MODULE = TARGET_NAME.replace(/[^a-zA-Z0-9]/g, '_');

// Helper to check if a string contains English/Anglaise keywords
function isEnglishModule(name) {
  if (!name) return false;
  const normalized = name.toLowerCase().trim();
  // Match "anglais" or "anglaise"
  return normalized.includes("anglais") || normalized.includes("anglaise");
}

async function migrate() {
  console.log("=== Démarrage de la migration de la base de données ===");

  // 1. Migrer la collection 'modules'
  console.log("\n1. Migration de la collection 'modules'...");
  const modulesSnap = await getDocs(collection(db, "modules"));
  let modulesUpdated = 0;
  for (const docSnap of modulesSnap.docs) {
    const data = docSnap.data();
    if (isEnglishModule(data.name) && data.name !== TARGET_NAME) {
      console.log(`   Module "${data.name}" (ID: ${docSnap.id}) -> "${TARGET_NAME}"`);
      await updateDoc(doc(db, "modules", docSnap.id), { name: TARGET_NAME });
      modulesUpdated++;
    }
  }
  console.log(`   Terminé. Modules mis à jour : ${modulesUpdated}`);

  // 2. Migrer la collection 'teachers'
  console.log("\n2. Migration de la collection 'teachers'...");
  const teachersSnap = await getDocs(collection(db, "teachers"));
  let teachersUpdated = 0;
  for (const docSnap of teachersSnap.docs) {
    const data = docSnap.data();
    let needsUpdate = false;
    const updateData = {};

    // Check subjects array
    if (Array.isArray(data.subjects)) {
      const newSubjects = data.subjects.map(subj => {
        if (isEnglishModule(subj) && subj !== TARGET_NAME) {
          needsUpdate = true;
          return TARGET_NAME;
        }
        return subj;
      });
      if (needsUpdate) {
        updateData.subjects = newSubjects;
      }
    }

    // Check single subject string field
    if (data.subject && isEnglishModule(data.subject) && data.subject !== TARGET_NAME) {
      needsUpdate = true;
      updateData.subject = TARGET_NAME;
    }

    if (needsUpdate) {
      console.log(`   Formateur "${data.firstName} ${data.lastName}" (ID: ${docSnap.id}) mis à jour.`);
      await updateDoc(doc(db, "teachers", docSnap.id), updateData);
      teachersUpdated++;
    }
  }
  console.log(`   Terminé. Formateurs mis à jour : ${teachersUpdated}`);

  // 3. Migrer la collection 'schedules'
  console.log("\n3. Migration de la collection 'schedules'...");
  const schedulesSnap = await getDocs(collection(db, "schedules"));
  let schedulesUpdated = 0;
  for (const docSnap of schedulesSnap.docs) {
    const data = docSnap.data();
    let needsUpdate = false;
    const updateData = {};

    if (data.module && isEnglishModule(data.module) && data.module !== TARGET_NAME) {
      needsUpdate = true;
      updateData.module = TARGET_NAME;
    }
    if (data.moduleS1 && isEnglishModule(data.moduleS1) && data.moduleS1 !== TARGET_NAME) {
      needsUpdate = true;
      updateData.moduleS1 = TARGET_NAME;
    }
    if (data.moduleS2 && isEnglishModule(data.moduleS2) && data.moduleS2 !== TARGET_NAME) {
      needsUpdate = true;
      updateData.moduleS2 = TARGET_NAME;
    }

    if (needsUpdate) {
      console.log(`   Séance emploi du temps (ID: ${docSnap.id}) mis à jour.`);
      await updateDoc(doc(db, "schedules", docSnap.id), updateData);
      schedulesUpdated++;
    }
  }
  console.log(`   Terminé. Séances d'emploi du temps mises à jour : ${schedulesUpdated}`);

  // 4. Migrer la collection 'grades'
  console.log("\n4. Migration de la collection 'grades'...");
  const gradesSnap = await getDocs(collection(db, "grades"));
  let gradesUpdated = 0;
  for (const docSnap of gradesSnap.docs) {
    const data = docSnap.data();
    const updates = {};
    let needsUpdate = false;

    for (const key of Object.keys(data)) {
      // Reconstruct original subject name if dot was replaced by underscore,
      // but key usually matches module name directly.
      const originalKey = key.replace(/_/g, '.'); // in case it was normalized, but usually isn't.
      if (isEnglishModule(key) && key !== TARGET_NAME) {
        updates[key] = deleteField();
        updates[TARGET_NAME] = data[key];
        needsUpdate = true;
        console.log(`   Notes Étudiant (ID: ${docSnap.id}) : Clé "${key}" -> "${TARGET_NAME}"`);
      }
    }

    if (needsUpdate) {
      await updateDoc(doc(db, "grades", docSnap.id), updates);
      gradesUpdated++;
    }
  }
  console.log(`   Terminé. Notes d'étudiants mises à jour : ${gradesUpdated}`);

  // 5. Migrer la collection 'attendance_stagiaires'
  console.log("\n5. Migration de la collection 'attendance_stagiaires'...");
  const attStagiairesSnap = await getDocs(collection(db, "attendance_stagiaires"));
  let attStagiairesUpdated = 0;
  for (const docSnap of attStagiairesSnap.docs) {
    const data = docSnap.data();
    if (data.moduleId && isEnglishModule(data.moduleId) && data.moduleId !== TARGET_NAME) {
      const studentId = data.studentId;
      const date = data.date;
      const newDocId = `${studentId}_${TARGET_SAFE_MODULE}_${date}`;

      console.log(`   Feuille présence stagiaire (ID: ${docSnap.id}) -> Nouveau ID: "${newDocId}"`);
      
      // Write the new document
      await setDoc(doc(db, "attendance_stagiaires", newDocId), {
        ...data,
        moduleId: TARGET_NAME
      });

      // If the ID was different, delete the old document
      if (docSnap.id !== newDocId) {
        await deleteDoc(doc(db, "attendance_stagiaires", docSnap.id));
      }
      attStagiairesUpdated++;
    }
  }
  console.log(`   Terminé. Présences stagiaires mises à jour/recréées : ${attStagiairesUpdated}`);

  // 6. Migrer la collection 'attendance_formateurs'
  console.log("\n6. Migration de la collection 'attendance_formateurs'...");
  const attFormateursSnap = await getDocs(collection(db, "attendance_formateurs"));
  let attFormateursUpdated = 0;
  for (const docSnap of attFormateursSnap.docs) {
    const data = docSnap.data();
    if (data.moduleId && isEnglishModule(data.moduleId) && data.moduleId !== TARGET_NAME) {
      const teacherId = data.teacherId;
      const date = data.date;
      const timeSlot = data.timeSlot || '';
      const safeTime = timeSlot.replace(/[^0-9]/g, '') || 'x';
      const newDocId = `${teacherId}_${TARGET_SAFE_MODULE}_${safeTime}_${date}`;

      console.log(`   Feuille présence formateur (ID: ${docSnap.id}) -> Nouveau ID: "${newDocId}"`);

      // Write the new document
      await setDoc(doc(db, "attendance_formateurs", newDocId), {
        ...data,
        moduleId: TARGET_NAME
      });

      // If the ID was different, delete the old document
      if (docSnap.id !== newDocId) {
        await deleteDoc(doc(db, "attendance_formateurs", docSnap.id));
      }
      attFormateursUpdated++;
    }
  }
  console.log(`   Terminé. Présences formateurs mises à jour/recréées : ${attFormateursUpdated}`);

  console.log("\n=== Migration terminée avec succès ! ===");
  process.exit(0);
}

migrate().catch(err => {
  console.error("Erreur de migration :", err);
  process.exit(1);
});
