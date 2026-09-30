import type { Leave, LeaveBalance, LeaveBalanceMap, LeaveTypeConfig } from '@/types';

export function accruedAllowance(code: string, annual: number, year: number, joinedOn?: string, now = new Date()): number {
  if (!['CL', 'SL', 'EL'].includes(code)) return annual;
  if (year > now.getFullYear() || !joinedOn || !/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) return 0;
  const [jy, jm, jd] = joinedOn.split('-').map(Number);
  const end = year < now.getFullYear() ? new Date(year, 11, 31) : now;
  let credits = 0;
  for (let month = 0; month < 12; month++) {
    // Credit on the joining-day anniversary after a completed month of service.
    const day = Math.min(jd, new Date(year, month + 1, 0).getDate());
    const credit = new Date(year, month, day);
    if (credit <= end && (year * 12 + month) > (jy * 12 + jm - 1)) credits++;
  }
  return credits * 0.5;
}

/** Legacy totals cannot prove usage: reconstruct from approved records only. */
export function resolveLeaveBalances(
  types: LeaveTypeConfig[],
  record: Partial<LeaveBalance> | null,
  _legacyBaselines: LeaveBalanceMap = {},
  leaves: Leave[] = [],
  year = new Date().getFullYear(),
  joinedOn?: string,
  now = new Date(),
): { balances: LeaveBalanceMap; allowances: LeaveBalanceMap } {
  const balances = { ...record?.balances };
  const allowances = { ...record?.allowances };
  for (const type of types) {
    const allowance = accruedAllowance(type.code, type.default, year, joinedOn, now);
    if (record?.calculationVersion === 2 && record.allowances?.[type.code] != null) {
      balances[type.code] = (record.balances?.[type.code] ?? record.allowances[type.code]!)
        + allowance - record.allowances[type.code]!;
    } else {
      const used = leaves.filter((leave) => leave.status === 'approved' && leave.leaveType === type.code
        && Number(leave.fromDate.slice(0, 4)) === year)
        .reduce((sum, leave) => sum + (Number.isFinite(leave.days) && leave.days > 0 ? leave.days : 0), 0);
      balances[type.code] = allowance - used + (record?.adjustments?.[type.code] ?? 0);
    }
    allowances[type.code] = allowance;
  }
  return { balances, allowances };
}
