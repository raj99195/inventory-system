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
  Phone,
  Building,
  Briefcase,
  Calendar as CalendarIcon,
  School as SchoolIcon,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { z } from 'zod';
import type { AppRole, AppUser, Permissions } from '@/types';
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  getPresetForRole,
  clonePermissions,
  getAssignableRoles,
  myLevel,
  canActOnUser,
  normalizePermissions,
} from '@/lib/permissions';
import { createUser, updateUser } from '@/hooks/useUsers';
import { useSchools } from '@/hooks/useSchools';
import { useAttendanceSettings } from '@/hooks/useAttendanceSettings';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { forwardGeocode } from '@/lib/attendance/geocode';
import { todayKey } from '@/lib/attendance/datetime';
import { cn } from '@/lib/utils';
import PermissionMatrix from './PermissionMatrix';

const baseSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  active: z.boolean(),
});

const createSchema = baseSchema.extend({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
});

interface Props {
  user: AppUser | null;
  onClose: () => void;
}

export default function UserForm({ user, onClose }: Props) {
  const { user: currentUser, userDoc } = useAuth();
  const { isSuperAdmin } = usePermission();
  const { schools } = useSchools();
  const { settings } = useAttendanceSettings();
  const departments = settings.departments ?? [];
  const isEditing = !!user;
  const isSelf = user?.uid === currentUser?.uid;
  const myLvl = myLevel(userDoc);

  const availableRoleMap = useMemo(() => getAssignableRoles(myLvl), [myLvl]);
  const availableRoles = Object.keys(availableRoleMap) as AppRole[];

  // Basic fields
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [active, setActive] = useState(user?.active ?? true);
  const [role, setRole] = useState<AppRole>(
    user?.role ?? (availableRoles.includes('employee') ? 'employee' : availableRoles[0] ?? 'employee')
  );
  const [permissions, setPermissions] = useState<Permissions>(
    user ? normalizePermissions(user.permissions, user.role) : getPresetForRole(role)
  );

  // Attendance fields
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [designation, setDesignation] = useState(user?.designation ?? '');
  const [joinedOn, setJoinedOn] = useState(user?.joinedOn ?? todayKey());
  const [assignedSchools, setAssignedSchools] = useState<string[]>(user?.assignedSchools ?? []);

  // Personal geofence
  const [officeAddress, setOfficeAddress] = useState(user?.officeAddress ?? '');
  const [officeLat, setOfficeLat] = useState<string>(user?.officeLat != null ? String(user.officeLat) : '');
  const [officeLng, setOfficeLng] = useState<string>(user?.officeLng != null ? String(user.officeLng) : '');
  const [officeRadiusM, setOfficeRadiusM] = useState<string>(
    user?.officeRadiusM != null ? String(user.officeRadiusM) : ''
  );
  const [geocoding, setGeocoding] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (role !== 'custom' && !isEditing) {
      setPermissions(getPresetForRole(role));
    }
  }, [role, isEditing]);

  const canEditMatrix = isSuperAdmin;

  const setModulePermissions = (moduleKey: keyof Permissions, actionKeys: string[], value: boolean) => {
    if (!canEditMatrix) return;
    setPermissions((previous) => {
      const cloned = clonePermissions(previous);
      const module = { ...(cloned[moduleKey] as Record<string, boolean> | undefined) };
      actionKeys.forEach((key) => { module[key] = value; });
      return { ...cloned, [moduleKey]: module };
    });
  };

  const fetchCoords = async () => {
    if (!officeAddress.trim()) return toast.error('Enter office address first');
    setGeocoding(true);
    try {
      const r = await forwardGeocode(officeAddress);
      if (r) {
        setOfficeLat(String(r.lat));
        setOfficeLng(String(r.lng));
        toast.success('Coordinates fetched');
      } else {
        toast.error('Address not found');
      }
    } catch {
      toast.error('Geocoding failed');
    } finally {
      setGeocoding(false);
    }
  };

  const toggleSchool = (id: string) => {
    setAssignedSchools((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (isEditing && !canActOnUser(userDoc, user)) return toast.error('You can only edit users below your role');
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

    // Attendance profile fields
    const attendancePayload = {
      phone: phone || undefined,
      department: department || undefined,
      designation: designation || undefined,
      joinedOn: joinedOn || undefined,
      assignedSchools,
      officeAddress: officeAddress || undefined,
      officeLat: officeLat === '' ? null : parseFloat(officeLat),
      officeLng: officeLng === '' ? null : parseFloat(officeLng),
      officeRadiusM: officeRadiusM === '' ? null : parseInt(officeRadiusM),
    };

    try {
      if (isEditing && user) {
        const patch: Parameters<typeof updateUser>[1] = {
          name: name.trim(),
          active,
          ...attendancePayload,
        };
        if (!isSelf && canEditMatrix) {
          patch.role = role;
          patch.permissions = permissions;
        } else if (!isSelf) {
          // Non-super-admin manager can change role but not perms directly
          patch.role = role;
          patch.permissions = getPresetForRole(role);
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
          ...attendancePayload,
        });
        toast.success('User created successfully');
      }
      onClose();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {isSelf && (
        <div className="rounded-2xl bg-pastel-peach border border-pastel-peach-deep/30 p-3 text-sm text-orange-900 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          You're editing your own profile. Role and permissions can only be changed by another admin.
        </div>
      )}

      {/* Basic Info */}
      <section className="space-y-4">
        <SectionHeader icon={UserIcon} title="Basic Information" subtitle="User account details" />
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
              <Field label="Confirm Password" error={errors.confirmPassword} required>
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

          <Field label="Phone">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft pointer-events-none" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 …"
                className="input-field pl-10"
              />
            </div>
          </Field>
          <Field label="Department">
            <DepartmentPicker value={department} options={departments} onChange={setDepartment} />
          </Field>
          <Field label="Designation">
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft pointer-events-none" />
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Engineer"
                className="input-field pl-10"
              />
            </div>
          </Field>
          <Field label="Date of Joining">
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft pointer-events-none" />
              <input
                type="date"
                value={joinedOn}
                onChange={(e) => setJoinedOn(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </Field>
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-brand-cream-dark/50 border border-brand-choco/8">
          <button
            type="button"
            onClick={() => setActive(!active)}
            disabled={isSelf}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors flex items-center shrink-0',
              active ? 'bg-green-500' : 'bg-brand-choco/20',
              isSelf && 'opacity-50 cursor-not-allowed'
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
            <p className="text-sm font-bold">{active ? 'Active' : 'Inactive'}</p>
            <p className="text-xs text-brand-choco-soft">
              {active
                ? 'User can sign in and use the system'
                : 'User cannot sign in — all access blocked'}
            </p>
          </div>
        </div>
      </section>

      {/* Role (only if not self and roles available) */}
      {!isSelf && availableRoles.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={Shield}
            title="Role"
            subtitle={
              canEditMatrix
                ? 'Pick a preset or customize permissions below'
                : 'Only roles strictly below your level are shown'
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
      )}

      {/* Assigned Schools */}
      <section className="space-y-4">
        <SectionHeader
          icon={SchoolIcon}
          title="Assigned Schools"
          subtitle="Schools this user can check in from (for school-based attendance)"
        />
        {schools.length === 0 ? (
          <div className="text-sm text-brand-choco-soft rounded-2xl bg-brand-cream-dark p-4">
            No schools yet. Go to Schools → Add School first.
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-choco/10 divide-y divide-brand-choco/8 max-h-64 overflow-y-auto">
            {schools.map((s) => {
              const isOn = assignedSchools.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={cn(
                    'flex items-center gap-3 p-3 cursor-pointer transition',
                    isOn ? 'bg-brand-orange-50' : 'hover:bg-brand-cream-dark/40'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggleSchool(s.id)}
                    className="w-4 h-4 accent-brand-orange"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-brand-choco">{s.name}</div>
                    <div className="text-xs text-brand-choco-soft">
                      In {s.inTime} · Out {s.outTime}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </section>

      {/* Personal Geofence */}
      <section className="space-y-4">
        <SectionHeader
          icon={MapPin}
          title="Personal Office Location"
          subtitle="Overrides org default for this user's office check-ins"
        />
        <div className="grid grid-cols-1 gap-3">
          <Field label="Office Address">
            <div className="flex gap-2">
              <input
                type="text"
                value={officeAddress}
                onChange={(e) => setOfficeAddress(e.target.value)}
                placeholder="e.g. Sector 62, Noida"
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={fetchCoords}
                disabled={geocoding}
                className="btn-secondary whitespace-nowrap"
              >
                {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Fetch
              </button>
            </div>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Latitude">
              <input
                type="number"
                step="any"
                value={officeLat}
                onChange={(e) => setOfficeLat(e.target.value)}
                className="input-field"
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number"
                step="any"
                value={officeLng}
                onChange={(e) => setOfficeLng(e.target.value)}
                className="input-field"
              />
            </Field>
            <Field label="Radius (m)">
              <input
                type="number"
                min="10"
                value={officeRadiusM}
                onChange={(e) => setOfficeRadiusM(e.target.value)}
                placeholder="100"
                className="input-field"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Permission Matrix (only for super admin, editing others) */}
      {!isSelf && canEditMatrix && (
        <section className="space-y-4">
          <SectionHeader
            icon={Sparkles}
            title="Permissions Matrix"
            subtitle="Choose a category, expand a group and set access. The selected role stays unchanged."
          />
          <PermissionMatrix permissions={permissions} onToggle={setModulePermissions} />
        </section>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-choco/8">
        <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
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

function DepartmentPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const inOptions = value && options.includes(value);
  const [mode, setMode] = useState<'select' | 'other'>(
    inOptions || !value ? 'select' : 'other'
  );

  if (mode === 'other') {
    return (
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft pointer-events-none" />
          <input
            type="text"
            className="input-field pl-10"
            placeholder="Type department name"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        {options.length > 0 && (
          <button
            type="button"
            className="btn-secondary text-xs whitespace-nowrap"
            onClick={() => {
              setMode('select');
              onChange('');
            }}
          >
            List
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft pointer-events-none" />
      <select
        className="input-field pl-10"
        value={inOptions ? value : ''}
        onChange={(e) => {
          if (e.target.value === '__other__') {
            setMode('other');
            onChange('');
          } else {
            onChange(e.target.value);
          }
        }}
      >
        <option value="">— Select —</option>
        {options.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
        <option value="__other__">+ Other (type new)</option>
      </select>
    </div>
  );
}
