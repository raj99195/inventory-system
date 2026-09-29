import { useState, useEffect } from 'react';
import { useAttendanceSettings, saveAttendanceSettings } from '@/hooks/useAttendanceSettings';
import { usePermission } from '@/hooks/usePermission';
import NoAccessPage from '@/pages/NoAccessPage';
import { WEEKDAY_CODES } from '@/lib/attendance/datetime';
import { Save, Clock, MapPin, Calendar, AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { AttendanceSettings, WorkingDay, LeaveTypeConfig } from '@/types';

import { DEFAULT_LEAVE_TYPES } from '@/lib/attendance/leaveTypes';

const WEEKDAY_LABELS: Record<WorkingDay, string> = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };

export default function AttendanceSettingsPage() {
  const { can } = usePermission();
  const { settings, loading, error } = useAttendanceSettings();
  const canEdit = can('settings.edit');

  const [form, setForm] = useState<AttendanceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !error && settings && !form) setForm({ ...settings });
  }, [settings, form, loading, error]);

  if (!can('settings.view')) return <NoAccessPage />;
  if (error) return <div className="card space-y-3" role="alert"><h1 className="font-display text-2xl font-bold">Settings could not be loaded</h1><p>Check your connection and access, then reload. Saved settings have not been replaced.</p><button className="btn-secondary" onClick={() => window.location.reload()}>Retry</button></div>;
  if (loading || !form) {
    return <div className="p-6"><div className="animate-pulse text-brand-choco/60">Loading settings…</div></div>;
  }

  const toggleWorkingDay = (code: WorkingDay) => {
    if (!canEdit) return;
    const cur = new Set(form.workingDays || []);
    cur.has(code) ? cur.delete(code) : cur.add(code);
    setForm({ ...form, workingDays: Array.from(cur) });
  };

  const updateLeaveType = (index: number, patch: Partial<LeaveTypeConfig>) => {
    if (!canEdit) return;
    setForm({ ...form, leaveTypes: form.leaveTypes.map((type, i) => i === index ? { ...type, ...patch } : type) });
  };

  const handleSave = async () => {
    if (!canEdit || saving || loading || error) return;
    if (!Number.isFinite(form.orgGeofence.lat) || Math.abs(form.orgGeofence.lat) > 90 || !Number.isFinite(form.orgGeofence.lng) || Math.abs(form.orgGeofence.lng) > 180 || !Number.isFinite(form.orgGeofence.radiusM) || form.orgGeofence.radiusM < 10 || !Number.isFinite(form.lateGraceMinutes) || form.lateGraceMinutes < 0 || !form.officeStartTime || !form.officeEndTime || !form.workingDays.length) {
      setMsg({ type: 'err', text: 'Enter valid work hours, working days, grace minutes and geofence values.' });
      return;
    }
    setSaving(true); setMsg(null);
    try {
      await saveAttendanceSettings(form, settings);
      setMsg({ type: 'ok', text: 'Settings saved successfully.' });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Failed to save' });
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">Configuration</div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold text-brand-choco">Attendance Settings</h1>
          <p className="text-sm text-brand-choco/60 mt-1">Manage work hours, leave allowances and office locations.</p>
        </div>
        {canEdit && (
          <button onClick={handleSave} disabled={saving} className="btn-primary shrink-0 disabled:opacity-50">
            <Save size={18} />{saving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-sm text-yellow-800">
          <AlertCircle size={16} />Only Super Admin can edit these settings.
        </div>
      )}

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      {/* Work Hours */}
      <section className="card !p-5 sm:!p-6">
        <div className="flex items-center gap-2 mb-4"><Clock size={18} className="text-brand-orange" /><h2 className="font-display text-xl font-bold text-brand-choco">Work Hours</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-brand-choco/70 block mb-1">Shift start</label>
            <input type="time" value={form.officeStartTime || '09:00'} disabled={!canEdit}
              onChange={(e) => setForm({ ...form, officeStartTime: e.target.value })}
              className="input-field disabled:bg-brand-cream-dark/40" />
          </div>
          <div>
            <label className="text-sm text-brand-choco/70 block mb-1">Shift end</label>
            <input type="time" value={form.officeEndTime || '18:00'} disabled={!canEdit}
              onChange={(e) => setForm({ ...form, officeEndTime: e.target.value })}
              className="input-field disabled:bg-brand-cream-dark/40" />
          </div>
          <div>
            <label className="text-sm text-brand-choco/70 block mb-1">Late grace (min)</label>
            <input type="number" min={0} value={form.lateGraceMinutes ?? 15} disabled={!canEdit}
              onChange={(e) => setForm({ ...form, lateGraceMinutes: Number(e.target.value) })}
              className="input-field disabled:bg-brand-cream-dark/40" />
          </div>
        </div>
      </section>

      {/* Working Days */}
      <section className="card !p-5 sm:!p-6">
        <div className="flex items-center gap-2 mb-4"><Calendar size={18} className="text-brand-orange" /><h2 className="font-display text-xl font-bold text-brand-choco">Working Days</h2></div>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_CODES.map((code) => {
            const active = (form.workingDays || []).includes(code);
            return (
              <button key={code} onClick={() => toggleWorkingDay(code)} disabled={!canEdit}
                className={`px-4 py-2 rounded-lg border text-sm font-medium ${active ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-choco/70 border-brand-choco/20'} disabled:opacity-60`}>
                {WEEKDAY_LABELS[code]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card !p-5 sm:!p-6 space-y-4">
        <div><h2 className="font-display text-xl font-bold">Office Saturday Off</h2>
          <p className="text-sm text-brand-choco-soft mt-1">Choose which Saturdays are off every month. For example, select 2nd and 4th.</p></div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {['1st', '2nd', '3rd', '4th', '5th'].map((label, index) => {
            const week = index + 1;
            const selected = (form.saturdayOffWeeks ?? []).includes(week);
            return <label key={week} className={`flex items-center gap-2 p-3 rounded-2xl border text-sm font-semibold ${selected ? 'border-brand-orange bg-brand-orange-50' : 'border-brand-choco/10'} ${!canEdit || !form.workingDays.includes('SA') ? 'opacity-50' : 'cursor-pointer'}`}>
              <input type="checkbox" className="accent-brand-orange" checked={selected} disabled={!canEdit || saving || !form.workingDays.includes('SA')}
                onChange={() => setForm({ ...form, saturdayOffWeeks: selected ? (form.saturdayOffWeeks ?? []).filter((value) => value !== week) : [...(form.saturdayOffWeeks ?? []), week].sort((a, b) => a - b) })} />
              {label} Saturday
            </label>;
          })}
        </div>
        <p className="text-xs text-brand-choco-soft">{form.workingDays.includes('SA') ? 'Unselected Saturdays are working days. The 5th applies only in months with five Saturdays. School schedules stay separate.' : 'Saturday is disabled under Working Days, so all Saturdays are off. Enable it to choose specific Saturdays.'}</p>
      </section>

      <section className="card !p-5 sm:!p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-display text-xl font-bold">Leave Types &amp; Allowances</h2>
            <p className="text-sm text-brand-choco-soft mt-1">Set the yearly allowance and maximum days for each application.</p></div>
          {canEdit && <button type="button" className="btn-secondary text-sm" onClick={() => setForm({ ...form, leaveTypes: [...form.leaveTypes, { code: '', name: '', default: 0, colorHex: '#F97316', maxDaysPerApplication: 3 }] })}><Plus size={16} />Add Leave Type</button>}
        </div>
        <p className="text-xs text-brand-choco-soft rounded-2xl bg-brand-cream-dark/50 p-3">Leave types and yearly allowances apply to all users. Remaining days update with the policy while preserving leave already used and manual adjustments. Zero means no automatic allowance, including Loss of Pay.</p>
        <div className="space-y-3">
          {form.leaveTypes.map((type, index) => <div key={index} className="rounded-2xl border border-brand-choco/10 p-4">
            <div className="grid grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              <label className="text-xs font-semibold lg:col-span-2">Code<input aria-label={`Leave code ${index + 1}`} className="input-field mt-1" value={type.code} disabled={!canEdit || settings.leaveTypes.some((saved) => saved.code === type.code)} onChange={(e) => updateLeaveType(index, { code: e.target.value.toUpperCase().trim() })} /></label>
              <label className="text-xs font-semibold col-span-2 lg:col-span-4">Leave name<input className="input-field mt-1" value={type.name} disabled={!canEdit} onChange={(e) => updateLeaveType(index, { name: e.target.value })} /></label>
              <label className="text-xs font-semibold lg:col-span-2">Days / year<input type="number" min="0" step="0.5" className="input-field mt-1" value={type.default} disabled={!canEdit} onChange={(e) => updateLeaveType(index, { default: Number(e.target.value) })} /></label>
              <label className="text-xs font-semibold lg:col-span-2">Max / application<input type="number" min="1" max="366" step="1" className="input-field mt-1" value={type.maxDaysPerApplication ?? 3} disabled={!canEdit} onChange={(e) => updateLeaveType(index, { maxDaysPerApplication: Number(e.target.value) })} /></label>
              <label className="text-xs font-semibold">Color<input type="color" className="block w-10 h-11 mt-1 rounded-lg" value={type.colorHex} disabled={!canEdit} onChange={(e) => updateLeaveType(index, { colorHex: e.target.value })} /></label>
              {canEdit && <button type="button" aria-label={`Remove ${type.name || 'leave type'}`} className="w-11 h-11 rounded-xl text-red-600 hover:bg-red-50" onClick={() => { if (window.confirm('Remove this leave type from new applications? Existing leave records and balances will be kept.')) setForm({ ...form, leaveTypes: form.leaveTypes.filter((_, i) => i !== index) }); }}><Trash2 size={18} className="mx-auto" /></button>}
            </div>
          </div>)}
        </div>
        {canEdit && DEFAULT_LEAVE_TYPES.some((type) => !form.leaveTypes.some((item) => item.code === type.code)) && <button type="button" className="btn-secondary text-sm" onClick={() => setForm({ ...form, leaveTypes: [...form.leaveTypes, ...DEFAULT_LEAVE_TYPES.filter((type) => !form.leaveTypes.some((item) => item.code === type.code))] })}>Add missing standard types (CL, SL, EL, ML, PL, CO, BL, LOP)</button>}
      </section>

      {/* Geofencing */}
      <section className="card !p-5 sm:!p-6">
        <div className="flex items-center gap-2 mb-4"><MapPin size={18} className="text-brand-orange" /><h2 className="font-display text-xl font-bold text-brand-choco">Geofencing</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['lat', 'lng'] as const).map((coordinate) => (
            <label key={coordinate} className="text-sm text-brand-choco/70">
              {coordinate === 'lat' ? 'Office latitude' : 'Office longitude'}
              <input type="number" step="any" disabled={!canEdit} value={form.orgGeofence[coordinate]}
                onChange={(e) => setForm({ ...form, orgGeofence: { ...form.orgGeofence, [coordinate]: Number(e.target.value) } })}
                className="input-field disabled:bg-brand-cream-dark/40" />
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.strictGeofence} disabled={!canEdit}
              onChange={(e) => setForm({ ...form, strictGeofence: e.target.checked })} className="accent-brand-orange" />
            <span className="text-brand-choco">Enforce office geofence</span>
          </label>
          <div>
            <label className="text-sm text-brand-choco/70 block mb-1">Office geofence radius (metres)</label>
            <input type="number" min={50} max={2000} value={form.orgGeofence.radiusM ?? 200}
              disabled={!canEdit || !form.strictGeofence}
              onChange={(e) => setForm({ ...form, orgGeofence: { ...form.orgGeofence, radiusM: Number(e.target.value) } })}
              className="input-field disabled:bg-brand-cream-dark/40" />
          </div>
        </div>
      </section>

      <p className="text-sm text-brand-choco/60">School check-ins use each school's location and radius.</p>
    </div>
  );
}