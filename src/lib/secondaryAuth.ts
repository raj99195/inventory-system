import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

/**
 * Firebase config read directly from Vite env vars.
 * A SECONDARY app instance is used to create users so the main admin session stays logged in.
 * (Client-side createUserWithEmailAndPassword would otherwise sign the admin out.)
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Create a new Firebase Auth user WITHOUT logging out the currently signed-in admin.
 * Returns the new user's UID.
 */
export async function createAuthUser(
  email: string,
  password: string
): Promise<string> {
  const appName = `Secondary-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, appName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password
    );
    const uid = cred.user.uid;
    // Sign out from the secondary auth immediately (belt and suspenders)
    await signOut(secondaryAuth);
    return uid;
  } finally {
    // Always clean up the secondary app
    await deleteApp(secondaryApp).catch(() => {
      /* ignore cleanup errors */
    });
  }
}
