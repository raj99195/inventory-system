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
import type { Employee } from '@/types';
import { logAudit } from '@/lib/audit';

const COL = 'employees';

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setEmployees(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee))
      );
      setLoading(false);
    });
    return unsub;
  }, []);

  return { employees, loading };
}

export async function generateEmployeeIdStr(): Promise<string> {
  const snap = await getDocs(collection(db, COL));
  return `EMP-${String(snap.size + 1).padStart(4, '0')}`;
}

export async function createEmployee(
  data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    module: 'employees',
    action: 'create',
    recordId: ref.id,
    recordType: 'employee',
    newValue: { name: data.name, employeeId: data.employeeId },
  });
  return ref.id;
}

export async function updateEmployee(
  id: string,
  data: Partial<Employee>,
  previousValue?: Partial<Employee>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    module: 'employees',
    action: 'update',
    recordId: id,
    recordType: 'employee',
    previousValue,
    newValue: data,
  });
}

export async function deleteEmployee(employee: Employee): Promise<void> {
  await deleteDoc(doc(db, COL, employee.id));
  await logAudit({
    module: 'employees',
    action: 'delete',
    recordId: employee.id,
    recordType: 'employee',
    previousValue: { name: employee.name, employeeId: employee.employeeId },
  });
}
