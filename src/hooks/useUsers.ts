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
  getDocFromServer,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { createAuthUser } from '@/lib/secondaryAuth';
import { logAudit } from '@/lib/audit';
import type { AppUser, AppRole, Permissions } from '@/types';
import { getPresetForRole, canActOnUser, canAssignRole, myLevel, hasPermission } from '@/lib/permissions';

const COL = 'users';
type ProfileFields = Pick<AppUser, 'phone' | 'department' | 'designation' | 'joinedOn' | 'assignedSchools' | 'officeAddress' | 'officeLat' | 'officeLng' | 'officeRadiusM'>;

async function assertUserAction(permission: string, targetId?: string, nextRole?: AppRole) {
  const actorId = auth.currentUser?.uid;
  if (!actorId) throw new Error('Not authenticated');
  const actorSnap = await getDocFromServer(doc(db, COL, actorId));
  if (!actorSnap.exists()) throw new Error('User profile not found');
  const actor = { ...actorSnap.data(), uid: actorId } as AppUser;
  if (!actor?.active || !(actor.role === 'super_admin' || hasPermission(actor.permissions, permission))) throw new Error('Permission denied');
  if (targetId) {
    const targetSnap = await getDocFromServer(doc(db, COL, targetId));
    if (!targetSnap.exists()) throw new Error('User profile not found');
    const target = { ...targetSnap.data(), uid: targetId } as AppUser;
    if (!canActOnUser(actor, target)) throw new Error('You can only manage users below your role');
  }
  if (nextRole && !(canAssignRole(myLevel(actor), nextRole) || (nextRole === 'custom' && actor.role === 'super_admin'))) throw new Error('Cannot assign this role');
}

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
export async function createUser(input: ProfileFields & {
  name: string;
  email: string;
  password: string;
  role: AppRole;
  permissions: Permissions;
  active: boolean;
  createdBy: string;
}): Promise<string> {
  // 1. Create Firebase Auth user via secondary app (doesn't affect current session)
  await assertUserAction('users.create', undefined, input.role);
  const uid = await createAuthUser(input.email, input.password);

  // 2. Create Firestore user doc with matching UID
  await setDoc(doc(db, COL, uid), {
    ...Object.fromEntries(Object.entries(input).filter(([key, value]) => !['password', 'createdBy'].includes(key) && value !== undefined)),
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
  data: ProfileFields & {
    name?: string;
    role?: AppRole;
    permissions?: Permissions;
    active?: boolean;
  },
  previousValue?: Partial<AppUser>
): Promise<void> {
  // Preserve the existing role unless a new role is explicitly provided.
  await assertUserAction('users.edit', uid, data.role);
  const patch: Record<string, unknown> = { ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)), updatedAt: serverTimestamp() };

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
  await assertUserAction('users.delete', user.uid);
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
