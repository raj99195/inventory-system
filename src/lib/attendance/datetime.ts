/**
 * datetime.ts — date/time formatting and calculation helpers
 * Aliases (todayStr, minutesToHhMm) kept for attendance-app compatibility.
 */

export function fmtDate(input: Date | string | null | undefined): string {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtTime(input: Date | string | null | undefined): string {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function fmtDateTime(input: Date | string | null | undefined): string {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  return `${fmtDate(d)}, ${fmtTime(d)}`;
}

/** Today as YYYY-MM-DD (local timezone) */
export function todayKey(): string {
  return dateKey(new Date());
}

/** Alias for backward compat with attendance app */
export const todayStr = todayKey;

/** Any date as YYYY-MM-DD (local timezone) */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** First day of current month as YYYY-MM-DD */
export function monthStart(base: Date = new Date()): string {
  return dateKey(new Date(base.getFullYear(), base.getMonth(), 1));
}

/** Last day of current month as YYYY-MM-DD */
export function monthEnd(base: Date = new Date()): string {
  return dateKey(new Date(base.getFullYear(), base.getMonth() + 1, 0));
}

/** "HH:MM" → total minutes since midnight */
export function timeToMinutes(hhmm: string): number {
  if (!hhmm || !hhmm.includes(':')) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** total minutes → "Xh Ym" */
export function minutesToHours(mins: number | null | undefined): string {
  if (!mins || mins < 0) return '0h 0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

/** Alias for backward compat */
export const minutesToHhMm = minutesToHours;

/** working minutes between two ISO timestamps */
export function workingMinutes(
  checkInAt: string | null | undefined,
  checkOutAt: string | null | undefined
): number {
  if (!checkInAt || !checkOutAt) return 0;
  const inMs = new Date(checkInAt).getTime();
  const outMs = new Date(checkOutAt).getTime();
  if (isNaN(inMs) || isNaN(outMs) || outMs <= inMs) return 0;
  return Math.round((outMs - inMs) / 1000 / 60);
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayKey();
}

/** Days between two YYYY-MM-DD dates (inclusive) */
export function daysBetween(from: string, to: string): number {
  const fromD = new Date(from);
  const toD = new Date(to);
  if (isNaN(fromD.getTime()) || isNaN(toD.getTime())) return 0;
  const diff = Math.round((toD.getTime() - fromD.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

export function weekdayCode(d: Date): WeekdayCode {
  return WEEKDAY_CODES[d.getDay()];
}

export function isWorkingDay(dateStr: string, workingDays: readonly string[], saturdayOffWeeks: readonly number[] = []): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return false;
  if (!workingDays.includes(weekdayCode(d))) return false;
  if (d.getDay() !== 6) return true;
  const isLastSaturday = new Date(year, month - 1, day + 7).getMonth() !== d.getMonth();
  const ordinal = Math.ceil(day / 7);
  return !(ordinal !== 4 && saturdayOffWeeks.includes(ordinal)) && !((saturdayOffWeeks.includes(4) || saturdayOffWeeks.includes(6)) && isLastSaturday);
}
