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
import type { Asset } from '@/types';
import { logAudit } from '@/lib/audit';

const COL = 'assets';

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset)));
      setLoading(false);
    });
    return unsub;
  }, []);

  return { assets, loading };
}

export async function generateAssetIdStr(): Promise<string> {
  const snap = await getDocs(collection(db, COL));
  return `AST-${String(snap.size + 1).padStart(5, '0')}`;
}

export async function createAsset(
  data: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    module: 'assets',
    action: 'create',
    recordId: ref.id,
    recordType: 'asset',
    newValue: { name: data.name, assetId: data.assetId },
  });
  return ref.id;
}

export async function updateAsset(
  id: string,
  data: Partial<Asset>,
  previousValue?: Partial<Asset>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    module: 'assets',
    action: 'update',
    recordId: id,
    recordType: 'asset',
    previousValue,
    newValue: data,
  });
}

export async function deleteAsset(asset: Asset): Promise<void> {
  await deleteDoc(doc(db, COL, asset.id));
  await logAudit({
    module: 'assets',
    action: 'delete',
    recordId: asset.id,
    recordType: 'asset',
    previousValue: { name: asset.name, assetId: asset.assetId },
  });
}
