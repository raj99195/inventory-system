import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Quotation, QuotationStatus } from '@/types';
import { logAudit } from '@/lib/audit';

const COL = 'quotations';

export function useQuotations(limitCount = 200) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, COL),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setQuotations(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Quotation))
        );
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [limitCount]);

  return { quotations, loading, error };
}

/** Q-YYYY-NNNN — auto-increments based on collection count */
export async function generateQuotationNumber(): Promise<string> {
  const snap = await getDocs(collection(db, COL));
  const count = snap.size;
  const year = new Date().getFullYear();
  return `Q-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function createQuotation(
  data: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdBy: user.email ?? user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    module: 'quotations',
    action: 'create',
    recordId: ref.id,
    recordType: 'quotation',
    newValue: {
      quotationNumber: data.quotationNumber,
      customerName: data.customerName,
      grandTotal: data.grandTotal,
      itemCount: data.itemCount,
    },
  });

  return ref.id;
}

export async function updateQuotation(
  id: string,
  data: Partial<Quotation>,
  previousValue?: Partial<Quotation>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    module: 'quotations',
    action: 'update',
    recordId: id,
    recordType: 'quotation',
    previousValue,
    newValue: data,
  });
}

export async function updateQuotationStatus(
  quotation: Quotation,
  newStatus: QuotationStatus
): Promise<void> {
  const extraFields: Partial<Quotation> = {};
  if (newStatus === 'sent') extraFields.sentAt = serverTimestamp() as unknown as Quotation['sentAt'];
  if (newStatus === 'accepted') extraFields.acceptedAt = serverTimestamp() as unknown as Quotation['acceptedAt'];

  await updateDoc(doc(db, COL, quotation.id), {
    status: newStatus,
    updatedAt: serverTimestamp(),
    ...extraFields,
  });
  await logAudit({
    module: 'quotations',
    action: 'status-change',
    recordId: quotation.id,
    recordType: 'quotation',
    previousValue: { status: quotation.status },
    newValue: { status: newStatus },
  });
}

export async function deleteQuotation(quotation: Quotation): Promise<void> {
  await deleteDoc(doc(db, COL, quotation.id));
  await logAudit({
    module: 'quotations',
    action: 'delete',
    recordId: quotation.id,
    recordType: 'quotation',
    previousValue: {
      quotationNumber: quotation.quotationNumber,
      customerName: quotation.customerName,
      grandTotal: quotation.grandTotal,
    },
  });
}
