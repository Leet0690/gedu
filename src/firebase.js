import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, initializeAuth, inMemoryPersistence, signOut } from "firebase/auth";
import { 
  initializeFirestore, 
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";

if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  throw new Error("Firebase config manquante. Définissez VITE_FIREBASE_API_KEY et les autres variables VITE_FIREBASE_*");
}

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

let _db;
try {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.warn("Firestore cache initialization failed:", e);
  _db = getFirestore(app);
}

export const db = _db;
export const auth = getAuth(app);

/**
 * Creates an isolated secondary Firebase app for creating users without
 * disrupting the current authenticated admin's session.
 */
export const createSecondaryAuth = async () => {
  const secondaryAppName = `user-creator-${crypto.randomUUID()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = initializeAuth(secondaryApp, { persistence: inMemoryPersistence });
  return {
    secondaryAuth,
    cleanup: async () => {
      try {
        try { await signOut(secondaryAuth); } finally { await deleteApp(secondaryApp); }
      } catch (e) {
        console.warn("Error deleting secondary app:", e);
      }
    }
  };
};
