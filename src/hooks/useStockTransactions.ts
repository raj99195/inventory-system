import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  doc,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { StockTransaction, StockTxType, StockSource, Product } from '@/types';
import { logAudit } from '@/lib/audit';

const COL = 'stockTransactions';

export function useStockTransactions(limitCount = 200) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COL),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as StockTransaction))
      );
      setLoading(false);
    });
    return unsub;
  }, [limitCount]);

  return { transactions, loading };
}

interface CreateTxParams {
  product: Product;
  type: StockTxType;
  quantity: number; // positive number always; sign applied by type
  source?: StockSource;
  reason?: string;
  remarks?: string;
  invoiceId?: string;
}

/**
 * Atomically:
 *   1. Update product's currentStock
 *   2. Create stockTransactions record
 * Both succeed or both fail. Uses Firestore runTransaction.
 */
export async function createStockTransaction(params: CreateTxParams): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const {
    product,
    type,
    quantity,
    source = 'manual',
    reason,
    remarks,
    invoiceId,
  } = params;

  if (quantity <= 0) throw new Error('Quantity must be positive');

  // Determine sign based on type
  const positiveTypes: StockTxType[] = ['stock-in', 'return'];
  const negativeTypes: StockTxType[] = [
    'stock-out',
    'damage',
    'lost',
  ];
  let signedQty: number;
  if (positiveTypes.includes(type)) signedQty = quantity;
  else if (negativeTypes.includes(type)) signedQty = -quantity;
  else signedQty = quantity; // adjustment/correction — user passes signed value handled outside

  const productRef = doc(db, 'products', product.id);
  const txRef = doc(collection(db, COL));

  await runTransaction(db, async (transaction) => {
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) throw new Error('Product not found');
    const currentStock = productSnap.data().currentStock ?? 0;
    const newStock = currentStock + signedQty;
    if (newStock < 0) throw new Error(`Insufficient stock (available: ${currentStock})`);

    transaction.update(productRef, {
      currentStock: newStock,
      updatedAt: serverTimestamp(),
    });

    transaction.set(txRef, {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      type,
      quantity: signedQty,
      balanceAfter: newStock,
      source,
      reason: reason ?? '',
      remarks: remarks ?? '',
      invoiceId: invoiceId ?? '',
      performedBy: user.email ?? user.uid,
      createdAt: serverTimestamp(),
    });
  });

  await logAudit({
    module: 'stock',
    action: type,
    recordId: product.id,
    recordType: 'product-stock',
    previousValue: { currentStock: product.currentStock },
    newValue: { qty: signedQty },
    reason,
  });
}

/**
 * Adjustment with explicit sign (positive or negative).
 * Used for corrections and manual adjustments.
 */
export async function createAdjustment(
  product: Product,
  delta: number,
  reason: string,
  remarks?: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  if (delta === 0) throw new Error('Adjustment cannot be zero');

  const productRef = doc(db, 'products', product.id);
  const txRef = doc(collection(db, 'stockTransactions'));

  await runTransaction(db, async (transaction) => {
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) throw new Error('Product not found');
    const currentStock = productSnap.data().currentStock ?? 0;
    const newStock = currentStock + delta;
    if (newStock < 0) throw new Error(`Insufficient stock (available: ${currentStock})`);

    transaction.update(productRef, {
      currentStock: newStock,
      updatedAt: serverTimestamp(),
    });

    transaction.set(txRef, {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      type: 'adjustment',
      quantity: delta,
      balanceAfter: newStock,
      source: 'adjustment',
      reason,
      remarks: remarks ?? '',
      performedBy: user.email ?? user.uid,
      createdAt: serverTimestamp(),
    });
  });

  await logAudit({
    module: 'stock',
    action: 'adjustment',
    recordId: product.id,
    recordType: 'product-stock',
    previousValue: { currentStock: product.currentStock },
    newValue: { delta },
    reason,
  });
}
