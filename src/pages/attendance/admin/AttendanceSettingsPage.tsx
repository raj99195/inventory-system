import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Loader2,
  Plus,
  Trash2,
  Info,
  RefreshCw,
  Building,
  Clock,
  MapPin,
  Palette,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermission } from '@/hooks/usePermission';
import {
  useAttendanceSettings,
  saveAttendanceSettings,
  DEFAULT_ATTENDANCE_SETTINGS,
} from '@/hooks/useAttendanceSettings';
import { forwardGeocode, reverseGeocode } from '@/lib/attendance/geocode';
import type { AttendanceSettings, LeaveTypeConfig, WorkingDay } from '@/types';
import { cn } from '@/lib/utils';

const DAYS: WorkingDay[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const DAY_LABELS: Record<WorkingDay, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};

const COLORS = [
  '#F97316',
  '#EF4444',
  '#10B981',
  '#EC4899',
  '#3B82F6',
  '#8B5CF6',
  '#6B7280',
  '#DC2626',
];

export default function AttendanceSettingsPage() {
  const { can, isSuperAdmin } = usePermission();
  const { settings: liveSettings, loading } = useAttendanceSettings();
  const editable = isSuperAdmin || can('settings.edit');

  const [draft, setDraft] = useState<AttendanceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!draft && liveSettings) setDraft({ ...liveSettings });
  }, [liveSettings, draft]);

  if (!can('settings.view') && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  if (loading || !draft) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
      </div>
    );
  }

  const set = <K extends keyof AttendanceSettings>(k: K, v: AttendanceSettings[K]) =>
    setDraft((s) => (s ? { ...s, [k]: v } : s));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveAttendanceSettings(draft);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const smartGeocode = async () => {
    const addr = ''; // orgGeofence has no address field, use lat/lng
    const g = draft.orgGeofence;
    if (g.lat === 0 && g.lng === 0) return toast.error('Set lat/lng or address');
    setGeocoding(true);
    try {
      const a = await reverseGeocode(g.lat, g.lng);
      if (a) toast.success('Address: ' + a);
      else toast.error('Could not resolve');
    } catch {
      toast.error('Geocode failed');
    } finally {
      setGeocoding(false);
    }
  };

  const setGeofence = (patch: Partial<AttendanceSettings['orgGeofence']>) =>
    set('orgGeofence', { ...draft.orgGeofence, ...patch });

  const toggleDay = (d: WorkingDay) => {
    const has = draft.workingDays.includes(d);
    set('workingDays', has ? draft.workingDays.filter((x) => x !== d) : [...draft.workingDays, d]);
  };

  const addLeaveType = () => {
    const next: LeaveTypeConfig = { code: '', name: '', default: 0, colorHex: COLORS[0] };
    set('leaveTypes', [...(draft.leaveTypes ?? []), next]);
  };
  const updateLeaveType = (idx: number, patch: Partial<LeaveTypeConfig>) =>
    set(
      'leaveTypes',
      (draft.leaveTypes ?? []).map((t, i) => (i === idx ? { ...t, ...patch } : t))
    );
  const removeLeaveType = (idx: number) => {
    if (!window.confirm('Remove this leave type? Existing balances stay, no new applications.')) return;
    set('leaveTypes', (draft.leaveTypes ?? []).filter((_, i) => i !== idx));
  };

  const addDepartment = () => {
    const name = (window.prompt('New department name:') ?? '').trim();
    if (!name) return;
    const list = draft.departments ?? [];
    if (list.some((d) => d.toLowerCase() === name.toLowerCase())) {
      toast.error('Department already exists');
      return;
    }
    set('departments', [...list, name]);
  };
  const removeDepartment = (idx: number) => {
    if (!window.confirm('Remove this department?')) return;
    set('departments', (draft.departments ?? []).filter((_, i) => i !== idx));
  };
  const renameDepartment = (idx: number, name: string) =>
    set('departments', (draft.departments ?? []).map((d, i) => (i === idx ? name : d)));

  const resetDefaults = () => {
    if (!window.confirm('Reset all settings to defaults? Current values are lost until you save.')) return;
    setDraft({ ...DEFAULT_ATTENDANCE_SETTINGS });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          Configuration
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-bold">Attendance Settings</h1>
        <p className="text-brand-choco-soft mt-2">
          Office timing, working days, leave types, departments and org-wide geofence.
        </p>
      </div>

      {!editable && (
        <div className="rounded-2xl bg-pastel-peach border border-pastel-peach-deep/30 p-3 text-sm text-orange-900 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          You have view-only access. Ask a Super Admin to edit these settings.
        </div>
      )}

      {/* Office timing */}
      <Section icon={Clock} title="Office Timing" subtitle="Late detection and org working days">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Office start">
            <input
              type="time"
              className="input-field"
              value={draft.officeStartTime}
              disabled={!editable}
              onChange={(e) => set('officeStartTime', e.target.value)}
            />
          </Field>
          <Field label="Office end">
            <input
              type="time"
              className="input-field"
              value={draft.officeEndTime}
              disabled={!editable}
              onChange={(e) => set('officeEndTime', e.target.value)}
            />
          </Field>
          <Field label="Late grace (min)">
            <input
              type="number"
              min="0"
              max="120"
              className="input-field"
              value={draft.lateGraceMinutes}
              disabled={!editable}
              onChange={(e) => set('lateGraceMinutes', parseInt(e.target.value) || 0)}
            />
          </Field>
        </div>
        <div className="mt-4">
          <label className="text-sm font-semibold mb-1.5 block">Working days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const active = draft.workingDays.includes(d);
              return (
                <button
                  type="button"
                  key={d}
                  disabled={!editable}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    'px-3 py-2 rounded-2xl text-xs font-bold transition',
                    active ? 'bg-brand-orange text-white' : 'bg-brand-cream-dark text-brand-choco-soft',
                    !editable && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  {DAY_LABELS[d]}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Departments */}
      <Section icon={Building} title="Departments" subtitle="Options shown in the user form dropdown">
        <div className="space-y-2">
          {(draft.departments ?? []).length === 0 && (
            <div className="text-sm text-brand-choco-soft rounded-2xl bg-brand-cream-dark p-3">
              No departments yet. Add one below.
            </div>
          )}
          {(draft.departments ?? []).map((dept, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                className="input-field !py-2 text-sm flex-1"
                value={dept}
                disabled={!editable}
                onChange={(e) => renameDepartment(idx, e.target.value)}
              />
              {editable && (
                <button
                  type="button"
                  className="w-9 h-9 rounded-xl hover:bg-pastel-pink flex items-center justify-center text-red-600"
                  onClick={() => removeDepartment(idx)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {editable && (
            <button type="button" className="btn-secondary text-sm" onClick={addDepartment}>
              <Plus className="w-4 h-4" />
              Add Department
            </button>
          )}
        </div>
      </Section>

      {/* Leave types */}
      <Section icon={Palette} title="Leave Types" subtitle="Codes, names, default balances and colors">
        <div className="space-y-2">
          {(draft.leaveTypes ?? []).map((t, idx) => (
            <div key={idx} className="rounded-2xl border border-brand-choco/10 p-3">
              <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-brand-choco-soft uppercase">Code</label>
                  <input
                    className="input-field !py-2 text-sm"
                    value={t.code}
                    disabled={!editable}
                    onChange={(e) => updateLeaveType(idx, { code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-5">
                  <label className="text-[10px] font-bold text-brand-choco-soft uppercase">Name</label>
                  <input
                    className="input-field !py-2 text-sm"
                    value={t.name}
                    disabled={!editable}
                    onChange={(e) => updateLeaveType(idx, { name: e.target.value })}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-brand-choco-soft uppercase">Default</label>
                  <input
                    type="number"
                    className="input-field !py-2 text-sm"
                    value={t.default}
                    disabled={!editable}
                    onChange={(e) => updateLeaveType(idx, { default: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-brand-choco-soft uppercase">Color</label>
                  <div className="flex gap-1 flex-wrap">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        disabled={!editable}
                        onClick={() => updateLeaveType(idx, { colorHex: c })}
                        className={cn(
                          'w-5 h-5 rounded-full border-2',
                          t.colorHex === c ? 'border-brand-choco' : 'border-transparent'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="col-span-1 flex justify-end">
                  {editable && (
                    <button
                      type="button"
                      className="w-8 h-8 rounded-xl hover:bg-pastel-pink flex items-center justify-center text-red-600"
                      onClick={() => removeLeaveType(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {editable && (
            <button type="button" className="btn-secondary w-full" onClick={addLeaveType}>
              <Plus className="w-4 h-4" />
              Add Leave Type
            </button>
          )}
        </div>
      </Section>

      {/* Office geofence */}
      <Section
        icon={MapPin}
        title="Org Office Geofence"
        subtitle="Default coords for office check-ins. Per-user overrides supported."
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Latitude">
              <input
                type="number"
                step="any"
                className="input-field"
                disabled={!editable}
                value={draft.orgGeofence.lat || ''}
                onChange={(e) => setGeofence({ lat: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number"
                step="any"
                className="input-field"
                disabled={!editable}
                value={draft.orgGeofence.lng || ''}
                onChange={(e) => setGeofence({ lng: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Radius (m)">
              <input
                type="number"
                min="10"
                className="input-field"
                disabled={!editable}
                value={draft.orgGeofence.radiusM || ''}
                onChange={(e) => setGeofence({ radiusM: parseInt(e.target.value) || 100 })}
              />
            </Field>
          </div>

          {editable && (
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={smartGeocode}
              disabled={geocoding}
            >
              {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Lookup address from coords
            </button>
          )}

          <label className="flex items-start gap-2 pt-2 rounded-2xl bg-brand-cream-dark p-3 cursor-pointer">
            <input
              type="checkbox"
              disabled={!editable}
              className="mt-0.5 w-4 h-4 accent-brand-orange"
              checked={draft.strictGeofence}
              onChange={(e) => set('strictGeofence', e.target.checked)}
            />
            <span className="text-sm text-brand-choco">
              <b>Strict geofence:</b> Block office check-in entirely when employee is outside the radius.
              (Off: allow with an "Off-site" tag on the record.)
            </span>
          </label>
        </div>
      </Section>

      {/* Actions */}
      {editable && (
        <div className="flex justify-between gap-2 sticky bottom-0 bg-white/95 backdrop-blur-sm py-3 border-t border-brand-choco/8">
          <button className="btn-secondary" onClick={resetDefaults} disabled={saving}>
            Reset to defaults
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card !p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-brand-orange-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-brand-orange-dark" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-brand-choco">{title}</h2>
          <p className="text-xs text-brand-choco-soft">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-brand-choco-soft uppercase mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
