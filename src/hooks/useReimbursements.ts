import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, where, type Transaction } from 'firebase/firestore';
import { convertBill, assertClaimSize } from '@/lib/reimbursementAttachments';
import { auth, db } from '@/lib/firebase';
import { canActOnUser, hasPermission, normalizePermissions, roleLevel } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { reimbursementTotal, validateBill, validatePayment, type BillAttachment, type Reimbursement, type ReimbursementInput, type ReimbursementExpense } from '@/lib/reimbursementPolicy';
import type { AppUser } from '@/types';

export function useReimbursements(userId: string | undefined, team = false, enabled = true, teamUserIds: string[] = []) {
  const [claims, setClaims] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const teamKey = teamUserIds.slice().sort().join(',');
  useEffect(() => {
    if (!userId || !enabled) { setClaims([]); setLoading(false); return; }
    setLoading(true); setError(false);
    const ids = team ? teamKey.split(',').filter(Boolean) : [userId];
    if (!ids.length) { setClaims([]); setLoading(false); return; }
    const groups: string[][] = []; for (let i = 0; i < ids.length; i += 5) groups.push(ids.slice(i, i+5));
    const results = new Map<number, Reimbursement[]>(); const settled = new Set<number>();
    const unsubs = groups.map((group, index) => onSnapshot(query(collection(db, 'reimbursements'), where('userId', 'in', group)), (snap) => {
      results.set(index, snap.docs.map((d) => ({ ...d.data(), id: d.id } as Reimbursement))); settled.add(index);
      setClaims([...results.values()].flat().sort((a,b) => b.submittedAt.localeCompare(a.submittedAt))); setLoading(settled.size < groups.length);
    }, () => { setError(true); settled.add(index); setLoading(settled.size < groups.length); }));
    return () => unsubs.forEach((unsub) => unsub());
  }, [userId, team, enabled, teamKey]);
  return { claims, loading, error };
}
async function paymentActor(tx: Transaction, claim: Reimbursement) {
  const actorId = auth.currentUser?.uid;
  if (!actorId) throw new Error('Not authenticated');
  const actorSnap = await tx.get(doc(db, 'users', actorId));
  const ownerSnap = await tx.get(doc(db, 'users', claim.userId));
  if (!actorSnap.exists() || !ownerSnap.exists()) throw new Error('User profile not found');
  const actor = { ...actorSnap.data(), uid: actorId } as AppUser;
  const owner = { ...ownerSnap.data(), uid: claim.userId } as AppUser;
  if (!canActOnUser(actor, owner) || (actor.role !== 'super_admin' && !hasPermission(normalizePermissions(actor.permissions, actor.role), 'reimbursements.pay'))) throw new Error('You can only close requests from users below your role. Self-payment is not allowed.');
  return actor;
}
export async function submitReimbursement(input: ReimbursementInput, billFiles: File[][]) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');
  reimbursementTotal(input, false);
  if (billFiles.length !== input.expenses.length || billFiles.some((files) => files.length > 3)) throw new Error('Attach up to 3 actual bills per expense');
  billFiles.flat().forEach((file) => validateBill(file));
  const claimRef = doc(collection(db, 'reimbursements'));
  const profileSnap = await getDoc(doc(db, 'users', userId));
  if (!profileSnap.exists()) throw new Error('User profile not found');
  const profile = profileSnap.data() as AppUser;
  if (!profile.active || (profile.role !== 'super_admin' && !hasPermission(normalizePermissions(profile.permissions, profile.role), 'reimbursements.createOwn'))) throw new Error('Reimbursement submission permission required');
  const expenses: (ReimbursementExpense & { amountPaise: number })[] = [];
  for (let index = 0; index < input.expenses.length; index++) {
    const bills = [];
    for (const file of billFiles[index]) bills.push(await convertBill(file, userId, claimRef.id));
    expenses.push({ ...input.expenses[index], bills, amountPaise: Math.round(input.expenses[index].amount * 100) });
  }
  assertClaimSize({ ...input, expenses });
  const totalAmount = reimbursementTotal({ ...input, expenses });
  await runTransaction(db, async (tx) => {
    const currentSnap = await tx.get(doc(db, 'users', userId));
    const current = currentSnap.data() as AppUser | undefined;
    if (!current?.active || (current.role !== 'super_admin' && !hasPermission(normalizePermissions(current.permissions, current.role), 'reimbursements.createOwn'))) throw new Error('Submission permission changed');
    tx.set(claimRef, { ...input, expenses, totalAmount, totalPaise: Math.round(totalAmount * 100), ownerLevel: roleLevel(current.role), userId, userName: current.name, userEmail: current.email, department: current.department ?? '', status: 'submitted', submittedAt: new Date().toISOString(), createdAt: serverTimestamp() });
  });
  await logAudit({ module: 'reimbursements', action: 'create', recordId: claimRef.id, recordType: 'reimbursement', newValue: { totalAmount } });
}
export async function payReimbursement(claim: Reimbursement, payment: { date: string; method: string; reference: string; notes: string }, proof?: File) {
  validatePayment(payment.date, payment.method);
  // Authorize before uploading optional payment proof.
  await runTransaction(db, async (tx) => { const snap = await tx.get(doc(db, 'reimbursements', claim.id)); if (!snap.exists() || snap.data().status !== 'submitted') throw new Error('Request is already closed or missing'); await paymentActor(tx, { ...snap.data(), id: snap.id } as Reimbursement); });
  const attachment = proof ? await convertBill(proof, claim.userId, claim.id, true) : undefined;
  await runTransaction(db, async (tx) => {
    const claimRef = doc(db, 'reimbursements', claim.id);
    const snap = await tx.get(claimRef);
    if (!snap.exists() || snap.data().status !== 'submitted') throw new Error('Request is already closed or missing');
    const actor = await paymentActor(tx, { ...snap.data(), id: snap.id } as Reimbursement);
    if (reimbursementTotal(snap.data() as ReimbursementInput) !== snap.data().totalAmount) throw new Error('Expense total does not match this request');
    assertClaimSize({ ...snap.data(), ...(attachment ? { paymentProof: attachment } : {}) }, 950000);
    tx.update(claimRef, { status: 'paid_closed', paidAt: new Date().toISOString(), paidBy: actor.uid, paidByName: actor.name, paymentDate: payment.date, paymentMethod: payment.method, paymentReference: payment.reference.trim(), paymentNotes: payment.notes.trim(), ...(attachment ? { paymentProof: attachment } : {}) });
  });
  await logAudit({ module: 'reimbursements', action: 'paid-close', recordId: claim.id, recordType: 'reimbursement', newValue: { paymentDate: payment.date, paymentMethod: payment.method } });
}
export async function attachPaymentProof(claim: Reimbursement, file: File) {
  await runTransaction(db, async (tx) => { const snap = await tx.get(doc(db, 'reimbursements', claim.id)); if (!snap.exists() || snap.data().status !== 'paid_closed' || snap.data().paymentProof) throw new Error('Proof already exists or request is not paid'); await paymentActor(tx, { ...snap.data(), id: snap.id } as Reimbursement); });
  const paymentProof = await convertBill(file, claim.userId, claim.id, true);
  await runTransaction(db, async (tx) => {
    const claimRef = doc(db, 'reimbursements', claim.id); const snap = await tx.get(claimRef);
    if (!snap.exists() || snap.data().status !== 'paid_closed' || snap.data().paymentProof) throw new Error('Proof already exists or request is not paid');
    await paymentActor(tx, { ...snap.data(), id: snap.id } as Reimbursement);
    assertClaimSize({ ...snap.data(), paymentProof }, 950000);
    tx.update(claimRef, { paymentProof, proofAddedBy: auth.currentUser!.uid, proofAddedAt: new Date().toISOString() });
  });
  await logAudit({ module: 'reimbursements', action: 'attach-payment-proof', recordId: claim.id, recordType: 'reimbursement', newValue: { proofAddedBy: auth.currentUser!.uid } });
}
