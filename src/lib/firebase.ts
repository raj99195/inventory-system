import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// CRITICAL: ignoreUndefinedProperties prevents "addDoc invalid data" errors
// when optional fields (like sku, hsn) are undefined in parsed invoice data.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});

export const auth = getAuth(app);

// Admin UID from env — used by AuthContext to enforce single-admin access
export const ADMIN_UID = import.meta.env.VITE_ADMIN_UID as string;

export default app;