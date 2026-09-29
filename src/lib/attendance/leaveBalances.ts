import type { Leave, LeaveBalance, LeaveBalanceMap, LeaveTypeConfig } from '@/types';

/** Legacy totals cannot prove usage: reconstruct from approved records only. */
export function resolveLeaveBalances(
  types: LeaveTypeConfig[],
  record: Partial<LeaveBalance> | null,
  _legacyBaselines: LeaveBalanceMap = {},
  leaves: Leave[] = [],
  year = new Date().getFullYear(),
): { balances: LeaveBalanceMap; allowances: LeaveBalanceMap } {
  const balances = { ...record?.balances };
  const allowances = { ...record?.allowances };
  for (const type of types) {
    if (record?.calculationVersion === 2 && record.allowances?.[type.code] != null) {
      balances[type.code] = (record.balances?.[type.code] ?? record.allowances[type.code]!)
        + type.default - record.allowances[type.code]!;
    } else {
      const used = leaves.filter((leave) => leave.status === 'approved' && leave.leaveType === type.code
        && Number(leave.fromDate.slice(0, 4)) === year)
        .reduce((sum, leave) => sum + (Number.isFinite(leave.days) && leave.days > 0 ? leave.days : 0), 0);
      balances[type.code] = type.default - used + (record?.adjustments?.[type.code] ?? 0);
    }
    allowances[type.code] = type.default;
  }
  return { balances, allowances };
}
