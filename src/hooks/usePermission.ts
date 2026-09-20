import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';

/**
 * Permission-checking hook.
 * Usage:
 *   const { can, role, isSuperAdmin } = usePermission();
 *   if (can('products.delete')) { ... }
 *
 * Super admins ALWAYS pass every check (even if their permissions object is oddly incomplete).
 * Deactivated users NEVER pass any check.
 */
export function usePermission() {
  const { userDoc } = useAuth();

  const isSuperAdmin = userDoc?.role === 'super_admin' && userDoc?.active === true;
  const isAdmin = userDoc?.role === 'admin' && userDoc?.active === true;
  const isAccountant =
    userDoc?.role === 'accountant' && userDoc?.active === true;

  const can = (perm: string): boolean => {
    if (!userDoc || !userDoc.active) return false;
    if (userDoc.role === 'super_admin') return true;
    return hasPermission(userDoc.permissions, perm);
  };

  /**
   * Check any of several permissions (OR).
   */
  const canAny = (...perms: string[]): boolean => perms.some((p) => can(p));

  /**
   * Check all of several permissions (AND).
   */
  const canAll = (...perms: string[]): boolean => perms.every((p) => can(p));

  return {
    can,
    canAny,
    canAll,
    role: userDoc?.role ?? null,
    isSuperAdmin,
    isAdmin,
    isAccountant,
    active: userDoc?.active ?? false,
  };
}
