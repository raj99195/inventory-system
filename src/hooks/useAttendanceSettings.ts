import { useEffect, useState } from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AttendanceSettings } from '@/types';
import { DEFAULT_LEAVE_TYPES } from '@/lib/attendance/leaveTypes';
import { logAudit } from '@/lib/audit';

const COL = 'settings';
const DOC_ID = 'general';

/**
 * Default attendance settings. Merged with any partial doc in Firestore.
 * Admin-editable via the Attendance Settings page (settings.edit locked to super_admin).
 */
export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  id: 'general',
  officeStartTime: '09:30',
  officeEndTime: '18:00',
  lateGraceMinutes: 15,
  workingDays: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA'],
  orgGeofence: {
    lat: 0,
    lng: 0,
    radiusM: 100,
  },
  strictGeofence: false,
  leaveTypes: DEFAULT_LEAVE_TYPES,
  departments: [
    'Engineering',
    'HR',
    'Operations',
    'Sales',
    'Marketing',
    'Finance',
  ],
};

// ─── Hook ──────────────────────────────────────────────────────

/**
 * Real-time attendance settings singleton doc.
 * Always returns a fully-populated `settings` object (defaults merged in).
 * `hasDoc` tells you if a document exists yet (useful for initial admin setup).
 */
export function useAttendanceSettings() {
  const [settings, setSettings] = useState<AttendanceSettings>(
    DEFAULT_ATTENDANCE_SETTINGS
  );
  const [hasDoc, setHasDoc] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, COL, DOC_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setSettings({
            ...DEFAULT_ATTENDANCE_SETTINGS,
            ...(snap.data() as Partial<AttendanceSettings>),
            id: 'general',
          });
          setHasDoc(true);
        } else {
          setSettings(DEFAULT_ATTENDANCE_SETTINGS);
          setHasDoc(false);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[useAttendanceSettings] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { settings, hasDoc, loading };
}

// ─── Actions ───────────────────────────────────────────────────

/** One-shot fetch (for scripts / non-reactive use). */
export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  const snap = await getDoc(doc(db, COL, DOC_ID));
  if (!snap.exists()) return DEFAULT_ATTENDANCE_SETTINGS;
  return {
    ...DEFAULT_ATTENDANCE_SETTINGS,
    ...(snap.data() as Partial<AttendanceSettings>),
    id: 'general',
  };
}

/**
 * Save (create-or-update) attendance settings.
 * Requires settings.edit permission (super_admin only, enforced at Firestore rules).
 */
export async function saveAttendanceSettings(
  patch: Partial<AttendanceSettings>,
  previousValue?: Partial<AttendanceSettings>
): Promise<void> {
  const ref = doc(db, COL, DOC_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      ...DEFAULT_ATTENDANCE_SETTINGS,
      ...patch,
      updatedAt: serverTimestamp(),
    });
  }

  await logAudit({
    module: 'settings',
    action: snap.exists() ? 'update' : 'create',
    recordId: DOC_ID,
    recordType: 'attendanceSettings',
    previousValue,
    newValue: patch,
  });
}
