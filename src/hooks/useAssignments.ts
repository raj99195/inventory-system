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
  where,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type {
  AssetAssignment,
  Asset,
  Employee,
  AssetCondition,
  AssetStatus,
} from '@/types';
import { logAudit } from '@/lib/audit';

const COL = 'assetAssignments';

export function useAssignments(limitCount = 200) {
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COL),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAssignments(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssetAssignment))
      );
      setLoading(false);
    });
    return unsub;
  }, [limitCount]);

  return { assignments, loading };
}

export function useAssignmentsByEmployee(employeeId: string) {
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, COL),
      where('employeeId', '==', employeeId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setAssignments(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssetAssignment))
      );
      setLoading(false);
    });
    return unsub;
  }, [employeeId]);

  return { assignments, loading };
}

interface AssignParams {
  asset: Asset;
  employee: Employee;
  conditionAtAssign: AssetCondition;
  accessories?: string[];
  remarks?: string;
}

/**
 * Atomically assign asset to employee.
 * Updates asset status → 'assigned', sets assignedTo.
 * Creates assignment record with action='assigned'.
 */
export async function assignAsset(params: AssignParams): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const { asset, employee, conditionAtAssign, accessories, remarks } = params;

  if (asset.status !== 'available') {
    throw new Error(`Asset is ${asset.status} — cannot assign`);
  }
  if (employee.status !== 'active') {
    throw new Error(`Employee is ${employee.status} — cannot assign`);
  }

  const assetRef = doc(db, 'assets', asset.id);
  const assignRef = doc(collection(db, COL));
  const today = new Date().toISOString().slice(0, 10);

  await runTransaction(db, async (transaction) => {
    const assetSnap = await transaction.get(assetRef);
    if (!assetSnap.exists()) throw new Error('Asset not found');
    if (assetSnap.data().status !== 'available') {
      throw new Error('Asset no longer available');
    }

    transaction.update(assetRef, {
      status: 'assigned' as AssetStatus,
      assignedTo: employee.id,
      updatedAt: serverTimestamp(),
    });

    transaction.set(assignRef, {
      assetId: asset.id,
      assetName: asset.name,
      employeeId: employee.id,
      employeeName: employee.name,
      action: 'assigned',
      date: today,
      conditionAtAssign,
      accessories: accessories ?? [],
      remarks: remarks ?? '',
      performedBy: user.email ?? user.uid,
      createdAt: serverTimestamp(),
    });
  });

  await logAudit({
    module: 'assignments',
    action: 'assign',
    recordId: asset.id,
    recordType: 'asset-assignment',
    newValue: {
      asset: asset.assetId,
      assetName: asset.name,
      employee: employee.employeeId,
      employeeName: employee.name,
    },
  });
}

interface ReturnParams {
  asset: Asset;
  employee: Employee;
  conditionAtReturn: AssetCondition;
  newStatus: AssetStatus; // available / under-repair / damaged
  receivedBy: string;
  accessories?: string[];
  damageDetails?: string;
  remarks?: string;
}

/**
 * Atomically return asset from employee.
 */
export async function returnAsset(params: ReturnParams): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const {
    asset,
    employee,
    conditionAtReturn,
    newStatus,
    receivedBy,
    accessories,
    damageDetails,
    remarks,
  } = params;

  if (asset.status !== 'assigned') {
    throw new Error('Asset is not currently assigned');
  }

  const assetRef = doc(db, 'assets', asset.id);
  const assignRef = doc(collection(db, COL));
  const today = new Date().toISOString().slice(0, 10);

  await runTransaction(db, async (transaction) => {
    transaction.update(assetRef, {
      status: newStatus,
      assignedTo: null,
      condition: conditionAtReturn,
      updatedAt: serverTimestamp(),
    });

    transaction.set(assignRef, {
      assetId: asset.id,
      assetName: asset.name,
      employeeId: employee.id,
      employeeName: employee.name,
      action: 'returned',
      date: today,
      conditionAtReturn,
      receivedBy,
      accessories: accessories ?? [],
      damageDetails: damageDetails ?? '',
      remarks: remarks ?? '',
      performedBy: user.email ?? user.uid,
      createdAt: serverTimestamp(),
    });
  });

  await logAudit({
    module: 'assignments',
    action: 'return',
    recordId: asset.id,
    recordType: 'asset-assignment',
    newValue: {
      asset: asset.assetId,
      newStatus,
      condition: conditionAtReturn,
    },
  });
}

interface TransferParams {
  asset: Asset;
  fromEmployee: Employee;
  toEmployee: Employee;
  remarks?: string;
}

export async function transferAsset(params: TransferParams): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const { asset, fromEmployee, toEmployee, remarks } = params;

  if (asset.status !== 'assigned') {
    throw new Error('Asset must be assigned before transfer');
  }
  if (toEmployee.status !== 'active') {
    throw new Error(`Target employee is ${toEmployee.status}`);
  }
  if (fromEmployee.id === toEmployee.id) {
    throw new Error('Cannot transfer to same employee');
  }

  const assetRef = doc(db, 'assets', asset.id);
  const assignRef = doc(collection(db, COL));
  const today = new Date().toISOString().slice(0, 10);

  await runTransaction(db, async (transaction) => {
    transaction.update(assetRef, {
      assignedTo: toEmployee.id,
      updatedAt: serverTimestamp(),
    });

    transaction.set(assignRef, {
      assetId: asset.id,
      assetName: asset.name,
      employeeId: toEmployee.id,
      employeeName: toEmployee.name,
      action: 'transferred',
      date: today,
      transferredFrom: fromEmployee.name,
      transferredTo: toEmployee.name,
      remarks: remarks ?? '',
      performedBy: user.email ?? user.uid,
      createdAt: serverTimestamp(),
    });
  });

  await logAudit({
    module: 'assignments',
    action: 'transfer',
    recordId: asset.id,
    recordType: 'asset-assignment',
    previousValue: { assignedTo: fromEmployee.name },
    newValue: { assignedTo: toEmployee.name },
  });
}
