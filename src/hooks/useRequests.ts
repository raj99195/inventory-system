import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  doc,
  addDoc,
  serverTimestamp,
  runTransaction,
  limit,
  type Transaction,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type {
  AssetRequest,
  RequestItemType,
  RequestUrgency,
  Asset,
  Product,
  AppUser,
} from '@/types';
import { logAudit } from '@/lib/audit';
import { canActOnUser, hasPermission } from '@/lib/permissions';

const COL = 'requests';
async function assertRequestReview(tx: Transaction, userId: string): Promise<void> {
  const actorId = auth.currentUser?.uid;
  if (!actorId) throw new Error('Not authenticated');
  const actorSnap = await tx.get(doc(db, 'users', actorId));
  const targetSnap = await tx.get(doc(db, 'users', userId));
  if (!actorSnap.exists() || !targetSnap.exists()) throw new Error('User profile not found');
  const actor = { ...actorSnap.data(), uid: actorId } as AppUser;
  const target = { ...targetSnap.data(), uid: userId } as AppUser;
  if (!canActOnUser(actor, target) || !(actor.role === 'super_admin' || hasPermission(actor.permissions, 'requests.approve'))) throw new Error('You can only approve requests from users below your role');
}

// ─── Hooks ─────────────────────────────────────────────────────

/** Real-time requests for a specific user, newest first. */
export function useUserRequests(userId?: string | null, limitCount = 100) {
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, COL),
      where('userId', '==', userId),
      orderBy('requestedAt', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRequests(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssetRequest))
        );
        setLoading(false);
      },
      (err) => {
        console.error('[useUserRequests] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [userId, limitCount]);

  return { requests, loading };
}

/** Real-time all requests (admin/manager view). */
export function useAllRequests(limitCount = 500) {
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COL),
      orderBy('requestedAt', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRequests(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssetRequest))
        );
        setLoading(false);
      },
      (err) => {
        console.error('[useAllRequests] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [limitCount]);

  return { requests, loading };
}

/** Real-time pending requests only — the approvals inbox. */
export function usePendingRequests(limitCount = 200) {
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COL),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRequests(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssetRequest))
        );
        setLoading(false);
      },
      (err) => {
        console.error('[usePendingRequests] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [limitCount]);

  return { requests, loading };
}

// ─── Actions ───────────────────────────────────────────────────

export interface CreateRequestParams {
  userId: string;
  userName: string;
  userEmail: string;
  userDepartment?: string;
  itemType: RequestItemType;
  itemId: string;
  itemName: string;
  itemSku?: string;
  quantity: number;
  reason: string;
  urgency?: RequestUrgency;
}

/**
 * Employee creates a new asset/product request. Status starts as 'pending'.
 * Balance/stock NOT touched until approved.
 */
export async function createRequest(params: CreateRequestParams): Promise<string> {
  const authUser = auth.currentUser;
  if (!authUser) throw new Error('Not authenticated');

  const {
    userId, userName, userEmail, userDepartment,
    itemType, itemId, itemName, itemSku,
    quantity, reason, urgency = 'normal',
  } = params;

  if (!itemId) throw new Error('Please select an item');
  if (!reason.trim()) throw new Error('Please provide a reason');
  if (quantity < 1) throw new Error('Quantity must be at least 1');
  if (itemType === 'asset' && quantity !== 1) {
    throw new Error('Asset requests always have quantity 1');
  }

  const payload: Omit<AssetRequest, 'id' | 'createdAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
  } = {
    userId,
    userName,
    userEmail,
    userDepartment,
    itemType,
    itemId,
    itemName,
    itemSku,
    quantity,
    reason: reason.trim(),
    urgency,
    status: 'pending',
    requestedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewerName: null,
    reviewedAt: null,
    reviewNotes: null,
    fulfilledAt: null,
    assignmentId: null,
    stockTxId: null,
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COL), payload);

  await logAudit({
    module: 'requests',
    action: 'create',
    recordId: ref.id,
    recordType: 'request',
    newValue: { itemType, itemName, quantity, urgency },
  });
  return ref.id;
}

/**
 * Approve a request atomically:
 *   - Verify request is 'pending'
 *   - For asset: ensure asset still 'available', create /assetAssignments, mark asset 'assigned'
 *   - For product: ensure stock >= quantity, create /stockTransactions (stock-out), reduce product stock
 *   - Update request → status: 'fulfilled' with links
 */
export async function approveRequest(
  requestId: string,
  reviewNotes = ''
): Promise<void> {
  const authUser = auth.currentUser;
  if (!authUser) throw new Error('Not authenticated');
  const reviewerId = authUser.uid;
  const reviewerName = authUser.displayName || authUser.email || reviewerId;

  const requestRef = doc(db, COL, requestId);
  let fulfillmentInfo: { type: RequestItemType; refId: string } | null = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists()) throw new Error('Request not found');
    const req = snap.data() as AssetRequest;
    await assertRequestReview(tx, req.userId);
    if (req.status !== 'pending') {
      throw new Error(`Request already ${req.status}`);
    }

    const nowIso = new Date().toISOString();

    if (req.itemType === 'asset') {
      // ─── Asset flow ───
      const assetRef = doc(db, 'assets', req.itemId);
      const assetSnap = await tx.get(assetRef);
      if (!assetSnap.exists()) throw new Error('Asset no longer exists');
      const asset = assetSnap.data() as Asset;
      if (asset.status !== 'available') {
        throw new Error(`Asset is currently ${asset.status}, cannot assign`);
      }

      // Create assignment record
      const assignmentRef = doc(collection(db, 'assetAssignments'));
      tx.set(assignmentRef, {
        assetId: req.itemId,
        assetName: req.itemName,
        employeeId: req.userId,
        employeeName: req.userName,
        action: 'assigned',
        date: nowIso.slice(0, 10),
        conditionAtAssign: asset.condition,
        remarks: `Auto-assigned via request approval. Reason: ${req.reason}`,
        performedBy: reviewerId,
        requestId,
        createdAt: serverTimestamp(),
      });

      // Update asset status
      tx.update(assetRef, {
        status: 'assigned',
        assignedTo: req.userId,
        updatedAt: serverTimestamp(),
      });

      fulfillmentInfo = { type: 'asset', refId: assignmentRef.id };

      tx.update(requestRef, {
        status: 'fulfilled',
        reviewedBy: reviewerId,
        reviewerName,
        reviewedAt: nowIso,
        reviewNotes,
        fulfilledAt: nowIso,
        assignmentId: assignmentRef.id,
      });
    } else if (req.itemType === 'product') {
      // ─── Product flow — creates stock-out ───
      const productRef = doc(db, 'products', req.itemId);
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists()) throw new Error('Product no longer exists');
      const product = productSnap.data() as Product;
      const currentStock = product.currentStock ?? 0;
      if (currentStock < req.quantity) {
        throw new Error(
          `Insufficient stock. Available: ${currentStock}, requested: ${req.quantity}`
        );
      }

      const newStock = currentStock - req.quantity;
      tx.update(productRef, {
        currentStock: newStock,
        updatedAt: serverTimestamp(),
      });

      const txRef = doc(collection(db, 'stockTransactions'));
      tx.set(txRef, {
        productId: req.itemId,
        productName: req.itemName,
        productSku: req.itemSku ?? product.sku,
        type: 'stock-out',
        quantity: -req.quantity,
        balanceAfter: newStock,
        source: 'request-fulfilled',
        reason: `Request by ${req.userName}: ${req.reason}`,
        remarks: `Fulfilled request ${requestId}`,
        requestId,
        performedBy: reviewerId,
        createdAt: serverTimestamp(),
      });

      fulfillmentInfo = { type: 'product', refId: txRef.id };

      tx.update(requestRef, {
        status: 'fulfilled',
        reviewedBy: reviewerId,
        reviewerName,
        reviewedAt: nowIso,
        reviewNotes,
        fulfilledAt: nowIso,
        stockTxId: txRef.id,
      });
    } else {
      // ─── Kit flow — approve only, no auto stock-out (kits need manual assembly) ───
      tx.update(requestRef, {
        status: 'approved',
        reviewedBy: reviewerId,
        reviewerName,
        reviewedAt: nowIso,
        reviewNotes,
      });
    }
  });

  await logAudit({
    module: 'requests',
    action: 'approve',
    recordId: requestId,
    recordType: 'request',
    newValue: {
      reviewedBy: reviewerId,
      reviewNotes,
      fulfillment: fulfillmentInfo,
    },
  });
}

/** Reject a request — no side effects. */
export async function rejectRequest(
  requestId: string,
  reviewNotes = ''
): Promise<void> {
  const authUser = auth.currentUser;
  if (!authUser) throw new Error('Not authenticated');
  const reviewerName = authUser.displayName || authUser.email || authUser.uid;

  const requestRef = doc(db, COL, requestId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists()) throw new Error('Request not found');
    const req = snap.data() as AssetRequest;
    await assertRequestReview(tx, req.userId);
    if (req.status !== 'pending') {
      throw new Error(`Request already ${req.status}`);
    }
    tx.update(requestRef, {
      status: 'rejected',
      reviewedBy: authUser.uid,
      reviewerName,
      reviewedAt: new Date().toISOString(),
      reviewNotes,
    });
  });

  await logAudit({
    module: 'requests',
    action: 'reject',
    recordId: requestId,
    recordType: 'request',
    newValue: { reviewNotes },
  });
}

/**
 * Cancel own pending request. Only owner + cancelOwn perm.
 * Cannot cancel once approved/fulfilled/rejected.
 */
export async function cancelRequest(requestId: string): Promise<void> {
  const authUser = auth.currentUser;
  if (!authUser) throw new Error('Not authenticated');

  const requestRef = doc(db, COL, requestId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists()) throw new Error('Request not found');
    const req = snap.data() as AssetRequest;
    if (req.userId !== authUser.uid) {
      throw new Error('You can only cancel your own requests');
    }
    if (req.status !== 'pending') {
      throw new Error(`Cannot cancel ${req.status} request`);
    }
    tx.update(requestRef, {
      status: 'cancelled',
      reviewedAt: new Date().toISOString(),
    });
  });

  await logAudit({
    module: 'requests',
    action: 'cancel',
    recordId: requestId,
    recordType: 'request',
    newValue: {},
  });
}
