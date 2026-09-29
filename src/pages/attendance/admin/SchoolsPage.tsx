import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Plus,
  Search,
  School as SchoolIcon,
  MapPin,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { usePermission } from '@/hooks/usePermission';
import {
  useSchools,
  createSchool,
  updateSchool,
  deleteSchool,
} from '@/hooks/useSchools';
import { forwardGeocode, reverseGeocode } from '@/lib/attendance/geocode';
import type { School, WorkingDay } from '@/types';
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

export default function SchoolsPage() {
  const { can } = usePermission();
  const { schools, loading } = useSchools();

  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [deleting, setDeleting] = useState<School | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  if (!can('schools.view')) {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(
    () => schools.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase())),
    [schools, q]
  );

  const canCreate = can('schools.create');
  const canEdit = can('schools.edit');
  const canDelete = can('schools.delete');

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteSchool(deleting);
      toast.success('School deleted');
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Locations
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">Schools</h1>
          <p className="text-brand-choco-soft mt-2">
            School sites employees can check into. Each has its own hours + geofence.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add School
          </button>
        )}
      </div>

      <div className="card !p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search schools…"
            className="input-field pl-11 !py-2.5"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SchoolIcon}
          title={schools.length === 0 ? 'No schools yet' : 'No matches'}
          description={
            schools.length === 0
              ? 'Add your first school to assign to employees.'
              : 'Try a different search.'
          }
          action={
            canCreate && schools.length === 0
              ? {
                  label: 'Add First School',
                  icon: Plus,
                  onClick: () => {
                    setEditing(null);
                    setFormOpen(true);
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((s) => (
            <div key={s.id} className="card !p-5 hover:shadow-lift">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-lg font-bold text-brand-choco">
                      {s.name}
                    </h3>
                    {!s.active && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-brand-cream-dark text-brand-choco-soft">
                        Inactive
                      </span>
                    )}
                  </div>
                  {s.address && (
                    <p className="text-sm text-brand-choco-soft mt-1 break-words">{s.address}</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {canEdit && (
                    <button
                      onClick={() => {
                        setEditing(s);
                        setFormOpen(true);
                      }}
                      className="w-8 h-8 rounded-xl hover:bg-brand-cream-dark flex items-center justify-center text-brand-choco-soft hover:text-brand-choco"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setDeleting(s)}
                      className="w-8 h-8 rounded-xl hover:bg-pastel-pink flex items-center justify-center text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                <div>
                  <div className="text-[10px] font-bold text-brand-choco-soft uppercase">In</div>
                  <div className="font-bold text-brand-choco">{s.inTime}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-brand-choco-soft uppercase">Out</div>
                  <div className="font-bold text-brand-choco">{s.outTime}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-brand-choco-soft uppercase">Radius</div>
                  <div className="font-bold text-brand-choco">{s.radiusM}m</div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-[10px] font-bold text-brand-choco-soft uppercase mb-1">
                  Working days
                </div>
                <div className="flex gap-1">
                  {DAYS.map((d) => {
                    const on = s.workingDays.includes(d);
                    return (
                      <span
                        key={d}
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-bold',
                          on
                            ? 'bg-brand-orange text-white'
                            : 'bg-brand-cream-dark text-brand-choco-soft'
                        )}
                      >
                        {DAY_LABELS[d][0]}
                      </span>
                    );
                  })}
                </div>
              </div>

              {s.lat != null && s.lng != null && (
                <a
                  href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-orange hover:text-brand-orange-dark mt-3"
                >
                  <MapPin className="w-3 h-3" />
                  View on Google Maps
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add School'}
        size="lg"
        closeOnOverlay={false}
      >
        <SchoolFormBody school={editing} onClose={() => setFormOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete School?"
        message={`"${deleting?.name}" will be permanently removed. Employees assigned to it will lose access for check-in.`}
        confirmLabel="Delete"
        loading={deleteBusy}
      />
    </div>
  );
}

function SchoolFormBody({ school, onClose }: { school: School | null; onClose: () => void }) {
  const isEdit = !!school;
  const [name, setName] = useState(school?.name ?? '');
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
    if (!name.trim()) return toast.error('School name is required');
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
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
    <form onSubmit={save} className="p-6 space-y-5">
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
