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
import { auth } from '@/lib/firebaseAuth';
import {
  BOOTSTRAP_SUPER_ADMIN_UID,
  SUPER_ADMIN_PRESET,
  normalizePermissions,
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

  // Load database code only once a Firebase session exists.
  useEffect(() => {
    let generation = 0;
    let stopProfile: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, async (fbUser) => {
      const current = ++generation;
      stopProfile?.(); stopProfile = undefined;
      setUser(fbUser); setUserDoc(null); setNoAccess(false);
      setLoading(!!fbUser); setReady(!fbUser);
      if (!fbUser) return;
      const fail = () => {
        if (current !== generation) return;
        setUserDoc(null); setNoAccess(true); setLoading(false); setReady(true);
      };
      try {
        const [{ db }, { doc, getDoc, setDoc, serverTimestamp, onSnapshot }] = await Promise.all([
          import('@/lib/firebase'), import('firebase/firestore'),
        ]);
        if (current !== generation) return;
        const ref = doc(db, 'users', fbUser.uid);
        if (fbUser.uid === BOOTSTRAP_SUPER_ADMIN_UID) {
          const snap = await getDoc(ref);
          if (current !== generation) return;
          if (!snap.exists()) await setDoc(ref, {
            uid: fbUser.uid, email: fbUser.email ?? '', name: fbUser.displayName ?? 'Super Admin',
            role: 'super_admin', permissions: SUPER_ADMIN_PRESET, active: true,
            createdAt: serverTimestamp(), createdBy: fbUser.uid, updatedAt: serverTimestamp(),
          });
        }
        if (current !== generation) return;
        stopProfile = onSnapshot(ref, snap => {
          if (current !== generation) return;
          if (snap.exists()) {
            const raw = snap.data();
            setUserDoc({ ...raw, uid: snap.id, permissions: normalizePermissions(raw.permissions) } as AppUser);
            setNoAccess(false);
          } else { setUserDoc(null); setNoAccess(true); }
          setLoading(false); setReady(true);
        }, fail);
      } catch { fail(); }
    });
    return () => { generation++; stopAuth(); stopProfile?.(); };
  }, []);

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