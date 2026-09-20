import type { ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';

interface CanProps {
  /** Required permission (e.g., "products.delete") */
  perm?: string;
  /** Pass ANY of these — user needs at least one */
  anyOf?: string[];
  /** Pass ALL of these */
  allOf?: string[];
  /** Only super admin */
  superAdminOnly?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Guard UI elements behind permissions.
 * Usage:
 *   <Can perm="products.delete">
 *     <button>Delete</button>
 *   </Can>
 *
 *   <Can superAdminOnly>
 *     <UsersLink />
 *   </Can>
 */
export default function Can({
  perm,
  anyOf,
  allOf,
  superAdminOnly,
  children,
  fallback = null,
}: CanProps) {
  const { can, canAny, canAll, isSuperAdmin } = usePermission();

  let allowed = true;
  if (superAdminOnly) allowed = allowed && isSuperAdmin;
  if (perm) allowed = allowed && can(perm);
  if (anyOf && anyOf.length > 0) allowed = allowed && canAny(...anyOf);
  if (allOf && allOf.length > 0) allowed = allowed && canAll(...allOf);

  return <>{allowed ? children : fallback}</>;
}
