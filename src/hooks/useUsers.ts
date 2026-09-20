import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createAuthUser } from '@/lib/secondaryAuth';
import { logAudit } from '@/lib/audit';
import type { AppUser, AppRole, Permissions } from '@/types';
import { getPresetForRole, detectRole } from '@/lib/permissions';

const COL = 'users';

export function useUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(
          (d) => ({ uid: d.id, ...d.data() } as AppUser)
        );
        setUsers(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { users, loading, error };
}

// ==================== CRUD ACTIONS ====================
export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: AppRole;
  permissions: Permissions;
  active: boolean;
  createdBy: string;
}): Promise<string> {
  // 1. Create Firebase Auth user via secondary app (doesn't affect current session)
  const uid = await createAuthUser(input.email, input.password);

  // 2. Create Firestore user doc with matching UID
  await setDoc(doc(db, COL, uid), {
    uid,
    email: input.email,
    name: input.name,
    role: input.role,
    permissions: input.permissions,
    active: input.active,
    createdAt: serverTimestamp(),
    createdBy: input.createdBy,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    module: 'users',
    action: 'create',
    recordId: uid,
    recordType: 'user',
    newValue: {
      email: input.email,
      name: input.name,
      role: input.role,
      active: input.active,
    },
  });

  return uid;
}

export async function updateUser(
  uid: string,
  data: {
    name?: string;
    role?: AppRole;
    permissions?: Permissions;
    active?: boolean;
  },
  previousValue?: Partial<AppUser>
): Promise<void> {
  // If permissions are being updated, auto-detect the closest role
  const patch: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.permissions && !data.role) {
    patch.role = detectRole(data.permissions);
  }

  await updateDoc(doc(db, COL, uid), patch);

  await logAudit({
    module: 'users',
    action: 'update',
    recordId: uid,
    recordType: 'user',
    previousValue,
    newValue: data,
  });
}

export async function deleteUser(user: AppUser): Promise<void> {
  // Delete Firestore doc only. The Firebase Auth account remains but is
  // effectively locked out (no user doc → no permissions in this system).
  // Full Auth deletion needs the Admin SDK (Cloud Function / server).
  await deleteDoc(doc(db, COL, user.uid));

  await logAudit({
    module: 'users',
    action: 'delete',
    recordId: user.uid,
    recordType: 'user',
    previousValue: {
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}

export async function toggleUserActive(user: AppUser): Promise<void> {
  await updateUser(
    user.uid,
    { active: !user.active },
    { active: user.active }
  );
}

/**
 * Update role using the matching preset (or apply custom permissions manually).
 */
export async function changeUserRole(
  uid: string,
  role: AppRole,
  currentPerms?: Permissions
): Promise<void> {
  const newPerms =
    role === 'custom' && currentPerms ? currentPerms : getPresetForRole(role);
  await updateUser(uid, { role, permissions: newPerms });
}
