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

const STANDARD_CATEGORIES = ["Power Supply", "Connector", "DIY Model", "DIY Kit", "Decorative Items", "Sensor", "Prototyping Tool", "Kit Spare Parts", "Drone/Drone Part", "Electronic Components", "Display", "Organiser", "Adhesive", "Electrical Item", "Mechanical Tools", "Development Board", "Project", "Electronic Development", "Switch/Switch Holder", "Camera", "Electronic Accessories", "Wheel", "Telescope", "Furniture Item", "Motor", "Soldering Part", "Safety Equipments", "Robot", "Storage", "Stationery Item", "Screw & Nuts", "Binoculars", "Microscope", "Laptop", "Projecter", "VR Headset"];

function categoryOptions(saved: Category[]): Category[] {
  const options = new Map(STANDARD_CATEGORIES.map((name) => [name.toLowerCase(), { id: `standard-${name}`, name } as Category]));
  for (const category of saved) {
    const key = category.name.trim().toLowerCase();
    if (key && key !== 'er') options.set(key, category);
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(() => categoryOptions([]));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, COL), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(
        categoryOptions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category)))
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
