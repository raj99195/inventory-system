import { useEffect, useState } from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  getDoc,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AttendanceSettings } from '@/types';
import { DEFAULT_LEAVE_TYPES, validateLeaveTypes } from '@/lib/attendance/leaveTypes';
import { logAudit } from '@/lib/audit';

const COL = 'settings';
const DOC_ID = 'general';

/**
 * Default attendance settings. Merged with any partial doc in Firestore.
 * Admin-editable via the Attendance Settings page (settings.edit locked to super_admin).
 */
export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  id: 'general',
  saturdayOffWeeks: [],
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
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const ref = doc(db, COL, DOC_ID);
    let cancelled = false;
    let serverReceived = false;
    const receive = (snap: Awaited<ReturnType<typeof getDoc>>) => {
      if (cancelled || snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
      serverReceived = true;
      const stored = snap.exists() ? snap.data() as Partial<AttendanceSettings> : {};
      setSettings({ ...DEFAULT_ATTENDANCE_SETTINGS, ...stored,
        orgGeofence: { ...DEFAULT_ATTENDANCE_SETTINGS.orgGeofence, ...stored.orgGeofence }, id: 'general' });
      setHasDoc(snap.exists());
      setError(null);
      setLoading(false);
    };
    const unsub = onSnapshot(ref, { includeMetadataChanges: true }, receive, (err) => {
      if (!cancelled) { setError(err); setLoading(false); }
    });
    void getDocFromServer(ref).then((snap) => {
      if (!serverReceived) receive(snap);
    }).catch((err: Error) => {
      if (!cancelled && !serverReceived) { setError(err); setLoading(false); }
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  return { settings, hasDoc, loading, error };
}

// ─── Actions ───────────────────────────────────────────────────

/** One-shot fetch (for scripts / non-reactive use). */
export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  const snap = await getDocFromServer(doc(db, COL, DOC_ID));
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
  if (patch.saturdayOffWeeks && patch.saturdayOffWeeks.some((week) => !Number.isInteger(week) || week < 1 || week > 5)) throw new Error('Saturday off must be between 1st and 5th.');
  if (patch.leaveTypes) {
    const error = validateLeaveTypes(patch.leaveTypes);
    if (error) throw new Error(error);
  }
  const ref = doc(db, COL, DOC_ID);
  let existed = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    existed = snap.exists();
    const current = snap.data() as Partial<AttendanceSettings> | undefined;
    const baselines = { ...current?.leaveAllowanceBaselines };
    // Record the old policy once so legacy balances keep their used-day history.
    for (const type of current?.leaveTypes ?? DEFAULT_LEAVE_TYPES) {
      if (baselines[type.code] == null) baselines[type.code] = type.default;
    }
    for (const type of patch.leaveTypes ?? []) {
      if (baselines[type.code] == null) baselines[type.code] = type.default;
    }
    const payload = { ...patch, leaveAllowanceBaselines: baselines, updatedAt: serverTimestamp() };
    if (existed) tx.update(ref, payload);
    else tx.set(ref, { ...DEFAULT_ATTENDANCE_SETTINGS, ...payload });
  });

  await logAudit({
    module: 'settings',
    action: existed ? 'update' : 'create',
    recordId: DOC_ID,
    recordType: 'attendanceSettings',
    previousValue,
    newValue: patch,
  });
}
