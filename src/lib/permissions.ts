import type { AppRole, AppUser, Permissions } from '@/types';

export const BOOTSTRAP_SUPER_ADMIN_UID = 'upDzyyrq2pNrMsX9lTRtgAnCuwZ2';

// ==================== PERMISSION MODULE SCHEMA ====================
export interface PermissionAction {
  key: string;
  label: string;
}

export interface PermissionModule {
  key: keyof Permissions;
  label: string;
  section: 'inventory' | 'attendance' | 'admin' | 'common' | 'requests';
  actions: PermissionAction[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  { key: 'dashboard', label: 'Dashboard', section: 'common', actions: [{ key: 'view', label: 'View' }] },

  // INVENTORY
  { key: 'products', label: 'Products', section: 'inventory', actions: [
    { key: 'view', label: 'View' }, { key: 'create', label: 'Create' },
    { key: 'edit', label: 'Edit' }, { key: 'delete', label: 'Delete' },
  ]},
  { key: 'kits', label: 'Kits', section: 'inventory', actions: [
    { key: 'view', label: 'View' }, { key: 'create', label: 'Create' },
    { key: 'edit', label: 'Edit' }, { key: 'delete', label: 'Delete' },
  ]},
  { key: 'stock', label: 'Stock Movement', section: 'inventory', actions: [
    { key: 'view', label: 'View' }, { key: 'stockIn', label: 'Stock In' },
    { key: 'stockOut', label: 'Stock Out' }, { key: 'adjustment', label: 'Adjustment' },
  ]},
  { key: 'invoices', label: 'Invoices', section: 'inventory', actions: [
    { key: 'view', label: 'View' }, { key: 'upload', label: 'Upload' },
    { key: 'verify', label: 'Verify' }, { key: 'delete', label: 'Delete' },
  ]},
  { key: 'quotations', label: 'Quotations', section: 'inventory', actions: [
    { key: 'view', label: 'View' }, { key: 'create', label: 'Create' },
    { key: 'edit', label: 'Edit' }, { key: 'delete', label: 'Delete' },
  ]},
  { key: 'categories', label: 'Categories', section: 'inventory', actions: [
    { key: 'view', label: 'View' }, { key: 'create', label: 'Create' }, { key: 'delete', label: 'Delete' },
  ]},

  // COMMON (HR / Assets)
  { key: 'employees', label: 'Employees', section: 'common', actions: [
    { key: 'view', label: 'View' }, { key: 'create', label: 'Create' },
    { key: 'edit', label: 'Edit' }, { key: 'delete', label: 'Delete' },
  ]},
  { key: 'assets', label: 'Assets', section: 'common', actions: [
    { key: 'view', label: 'View' }, { key: 'create', label: 'Create' },
    { key: 'edit', label: 'Edit' }, { key: 'delete', label: 'Delete' },
  ]},
  { key: 'assignments', label: 'Asset Assignments', section: 'common', actions: [
    { key: 'view', label: 'View' }, { key: 'assign', label: 'Assign' },
    { key: 'return', label: 'Return' }, { key: 'transfer', label: 'Transfer' },
  ]},

  // REQUESTS (NEW)
  { key: 'requests', label: 'Asset Requests', section: 'requests', actions: [
    { key: 'createOwn', label: 'Create Own' },
    { key: 'viewOwn', label: 'View Own' },
    { key: 'cancelOwn', label: 'Cancel Own' },
    { key: 'viewAll', label: 'View All' },
    { key: 'approve', label: 'Approve / Reject' },
  ]},

  // ATTENDANCE
  { key: 'attendance', label: 'Attendance', section: 'attendance', actions: [
    { key: 'markOwn', label: 'Mark Own' }, { key: 'viewOwn', label: 'View Own' },
    { key: 'viewAll', label: 'View Team' }, { key: 'editAll', label: 'Edit Others' },
    { key: 'exportAll', label: 'Export CSV' },
  ]},
  { key: 'leaves', label: 'Leaves', section: 'attendance', actions: [
    { key: 'applyOwn', label: 'Apply Own' }, { key: 'viewOwn', label: 'View Own' },
    { key: 'cancelOwn', label: 'Cancel Own' }, { key: 'viewAll', label: 'View All' },
    { key: 'approve', label: 'Approve / Reject' }, { key: 'exportAll', label: 'Export CSV' },
  ]},
  { key: 'schools', label: 'Schools', section: 'attendance', actions: [
    { key: 'view', label: 'View' }, { key: 'create', label: 'Create' },
    { key: 'edit', label: 'Edit' }, { key: 'delete', label: 'Delete' },
  ]},

  // ADMIN
  { key: 'audit', label: 'Audit Log', section: 'admin', actions: [{ key: 'view', label: 'View' }] },
  { key: 'users', label: 'Users & Roles', section: 'admin', actions: [
    { key: 'view', label: 'View' }, { key: 'create', label: 'Create' },
    { key: 'edit', label: 'Edit' }, { key: 'delete', label: 'Delete' },
  ]},
  { key: 'settings', label: 'Settings', section: 'admin', actions: [
    { key: 'view', label: 'View' }, { key: 'edit', label: 'Edit' },
  ]},
];

export const LOCKED_PERMS = new Set<string>(['settings.edit']);

export const ROLE_LEVELS: Record<AppRole, number> = {
  super_admin: 5, admin: 4, hr: 3, manager: 2, accountant: 2, employee: 1, custom: 0,
};

// ==================== ROLE PRESETS ====================

export const SUPER_ADMIN_PRESET: Permissions = {
  dashboard: { view: true },
  products: { view: true, create: true, edit: true, delete: true },
  kits: { view: true, create: true, edit: true, delete: true },
  stock: { view: true, stockIn: true, stockOut: true, adjustment: true },
  invoices: { view: true, upload: true, verify: true, delete: true },
  quotations: { view: true, create: true, edit: true, delete: true },
  employees: { view: true, create: true, edit: true, delete: true },
  assets: { view: true, create: true, edit: true, delete: true },
  assignments: { view: true, assign: true, return: true, transfer: true },
  categories: { view: true, create: true, delete: true },
  audit: { view: true },
  users: { view: true, create: true, edit: true, delete: true },
  attendance: { markOwn: true, viewOwn: true, viewAll: true, editAll: true, exportAll: true },
  leaves: { applyOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true, exportAll: true },
  schools: { view: true, create: true, edit: true, delete: true },
  settings: { view: true, edit: true },
  requests: { createOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true },
};

export const ADMIN_PRESET: Permissions = {
  dashboard: { view: true },
  products: { view: true, create: true, edit: true, delete: false },
  kits: { view: true, create: true, edit: true, delete: false },
  stock: { view: true, stockIn: true, stockOut: true, adjustment: true },
  invoices: { view: true, upload: true, verify: true, delete: false },
  quotations: { view: true, create: true, edit: true, delete: false },
  employees: { view: true, create: true, edit: true, delete: false },
  assets: { view: true, create: true, edit: true, delete: false },
  assignments: { view: true, assign: true, return: true, transfer: true },
  categories: { view: true, create: true, delete: false },
  audit: { view: true },
  users: { view: true, create: true, edit: true, delete: false },
  attendance: { markOwn: true, viewOwn: true, viewAll: true, editAll: true, exportAll: true },
  leaves: { applyOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true, exportAll: true },
  schools: { view: true, create: true, edit: true, delete: false },
  settings: { view: true, edit: false },
  requests: { createOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true },
};

export const HR_PRESET: Permissions = {
  dashboard: { view: true },
  products: { view: true, create: false, edit: false, delete: false },
  kits: { view: true, create: false, edit: false, delete: false },
  stock: { view: true, stockIn: false, stockOut: false, adjustment: false },
  invoices: { view: false, upload: false, verify: false, delete: false },
  quotations: { view: false, create: false, edit: false, delete: false },
  employees: { view: true, create: true, edit: true, delete: false },
  assets: { view: true, create: true, edit: true, delete: false },
  assignments: { view: true, assign: true, return: true, transfer: true },
  categories: { view: true, create: false, delete: false },
  audit: { view: true },
  users: { view: true, create: true, edit: true, delete: false },
  attendance: { markOwn: true, viewOwn: true, viewAll: true, editAll: false, exportAll: true },
  leaves: { applyOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true, exportAll: true },
  schools: { view: true, create: true, edit: true, delete: false },
  settings: { view: true, edit: false },
  requests: { createOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true },
};

export const MANAGER_PRESET: Permissions = {
  dashboard: { view: true },
  products: { view: false, create: false, edit: false, delete: false },
  kits: { view: false, create: false, edit: false, delete: false },
  stock: { view: false, stockIn: false, stockOut: false, adjustment: false },
  invoices: { view: false, upload: false, verify: false, delete: false },
  quotations: { view: false, create: false, edit: false, delete: false },
  employees: { view: true, create: false, edit: false, delete: false },
  assets: { view: false, create: false, edit: false, delete: false },
  assignments: { view: false, assign: false, return: false, transfer: false },
  categories: { view: false, create: false, delete: false },
  audit: { view: false },
  users: { view: false, create: false, edit: false, delete: false },
  attendance: { markOwn: true, viewOwn: true, viewAll: true, editAll: false, exportAll: true },
  leaves: { applyOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true, exportAll: false },
  schools: { view: true, create: false, edit: false, delete: false },
  settings: { view: false, edit: false },
  requests: { createOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true },
};

export const ACCOUNTANT_PRESET: Permissions = {
  dashboard: { view: true },
  products: { view: true, create: false, edit: false, delete: false },
  kits: { view: true, create: false, edit: false, delete: false },
  stock: { view: true, stockIn: false, stockOut: false, adjustment: false },
  invoices: { view: true, upload: true, verify: true, delete: false },
  quotations: { view: true, create: true, edit: true, delete: false },
  employees: { view: true, create: false, edit: false, delete: false },
  assets: { view: true, create: false, edit: false, delete: false },
  assignments: { view: true, assign: false, return: false, transfer: false },
  categories: { view: true, create: false, delete: false },
  audit: { view: true },
  users: { view: false, create: false, edit: false, delete: false },
  attendance: { markOwn: true, viewOwn: true, viewAll: false, editAll: false, exportAll: false },
  leaves: { applyOwn: true, viewOwn: true, cancelOwn: true, viewAll: false, approve: false, exportAll: false },
  schools: { view: false, create: false, edit: false, delete: false },
  settings: { view: false, edit: false },
  requests: { createOwn: true, viewOwn: true, cancelOwn: true, viewAll: false, approve: false },
};

export const EMPLOYEE_PRESET: Permissions = {
  dashboard: { view: true },
  products: { view: false, create: false, edit: false, delete: false },
  kits: { view: false, create: false, edit: false, delete: false },
  stock: { view: false, stockIn: false, stockOut: false, adjustment: false },
  invoices: { view: false, upload: false, verify: false, delete: false },
  quotations: { view: false, create: false, edit: false, delete: false },
  employees: { view: false, create: false, edit: false, delete: false },
  assets: { view: false, create: false, edit: false, delete: false },
  assignments: { view: false, assign: false, return: false, transfer: false },
  categories: { view: false, create: false, delete: false },
  audit: { view: false },
  users: { view: false, create: false, edit: false, delete: false },
  attendance: { markOwn: true, viewOwn: true, viewAll: false, editAll: false, exportAll: false },
  leaves: { applyOwn: true, viewOwn: true, cancelOwn: true, viewAll: false, approve: false, exportAll: false },
  schools: { view: true, create: false, edit: false, delete: false },
  settings: { view: false, edit: false },
  requests: { createOwn: true, viewOwn: true, cancelOwn: true, viewAll: false, approve: false },
};

export const EMPTY_PRESET: Permissions = {
  dashboard: { view: false },
  products: { view: false, create: false, edit: false, delete: false },
  kits: { view: false, create: false, edit: false, delete: false },
  stock: { view: false, stockIn: false, stockOut: false, adjustment: false },
  invoices: { view: false, upload: false, verify: false, delete: false },
  quotations: { view: false, create: false, edit: false, delete: false },
  employees: { view: false, create: false, edit: false, delete: false },
  assets: { view: false, create: false, edit: false, delete: false },
  assignments: { view: false, assign: false, return: false, transfer: false },
  categories: { view: false, create: false, delete: false },
  audit: { view: false },
  users: { view: false, create: false, edit: false, delete: false },
  attendance: { markOwn: false, viewOwn: false, viewAll: false, editAll: false, exportAll: false },
  leaves: { applyOwn: false, viewOwn: false, cancelOwn: false, viewAll: false, approve: false, exportAll: false },
  schools: { view: false, create: false, edit: false, delete: false },
  settings: { view: false, edit: false },
  requests: { createOwn: false, viewOwn: false, cancelOwn: false, viewAll: false, approve: false },
};

export const ROLE_PRESETS: Record<Exclude<AppRole, 'custom'>, Permissions> = {
  super_admin: SUPER_ADMIN_PRESET,
  admin: ADMIN_PRESET,
  hr: HR_PRESET,
  manager: MANAGER_PRESET,
  accountant: ACCOUNTANT_PRESET,
  employee: EMPLOYEE_PRESET,
};

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin', admin: 'Admin', hr: 'HR', manager: 'Manager',
  accountant: 'Accountant', employee: 'Employee', custom: 'Custom',
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: 'Full access. Can delete anything, edit system settings, and manage all users.',
  admin: 'Full access except delete + settings.edit. Can create users (below their level).',
  hr: 'Manages users, employees, assets, attendance, leaves, requests. Read-only inventory.',
  manager: 'Team attendance oversight + leave/request approval. No inventory or HR access.',
  accountant: 'View-only inventory. Uploads/verifies invoices, creates quotations. Own attendance/leaves/requests.',
  employee: 'Own attendance, leaves and requests only. Base access for all users.',
  custom: 'Manually toggled permissions set by a Super Admin. Locked perms cannot be granted.',
};

// ==================== HELPERS ====================

export function getPresetForRole(role: AppRole): Permissions {
  if (role === 'custom') return EMPTY_PRESET;
  return ROLE_PRESETS[role];
}

export function clonePermissions(p: Permissions): Permissions {
  return JSON.parse(JSON.stringify(p)) as Permissions;
}

export function normalizePermissions(perms: Partial<Permissions> | null | undefined): Permissions {
  if (!perms) return clonePermissions(EMPTY_PRESET);
  const base = clonePermissions(EMPTY_PRESET);
  return { ...base, ...perms } as Permissions;
}

export function detectRole(perms: Permissions): AppRole {
  const stringify = (p: Permissions) => JSON.stringify(p);
  const target = stringify(perms);
  if (target === stringify(SUPER_ADMIN_PRESET)) return 'super_admin';
  if (target === stringify(ADMIN_PRESET)) return 'admin';
  if (target === stringify(HR_PRESET)) return 'hr';
  if (target === stringify(MANAGER_PRESET)) return 'manager';
  if (target === stringify(ACCOUNTANT_PRESET)) return 'accountant';
  if (target === stringify(EMPLOYEE_PRESET)) return 'employee';
  return 'custom';
}

export function hasPermission(perms: Permissions | null | undefined, perm: string): boolean {
  if (!perms) return false;
  const [moduleKey, actionKey] = perm.split('.');
  if (!moduleKey || !actionKey) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modulePerms = (perms as any)[moduleKey];
  if (!modulePerms) return false;
  return modulePerms[actionKey] === true;
}

export function roleLevel(role: AppRole | undefined | null): number {
  if (!role) return 0;
  return ROLE_LEVELS[role] ?? 0;
}

export function myLevel(profile: AppUser | null | undefined): number {
  return roleLevel(profile?.role);
}

export function canAssignRole(myLvl: number, targetRole: AppRole): boolean {
  const t = roleLevel(targetRole);
  return t > 0 && t < myLvl;
}

export function getAssignableRoles(myLvl: number): Partial<Record<Exclude<AppRole, 'custom'>, Permissions>> {
  const out: Partial<Record<Exclude<AppRole, 'custom'>, Permissions>> = {};
  (Object.keys(ROLE_PRESETS) as Array<Exclude<AppRole, 'custom'>>).forEach((role) => {
    if (canAssignRole(myLvl, role)) out[role] = ROLE_PRESETS[role];
  });
  return out;
}

export function canManageUser(myLvl: number, targetUser: AppUser | null | undefined): boolean {
  if (!targetUser) return false;
  return canAssignRole(myLvl, targetUser.role);
}

export function containsLockedPerms(perms: Permissions): boolean {
  for (const lockedPerm of LOCKED_PERMS) {
    if (hasPermission(perms, lockedPerm)) return true;
  }
  return false;
}

export function stripLockedPerms(perms: Permissions): Permissions {
  const cleaned = clonePermissions(perms);
  for (const lockedPerm of LOCKED_PERMS) {
    const [moduleKey, actionKey] = lockedPerm.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modulePerms = (cleaned as any)[moduleKey];
    if (modulePerms && actionKey in modulePerms) {
      modulePerms[actionKey] = false;
    }
  }
  return cleaned;
}

export function homePathFor(profile: AppUser | null | undefined): string {
  if (!profile) return '/login';
  const perms = profile.permissions;
  if (!perms) return '/no-access';
  if (hasPermission(perms, 'dashboard.view')) return '/dashboard';
  if (hasPermission(perms, 'attendance.markOwn')) return '/attendance/mark';
  if (hasPermission(perms, 'attendance.viewAll')) return '/attendance/admin/view';
  return '/no-access';
}
