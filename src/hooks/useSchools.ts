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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { School } from '@/types';
import { logAudit } from '@/lib/audit';

const COL = 'schools';

// ─── Hook ──────────────────────────────────────────────────────

/** Real-time schools list, alphabetical. */
export function useSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('name', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSchools(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as School))
        );
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { schools, loading, error };
}

// ─── Actions ───────────────────────────────────────────────────

export type CreateSchoolInput = Omit<
  School,
  'id' | 'createdAt' | 'updatedAt'
>;

/** Create a school. Defaults applied for missing optional fields. */
export async function createSchool(
  data: Partial<CreateSchoolInput>
): Promise<string> {
  const payload = {
    name: (data.name ?? '').trim(),
    inTime: data.inTime || '09:00',
    outTime: data.outTime || '17:00',
    workingDays:
      Array.isArray(data.workingDays) && data.workingDays.length
        ? data.workingDays
        : ['MO', 'TU', 'WE', 'TH', 'FR'],
    address: data.address ?? '',
    lat: data.lat ?? 0,
    lng: data.lng ?? 0,
    radiusM: data.radiusM ?? 100,
    active: data.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!payload.name) throw new Error('School name is required');

  const ref = await addDoc(collection(db, COL), payload);
  await logAudit({
    module: 'schools',
    action: 'create',
    recordId: ref.id,
    recordType: 'school',
    newValue: { name: payload.name, address: payload.address },
  });
  return ref.id;
}

export async function updateSchool(
  id: string,
  patch: Partial<School>,
  previousValue?: Partial<School>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    module: 'schools',
    action: 'update',
    recordId: id,
    recordType: 'school',
    previousValue,
    newValue: patch,
  });
}

export async function deleteSchool(school: School): Promise<void> {
  await deleteDoc(doc(db, COL, school.id));
  await logAudit({
    module: 'schools',
    action: 'delete',
    recordId: school.id,
    recordType: 'school',
    previousValue: { name: school.name, address: school.address },
  });
}

export async function toggleSchoolActive(school: School): Promise<void> {
  await updateSchool(
    school.id,
    { active: !school.active },
    { active: school.active }
  );
}

// ─── Helpers ───────────────────────────────────────────────────

/** Filter schools by user's assignedSchools id list. */
export function filterUserAssignedSchools(
  allSchools: School[],
  assignedIds: string[] | undefined
): School[] {
  if (!assignedIds || assignedIds.length === 0) return [];
  const set = new Set(assignedIds);
  return allSchools.filter((s) => set.has(s.id));
}
