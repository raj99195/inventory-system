import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  limit,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Leave, LeaveBalance, LeaveBalanceMap } from '@/types';
import { logAudit } from '@/lib/audit';
import { daysBetween } from '@/lib/attendance/datetime';

const COL = 'leaves';
const BAL_COL = 'leaveBalances';

const balanceId = (userId: string, year: number) => `${userId}_${year}`;

// ─── Hooks ─────────────────────────────────────────────────────

/** Real-time leaves for a specific user, newest first. */
export function useUserLeaves(userId?: string | null, limitCount = 100) {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLeaves([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, COL),
      where('userId', '==', userId),
      orderBy('appliedAt', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLeaves(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Leave))
        );
        setLoading(false);
      },
      (err) => {
        console.error('[useUserLeaves] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [userId, limitCount]);

  return { leaves, loading };
}

/** Real-time all leaves (admin/manager view). */
export function useAllLeaves(limitCount = 500) {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COL),
      orderBy('appliedAt', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLeaves(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Leave))
        );
        setLoading(false);
      },
      (err) => {
        console.error('[useAllLeaves] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [limitCount]);

  return { leaves, loading };
}

/** Real-time pending leaves only — for the approvals inbox. */
export function usePendingLeaves(limitCount = 200) {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COL),
      where('status', '==', 'pending'),
      orderBy('appliedAt', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLeaves(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Leave))
        );
        setLoading(false);
      },
      (err) => {
        console.error('[usePendingLeaves] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [limitCount]);

  return { leaves, loading };
}

/** Real-time leave balance for a user in a given year. */
export function useLeaveBalance(
  userId?: string | null,
  year: number = new Date().getFullYear()
) {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBalance(null);
      setLoading(false);
      return;
    }
    const ref = doc(db, BAL_COL, balanceId(userId, year));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setBalance(
          snap.exists()
            ? ({ id: snap.id, ...snap.data() } as LeaveBalance)
            : null
        );
        setLoading(false);
      },
      (err) => {
        console.error('[useLeaveBalance] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [userId, year]);

  return { balance, loading };
}

// ─── Actions (atomic where balances change) ────────────────────

export interface ApplyLeaveParams {
  userId: string;
  leaveType: string; // "CL", "SL", etc.
  fromDate: string; // YYYY-MM-DD
  toDate: string;
  reason: string;
}

/** Apply for a leave. Balance is NOT deducted until approval. */
export async function applyLeave(params: ApplyLeaveParams): Promise<string> {
  const authUser = auth.currentUser;
  if (!authUser) throw new Error('Not authenticated');

  const { userId, leaveType, fromDate, toDate, reason } = params;
  if (!leaveType || !fromDate || !toDate) {
    throw new Error('Type, from-date and to-date are required');
  }
  if (fromDate > toDate) {
    throw new Error('End date cannot be before start date');
  }

  const days = daysBetween(fromDate, toDate);
  const payload: Omit<Leave, 'id'> = {
    userId,
    leaveType,
    fromDate,
    toDate,
    days,
    reason: reason || '',
    status: 'pending',
    appliedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
  };

  const ref = await addDoc(collection(db, COL), payload);
  await logAudit({
    module: 'leaves',
    action: 'apply',
    recordId: ref.id,
    recordType: 'leave',
    newValue: { leaveType, fromDate, toDate, days },
  });
  return ref.id;
}

/**
 * Approve a leave atomically:
 *  - Read leave doc, verify status is 'pending'
 *  - Deduct days from user's balance for that year
 *  - Update leave status → 'approved'
 * Uses runTransaction so a race can't double-approve or double-deduct.
 */
export async function approveLeave(
  leaveId: string,
  reviewNotes = ''
): Promise<void> {
  const authUser = auth.currentUser;
  if (!authUser) throw new Error('Not authenticated');
  const reviewerId = authUser.uid;

  const leaveRef = doc(db, COL, leaveId);

  await runTransaction(db, async (tx) => {
    const leaveSnap = await tx.get(leaveRef);
    if (!leaveSnap.exists()) throw new Error('Leave not found');
    const leave = leaveSnap.data() as Leave;
    if (leave.status !== 'pending') {
      throw new Error(`Leave already ${leave.status}`);
    }

    const year = new Date(leave.fromDate).getFullYear();
    const balRef = doc(db, BAL_COL, balanceId(leave.userId, year));
    const balSnap = await tx.get(balRef);

    const currentBalances: LeaveBalanceMap = balSnap.exists()
      ? ((balSnap.data() as LeaveBalance).balances ?? {})
      : {};
    const availableForType = currentBalances[leave.leaveType] ?? 0;

    // LOP always allowed to go negative? Keep simple: block if insufficient.
    if (availableForType < leave.days) {
      throw new Error(
        `Insufficient ${leave.leaveType} balance (available: ${availableForType}, needed: ${leave.days})`
      );
    }

    const newBalances: LeaveBalanceMap = {
      ...currentBalances,
      [leave.leaveType]: availableForType - leave.days,
    };

    if (balSnap.exists()) {
      tx.update(balRef, { balances: newBalances });
    } else {
      tx.set(balRef, {
        userId: leave.userId,
        year,
        balances: newBalances,
      });
    }

    tx.update(leaveRef, {
      status: 'approved',
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
      reviewNotes,
    });
  });

  await logAudit({
    module: 'leaves',
    action: 'approve',
    recordId: leaveId,
    recordType: 'leave',
    newValue: { reviewedBy: reviewerId, reviewNotes },
  });
}

/** Reject a leave — no balance change. */
export async function rejectLeave(
  leaveId: string,
  reviewNotes = ''
): Promise<void> {
  const authUser = auth.currentUser;
  if (!authUser) throw new Error('Not authenticated');

  const leaveRef = doc(db, COL, leaveId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(leaveRef);
    if (!snap.exists()) throw new Error('Leave not found');
    const leave = snap.data() as Leave;
    if (leave.status !== 'pending') {
      throw new Error(`Leave already ${leave.status}`);
    }
    tx.update(leaveRef, {
      status: 'rejected',
      reviewedBy: authUser.uid,
      reviewedAt: new Date().toISOString(),
      reviewNotes,
    });
  });

  await logAudit({
    module: 'leaves',
    action: 'reject',
    recordId: leaveId,
    recordType: 'leave',
    newValue: { reviewNotes },
  });
}

/**
 * Cancel a leave:
 *  - Employees can cancel their own pending leaves (no balance change).
 *  - Admins can cancel approved leaves (restores balance).
 * Uses runTransaction for atomicity.
 */
export async function cancelLeave(leaveId: string): Promise<void> {
  const authUser = auth.currentUser;
  if (!authUser) throw new Error('Not authenticated');

  const leaveRef = doc(db, COL, leaveId);
  let refundInfo: { leaveType: string; days: number; userId: string } | null =
    null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(leaveRef);
    if (!snap.exists()) throw new Error('Leave not found');
    const leave = snap.data() as Leave;

    if (leave.status === 'cancelled') throw new Error('Already cancelled');
    if (leave.status === 'rejected') throw new Error('Cannot cancel rejected leave');

    // Refund balance only if previously approved
    if (leave.status === 'approved') {
      const year = new Date(leave.fromDate).getFullYear();
      const balRef = doc(db, BAL_COL, balanceId(leave.userId, year));
      const balSnap = await tx.get(balRef);
      const currentBalances: LeaveBalanceMap = balSnap.exists()
        ? ((balSnap.data() as LeaveBalance).balances ?? {})
        : {};
      const newBalances: LeaveBalanceMap = {
        ...currentBalances,
        [leave.leaveType]: (currentBalances[leave.leaveType] ?? 0) + leave.days,
      };
      if (balSnap.exists()) {
        tx.update(balRef, { balances: newBalances });
      } else {
        tx.set(balRef, { userId: leave.userId, year, balances: newBalances });
      }
      refundInfo = { leaveType: leave.leaveType, days: leave.days, userId: leave.userId };
    }

    tx.update(leaveRef, {
      status: 'cancelled',
      reviewedAt: new Date().toISOString(),
    });
  });

  await logAudit({
    module: 'leaves',
    action: 'cancel',
    recordId: leaveId,
    recordType: 'leave',
    newValue: refundInfo ? { refunded: refundInfo } : {},
  });
}

/**
 * Manually adjust a user's leave balance (admin action).
 * Positive delta = grant more days; negative = deduct.
 */
export async function adjustBalance(
  userId: string,
  leaveType: string,
  delta: number,
  year: number = new Date().getFullYear(),
  reason = ''
): Promise<void> {
  const authUser = auth.currentUser;
  if (!authUser) throw new Error('Not authenticated');
  if (delta === 0) return;

  const balRef = doc(db, BAL_COL, balanceId(userId, year));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(balRef);
    const currentBalances: LeaveBalanceMap = snap.exists()
      ? ((snap.data() as LeaveBalance).balances ?? {})
      : {};
    const newBalances: LeaveBalanceMap = {
      ...currentBalances,
      [leaveType]: (currentBalances[leaveType] ?? 0) + delta,
    };
    if (snap.exists()) {
      tx.update(balRef, { balances: newBalances });
    } else {
      tx.set(balRef, { userId, year, balances: newBalances });
    }
  });

  await logAudit({
    module: 'leaves',
    action: 'adjust-balance',
    recordId: `${userId}_${year}`,
    recordType: 'leaveBalance',
    newValue: { leaveType, delta, reason },
  });
}

/**
 * Seed the year's default balances for a user (called on user create,
 * or when the year rolls over).
 */
export async function seedLeaveBalances(
  userId: string,
  defaults: LeaveBalanceMap,
  year: number = new Date().getFullYear()
): Promise<void> {
  const ref = doc(db, BAL_COL, balanceId(userId, year));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return; // don't overwrite existing balances
    tx.set(ref, { userId, year, balances: defaults });
  });
}
