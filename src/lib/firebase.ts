import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

import app from './firebaseAuth';
export { auth } from './firebaseAuth';

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

export const storage = getStorage(app);

export const ADMIN_UID = import.meta.env.VITE_ADMIN_UID as string;

export default app;