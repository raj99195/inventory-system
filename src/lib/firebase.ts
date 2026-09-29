import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// ─────────────────────────────────────────────────────────────
// Firestore configuration
//
// 1. `ignoreUndefinedProperties: true`
//    - Prevents "addDoc invalid data" errors when optional fields
//      (sku, hsn, etc.) are undefined in parsed data.
//
// 2. `persistentLocalCache` with `persistentMultipleTabManager`
//    - Enables offline support:
//      • Reads served from cache when offline
//      • Writes queued locally and synced on reconnect
//    - Required for attendance module (mark check-in when off-network)
//    - Multi-tab safe (works across multiple browser tabs)
// ─────────────────────────────────────────────────────────────
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);
export const storage = getStorage(app);

export const ADMIN_UID = import.meta.env.VITE_ADMIN_UID as string;

export default app;