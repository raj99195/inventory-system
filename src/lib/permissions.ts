import type { AppRole, Permissions } from '@/types';

/**
 * The hardcoded Super Admin UID (Raj / Firebase project owner).
 * This UID always gets full super_admin permissions and cannot be locked out.
 */
export const BOOTSTRAP_SUPER_ADMIN_UID = 'upDzyyrq2pNrMsX9lTRtgAnCuwZ2';

// ==================== PERMISSION MODULE SCHEMA ====================
// Used to render the permission matrix dynamically
export interface PermissionAction {
  key: string;
  label: string;
}

export interface PermissionModule {
  key: keyof Permissions;
  label: string;
  actions: PermissionAction[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    actions: [{ key: 'view', label: 'View' }],
  },
  {
    key: 'products',
    label: 'Products',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'kits',
    label: 'Kits',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'stock',
    label: 'Stock Movement',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'stockIn', label: 'Stock In' },
      { key: 'stockOut', label: 'Stock Out' },
      { key: 'adjustment', label: 'Adjustment' },
    ],
  },
  {
    key: 'invoices',
    label: 'Invoices',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'upload', label: 'Upload' },
      { key: 'verify', label: 'Verify' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'quotations',
    label: 'Quotations',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'employees',
    label: 'Employees',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'assets',
    label: 'Assets',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'assignments',
    label: 'Assignments',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'assign', label: 'Assign' },
      { key: 'return', label: 'Return' },
      { key: 'transfer', label: 'Transfer' },
    ],
  },
  {
    key: 'categories',
    label: 'Categories',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'audit',
    label: 'Audit Log',
    actions: [{ key: 'view', label: 'View' }],
  },
  {
    key: 'users',
    label: 'Users & Roles',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
];

// ==================== ROLE PRESETS ====================
/**
 * Super Admin: Full access to everything including deletion and permission toggling.
 */
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
};

/**
 * Admin: Full access EXCEPT delete operations. Can create users (but not super_admins).
 */
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
  users: { view: true, create: true, edit: false, delete: false },
};

/**
 * Accountant: Mostly view-only, but can upload/verify invoices and create quotations.
 */
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
};

/**
 * A blank preset with everything false — used as the base for Custom roles.
 */
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
};

export const ROLE_PRESETS: Record<Exclude<AppRole, 'custom'>, Permissions> = {
  super_admin: SUPER_ADMIN_PRESET,
  admin: ADMIN_PRESET,
  accountant: ACCOUNTANT_PRESET,
};

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  accountant: 'Accountant',
  custom: 'Custom',
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: 'Full access. Can delete anything and manage all users & permissions.',
  admin: 'Full access except delete. Can create users (Admin / Accountant only).',
  accountant: 'View-only across the app. Can upload & verify invoices and create quotations.',
  custom: 'Manually toggled permissions set by a Super Admin.',
};

// ==================== HELPER FUNCTIONS ====================
export function getPresetForRole(role: AppRole): Permissions {
  if (role === 'custom') return EMPTY_PRESET;
  return ROLE_PRESETS[role];
}

/**
 * Deep clone a permissions object (safe from reference bugs).
 */
export function clonePermissions(p: Permissions): Permissions {
  return JSON.parse(JSON.stringify(p)) as Permissions;
}

/**
 * Detect the closest matching role for a given permissions object.
 * Returns 'custom' if it doesn't match any preset exactly.
 */
export function detectRole(perms: Permissions): AppRole {
  const stringify = (p: Permissions) => JSON.stringify(p);
  const target = stringify(perms);
  if (target === stringify(SUPER_ADMIN_PRESET)) return 'super_admin';
  if (target === stringify(ADMIN_PRESET)) return 'admin';
  if (target === stringify(ACCOUNTANT_PRESET)) return 'accountant';
  return 'custom';
}

/**
 * Check whether the permissions object grants a specific permission.
 * Uses dot notation like "products.delete" or "stock.stockIn".
 */
export function hasPermission(
  perms: Permissions | null | undefined,
  perm: string
): boolean {
  if (!perms) return false;
  const [moduleKey, actionKey] = perm.split('.');
  if (!moduleKey || !actionKey) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modulePerms = (perms as any)[moduleKey];
  if (!modulePerms) return false;
  return modulePerms[actionKey] === true;
}