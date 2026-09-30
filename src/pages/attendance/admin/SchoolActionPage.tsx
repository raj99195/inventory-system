import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSchools, createSchool, updateSchool, deleteSchool } from '@/hooks/useSchools';
import { usePermission } from '@/hooks/usePermission';
import NoAccessPage from '@/pages/NoAccessPage';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { forwardGeocode, reverseGeocode } from '@/lib/attendance/geocode';
import { cn } from '@/lib/utils';
import type { School, WorkingDay } from '@/types';
import { INDIAN_STATES, SCHOOL_CITIES } from '@/lib/attendance/schoolLocations';
const DAYS: WorkingDay[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const DAY_LABELS: Record<WorkingDay, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };
const LIST_PATH = '/attendance/admin/schools';

export default function SchoolActionPage({ action }: { action: 'create' | 'edit' | 'delete' }) {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { schools, loading, error } = useSchools();
  const [busy, setBusy] = useState(false);
  const school = schools.find((item) => item.id === schoolId);
  const close = () => { if (!busy) navigate(LIST_PATH); };
  if (!can(`schools.${action}`)) return <NoAccessPage />;
  if (loading) return <p>Loading school…</p>;
  if (error) return <p role="alert">Unable to load schools: {error.message}</p>;
  if (action !== 'create' && !school) return <div>School not found. <Link to={LIST_PATH}>Back to schools</Link></div>;
  const remove = async () => {
    if (!school || busy || !can('schools.delete')) return;
    setBusy(true);
    try {
      await deleteSchool(school);
      toast.success('School deleted');
      navigate(LIST_PATH, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    } finally { setBusy(false); }
  };
  return <div className="max-w-3xl mx-auto space-y-5">
    <Link to={LIST_PATH} className="inline-flex text-sm font-semibold text-brand-choco-soft hover:text-brand-orange">← Back to Schools</Link>
    <h1 className="font-display text-3xl font-bold">{action === 'create' ? 'Add School' : action === 'edit' ? 'Edit School' : 'Delete School'}</h1>
    {action === 'delete' ? <ConfirmDialog open onClose={close} onConfirm={remove}
      title="Delete School?" message={`Delete ${school!.name}? Employees will no longer be able to check in at this school.`}
      loading={busy} /> : <SchoolFormBody key={school?.id ?? 'new'} school={school ?? null} onClose={close} />}
  </div>;
}

function SchoolFormBody({ school, onClose }: { school: School | null; onClose: () => void }) {
  const isEdit = !!school;
  const { can } = usePermission();
  const [name, setName] = useState(school?.name ?? '');
  const { schools } = useSchools();
  const [state, setState] = useState(school?.state ?? '');
  const [city, setCity] = useState(school?.city ?? '');
  const cities = [...new Set([...(SCHOOL_CITIES[state] ?? []), ...schools.filter((s) => s.state === state).map((s) => s.city ?? '')])].filter(Boolean).sort();
  const [inTime, setInTime] = useState(school?.inTime ?? '09:00');
  const [outTime, setOutTime] = useState(school?.outTime ?? '17:00');
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>(
    school?.workingDays ?? ['MO', 'TU', 'WE', 'TH', 'FR']
  );
  const [address, setAddress] = useState(school?.address ?? '');
  const [lat, setLat] = useState<string>(school?.lat != null ? String(school.lat) : '');
  const [lng, setLng] = useState<string>(school?.lng != null ? String(school.lng) : '');
  const [radiusM, setRadiusM] = useState<string>(String(school?.radiusM ?? 100));
  const [active, setActive] = useState(school?.active !== false);
  const [busy, setBusy] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const toggleDay = (d: WorkingDay) =>
    setWorkingDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );

  const smartGeocode = async () => {
    const hasCoords = lat !== '' && lng !== '';
    if (!address.trim() && !hasCoords) {
      return toast.error('Enter an address OR coordinates first');
    }
    setGeocoding(true);
    try {
      if (address.trim()) {
        const r = await forwardGeocode(address);
        if (r) {
          setLat(String(r.lat));
          setLng(String(r.lng));
          toast.success('Coordinates fetched');
        } else {
          toast.error('Address not found. Try street + pincode, or paste coords from Maps.');
        }
      } else {
        const addr = await reverseGeocode(parseFloat(lat), parseFloat(lng));
        if (addr) {
          setAddress(addr);
          toast.success('Address fetched');
        } else {
          toast.error('Could not resolve address');
        }
      }
    } catch {
      toast.error('Geocode failed');
    } finally {
      setGeocoding(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !can(isEdit ? 'schools.edit' : 'schools.create')) return;
    if (!workingDays.length) return toast.error('Select at least one working day');
    if (!Number.isFinite(Number(lat)) || Math.abs(Number(lat)) > 90 || !Number.isFinite(Number(lng)) || Math.abs(Number(lng)) > 180) return toast.error('Enter valid coordinates');
    if (!Number.isFinite(Number(radiusM)) || Number(radiusM) < 10) return toast.error('Radius must be at least 10 metres');
    if (!name.trim()) return toast.error('School name is required');
    if (!state || !city.trim()) return toast.error('Select state and city');
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        state,
        city: city.trim(),
        inTime,
        outTime,
        workingDays,
        address,
        lat: lat === '' ? 0 : parseFloat(lat),
        lng: lng === '' ? 0 : parseFloat(lng),
        radiusM: parseInt(radiusM) || 100,
        active,
      };
      if (isEdit && school) {
        await updateSchool(school.id, payload, {
          name: school.name,
          inTime: school.inTime,
          outTime: school.outTime,
          radiusM: school.radiusM,
          active: school.active,
        });
        toast.success('School updated');
      } else {
        await createSchool(payload);
        toast.success('School created');
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="card !p-5 sm:!p-6 space-y-5">
      <div>
        <label className="text-sm font-semibold mb-1.5 block">School name *</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field"
          placeholder="e.g. STEM Primary School Noida"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label htmlFor="school-state" className="text-sm font-semibold mb-1.5 block">State *</label><select id="school-state" className="input-field" required value={state} onChange={(e) => { setState(e.target.value); setCity(''); }}><option value="">Select state</option>{[...new Set([...INDIAN_STATES, ...(school?.state ? [school.state] : [])])].map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label htmlFor="school-city" className="text-sm font-semibold mb-1.5 block">City *</label><input id="school-city" className="input-field" list="school-cities" required disabled={!state} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Select or enter city" /><datalist id="school-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist><p className="text-xs mt-1 text-brand-choco-soft">Select a suggestion or enter another city.</p></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-semibold mb-1.5 block">In time *</label>
          <input
            type="time"
            required
            value={inTime}
            onChange={(e) => setInTime(e.target.value)}
            className="input-field"
          />
          <p className="text-[10px] text-brand-choco-soft mt-1">Check-in after this = late</p>
        </div>
        <div>
          <label className="text-sm font-semibold mb-1.5 block">Out time *</label>
          <input
            type="time"
            required
            value={outTime}
            onChange={(e) => setOutTime(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold mb-1.5 block">Working days *</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={cn(
                'px-3 py-2 rounded-2xl text-xs font-bold transition',
                workingDays.includes(d)
                  ? 'bg-brand-orange text-white'
                  : 'bg-brand-cream-dark text-brand-choco-soft'
              )}
            >
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold mb-1.5 block">Address (for geofence)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Sector 62, Noida"
            className="input-field flex-1"
          />
          <button
            type="button"
            className="btn-secondary whitespace-nowrap"
            onClick={smartGeocode}
            disabled={geocoding}
          >
            {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {address.trim() ? 'Get coords' : 'Get address'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-semibold mb-1.5 block">Latitude</label>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="text-sm font-semibold mb-1.5 block">Longitude</label>
          <input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="text-sm font-semibold mb-1.5 block">Radius (m)</label>
          <input
            type="number"
            min="10"
            value={radiusM}
            onChange={(e) => setRadiusM(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="w-4 h-4 accent-brand-orange"
        />
        <span className="text-sm text-brand-choco">Active (uncheck to hide from employees)</span>
      </label>

      <div className="flex justify-end gap-2 pt-4 border-t border-brand-choco/8">
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Save' : 'Create'}
        </button>
      </div>
    </form>
  );
}
