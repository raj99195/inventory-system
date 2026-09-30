import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSchools } from '@/hooks/useSchools';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import NoAccessPage from '@/pages/NoAccessPage';
import {
  Search,
  MapPin,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  School as SchoolIcon,
} from 'lucide-react';
import type { School, WorkingDay } from '@/types';

const WEEKDAY_LETTERS: Record<WorkingDay, string> = {
  MO: 'M', TU: 'T', WE: 'W', TH: 'T', FR: 'F', SA: 'S', SU: 'S',
};
const WEEKDAY_ORDER: WorkingDay[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export default function SchoolsPage() {
  const { userDoc: user } = useAuth();
  const { can } = usePermission();
  const { schools, loading, error } = useSchools();
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');

  const canCreate = can('schools.create');
  const canEdit = can('schools.edit');
  const canDelete = can('schools.delete');
  const isAdminLevel = canCreate || canEdit || canDelete || (user?.active === true && ['super_admin', 'admin', 'hr'].includes(user.role));

  // Employees see only their assigned schools; admin+/HR see all
  const visibleSchools = useMemo(() => {
    if (!schools) return [];
    if (isAdminLevel) return schools;
    const assigned = new Set<string>(user?.assignedSchools || []);
    return schools.filter((s) => s.active && assigned.has(s.id));
  }, [schools, isAdminLevel, user?.assignedSchools]);

  // Search filter
  const filtered = useMemo(() => {
    if (!isAdminLevel) return visibleSchools;
    const q = query.toLowerCase();
    return visibleSchools.filter(
      (s) => (!state || s.state === state) && (!city || s.city === city)
        && (!status || (status === 'active' ? s.active : !s.active))
        && [s.name, s.address, s.city, s.state].some((v) => (v ?? '').toLowerCase().includes(q))
    );
  }, [visibleSchools, query, state, city, status, isAdminLevel]);

  if (!can('schools.view')) return <NoAccessPage />;
  if (error) return <p role="alert">Unable to load schools: {error.message}</p>;
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse text-brand-choco/60">Loading schools…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="inline-flex px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            {isAdminLevel ? 'Locations' : 'My Schools'}
          </p>
          <h1 className="font-display text-4xl lg:text-5xl font-bold text-brand-choco mt-1">Schools</h1>
          <p className="text-sm text-brand-choco/60 mt-1">
            {isAdminLevel
              ? 'School sites employees can check into. Each has its own hours + geofence.'
              : 'View your assigned schools and attendance locations.'}
          </p>
        </div>
        {canCreate && (
          <Link
            to="/attendance/admin/schools/new"
            className="btn-primary shrink-0"
          >
            <Plus size={18} />
            New School
          </Link>
        )}
      </div>

      {/* Search */}
      {isAdminLevel && <div className="card !p-3">
        <div className="flex items-center gap-2 px-3">
          <Search size={18} className="text-brand-choco/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search schools…"
            className="flex-1 py-2 outline-none bg-transparent text-brand-choco placeholder:text-brand-choco/40"
          />
        </div>
      </div>}

      {/* Empty states */}
      {isAdminLevel && <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <select aria-label="Filter state" className="input-field" value={state} onChange={(e) => { setState(e.target.value); setCity(''); }}><option value="">All states</option>{[...new Set(visibleSchools.map((s) => s.state).filter(Boolean))].sort().map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Filter city" className="input-field" value={city} onChange={(e) => setCity(e.target.value)}><option value="">All cities</option>{[...new Set(visibleSchools.filter((s) => !state || s.state === state).map((s) => s.city).filter(Boolean))].sort().map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Filter school status" className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <button className="btn-secondary" onClick={() => { setQuery(''); setState(''); setCity(''); setStatus(''); }}>Clear filters</button>
      </div>}
      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-brand-choco/10 p-12 text-center">
          <SchoolIcon size={48} className="mx-auto text-brand-choco/20 mb-3" />
          {!isAdminLevel && (!user?.assignedSchools || user.assignedSchools.length === 0) ? (
            <>
              <p className="text-brand-choco font-medium">No schools assigned</p>
              <p className="text-sm text-brand-choco/60 mt-1">
                Contact your administrator to assign a school for attendance.
              </p>
            </>
          ) : isAdminLevel && (query || state || city || status) ? (
            <>
              <p className="text-brand-choco font-medium">No matching schools</p>
              <p className="text-sm text-brand-choco/60 mt-1">No schools found for "{query}".</p>
            </>
          ) : (
            <>
              <p className="text-brand-choco font-medium">No schools yet</p>
              {canCreate && (
                <Link
                  to="/attendance/admin/schools/new"
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-brand-orange text-white rounded-lg"
                >
                  <Plus size={16} /> Add first school
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <SchoolCard
              key={s.id}
              school={s}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SchoolCard({
  school,
  canEdit,
  canDelete,
}: {
  school: School;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const workingDays = school.workingDays || [];
  const mapsUrl =
    school.lat != null && school.lng != null
      ? `https://www.google.com/maps?q=${school.lat},${school.lng}`
      : null;

  return (
    <div className="card !p-3 sm:!p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-base font-bold text-brand-choco break-words">
            {school.name || '(unnamed)'}
          </h3>
          <p className="text-xs text-brand-choco/60 mt-1">{[school.city, school.state].filter(Boolean).join(', ')} · {school.active ? 'Active' : 'Inactive'}</p>
          {school.address && (
            <p className="text-sm text-brand-choco/60 mt-1 line-clamp-2">
              {school.address}
            </p>
          )}
        </div>
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-1">
            {canEdit && <Link
              to={`/attendance/admin/schools/${school.id}/edit`}
              className="p-2 rounded-lg hover:bg-brand-orange/10 text-brand-choco/60 hover:text-brand-orange"
              title="Edit"
            >
              <Pencil size={16} />
            </Link>}
            {canDelete && (
              <Link
                to={`/attendance/admin/schools/${school.id}/delete`}
                className="p-2 rounded-lg hover:bg-red-50 text-brand-choco/60 hover:text-red-600"
                title="Delete"
              >
                <Trash2 size={16} />
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-brand-choco/5">
        <div>
          <p className="text-[10px] font-semibold text-brand-choco/50 uppercase tracking-wide">
            In
          </p>
          <p className="text-brand-choco font-medium mt-0.5">{school.inTime || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-brand-choco/50 uppercase tracking-wide">
            Out
          </p>
          <p className="text-brand-choco font-medium mt-0.5">{school.outTime || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-brand-choco/50 uppercase tracking-wide">
            Radius
          </p>
          <p className="text-brand-choco font-medium mt-0.5">
            {school.radiusM ? `${school.radiusM}m` : '—'}
          </p>
        </div>
      </div>

      {workingDays.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold text-brand-choco/50 uppercase tracking-wide mb-1.5">
            Working Days
          </p>
          <div className="flex gap-1">
            {WEEKDAY_ORDER.map((d) => {
              const active = workingDays.includes(d);
              return (
                <span
                  key={d}
                  className={`w-6 h-6 rounded-md text-xs font-medium flex items-center justify-center ${
                    active
                      ? 'bg-brand-orange text-white'
                      : 'bg-brand-choco/5 text-brand-choco/40'
                  }`}
                >
                  {WEEKDAY_LETTERS[d]}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-orange hover:underline"
        >
          <MapPin size={14} />
          View on Google Maps
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}
