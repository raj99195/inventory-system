import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logAudit } from '@/lib/audit';

export interface Category {
  id: string;
  name: string;
  color?: string;
  createdAt: Timestamp;
}

const COL = 'categories';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category))
      );
      setLoading(false);
    });
    return unsub;
  }, []);

  return { categories, loading };
}

export async function createCategory(name: string, color?: string) {
  const ref = await addDoc(collection(db, COL), {
    name,
    color: color ?? '#F97316',
    createdAt: serverTimestamp(),
  });
  await logAudit({
    module: 'categories',
    action: 'create',
    recordId: ref.id,
    recordType: 'category',
    newValue: { name, color },
  });
  return ref.id;
}

export async function deleteCategory(id: string, name: string) {
  await deleteDoc(doc(db, COL, id));
  await logAudit({
    module: 'categories',
    action: 'delete',
    recordId: id,
    recordType: 'category',
    previousValue: { name },
  });
}
