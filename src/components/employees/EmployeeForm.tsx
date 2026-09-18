import { useEffect, useState } from 'react';
import {
  User,
  Hash,
  Building2,
  Briefcase,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { z } from 'zod';
import type { Employee, EmployeeStatus } from '@/types';
import {
  createEmployee,
  updateEmployee,
  generateEmployeeIdStr,
} from '@/hooks/useEmployees';
import { cn } from '@/lib/utils';

const employeeSchema = z.object({
  employeeId: z.string().min(2, 'Employee ID required'),
  name: z.string().min(2, 'Name too short').max(100),
  department: z.string().min(1, 'Department required'),
  designation: z.string().min(1, 'Designation required'),
  email: z.string().email('Invalid email'),
  contactNumber: z.string().min(6, 'Invalid number'),
  joiningDate: z.string().min(1, 'Joining date required'),
  status: z.enum(['active', 'inactive', 'resigned', 'terminated']),
});

type FormData = z.infer<typeof employeeSchema>;

interface Props {
  employee?: Employee | null;
  onClose: () => void;
  onSaved?: () => void;
}

const DEPARTMENTS = [
  'Engineering',
  'Content',
  'Sales',
  'Marketing',
  'HR',
  'Operations',
  'Design',
  'Finance',
  'Support',
  'Admin',
];

export default function EmployeeForm({ employee, onClose, onSaved }: Props) {
  const isEdit = !!employee;
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {}
  );

  const [form, setForm] = useState<FormData>({
    employeeId: employee?.employeeId ?? '',
    name: employee?.name ?? '',
    department: employee?.department ?? '',
    designation: employee?.designation ?? '',
    email: employee?.email ?? '',
    contactNumber: employee?.contactNumber ?? '',
    joiningDate: employee?.joiningDate ?? new Date().toISOString().slice(0, 10),
    status: employee?.status ?? 'active',
  });

  useEffect(() => {
    if (isEdit || form.employeeId) return;
    generateEmployeeIdStr().then((id) =>
      setForm((f) => ({ ...f, employeeId: id }))
    );
  }, [isEdit, form.employeeId]);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = employeeSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormData, string>> = {};
      parsed.error.issues.forEach((i) => {
        const key = i.path[0] as keyof FormData;
        errs[key] = i.message;
      });
      setErrors(errs);
      toast.error('Please fix the errors below');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && employee) {
        await updateEmployee(employee.id, parsed.data, {
          name: employee.name,
          department: employee.department,
          status: employee.status,
        });
        toast.success('Employee updated');
      } else {
        await createEmployee(parsed.data);
        toast.success('Employee created');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Employee ID" icon={Hash} error={errors.employeeId} required>
          <input
            type="text"
            value={form.employeeId}
            onChange={(e) => set('employeeId', e.target.value)}
            className="input-field"
            placeholder="Auto-generated"
          />
        </Field>

        <Field label="Full Name" icon={User} error={errors.name} required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="input-field"
            placeholder="e.g. Priya Sharma"
          />
        </Field>

        <Field label="Department" icon={Building2} error={errors.department} required>
          <input
            type="text"
            list="departments"
            value={form.department}
            onChange={(e) => set('department', e.target.value)}
            className="input-field"
            placeholder="Select or type"
          />
          <datalist id="departments">
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>

        <Field label="Designation" icon={Briefcase} error={errors.designation} required>
          <input
            type="text"
            value={form.designation}
            onChange={(e) => set('designation', e.target.value)}
            className="input-field"
            placeholder="e.g. Senior Developer"
          />
        </Field>

        <Field label="Email" icon={Mail} error={errors.email} required>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="input-field"
            placeholder="e.g. priya@stemmantra.com"
          />
        </Field>

        <Field label="Contact Number" icon={Phone} error={errors.contactNumber} required>
          <input
            type="tel"
            value={form.contactNumber}
            onChange={(e) => set('contactNumber', e.target.value)}
            className="input-field"
            placeholder="+91 98765 43210"
          />
        </Field>

        <Field label="Joining Date" icon={Calendar} error={errors.joiningDate} required>
          <input
            type="date"
            value={form.joiningDate}
            onChange={(e) => set('joiningDate', e.target.value)}
            className="input-field"
          />
        </Field>

        <Field label="Status">
          <div className="grid grid-cols-2 gap-2">
            {(['active', 'inactive', 'resigned', 'terminated'] as EmployeeStatus[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status', s)}
                  className={cn(
                    'py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all',
                    form.status === s
                      ? s === 'active'
                        ? 'bg-pastel-green text-green-800'
                        : s === 'inactive'
                        ? 'bg-pastel-peach text-orange-800'
                        : s === 'resigned'
                        ? 'bg-pastel-blue text-blue-800'
                        : 'bg-pastel-pink text-red-800'
                      : 'bg-brand-cream-dark text-brand-choco-soft hover:bg-brand-cream-deep'
                  )}
                >
                  {s}
                </button>
              )
            )}
          </div>
        </Field>
      </div>

      <div className="flex gap-3 pt-4 border-t border-brand-choco/8 sticky bottom-0 bg-white -mx-6 px-6 pb-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex-1 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>{isEdit ? 'Update Employee' : 'Add Employee'}</>
          )}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  icon: Icon,
  error,
  required,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold mb-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-brand-choco-soft" />}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}
