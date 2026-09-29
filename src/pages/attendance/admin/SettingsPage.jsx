import { useEffect, useState } from 'react';
import { useToast } from '../../components/ui/Toast.jsx';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '../../services/settings.service.js';
import { forwardGeocode, reverseGeocode } from '../../utils/geocode.js';
import { PageLoader, Spinner } from '../../components/ui/EmptyState.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COLORS = ['blue', 'red', 'green', 'pink', 'purple', 'amber', 'gray'];

export default function SettingsPage() {
  const toast = useToast();
  const { can } = usePermissions();
  const editable = can(PERMISSIONS.SETTINGS_EDIT);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => { getSettings().then(s => { setSettings(s); setLoading(false); }); }, []);

  if (loading) return <PageLoader />;

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      toast.success('Settings saved');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const smartGeocode = async () => {
    const addr = (settings.officeAddress || '').trim();
    const lat = settings.officeLat;
    const lng = settings.officeLng;
    if (!addr && (lat == null || lng == null)) return toast.warn('Enter an address OR coordinates first');
    setGeocoding(true);
    try {
      if (addr) {
        const r = await forwardGeocode(addr);
        if (r) { setSettings(s => ({ ...s, officeLat: r.lat, officeLng: r.lng })); toast.success('Coords fetched'); }
        else toast.error('Address not found. Try street + pincode, or paste coords from Google Maps.');
      } else {
        const addrStr = await reverseGeocode(lat, lng);
        if (addrStr) { setSettings(s => ({ ...s, officeAddress: addrStr })); toast.success('Address fetched'); }
        else toast.error('Could not resolve address');
      }
    } catch (e) { toast.error('Geocoding failed'); }
    finally { setGeocoding(false); }
  };

  // Leave types CRUD
  const addLeaveType = () => {
    const next = { code: '', name: '', default: 0, paid: true, color: 'blue' };
    setSettings(s => ({ ...s, leaveTypes: [...(s.leaveTypes || []), next] }));
  };
  const updateLeaveType = (idx, patch) => {
    setSettings(s => ({
      ...s,
      leaveTypes: s.leaveTypes.map((t, i) => i === idx ? { ...t, ...patch } : t)
    }));
  };
  const removeLeaveType = (idx) => {
    if (!confirm('Remove this leave type? Existing balances will remain but no new applications can be made.')) return;
    setSettings(s => ({ ...s, leaveTypes: s.leaveTypes.filter((_, i) => i !== idx) }));
  };

  const toggleWorkingDay = (d) => {
    setSettings(s => {
      const has = (s.workingDays || []).includes(d);
      return { ...s, workingDays: has ? s.workingDays.filter(x => x !== d) : [...(s.workingDays || []), d].sort() };
    });
  };

  const resetDefaults = () => {
    if (!confirm('Reset all settings to defaults? Current values will be lost until you save.')) return;
    setSettings({ ...DEFAULT_SETTINGS });
  };

  // Departments CRUD
  const addDepartment = () => {
    const name = (prompt('New department name:') || '').trim();
    if (!name) return;
    setSettings(s => {
      const list = s.departments || [];
      if (list.some(d => d.toLowerCase() === name.toLowerCase())) {
        toast.warn('Department already exists');
        return s;
      }
      return { ...s, departments: [...list, name] };
    });
  };
  const removeDepartment = (idx) => {
    if (!confirm('Remove this department? Existing user records that reference it will keep the old value.')) return;
    setSettings(s => ({ ...s, departments: s.departments.filter((_, i) => i !== idx) }));
  };
  const renameDepartment = (idx, name) => {
    setSettings(s => ({ ...s, departments: s.departments.map((d, i) => i === idx ? name : d) }));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {!editable && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          You have view-only access. Ask a Super Admin to edit these settings.
        </div>
      )}

      {/* Office timing */}
      <Section title="Office Timing" subtitle="Used to detect late arrivals and half-day cutoffs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Office start time</label>
            <input type="time" className="input" value={settings.officeStartTime}
              disabled={!editable}
              onChange={e => set('officeStartTime', e.target.value)} />
            <p className="text-[11px] text-ink-500 mt-1">Check-in after this → 'late'</p>
          </div>
          <div>
            <label className="label">Half-day cutoff (mins)</label>
            <input type="number" className="input" value={settings.halfDayCutoffMinutes}
              disabled={!editable}
              onChange={e => set('halfDayCutoffMinutes', parseInt(e.target.value) || 0)} />
            <p className="text-[11px] text-ink-500 mt-1">Worked less than this → 'half-day'</p>
          </div>
          <div>
            <label className="label">Full-day (mins)</label>
            <input type="number" className="input" value={settings.fullDayCutoffMinutes}
              disabled={!editable}
              onChange={e => set('fullDayCutoffMinutes', parseInt(e.target.value) || 0)} />
            <p className="text-[11px] text-ink-500 mt-1">Reference for full working day</p>
          </div>
        </div>

        <div className="mt-4">
          <label className="label">Working days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => {
              const active = (settings.workingDays || []).includes(i);
              return (
                <button type="button" key={i} disabled={!editable} onClick={() => toggleWorkingDay(i)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition
                    ${active ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600'}
                    ${!editable && 'opacity-60 cursor-not-allowed'}`}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Departments */}
      <Section title="Departments" subtitle="These appear in the department dropdown when creating or editing a user.">
        <div className="space-y-2">
          {(settings.departments || []).length === 0 && (
            <div className="text-sm text-ink-500 rounded-lg bg-ink-50 p-3">
              No departments yet. Add one below.
            </div>
          )}
          {(settings.departments || []).map((dept, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input className="input py-2 text-sm flex-1" value={dept} disabled={!editable}
                onChange={e => renameDepartment(idx, e.target.value)} />
              {editable && (
                <button type="button" className="text-xs font-semibold text-red-600 hover:text-red-700 px-2"
                  onClick={() => removeDepartment(idx)}>Remove</button>
              )}
            </div>
          ))}
          {editable && (
            <button type="button" className="btn-secondary text-sm" onClick={addDepartment}>
              + Add Department
            </button>
          )}
        </div>
      </Section>

      {/* Leave types */}
      <Section title="Leave Types" subtitle="Add, remove, or edit the leave types available to employees. Default balance applies to new employees.">
        <div className="space-y-2">
          {(settings.leaveTypes || []).map((t, idx) => (
            <div key={idx} className="rounded-xl border border-ink-100 p-3">
              <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                <div className="col-span-1 sm:col-span-2">
                  <label className="label">Code</label>
                  <input className="input py-2 text-sm" value={t.code} disabled={!editable}
                    onChange={e => updateLeaveType(idx, { code: e.target.value.toUpperCase() })} />
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <label className="label">Name</label>
                  <input className="input py-2 text-sm" value={t.name} disabled={!editable}
                    onChange={e => updateLeaveType(idx, { name: e.target.value })} />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="label">Default</label>
                  <input type="number" className="input py-2 text-sm" value={t.default} disabled={!editable}
                    onChange={e => updateLeaveType(idx, { default: Number(e.target.value) })} />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="label">Color</label>
                  <select className="input py-2 text-sm" value={t.color} disabled={!editable}
                    onChange={e => updateLeaveType(idx, { color: e.target.value })}>
                    {COLORS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-1 flex items-center gap-1.5">
                  <input type="checkbox" checked={t.paid} disabled={!editable} id={`paid-${idx}`}
                    onChange={e => updateLeaveType(idx, { paid: e.target.checked })} />
                  <label htmlFor={`paid-${idx}`} className="text-xs">Paid</label>
                </div>
                <div className="col-span-1 sm:col-span-1 flex justify-end">
                  {editable && (
                    <button type="button" className="text-xs font-semibold text-red-600 hover:text-red-700"
                      onClick={() => removeLeaveType(idx)}>Remove</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {editable && (
            <button type="button" className="btn-secondary w-full" onClick={addLeaveType}>+ Add Leave Type</button>
          )}
        </div>
      </Section>

      {/* Office geofence */}
      <Section title="Office Geofence" subtitle="Default office location. Individual users can override this from Users → Edit.">
        <div className="space-y-3">
          <div>
            <label className="label">Office address</label>
            <div className="flex flex-wrap gap-2">
              <input className="input flex-1 min-w-[200px]" placeholder="e.g. Sector 6, Chilla, Noida, UP"
                disabled={!editable} value={settings.officeAddress}
                onChange={e => set('officeAddress', e.target.value)} />
              {editable && (
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={smartGeocode} disabled={geocoding}>
                  {geocoding ? <Spinner /> : (settings.officeAddress?.trim() ? 'Address → Coords' : 'Coords → Address')}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Latitude</label>
              <input type="number" step="any" className="input" disabled={!editable}
                value={settings.officeLat ?? ''} onChange={e => set('officeLat', e.target.value === '' ? null : parseFloat(e.target.value))} />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input type="number" step="any" className="input" disabled={!editable}
                value={settings.officeLng ?? ''} onChange={e => set('officeLng', e.target.value === '' ? null : parseFloat(e.target.value))} />
            </div>
            <div>
              <label className="label">Radius (m)</label>
              <input type="number" min="10" className="input" disabled={!editable}
                value={settings.officeRadiusM ?? ''} onChange={e => set('officeRadiusM', parseInt(e.target.value) || 100)} />
            </div>
          </div>

          <div className="flex items-start gap-2 pt-2 rounded-xl bg-ink-50 p-3">
            <input type="checkbox" id="strict" className="mt-1" disabled={!editable}
              checked={!!settings.geofenceStrict}
              onChange={e => set('geofenceStrict', e.target.checked)} />
            <label htmlFor="strict" className="text-sm text-ink-700 cursor-pointer">
              <b>Strict geofence:</b> Block check-in entirely when employee is outside the radius.
              (Off: allow with an "Off-site" tag on the record.)
            </label>
          </div>
        </div>
      </Section>

      {/* Actions */}
      {editable && (
        <div className="flex justify-between gap-2 sticky bottom-0 bg-ink-50/80 backdrop-blur-sm py-3 -mx-4 px-4 border-t border-ink-100">
          <button className="btn-secondary" onClick={resetDefaults} disabled={saving}>Reset to defaults</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner className="text-white" /> : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}

const Section = ({ title, subtitle, children }) => (
  <div className="card p-5">
    <div className="mb-4">
      <h2 className="text-base font-bold text-ink-900">{title}</h2>
      {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);