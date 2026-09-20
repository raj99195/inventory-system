import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  BOOTSTRAP_SUPER_ADMIN_UID,
  SUPER_ADMIN_PRESET,
} from '@/lib/permissions';
import type { AppUser } from '@/types';

interface AuthContextValue {
  user: FirebaseUser | null;
  userDoc: AppUser | null;
  loading: boolean;
  /** true once auth + userDoc bootstrap has settled */
  ready: boolean;
  /** true if signed in but no user doc exists (not provisioned) */
  noAccess: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userDoc, setUserDoc] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [noAccess, setNoAccess] = useState(false);

  // Listen for Firebase auth changes and bootstrap super admin doc if needed
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      setReady(false);

      if (!fbUser) {
        setUserDoc(null);
        setNoAccess(false);
        setLoading(false);
        setReady(true);
        return;
      }

      // BOOTSTRAP: if this is Raj and no user doc exists, create one with super_admin role.
      if (fbUser.uid === BOOTSTRAP_SUPER_ADMIN_UID) {
        try {
          const ref = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            console.info('[Auth] Bootstrapping super admin doc for', fbUser.email);
            await setDoc(ref, {
              uid: fbUser.uid,
              email: fbUser.email ?? '',
              name: fbUser.displayName ?? 'Super Admin',
              role: 'super_admin',
              permissions: SUPER_ADMIN_PRESET,
              active: true,
              createdAt: serverTimestamp(),
              createdBy: fbUser.uid,
              updatedAt: serverTimestamp(),
            });
            console.info('[Auth] Bootstrap done ✓');
          }
        } catch (err) {
          console.error(
            '[Auth] Failed to bootstrap super admin doc:',
            err
          );
          // Don't block — the snapshot listener will retry
        }
      }
    });
    return unsub;
  }, []);

  // Live-subscribe to the current user's doc for permission changes
  useEffect(() => {
    if (!user) {
      setUserDoc(null);
      setNoAccess(false);
      setLoading(false);
      setReady(true);
      return;
    }

    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setUserDoc({ uid: snap.id, ...snap.data() } as AppUser);
          setNoAccess(false);
        } else {
          // Signed in but no user doc — user isn't provisioned in this system
          console.warn(
            '[Auth] Signed in but no user doc for uid',
            user.uid,
            '— user has NO permissions.'
          );
          setUserDoc(null);
          setNoAccess(true);
        }
        setLoading(false);
        setReady(true);
      },
      (err) => {
        console.error('[Auth] userDoc snapshot error:', err);
        // On permission-denied, mark as noAccess so the app can react
        setUserDoc(null);
        setNoAccess(true);
        setLoading(false);
        setReady(true);
      }
    );
    return unsub;
  }, [user]);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setUserDoc(null);
    setNoAccess(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userDoc,
        loading,
        ready,
        noAccess,
        signIn,
        login: signIn,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
