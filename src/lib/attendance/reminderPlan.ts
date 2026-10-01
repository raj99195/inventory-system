import { dateKey, isWorkingDay } from './datetime';

export interface ReminderShift {
  id: string;
  name: string;
  start: string;
  end: string;
  workingDays: readonly string[];
  saturdayOffWeeks?: readonly number[];
}
export interface AttendanceReminder {
  id: number;
  at: Date;
  kind: 'check-in' | 'check-out';
  shift: string;
  time: string;
  date: string;
}

export function buildReminderPlan(shift: ReminderShift, now = new Date(), days = 90,
  todayStatus?: { checkInAt?: string | null; checkOutAt?: string | null }): AttendanceReminder[] {
  const plan: AttendanceReminder[] = [];
  const times = [shift.start, shift.end].map((time) => /^(\d{2}):(\d{2})$/.exec(time));
  if (times.some((match) => !match || Number(match[1]) > 23 || Number(match[2]) > 59)) return plan;
  for (let offset = 0; offset < days; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const date = dateKey(day);
    if (!isWorkingDay(date, shift.workingDays, shift.saturdayOffWeeks)) continue;
    for (let index = 0; index < 2; index++) {
      if (offset === 0 && (index === 0 ? todayStatus?.checkInAt : todayStatus?.checkOutAt)) continue;
      const match = times[index]!;
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(match[1]), Number(match[2]) - 15);
      if (at <= now) continue;
      plan.push({ id: Number(date.replaceAll('-', '')) * 2 + index, at,
        kind: index === 0 ? 'check-in' : 'check-out', shift: shift.name,
        time: index === 0 ? shift.start : shift.end, date });
    }
  }
  return plan;
}
