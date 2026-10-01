import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type {
  AttendanceRecord,
  AppUser,
  School,
  AttendanceSettings,
  LocationType,
} from '@/types';
import { logAudit } from '@/lib/audit';
import { canActOnUser, hasPermission } from '@/lib/permissions';
import { distanceMeters } from '@/lib/attendance/geocode';
import { isWorkingDay, dateKey, todayKey, workingMinutes as calcWorkingMinutes } from '@/lib/attendance/datetime';

const COL = 'attendance';

const dailyId = (userId: string, date: string) => `${userId}_${date}`;

// ─── Hooks ─────────────────────────────────────────────────────

/**
 * Real-time attendance for a specific user (defaults to signed-in user).
 * Returns most-recent-first. Limit configurable.
 */
export function useUserAttendance(userId?: string | null, limitCount = 100) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, COL),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRecords(
          snap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as AttendanceRecord)
          )
        );
        setLoading(false);
      },
      (err) => {
        console.error('[useUserAttendance] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [userId, limitCount]);

  return { records, loading };
}

/**
 * Real-time full attendance for all users (admin view).
 * Use limitCount conservatively — this fetches everyone.
 */
export function useAllAttendance(limitCount = 500) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COL),
      orderBy('date', 'desc'),
      limit(limitCount)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRecords(
          snap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as AttendanceRecord)
          )
        );
        setLoading(false);
      },
      (err) => {
        console.error('[useAllAttendance] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [limitCount]);

  return { records, loading };
}

/** Today's attendance for a specific user (one doc, real-time). */
export function useTodaysAttendance(userId?: string | null, date = todayKey()) {
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRecord(null);
      setLoading(false);
      return;
    }
    const ref = doc(db, COL, dailyId(userId, date));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setRecord(
          snap.exists()
            ? ({ id: snap.id, ...snap.data() } as AttendanceRecord)
            : null
        );
        setLoading(false);
      },
      (err) => {
        console.error('[useTodaysAttendance] snapshot error:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [userId, date]);

  return { record, loading };
}

// ─── One-shot fetch helpers ────────────────────────────────────

export async function getTodaysAttendance(
  userId: string
): Promise<AttendanceRecord | null> {
  const ref = doc(db, COL, dailyId(userId, todayKey()));
  const snap = await getDoc(ref);
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as AttendanceRecord)
    : null;
}

// ─── Geofence + late detection (pure functions) ────────────────

interface GeofenceResult {
  withinRadius: boolean | null; // null = wfh (no check)
  distance: number | null;
  radius: number | null;
}

function computeGeofence(
  location: { lat: number; lng: number },
  locationType: LocationType,
  school: School | null,
  user: AppUser | null,
  settings: AttendanceSettings
): GeofenceResult {
  if (locationType === 'wfh') {
    return { withinRadius: null, distance: null, radius: null };
  }

  let centerLat: number | null | undefined;
  let centerLng: number | null | undefined;
  let radius: number;

  if (locationType === 'school' && school) {
    centerLat = school.lat;
    centerLng = school.lng;
    radius = school.radiusM ?? 100;
  } else {
    // office: user's per-user override, else org default
    centerLat = user?.officeLat ?? settings.orgGeofence?.lat;
    centerLng = user?.officeLng ?? settings.orgGeofence?.lng;
    radius = user?.officeRadiusM ?? settings.orgGeofence?.radiusM ?? 100;
  }

  if (centerLat == null || centerLng == null) {
    return { withinRadius: null, distance: null, radius };
  }
  const dist = Math.round(
    distanceMeters(location.lat, location.lng, centerLat, centerLng)
  );
  return { withinRadius: dist <= radius, distance: dist, radius };
}

function parseHHMM(str: string): { h: number; m: number } {
  const [h, m] = String(str || '09:00').split(':').map(Number);
  return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m };
}

function computeIsLate(
  now: Date,
  locationType: LocationType,
  school: School | null,
  settings: AttendanceSettings
): boolean {
  if (locationType === 'office' && !isWorkingDay(dateKey(now), settings.workingDays, settings.saturdayOffWeeks)) return false;
  const timeStr =
    locationType === 'school' && school
      ? school.inTime
      : settings.officeStartTime;
  const { h, m } = parseHHMM(timeStr);
  const grace = settings.lateGraceMinutes ?? 0;
  const cutoffMinutes = h * 60 + m + grace;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > cutoffMinutes;
}

// ─── Actions ───────────────────────────────────────────────────

export interface CheckInParams {
  selfieBase64: string; // full data URL: "data:image/jpeg;base64,..."
  location: { lat: number; lng: number };
  address?: string;
  locationType: LocationType;
  schoolId?: string | null;
  notes?: string;
  user: AppUser; // signed-in user's normalized doc (for officeLat/Lng)
  settings: AttendanceSettings;
  school?: School | null;
}

/**
 * Check-in: creates the day's attendance doc (or overwrites if none exists).
 * Throws if already checked in for today, or if strict geofence blocks off-site.
 */
export async function checkIn(params: CheckInParams): Promise<void> {
  const authUser = auth.currentUser;
  if (!authUser) throw new Error('Not authenticated');

  const {
    selfieBase64,
    location,
    address = '',
    locationType,
    schoolId = null,
    notes = '',
    user,
    settings,
    school = null,
  } = params;

  if (locationType === 'school' && !school) {
    throw new Error('School required for school check-in');
  }
  if (!selfieBase64) throw new Error('Selfie is required for check-in');

  const date = todayKey();
  const id = dailyId(user.uid, date);
  const ref = doc(db, COL, id);

  const existing = await getDoc(ref);
  if (existing.exists() && existing.data().checkInAt) {
    throw new Error('Already checked in for today');
  }

  const geo = computeGeofence(location, locationType, school, user, settings);

  if (
    settings.strictGeofence &&
    locationType === 'office' &&
    geo.withinRadius === false
  ) {
    throw new Error(
      `Off-site check-in blocked. You are ${geo.distance}m from office (allowed: ${geo.radius}m).`
    );
  }

  const now = new Date();
  const isLate = computeIsLate(now, locationType, school, settings);

  const payload: Partial<AttendanceRecord> = {
    userId: user.uid,
    date,
    checkInAt: now.toISOString(),
    checkOutAt: null,
    checkInSelfie: selfieBase64,
    checkOutSelfie: null,
    checkInLat: location.lat,
    checkInLng: location.lng,
    checkInAddress: address,
    checkOutLat: null,
    checkOutLng: null,
    checkOutAddress: null,
    locationType,
    schoolId,
    schoolName: school?.name ?? null,
    isLate,
    workingMinutes: 0,
    notes,
  };

  await setDoc(ref, payload);

  await logAudit({
    module: 'attendance',
    action: 'check-in',
    recordId: id,
    recordType: 'attendance',
    newValue: {
      date,
      locationType,
      schoolName: school?.name ?? null,
      isLate,
      withinRadius: geo.withinRadius,
      distance: geo.distance,
    },
  });
}

export interface CheckOutParams {
  selfieBase64: string;
  location: { lat: number; lng: number };
  address?: string;
  notes?: string;
  user: AppUser;
  settings: AttendanceSettings;
  school?: School | null;
}

/**
 * Check-out: updates today's attendance doc with check-out details
 * and calculates workingMinutes.
 */
export async function checkOut(params: CheckOutParams): Promise<void> {
  const authUser = auth.currentUser;
  if (!authUser) throw new Error('Not authenticated');

  const {
    selfieBase64,
    location,
    address = '',
    notes,
    user,
  } = params;

  if (!selfieBase64) throw new Error('Selfie is required for check-out');

  const date = todayKey();
  const id = dailyId(user.uid, date);
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists() || !snap.data().checkInAt) {
    throw new Error('You need to check in first');
  }
  const existing = snap.data() as AttendanceRecord;
  if (existing.checkOutAt) {
    throw new Error('Already checked out for today');
  }

  const now = new Date();
  const wm = calcWorkingMinutes(existing.checkInAt, now.toISOString());

  await updateDoc(ref, {
    checkOutAt: now.toISOString(),
    checkOutSelfie: selfieBase64,
    checkOutLat: location.lat,
    checkOutLng: location.lng,
    checkOutAddress: address,
    workingMinutes: wm,
    notes: notes ?? existing.notes ?? '',
  });

  await logAudit({
    module: 'attendance',
    action: 'check-out',
    recordId: id,
    recordType: 'attendance',
    newValue: { workingMinutes: wm },
  });
}

/**
 * Admin edit — correct someone's attendance record.
 * Requires attendance.editAll permission (enforced at UI + Firestore rules).
 */
export async function adminEditAttendance(
  id: string,
  patch: Partial<AttendanceRecord>,
  previousValue: Partial<AttendanceRecord>
): Promise<void> {
  const actorId = auth.currentUser?.uid;
  if (!actorId) throw new Error('Not authenticated');
  await runTransaction(db, async (tx) => {
    const recordRef = doc(db, COL, id);
    const record = await tx.get(recordRef);
    if (!record.exists()) throw new Error('Attendance record not found');
    const actorSnap = await tx.get(doc(db, 'users', actorId));
    const targetId = record.data().userId;
    const targetSnap = await tx.get(doc(db, 'users', targetId));
    if (!actorSnap.exists() || !targetSnap.exists()) throw new Error('User profile not found');
    const actor = { ...actorSnap.data(), uid: actorId } as AppUser;
    const target = { ...targetSnap.data(), uid: targetId } as AppUser;
    if (!canActOnUser(actor, target) || !(actor.role === 'super_admin' || hasPermission(actor.permissions, 'attendance.editAll'))) throw new Error('You can only edit attendance for users below your role');
    if (patch.userId && patch.userId !== targetId) throw new Error('Cannot change the attendance owner');
    tx.update(recordRef, patch);
  });
  await logAudit({
    module: 'attendance',
    action: 'admin-edit',
    recordId: id,
    recordType: 'attendance',
    previousValue,
    newValue: patch,
  });
}
