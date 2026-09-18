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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product } from '@/types';
import { logAudit } from '@/lib/audit';

const COL = 'products';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Product)
        );
        setProducts(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { products, loading, error };
}

export async function generateSku(category: string): Promise<string> {
  const prefix = (category || 'PRD').slice(0, 3).toUpperCase();
  const snap = await getDocs(collection(db, COL));
  const count = snap.size;
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

export async function createProduct(
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    module: 'products',
    action: 'create',
    recordId: ref.id,
    recordType: 'product',
    newValue: data,
  });
  return ref.id;
}

export async function updateProduct(
  id: string,
  data: Partial<Product>,
  previousValue?: Partial<Product>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    module: 'products',
    action: 'update',
    recordId: id,
    recordType: 'product',
    previousValue,
    newValue: data,
  });
}

export async function deleteProduct(product: Product): Promise<void> {
  await deleteDoc(doc(db, COL, product.id));
  await logAudit({
    module: 'products',
    action: 'delete',
    recordId: product.id,
    recordType: 'product',
    previousValue: {
      name: product.name,
      sku: product.sku,
      currentStock: product.currentStock,
    },
  });
}

export async function toggleProductStatus(product: Product): Promise<void> {
  const newStatus = product.status === 'active' ? 'inactive' : 'active';
  await updateProduct(
    product.id,
    { status: newStatus },
    { status: product.status }
  );
}
