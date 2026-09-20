import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Kit } from '@/types';
import { logAudit } from '@/lib/audit';

const COL = 'kits';

export function useKits() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Kit)
        );
        setKits(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { kits, loading, error };
}

export async function generateKitSku(): Promise<string> {
  const snap = await getDocs(collection(db, COL));
  const count = snap.size;
  return `KIT-${String(count + 1).padStart(4, '0')}`;
}

// ============================================================================
// 🚀 MODEL B: CREATE KIT with atomic component stock deduction
// ============================================================================
// When a kit is created with initialBatchQty = N:
//   1. Read all linked products (components with productId) in ONE transaction
//   2. Verify each has enough stock: currentStock >= (componentQty × N)
//   3. Deduct from each linked product's currentStock
//   4. Create a stockTransaction for each deduction (source: 'kit-assembly')
//   5. Create the kit doc with currentStock = N
//
// All atomically — if ANY component is insufficient, the entire operation rolls
// back cleanly. Manual (non-linked) components don't affect stock.
// ============================================================================

export interface CreateKitOptions {
  initialBatchQty: number; // How many pre-assembled kits to create in this batch (default 1)
}

export async function createKit(
  data: Omit<Kit, 'id' | 'createdAt' | 'updatedAt' | 'currentStock'>,
  options: CreateKitOptions = { initialBatchQty: 1 }
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const batchQty = Math.max(1, Math.floor(options.initialBatchQty));

  const linkedComponents = data.components.filter((c) => !!c.productId);

  // Pre-generate the kit's doc ID so we can reference it inside the transaction
  const kitRef = doc(collection(db, COL));
  const kitId = kitRef.id;

  await runTransaction(db, async (transaction) => {
    // ─── READ PHASE ─── (must precede all writes in Firestore transactions)
    const productRefs = linkedComponents.map((c) => doc(db, 'products', c.productId!));
    const productSnaps = await Promise.all(
      productRefs.map((ref) => transaction.get(ref))
    );

    // ─── VERIFY PHASE ─── check every linked product has enough stock
    const updates: Array<{
      productRef: ReturnType<typeof doc>;
      productId: string;
      productName: string;
      productSku: string;
      previousStock: number;
      newStock: number;
      deductQty: number;
    }> = [];

    for (let i = 0; i < linkedComponents.length; i++) {
      const comp = linkedComponents[i];
      const snap = productSnaps[i];

      if (!snap.exists()) {
        throw new Error(
          `Component "${comp.name}" is linked to a product that no longer exists`
        );
      }

      const productData = snap.data();
      const previousStock: number = productData.currentStock ?? 0;
      const deductQty = comp.quantity * batchQty;

      if (previousStock < deductQty) {
        throw new Error(
          `Insufficient stock for "${productData.name}" — need ${deductQty}, have ${previousStock}`
        );
      }

      updates.push({
        productRef: productRefs[i],
        productId: comp.productId!,
        productName: productData.name,
        productSku: productData.sku,
        previousStock,
        newStock: previousStock - deductQty,
        deductQty,
      });
    }

    // ─── WRITE PHASE ─── deduct products + log stock transactions + create kit
    for (const u of updates) {
      transaction.update(u.productRef, {
        currentStock: u.newStock,
        updatedAt: serverTimestamp(),
      });

      const txRef = doc(collection(db, 'stockTransactions'));
      transaction.set(txRef, {
        productId: u.productId,
        productName: u.productName,
        productSku: u.productSku,
        type: 'stock-out',
        quantity: -u.deductQty,
        balanceAfter: u.newStock,
        source: 'kit-assembly',
        reason: `Kit assembly: ${data.sku}`,
        remarks: `Used to build ${batchQty} × "${data.name}"`,
        kitId,
        kitSku: data.sku,
        performedBy: user.email ?? user.uid,
        createdAt: serverTimestamp(),
      });
    }

    // Finally, create the kit itself
    transaction.set(kitRef, {
      ...data,
      currentStock: batchQty,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // Audit log outside transaction (not part of atomic operation)
  await logAudit({
    module: 'kits',
    action: 'create',
    recordId: kitId,
    recordType: 'kit',
    newValue: {
      name: data.name,
      sku: data.sku,
      componentCount: data.componentCount,
      totalPieces: data.totalPieces,
      linkedComponents: linkedComponents.length,
      manualComponents: data.components.length - linkedComponents.length,
      initialBatchQty: batchQty,
    },
  });

  return kitId;
}

// ============================================================================
// 🚀 ASSEMBLE MORE — deduct components to build additional units of an existing kit
// ============================================================================
export async function assembleMoreKits(
  kit: Kit,
  additionalQty: number
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  if (additionalQty <= 0) throw new Error('Quantity must be greater than 0');

  const linkedComponents = kit.components.filter((c) => !!c.productId);
  const kitRef = doc(db, COL, kit.id);

  await runTransaction(db, async (transaction) => {
    // READ
    const productRefs = linkedComponents.map((c) => doc(db, 'products', c.productId!));
    const [kitSnap, ...productSnaps] = await Promise.all([
      transaction.get(kitRef),
      ...productRefs.map((ref) => transaction.get(ref)),
    ]);

    if (!kitSnap.exists()) throw new Error('Kit no longer exists');
    const kitCurrentStock: number = kitSnap.data().currentStock ?? 0;

    // VERIFY
    const updates: Array<{
      productRef: ReturnType<typeof doc>;
      productId: string;
      productName: string;
      productSku: string;
      newStock: number;
      deductQty: number;
    }> = [];

    for (let i = 0; i < linkedComponents.length; i++) {
      const comp = linkedComponents[i];
      const snap = productSnaps[i];
      if (!snap.exists()) {
        throw new Error(`Component "${comp.name}" product no longer exists`);
      }
      const productData = snap.data();
      const currentStock: number = productData.currentStock ?? 0;
      const deductQty = comp.quantity * additionalQty;

      if (currentStock < deductQty) {
        throw new Error(
          `Insufficient stock for "${productData.name}" — need ${deductQty}, have ${currentStock}`
        );
      }

      updates.push({
        productRef: productRefs[i],
        productId: comp.productId!,
        productName: productData.name,
        productSku: productData.sku,
        newStock: currentStock - deductQty,
        deductQty,
      });
    }

    // WRITE
    for (const u of updates) {
      transaction.update(u.productRef, {
        currentStock: u.newStock,
        updatedAt: serverTimestamp(),
      });

      const txRef = doc(collection(db, 'stockTransactions'));
      transaction.set(txRef, {
        productId: u.productId,
        productName: u.productName,
        productSku: u.productSku,
        type: 'stock-out',
        quantity: -u.deductQty,
        balanceAfter: u.newStock,
        source: 'kit-assembly',
        reason: `Kit assembly: ${kit.sku}`,
        remarks: `Assembled ${additionalQty} more × "${kit.name}"`,
        kitId: kit.id,
        kitSku: kit.sku,
        performedBy: user.email ?? user.uid,
        createdAt: serverTimestamp(),
      });
    }

    transaction.update(kitRef, {
      currentStock: kitCurrentStock + additionalQty,
      updatedAt: serverTimestamp(),
    });
  });

  await logAudit({
    module: 'kits',
    action: 'assemble',
    recordId: kit.id,
    recordType: 'kit',
    newValue: {
      kitSku: kit.sku,
      assembledQty: additionalQty,
    },
  });
}

// ============================================================================
// updateKit — metadata only, does NOT touch stock
// ============================================================================
export async function updateKit(
  id: string,
  data: Partial<Kit>,
  previousValue?: Partial<Kit>
): Promise<void> {
  // Never let currentStock be silently overwritten via a metadata edit
  const { currentStock: _ignored, ...safeData } = data;
  void _ignored;

  await updateDoc(doc(db, COL, id), {
    ...safeData,
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    module: 'kits',
    action: 'update',
    recordId: id,
    recordType: 'kit',
    previousValue,
    newValue: safeData,
  });
}

export async function deleteKit(kit: Kit): Promise<void> {
  await deleteDoc(doc(db, COL, kit.id));
  await logAudit({
    module: 'kits',
    action: 'delete',
    recordId: kit.id,
    recordType: 'kit',
    previousValue: {
      name: kit.name,
      sku: kit.sku,
      componentCount: kit.componentCount,
      totalPieces: kit.totalPieces,
      currentStock: kit.currentStock,
    },
  });
}

export async function toggleKitStatus(kit: Kit): Promise<void> {
  const newStatus = kit.status === 'active' ? 'inactive' : 'active';
  await updateKit(
    kit.id,
    { status: newStatus },
    { status: kit.status }
  );
}