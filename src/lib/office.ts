import { collection, doc, runTransaction, serverTimestamp, type Transaction } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { canActOnUser, hasPermission, normalizePermissions } from '@/lib/permissions';
import type { AppUser } from '@/types';
export type OfficeKind = 'officeAssets' | 'officeInventory';
export async function fulfillOffice(tx: Transaction, kind: OfficeKind, itemId: string, userId: string, quantity: number, reason: string, requestId?: string) {
  const actorId = auth.currentUser?.uid;
  if (!actorId) throw new Error('Not authenticated');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || (kind === 'officeAssets' && quantity !== 1)) throw new Error('Invalid quantity');
  const actorSnap = await tx.get(doc(db, 'users', actorId));
  const targetSnap = await tx.get(doc(db, 'users', userId));
  const itemRef = doc(db, kind, itemId);
  const itemSnap = await tx.get(itemRef);
  if (!actorSnap.exists() || !targetSnap.exists() || !itemSnap.exists()) throw new Error('User or item not found');
  const actor = { ...actorSnap.data(), uid: actorId } as AppUser;
  const target = { ...targetSnap.data(), uid: userId } as AppUser;
  if (!canActOnUser(actor, target) || !target.active) throw new Error('Assign only to active users below your role. Self-assignment is not allowed.');
  if (actor.role !== 'super_admin' && !hasPermission(normalizePermissions(actor.permissions, actor.role), requestId ? 'requests.approve' : `${kind}.assign`)) throw new Error('Assignment permission required');
  const item = itemSnap.data();
  if (kind === 'officeAssets' && item.status !== 'available') throw new Error('Asset is no longer available');
  if (kind === 'officeInventory' && (item.status !== 'active' || item.currentStock < quantity)) throw new Error('Insufficient office stock');
  const assignmentRef = doc(collection(db, 'officeAssignments'));
  tx.set(assignmentRef, { kind, itemId, itemName: item.name, userId, userName: target.name, quantity, reason, status: 'assigned', performedBy: actorId, ...(requestId ? { requestId } : {}), createdAt: serverTimestamp() });
  tx.update(itemRef, kind === 'officeAssets' ? { status: 'assigned', assignedTo: userId, lastAssignmentId: assignmentRef.id, updatedAt: serverTimestamp() } : { currentStock: item.currentStock - quantity, lastAssignmentId: assignmentRef.id, updatedAt: serverTimestamp() });
  return assignmentRef.id;
}
export async function assignOffice(kind: OfficeKind, itemId: string, userId: string, quantity: number, reason: string) {
  await runTransaction(db, (tx) => fulfillOffice(tx, kind, itemId, userId, quantity, reason));
}
export async function returnOffice(assignmentId: string) {
  const actorId = auth.currentUser?.uid;
  if (!actorId) throw new Error('Not authenticated');
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'officeAssignments', assignmentId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Assignment not found');
    const assignment = snap.data();
    const actorSnap = await tx.get(doc(db, 'users', actorId));
    const targetSnap = await tx.get(doc(db, 'users', assignment.userId));
    const itemRef = doc(db, assignment.kind, assignment.itemId);
    const itemSnap = await tx.get(itemRef);
    if (!actorSnap.exists() || !targetSnap.exists() || !itemSnap.exists()) throw new Error('User or item not found');
    const actor = { ...actorSnap.data(), uid: actorId } as AppUser;
    if (!canActOnUser(actor, { ...targetSnap.data(), uid: assignment.userId } as AppUser) || (actor.role !== 'super_admin' && !hasPermission(normalizePermissions(actor.permissions, actor.role), `${assignment.kind}.return`))) throw new Error('Return permission required for this user');
    if (assignment.status !== 'assigned') throw new Error('Already returned');
    const item = itemSnap.data();
    if (assignment.kind === 'officeAssets' && (item.status !== 'assigned' || item.assignedTo !== assignment.userId)) throw new Error('Asset assignment has changed');
    tx.update(itemRef, assignment.kind === 'officeAssets' ? { status: 'available', assignedTo: null, lastAssignmentId: ref.id, updatedAt: serverTimestamp() } : { currentStock: item.currentStock + assignment.quantity, lastAssignmentId: ref.id, updatedAt: serverTimestamp() });
    tx.update(ref, { status: 'returned', returnedBy: actorId, returnedAt: serverTimestamp() });
  });
}
