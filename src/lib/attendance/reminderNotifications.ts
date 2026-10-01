import { LocalNotifications } from '@capacitor/local-notifications';
import type { AttendanceReminder } from './reminderPlan';

export const ATTENDANCE_REMINDER_KIND = 'attendance-reminder';
let revision = 0;
let queue: Promise<void> = Promise.resolve();

/** Serialize replacements so logout/settings changes cannot leave stale alarms behind. */
export function replaceAttendanceReminders(plan: AttendanceReminder[]): Promise<void> {
  const version = ++revision;
  const operation = queue.catch(() => {}).then(async () => {
    if (version !== revision) return;
    const { notifications } = await LocalNotifications.getPending();
    const owned = notifications.filter((item) => item.extra?.kind === ATTENDANCE_REMINDER_KIND);
    if (owned.length) await LocalNotifications.cancel({ notifications: owned.map(({ id }) => ({ id })) });
    if (version !== revision || !plan.length) return;
    await LocalNotifications.createChannel({ id: 'attendance-reminders', name: 'Attendance reminders',
      description: 'Check-in and check-out reminders 15 minutes before your shift.', importance: 4, visibility: 1, vibration: true });
    await LocalNotifications.schedule({ notifications: plan.map((item) => ({
      id: item.id,
      title: item.kind === 'check-in' ? 'Check-in in 15 minutes' : 'Check-out in 15 minutes',
      body: `${item.shift}: ${item.kind === 'check-in' ? 'Check in' : 'Check out'} at ${item.time}. Tap to open attendance.`,
      channelId: 'attendance-reminders', smallIcon: 'ic_stat_attendance', iconColor: '#F97316',
      schedule: { at: item.at, allowWhileIdle: true }, isExactNotification: true, isExactMandatory: true,
      extra: { kind: ATTENDANCE_REMINDER_KIND, attendanceDate: item.date },
    })) });
  });
  queue = operation;
  return operation;
}
