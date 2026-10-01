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

export function useAssets(enabled = true, source: 'assets' | 'officeAssets' = COL) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) { setAssets([]); setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, source), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset)));
      setLoading(false);
    });
    return unsub;
  }, [enabled, source]);

  return { assets, loading };
}

export async function generateAssetIdStr(source: 'assets' | 'officeAssets' = COL): Promise<string> {
  const snap = await getDocs(collection(db, source));
  return `${source === COL ? 'AST' : 'OAST'}-${String(snap.size + 1).padStart(5, '0')}`;
}

export async function createAsset(
  data: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>,
  source: 'assets' | 'officeAssets' = COL
): Promise<string> {
  const ref = await addDoc(collection(db, source), {
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
  previousValue?: Partial<Asset>,
  source: 'assets' | 'officeAssets' = COL
): Promise<void> {
  await updateDoc(doc(db, source, id), {
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
