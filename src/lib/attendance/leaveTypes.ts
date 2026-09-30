/**
 * leaveTypes.ts — leave code catalog for the attendance module
 */

import type { LeaveTypeConfig } from '@/types';

/** Default leave types shipped with the app. Override via /settings/general. */
export const DEFAULT_LEAVE_TYPES: LeaveTypeConfig[] = [
  { code: 'CL', name: 'Casual Leave', default: 6, colorHex: '#F97316' },
  { code: 'SL', name: 'Sick Leave', default: 6, colorHex: '#EF4444' },
  { code: 'EL', name: 'Earned Leave', default: 6, colorHex: '#10B981' },
  { code: 'ML', name: 'Maternity Leave', default: 182, colorHex: '#EC4899' },
  { code: 'PL', name: 'Paternity Leave', default: 15, colorHex: '#3B82F6' },
  { code: 'CO', name: 'Comp-Off', default: 0, colorHex: '#8B5CF6' },
  { code: 'BL', name: 'Bereavement Leave', default: 5, colorHex: '#6B7280' },
  { code: 'LOP', name: 'Loss of Pay', default: 0, colorHex: '#DC2626' },
];

export function normalizeMonthlyLeaveTypes(types: LeaveTypeConfig[]): LeaveTypeConfig[] {
  return types.map((type) => ['CL', 'SL', 'EL'].includes(type.code) ? { ...type, default: 6 } : type);
}

/** Lookup label by leave code */
export function leaveTypeLabel(
  code: string,
  types: LeaveTypeConfig[] = DEFAULT_LEAVE_TYPES
): string {
  return types.find((t) => t.code === code)?.name ?? code;
}

/** Lookup color by leave code */
export function leaveTypeColor(
  code: string,
  types: LeaveTypeConfig[] = DEFAULT_LEAVE_TYPES
): string {
  return types.find((t) => t.code === code)?.colorHex ?? '#6B7280';
}

/** Get a full config for a code */
export function leaveTypeByCode(
  code: string,
  types: LeaveTypeConfig[] = DEFAULT_LEAVE_TYPES
): LeaveTypeConfig | undefined {
  return types.find((t) => t.code === code);
}

/** Default balance map for a fresh year */
export function defaultBalances(
  types: LeaveTypeConfig[] = DEFAULT_LEAVE_TYPES
): Record<string, number> {
  const out: Record<string, number> = {};
  types.forEach((t) => {
    out[t.code] = t.default;
  });
  return out;
}

/** Validate settings before publishing a leave policy. */
export function validateLeaveTypes(types: LeaveTypeConfig[]): string | null {
  const codes = new Set<string>();
  for (const type of types) {
    if (!/^[A-Z][A-Z0-9_]{0,15}$/.test(type.code)) return 'Use a short uppercase leave code (letters, digits or underscore).';
    if (codes.has(type.code)) return `Duplicate leave code: ${type.code}`;
    codes.add(type.code);
    if (!type.name.trim()) return 'Every leave type needs a name.';
    if (!Number.isFinite(type.default) || type.default < 0) return 'Yearly allowance must be zero or more.';
    const maximum = type.maxDaysPerApplication ?? 3;
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 366) return 'Per-application limit must be a whole number from 1 to 366.';
  }
  return null;
}
