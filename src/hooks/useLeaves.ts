import { useEffect, useState } from 'react';
import {
  getDocFromServer,
  getDocsFromServer,
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
  type Transaction,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { AppUser, Leave, LeaveBalance, LeaveBalanceMap } from '@/types';
import { canActOnUser, hasPermission } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { getAttendanceSettings, useAttendanceSettings } from '@/hooks/useAttendanceSettings';
import { resolveLeaveBalances } from '@/lib/attendance/leaveBalances';
import { DEFAULT_LEAVE_TYPES } from '@/lib/attendance/leaveTypes';
import { daysBetween } from '@/lib/attendance/datetime';

const COL = 'leaves';
const BAL_COL = 'leaveBalances';

const balanceId = (userId: string, year: number) => `${userId}_${year}`;

async function assertLeaveAction(tx: Transaction, targetId: string, permission: string): Promise<AppUser> {
  const actorId = auth.currentUser?.uid;
  if (!actorId) throw new Error('Not authenticated');
  const actorSnap = await tx.get(doc(db, 'users', actorId));
  const targetSnap = await tx.get(doc(db, 'users', targetId));
  if (!actorSnap.exists() || !targetSnap.exists()) throw new Error('User profile not found');
  const actor = { ...actorSnap.data(), uid: actorId } as AppUser;
  const target = { ...targetSnap.data(), uid: targetId } as AppUser;
  if (!canActOnUser(actor, target) || !(actor.role === 'super_admin' || hasPermission(actor.permissions, permission))) throw new Error('You can only manage users below your role');
  return target;
}

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
  const { settings, loading: settingsLoading, error: settingsError } = useAttendanceSettings();
  const [error, setError] = useState<Error | null>(null);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<Leave[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [joinedOn, setJoinedOn] = useState<string>();
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBalance(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setBalance(null);
    setError(null);
    setHistoryLoading(true);
    setHistory([]);
    setProfileLoading(true);
    const stopProfile = onSnapshot(doc(db, 'users', userId), (snap) => { setJoinedOn(snap.data()?.joinedOn); setProfileLoading(false); }, (err) => { setError(err); setProfileLoading(false); });
    const stopHistory = onSnapshot(query(collection(db, COL), where('userId', '==', userId)), (snap) => {
      setHistory(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Leave)));
      setHistoryLoading(false);
    }, (err) => { setError(err); setHistoryLoading(false); });
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
        setError(err);
        setLoading(false);
      }
    );
    return () => { unsub(); stopHistory(); stopProfile(); };
  }, [userId, year]);

  const effective = resolveLeaveBalances(settings.leaveTypes, balance, settings.leaveAllowanceBaselines, history, year, joinedOn);
  return {
    balance: userId ? { id: balanceId(userId, year), userId, year, ...effective } : null,
    loading: loading || settingsLoading || (!!userId && (historyLoading || profileLoading)),
    error: error ?? settingsError,
  };
}

/** Repair legacy totals once, checking source records again within the transaction. */
async function ensureVerifiedBalance(userId: string, year: number): Promise<void> {
  const ref = doc(db, BAL_COL, balanceId(userId, year));
  const existing = await getDocFromServer(ref);
  await runTransaction(db, async (tx) => { await assertLeaveAction(tx, userId, 'leaves.approve'); });
  if (existing.data()?.calculationVersion === 2) return;
  const history = await getDocsFromServer(query(collection(db, COL), where('userId', '==', userId)));
  await runTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    if (current.data()?.calculationVersion === 2) return;
    const settings = (await tx.get(doc(db, 'settings', 'general'))).data();
    const profile = (await tx.get(doc(db, 'users', userId))).data();
    const snapshots = await Promise.all(history.docs.map((item) => tx.get(item.ref)));
    const leaves = snapshots.filter((item) => item.exists()).map((item) => ({ id: item.id, ...item.data() } as Leave));
    const effective = resolveLeaveBalances(settings?.leaveTypes ?? DEFAULT_LEAVE_TYPES,
      current.exists() ? current.data() as LeaveBalance : null, {}, leaves, year, profile?.joinedOn);
    tx.set(ref, { userId, year, ...effective, calculationVersion: 2 }, { merge: true });
  });
}

// ─── Actions (atomic where balances change) ────────────────────

export interface ApplyLeaveParams {
  halfDay?: boolean;
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

  if (userId !== authUser.uid) throw new Error('You can only apply for your own leave');
  if (params.halfDay && fromDate !== toDate) throw new Error('Half-day leave must use one date');
  const days = params.halfDay ? 0.5 : daysBetween(fromDate, toDate);
  const settings = await getAttendanceSettings();
  const policy = settings.leaveTypes.find((type) => type.code === leaveType);
  if (!policy) throw new Error('This leave type is no longer available');
  if (days < 0.5 || fromDate.slice(0, 4) !== toDate.slice(0, 4)) throw new Error('Choose dates within the same calendar year');
  if (days > (policy.maxDaysPerApplication ?? 3)) throw new Error(`Maximum ${policy.maxDaysPerApplication ?? 3} days per application`);
  const profile = (await getDocFromServer(doc(db, 'users', userId))).data() as AppUser;
  if (!profile?.active || !(profile.role === 'super_admin' || hasPermission(profile.permissions, 'leaves.applyOwn'))) throw new Error('Leave application is not permitted');
  const year = Number(fromDate.slice(0, 4));
  const historySnap = await getDocsFromServer(query(collection(db, COL), where('userId', '==', userId)));
  const history = historySnap.docs.map((item) => ({ id: item.id, ...item.data() } as Leave));
  const savedBalance = await getDocFromServer(doc(db, BAL_COL, balanceId(userId, year)));
  const effective = resolveLeaveBalances(settings.leaveTypes, savedBalance.exists() ? savedBalance.data() as LeaveBalance : null, {}, history, year, profile.joinedOn);
  const reserved = history.filter((l) => l.status === 'pending' && l.leaveType === leaveType && Number(l.fromDate.slice(0, 4)) === year).reduce((sum, l) => sum + l.days, 0);
  if ((effective.balances[leaveType] ?? 0) - reserved < days) throw new Error('Insufficient accrued balance after pending requests');
  const payload: Omit<Leave, 'id'> = {
    userId,
    halfDay: params.halfDay === true,
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

  const source = await getDocFromServer(leaveRef);
  if (!source.exists()) throw new Error('Leave not found');
  await ensureVerifiedBalance(source.data().userId, Number(source.data().fromDate.slice(0, 4)));

  await runTransaction(db, async (tx) => {
    const leaveSnap = await tx.get(leaveRef);
    if (!leaveSnap.exists()) throw new Error('Leave not found');
    const leave = leaveSnap.data() as Leave;
    const target = await assertLeaveAction(tx, leave.userId, 'leaves.approve');
    if (leave.status !== 'pending') {
      throw new Error(`Leave already ${leave.status}`);
    }

    const year = new Date(leave.fromDate).getFullYear();
    const balRef = doc(db, BAL_COL, balanceId(leave.userId, year));
    const balSnap = await tx.get(balRef);

    const settingsSnap = await tx.get(doc(db, 'settings', 'general'));
    const settings = settingsSnap.data();
    const types = settings?.leaveTypes ?? DEFAULT_LEAVE_TYPES;
    if (!types.some((type: { code: string }) => type.code === leave.leaveType)) throw new Error('This leave type is no longer available');
    const effective = resolveLeaveBalances(types, balSnap.exists() ? balSnap.data() as LeaveBalance : null, settings?.leaveAllowanceBaselines, [], year, target.joinedOn);
    const currentBalances = effective.balances;
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
      tx.update(balRef, { balances: newBalances, allowances: effective.allowances });
    } else {
      tx.set(balRef, {
        userId: leave.userId,
        year,
        balances: newBalances,
        allowances: effective.allowances,
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
    await assertLeaveAction(tx, leave.userId, 'leaves.approve');
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

  const source = await getDocFromServer(leaveRef);
  if (!source.exists()) throw new Error('Leave not found');
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(leaveRef);
    if (!snap.exists()) throw new Error('Leave not found');
    const leave = snap.data() as Leave;

    const target = (await tx.get(doc(db, 'users', leave.userId))).data() as AppUser;
    if (leave.userId !== authUser.uid) await assertLeaveAction(tx, leave.userId, 'leaves.approve');
    else {
      const actor = target;
      if (!actor.active || !(actor.role === 'super_admin' || hasPermission(actor.permissions, 'leaves.cancelOwn'))) throw new Error('Leave cancellation is not allowed');
    }

    if (leave.status === 'cancelled') throw new Error('Already cancelled');
    if (leave.status === 'rejected') throw new Error('Cannot cancel rejected leave');

    // Refund balance only if previously approved
    if (leave.status === 'approved') {
      const year = new Date(leave.fromDate).getFullYear();
      const balRef = doc(db, BAL_COL, balanceId(leave.userId, year));
      const balSnap = await tx.get(balRef);
      // Keep the stored accrual baseline; the resolver adds newly earned credit.
      // Legacy records reconstruct usage from leave status, so need no stored refund.
      if (balSnap.data()?.calculationVersion === 2) {
        const currentBalances = balSnap.data()!.balances as LeaveBalanceMap;
        tx.update(balRef, { balances: { ...currentBalances, [leave.leaveType]: (currentBalances[leave.leaveType] ?? 0) + leave.days }, lastLeaveId: leaveId });
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

  await ensureVerifiedBalance(userId, year);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(balRef);
    const target = await assertLeaveAction(tx, userId, 'leaves.approve');
    const settingsSnap = await tx.get(doc(db, 'settings', 'general'));
    const settings = settingsSnap.data();
    const effective = resolveLeaveBalances(settings?.leaveTypes ?? DEFAULT_LEAVE_TYPES, snap.exists() ? snap.data() as LeaveBalance : null, settings?.leaveAllowanceBaselines, [], year, target.joinedOn);
    const currentBalances = effective.balances;
    const newBalances: LeaveBalanceMap = {
      ...currentBalances,
      [leaveType]: (currentBalances[leaveType] ?? 0) + delta,
    };
    if (snap.exists()) {
      tx.update(balRef, { balances: newBalances, allowances: effective.allowances });
    } else {
      tx.set(balRef, { userId, year, balances: newBalances, allowances: effective.allowances });
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
    tx.set(ref, { userId, year, balances: defaults, allowances: defaults, calculationVersion: 2 });
  });
}
