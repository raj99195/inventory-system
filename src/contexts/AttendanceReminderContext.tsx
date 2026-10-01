import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { hasPermission } from '@/lib/permissions';
import { useAttendanceSettings } from '@/hooks/useAttendanceSettings';
import { useSchools } from '@/hooks/useSchools';
import { useTodaysAttendance } from '@/hooks/useAttendance';
import { buildReminderPlan, type ReminderShift } from '@/lib/attendance/reminderPlan';
import { ATTENDANCE_REMINDER_KIND, replaceAttendanceReminders } from '@/lib/attendance/reminderNotifications';
import type { AppUser } from '@/types';
import { dateKey } from '@/lib/attendance/datetime';

type ReminderStatus = 'loading' | 'enabled' | 'disabled' | 'permission' | 'exact-permission' | 'error';
interface ReminderContextValue {
  status: ReminderStatus;
  error: string;
  shift: ReminderShift | undefined;
  shifts: ReminderShift[];
  enable: () => Promise<void>;
  disable: () => void;
  allowExact: () => Promise<void>;
  selectShift: (id: string) => void;
}
const ReminderContext = createContext<ReminderContextValue | null>(null);
const native = Capacitor.getPlatform() === 'android';
function readPreference(uid: string): { enabled: boolean; shift?: string } {
  try { return { enabled: true, ...JSON.parse(localStorage.getItem(`attendance-reminders:${uid}`) ?? '{}') }; }
  catch { return { enabled: true }; }
}

export function AttendanceReminderProvider({ children }: { children: ReactNode }) {
  const { userDoc, ready } = useAuth();
  const navigate = useNavigate();
  const eligible = ready && userDoc?.active && (userDoc.role === 'super_admin' || hasPermission(userDoc.permissions, 'attendance.markOwn'));

  useEffect(() => {
    if (!native || !ready) return;
    const clear = () => { void replaceAttendanceReminders([]).catch((error) => console.error('[Attendance reminders] cleanup:', error)); };
    const owner = localStorage.getItem('attendance-reminder-owner');
    if (!eligible || owner !== userDoc?.uid) clear();
    if (eligible && userDoc) localStorage.setItem('attendance-reminder-owner', userDoc.uid);
    else localStorage.removeItem('attendance-reminder-owner');
    return clear;
  }, [eligible, ready, userDoc?.uid]);

  useEffect(() => {
    if (!native) return;
    let disposed = false;
    let handle: PluginListenerHandle | undefined;
    void LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      if (event.notification.extra?.kind === ATTENDANCE_REMINDER_KIND) navigate('/attendance/mark');
    }).then((listener) => { if (disposed) void listener.remove(); else handle = listener; }).catch((error) => console.error('[Attendance reminders] listener:', error));
    return () => { disposed = true; void handle?.remove(); };
  }, [navigate]);

  if (!native || !eligible || !userDoc) return <ReminderContext.Provider value={null}>{children}</ReminderContext.Provider>;
  return <ReminderRuntime key={userDoc.uid} profile={userDoc}>{children}</ReminderRuntime>;
}

function ReminderRuntime({ profile, children }: { profile: AppUser; children: ReactNode }) {
  const { settings, loading: settingsLoading, error: settingsError } = useAttendanceSettings();
  const { schools, loading: schoolsLoading, error: schoolsError } = useSchools();
  const { record: today, loading: todayLoading } = useTodaysAttendance(profile.uid);
  const [preference, setPreference] = useState(() => readPreference(profile.uid));
  const [status, setStatus] = useState<ReminderStatus>('loading');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const shifts = useMemo<ReminderShift[]>(() => [
    { id: 'office', name: 'Office', start: settings.officeStartTime, end: settings.officeEndTime, workingDays: settings.workingDays, saturdayOffWeeks: settings.saturdayOffWeeks },
    ...schools.filter((school) => school.active && profile.assignedSchools?.includes(school.id)).map((school) => ({ id: school.id, name: school.name, start: school.inTime, end: school.outTime, workingDays: school.workingDays })),
  ], [settings, schools, profile.assignedSchools]);
  const shift = shifts.find((item) => item.id === preference.shift) ?? shifts.find((item) => item.id === profile.assignedSchools?.[0]) ?? shifts[0];

  useEffect(() => {
    let disposed = false;
    let listener: PluginListenerHandle | undefined;
    void NativeApp.addListener('appStateChange', ({ isActive }) => { if (isActive) setRefresh((value) => value + 1); })
      .then((handle) => { if (disposed) void handle.remove(); else listener = handle; });
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(() => setRefresh((value) => value + 1), midnight.getTime() - now.getTime() + 1000);
    return () => { disposed = true; void listener?.remove(); window.clearTimeout(timer); };
  }, [refresh]);

  useEffect(() => {
    let disposed = false;
    const sync = async () => {
      if (!preference.enabled) { await replaceAttendanceReminders([]); if (!disposed) setStatus('disabled'); return; }
      if (settingsLoading || schoolsLoading || todayLoading) return;
      if (settingsError || schoolsError) { setError('Unable to refresh attendance timings. Please try again when connected.'); setStatus('error'); return; }
      setStatus('loading');
      setError('');
      const permission = await LocalNotifications.checkPermissions();
      if (disposed) return;
      if (permission.display !== 'granted') { await replaceAttendanceReminders([]); if (!disposed) setStatus('permission'); return; }
      const exact = await LocalNotifications.checkExactNotificationSetting();
      if (disposed) return;
      if (exact.exact_alarm !== 'granted') { await replaceAttendanceReminders([]); if (!disposed) setStatus('exact-permission'); return; }
      if (!shift) throw new Error('No attendance timing is available');
      const now = new Date();
      const currentToday = today?.date === dateKey(now) ? today : undefined;
      const plan = buildReminderPlan(shift, now, 90, currentToday);
      // Once checked in, today's checkout follows the location actually used.
      if (currentToday?.checkInAt && !currentToday.checkOutAt) {
        const actual = shifts.find((item) => item.id === (currentToday.locationType === 'school' ? currentToday.schoolId : 'office'));
        if (actual && actual.id !== shift.id) {
          const date = currentToday.date;
          const actualToday = buildReminderPlan(actual, now, 1, currentToday);
          const combined = [...plan.filter((item) => item.date !== date), ...actualToday];
          await replaceAttendanceReminders(combined);
        } else await replaceAttendanceReminders(plan);
      } else await replaceAttendanceReminders(plan);
      if (!disposed) setStatus('enabled');
    };
    void sync().catch((cause: unknown) => { if (!disposed) { setStatus('error'); setError(cause instanceof Error ? cause.message : 'Unable to schedule reminders'); } });
    return () => { disposed = true; };
  }, [preference, settingsLoading, schoolsLoading, todayLoading, settingsError, schoolsError, shift, shifts, today, refresh]);

  const save = (next: typeof preference) => {
    localStorage.setItem(`attendance-reminders:${profile.uid}`, JSON.stringify(next));
    setPreference(next);
  };
  const enable = async () => {
    try {
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted') { setStatus('permission'); return; }
      save({ ...preference, enabled: true });
      setRefresh((value) => value + 1);
    } catch (cause) { setStatus('error'); setError(cause instanceof Error ? cause.message : 'Unable to enable notifications'); }
  };
  const allowExact = async () => {
    try { await LocalNotifications.changeExactNotificationSetting(); setRefresh((value) => value + 1); }
    catch (cause) { setStatus('error'); setError(cause instanceof Error ? cause.message : 'Unable to open reminder settings'); }
  };
  return <ReminderContext.Provider value={{ status, error, shift, shifts, enable, allowExact,
    disable: () => save({ ...preference, enabled: false }), selectShift: (id) => save({ ...preference, shift: id }) }}>{children}</ReminderContext.Provider>;
}

export function useAttendanceReminders() { return useContext(ReminderContext); }
