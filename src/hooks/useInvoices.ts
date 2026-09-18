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
  runTransaction,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Invoice, InvoiceLineItem, Product } from '@/types';
import { logAudit } from '@/lib/audit';

const COL = 'invoices';

export function useInvoices(limitCount = 200) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COL),
      orderBy('uploadedAt', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(q, (snap) => {
      setInvoices(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice))
      );
      setLoading(false);
    });
    return unsub;
  }, [limitCount]);

  return { invoices, loading };
}

export async function checkDuplicate(invoiceNumber: string): Promise<Invoice | null> {
  if (!invoiceNumber) return null;
  const q = query(
    collection(db, COL),
    where('invoiceNumber', '==', invoiceNumber),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Invoice;
}

interface CreateInvoiceParams {
  invoiceNumber: string;
  invoiceDate: string;
  customerName?: string;
  customerGstin?: string;
  totalAmount: number;
  lineItems: InvoiceLineItem[];
  rawText?: string;
}

export async function createPendingInvoice(
  params: CreateInvoiceParams
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const ref = await addDoc(collection(db, COL), {
    ...params,
    status: 'pending-verification',
    uploadedAt: serverTimestamp(),
    uploadedBy: user.email ?? user.uid,
  });
  await logAudit({
    module: 'invoices',
    action: 'upload',
    recordId: ref.id,
    recordType: 'invoice',
    newValue: { invoiceNumber: params.invoiceNumber },
  });
  return ref.id;
}

/**
 * Process invoice: for each line item, apply stock movement.
 * direction: 'in' = stock-in (purchases), 'out' = stock-out (sales)
 * Uses runTransaction per line item for atomicity.
 */
export async function processInvoice(
  invoice: Invoice,
  direction: 'in' | 'out',
  productMap: Map<string, Product>
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const validItems = invoice.lineItems.filter((li) => li.matchedProductId);
  if (validItems.length === 0) {
    throw new Error('No line items matched to products');
  }

  const invoiceRef = doc(db, 'invoices', invoice.id);

  // Process each matched line item — atomic per item
  for (const item of validItems) {
    const product = productMap.get(item.matchedProductId!);
    if (!product) continue;

    const signedQty = direction === 'in' ? item.quantity : -item.quantity;
    const productRef = doc(db, 'products', product.id);
    const txRef = doc(collection(db, 'stockTransactions'));

    await runTransaction(db, async (transaction) => {
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) throw new Error(`Product ${product.name} not found`);
      const currentStock = productSnap.data().currentStock ?? 0;
      const newStock = currentStock + signedQty;
      if (newStock < 0) {
        throw new Error(
          `Insufficient stock for ${product.name} (have ${currentStock}, need ${item.quantity})`
        );
      }

      transaction.update(productRef, {
        currentStock: newStock,
        updatedAt: serverTimestamp(),
      });

      transaction.set(txRef, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        type: direction === 'in' ? 'stock-in' : 'stock-out',
        quantity: signedQty,
        balanceAfter: newStock,
        source: 'zoho-invoice',
        reason: `Zoho Invoice ${invoice.invoiceNumber}`,
        remarks: `Rate: ₹${item.rate} · Amount: ₹${item.amount}`,
        invoiceId: invoice.id,
        performedBy: user.email ?? user.uid,
        createdAt: serverTimestamp(),
      });
    });
  }

  // Mark invoice as processed
  await updateDoc(invoiceRef, {
    status: 'stock-updated',
    verifiedAt: serverTimestamp(),
    stockUpdatedAt: serverTimestamp(),
    lineItems: invoice.lineItems, // save the matched state
  });

  await logAudit({
    module: 'invoices',
    action: 'process',
    recordId: invoice.id,
    recordType: 'invoice',
    newValue: {
      invoiceNumber: invoice.invoiceNumber,
      direction,
      itemsProcessed: validItems.length,
    },
  });
}

export async function updateInvoiceLineItems(
  invoiceId: string,
  lineItems: InvoiceLineItem[]
): Promise<void> {
  await updateDoc(doc(db, COL, invoiceId), {
    lineItems,
    status: 'verified',
  });
}

export async function cancelInvoice(invoice: Invoice): Promise<void> {
  await updateDoc(doc(db, COL, invoice.id), {
    status: 'cancelled',
  });
  await logAudit({
    module: 'invoices',
    action: 'cancel',
    recordId: invoice.id,
    recordType: 'invoice',
    previousValue: { status: invoice.status },
    newValue: { status: 'cancelled' },
  });
}

export async function deleteInvoice(invoice: Invoice): Promise<void> {
  await deleteDoc(doc(db, COL, invoice.id));
  await logAudit({
    module: 'invoices',
    action: 'delete',
    recordId: invoice.id,
    recordType: 'invoice',
    previousValue: { invoiceNumber: invoice.invoiceNumber },
  });
}
