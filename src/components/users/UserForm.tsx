import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Loader2,
  AlertCircle,
  Shield,
  User as UserIcon,
  Mail,
  Lock,
  Check,
  Info,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { z } from 'zod';
import type { AppRole, AppUser, Permissions } from '@/types';
import {
  PERMISSION_MODULES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  getPresetForRole,
  detectRole,
  clonePermissions,
} from '@/lib/permissions';
import { createUser, updateUser } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { cn } from '@/lib/utils';

// ---------- Validation ----------
const baseSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  active: z.boolean(),
});

const createSchema = baseSchema.extend({
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
});

interface Props {
  user: AppUser | null;
  onClose: () => void;
}

export default function UserForm({ user, onClose }: Props) {
  const { user: currentUser } = useAuth();
  const { isSuperAdmin, isAdmin } = usePermission();
  const isEditing = !!user;

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [active, setActive] = useState(user?.active ?? true);
  const [role, setRole] = useState<AppRole>(user?.role ?? 'accountant');
  const [permissions, setPermissions] = useState<Permissions>(
    user?.permissions ?? getPresetForRole('accountant')
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // When role changes (non-custom), snap permissions to preset
  useEffect(() => {
    if (role !== 'custom') {
      setPermissions(getPresetForRole(role));
    }
  }, [role]);

  // Admins can only create Admin or Accountant (not Super Admin)
  const availableRoles: AppRole[] = useMemo(() => {
    if (isSuperAdmin) return ['super_admin', 'admin', 'accountant', 'custom'];
    if (isAdmin) return ['admin', 'accountant'];
    return [];
  }, [isSuperAdmin, isAdmin]);

  // Only Super Admin can edit the permission matrix directly
  const canEditMatrix = isSuperAdmin;

  const togglePermission = (moduleKey: string, actionKey: string) => {
    if (!canEditMatrix) return;
    const cloned = clonePermissions(permissions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const module = (cloned as any)[moduleKey];
    module[actionKey] = !module[actionKey];
    setPermissions(cloned);
    // Auto-detect if it matches a preset, otherwise mark as custom
    setRole(detectRole(cloned));
  };

  const handleToggleAll = (moduleKey: string, value: boolean) => {
    if (!canEditMatrix) return;
    const cloned = clonePermissions(permissions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const module = (cloned as any)[moduleKey];
    Object.keys(module).forEach((k) => (module[k] = value));
    setPermissions(cloned);
    setRole(detectRole(cloned));
  };

  const handleSubmit = async () => {
    // Validate
    const schema = isEditing ? baseSchema : createSchema;
    const result = schema.safeParse({
      name,
      email,
      active,
      ...(isEditing ? {} : { password, confirmPassword }),
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      toast.error('Please fix the errors below');
      return;
    }
    if (!isEditing && password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      toast.error('Passwords do not match');
      return;
    }
    if (!currentUser) {
      toast.error('Not signed in');
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      if (isEditing && user) {
        // Only super admins can change role/permissions
        const patch: Parameters<typeof updateUser>[1] = {
          name: name.trim(),
          active,
        };
        if (isSuperAdmin) {
          patch.role = role;
          patch.permissions = permissions;
        }
        await updateUser(user.uid, patch, {
          name: user.name,
          active: user.active,
          role: user.role,
        });
        toast.success('User updated');
      } else {
        await createUser({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          permissions,
          active,
          createdBy: currentUser.uid,
        });
        toast.success('User created successfully');
      }
      onClose();
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Basic Info */}
      <section className="space-y-4">
        <SectionHeader
          icon={UserIcon}
          title="Basic Information"
          subtitle="User account details"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full Name" error={errors.name} required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Raj Agrahari"
              className="input-field"
            />
          </Field>

          <Field label="Email" error={errors.email} required>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@company.com"
                className="input-field pl-10"
                disabled={isEditing}
              />
            </div>
            {isEditing && (
              <p className="mt-1 text-[10px] text-brand-choco-soft">
                Email cannot be changed after creation
              </p>
            )}
          </Field>

          {!isEditing && (
            <>
              <Field label="Password" error={errors.password} required>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft pointer-events-none" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="input-field pl-10"
                  />
                </div>
              </Field>

              <Field
                label="Confirm Password"
                error={errors.confirmPassword}
                required
              >
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft pointer-events-none" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="input-field pl-10"
                  />
                </div>
              </Field>
            </>
          )}
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-brand-cream-dark/50 border border-brand-choco/8">
          <button
            type="button"
            onClick={() => setActive(!active)}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors flex items-center shrink-0',
              active ? 'bg-green-500' : 'bg-brand-choco/20'
            )}
          >
            <motion.span
              layout
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className={cn(
                'w-5 h-5 rounded-full bg-white shadow-md',
                active ? 'ml-6' : 'ml-0.5'
              )}
            />
          </button>
          <div className="flex-1">
            <p className="text-sm font-bold">
              {active ? 'Active' : 'Inactive'}
            </p>
            <p className="text-xs text-brand-choco-soft">
              {active
                ? 'User can sign in and use the system'
                : 'User cannot sign in — all access blocked'}
            </p>
          </div>
        </div>
      </section>

      {/* Role */}
      <section className="space-y-4">
        <SectionHeader
          icon={Shield}
          title="Role"
          subtitle={
            isSuperAdmin
              ? 'Pick a preset or customize permissions below'
              : 'Only Super Admin can customize permissions'
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {availableRoles.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                'p-3 rounded-2xl border-2 text-left transition-all',
                role === r
                  ? 'border-brand-orange bg-brand-orange-50'
                  : 'border-brand-choco/8 bg-white hover:border-brand-orange/30'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Shield
                  className={cn(
                    'w-4 h-4',
                    role === r ? 'text-brand-orange' : 'text-brand-choco-soft'
                  )}
                />
                <span className="text-sm font-bold">{ROLE_LABELS[r]}</span>
              </div>
              {role === r && (
                <p className="text-[10px] text-brand-choco-soft leading-tight">
                  {ROLE_DESCRIPTIONS[r]}
                </p>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Permission Matrix */}
      <section className="space-y-4">
        <SectionHeader
          icon={Sparkles}
          title="Permissions Matrix"
          subtitle={
            canEditMatrix
              ? 'Toggle individual permissions. Role auto-switches to Custom on any change.'
              : 'Read-only preview. Only Super Admin can toggle these.'
          }
        />

        {!canEditMatrix && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-pastel-blue border border-pastel-blue-deep/30">
            <Info className="w-4 h-4 text-brand-choco shrink-0 mt-0.5" />
            <p className="text-xs text-brand-choco">
              You are viewing this in read-only mode. Only Super Admins can
              modify individual permissions. Change the <b>Role</b> above to
              apply a preset.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-brand-choco/8 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-brand-cream-dark border-b border-brand-choco/8 text-xs font-bold uppercase tracking-wider text-brand-choco-soft">
                  <th className="text-left p-3">Module</th>
                  <th className="text-center p-3 w-16">All</th>
                  <th className="text-left p-3">Permissions</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MODULES.map((mod) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const modulePerms = (permissions as any)[mod.key];
                  const allTrue = mod.actions.every(
                    (a) => modulePerms?.[a.key] === true
                  );
                  const someTrue = mod.actions.some(
                    (a) => modulePerms?.[a.key] === true
                  );

                  return (
                    <tr
                      key={mod.key}
                      className="border-b border-brand-choco/5 hover:bg-brand-cream-dark/30 transition"
                    >
                      <td className="p-3 font-bold text-sm">{mod.label}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleAll(mod.key, !allTrue)
                          }
                          disabled={!canEditMatrix}
                          className={cn(
                            'w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all',
                            allTrue
                              ? 'bg-brand-orange border-brand-orange text-white'
                              : someTrue
                              ? 'bg-brand-orange/30 border-brand-orange text-brand-orange'
                              : 'bg-white border-brand-choco/20 hover:border-brand-orange',
                            !canEditMatrix && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {allTrue && <Check className="w-3.5 h-3.5" />}
                          {!allTrue && someTrue && (
                            <div className="w-2.5 h-0.5 bg-brand-orange rounded-full" />
                          )}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {mod.actions.map((action) => {
                            const enabled = modulePerms?.[action.key] === true;
                            return (
                              <button
                                key={action.key}
                                type="button"
                                onClick={() =>
                                  togglePermission(mod.key, action.key)
                                }
                                disabled={!canEditMatrix}
                                className={cn(
                                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border',
                                  enabled
                                    ? 'bg-brand-orange text-white border-brand-orange shadow-sm'
                                    : 'bg-white text-brand-choco-soft border-brand-choco/15 hover:border-brand-orange/40',
                                  !canEditMatrix &&
                                    'opacity-60 cursor-not-allowed'
                                )}
                              >
                                {enabled ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <span className="w-3 h-3" />
                                )}
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-choco/8">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="btn-primary min-w-40"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              {isEditing ? 'Update User' : 'Create User'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand-orange-100 flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-orange" />
      </div>
      <div>
        <h3 className="font-display font-bold text-base">{title}</h3>
        <p className="text-xs text-brand-choco-soft">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
