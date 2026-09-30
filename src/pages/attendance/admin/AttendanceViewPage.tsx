import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Download, Loader2, Calendar as CalendarIcon, MapPin, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { usePermission } from '@/hooks/usePermission';
import { useAllAttendance } from '@/hooks/useAttendance';
import { useUsers } from '@/hooks/useUsers';
import { fmtDate, fmtTime, minutesToHours, monthStart, monthEnd } from '@/lib/attendance/datetime';
import { exportToCsv } from '@/lib/attendance/csvExport';
import type { AttendanceRecord } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { canActOnUser } from '@/lib/permissions';

export default function AttendanceViewPage() {
  const { can } = usePermission();
  const { records, loading } = useAllAttendance(1000);
  const { users: allUsers } = useUsers();
  const { userDoc } = useAuth();
  const users = useMemo(() => allUsers.filter((u) => canActOnUser(userDoc, u)), [allUsers, userDoc]);

  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());
  const [userId, setUserId] = useState<string>('');
  const [view, setView] = useState<AttendanceRecord | null>(null);

  const userMap = useMemo(() => new Map(users.map((u) => [u.uid, u])), [users]);

  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          userMap.has(r.userId) &&
          (!from || r.date >= from) &&
          (!to || r.date <= to) &&
          (!userId || r.userId === userId)
      ),
    [records, from, to, userId, userMap]
  );

  const canExport = can('attendance.exportAll');

  const handleExport = () => {
    if (!filtered.length) return;
    const rows = filtered.map((r) => {
      const u = userMap.get(r.userId);
      return {
        Date: r.date,
        Employee: u?.name ?? r.userId,
        Email: u?.email ?? '',
        Department: u?.department ?? '',
        'Check-in': r.checkInAt ? new Date(r.checkInAt).toISOString() : '',
        'Check-out': r.checkOutAt ? new Date(r.checkOutAt).toISOString() : '',
        Hours: minutesToHours(r.workingMinutes),
        Late: r.isLate ? 'Yes' : 'No',
        LocationType: r.locationType,
        School: r.schoolName ?? '',
        'In Address': r.checkInAddress ?? '',
        'Out Address': r.checkOutAddress ?? '',
        Notes: r.notes ?? '',
      };
    });
    const count = exportToCsv(`attendance-${from}_to_${to}`, rows);
    toast.success(`Exported ${count} rows`);
  };

  if (!can('attendance.viewAll')) return <Navigate to="/" replace />;
  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          Team Records
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-bold">Team Attendance</h1>
        <p className="text-brand-choco-soft mt-2">
          Filter by date range and employee. Click any row to see selfie + location details.
        </p>
      </div>

      <div className="card !p-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[150px] flex-1">
          <label className="text-xs font-semibold text-brand-choco-soft block mb-1">From</label>
          <input
            type="date"
            className="input-field !py-2.5 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="min-w-[150px] flex-1">
          <label className="text-xs font-semibold text-brand-choco-soft block mb-1">To</label>
          <input
            type="date"
            className="input-field !py-2.5 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="text-xs font-semibold text-brand-choco-soft block mb-1">Employee</label>
          <select
            className="input-field !py-2.5 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">All employees</option>
            {users.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.name} · {u.email}
              </option>
            ))}
          </select>
        </div>
        {canExport && (
          <button
            className="btn-secondary disabled:opacity-50"
            onClick={handleExport}
            disabled={!filtered.length}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="No records"
          description="No attendance found for these filters."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const u = userMap.get(r.userId);
            return (
              <div key={r.id} className="card !p-4 hover:shadow-lift">
                <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-orange-light to-brand-orange text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                    {u?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-brand-choco">{u?.name ?? 'Unknown'}</span>
                      <span className="text-xs text-brand-choco-soft">· {fmtDate(r.date)}</span>
                      {r.isLate && (
                        <span className="text-[10px] font-bold uppercase bg-pastel-peach text-orange-800 px-2 py-0.5 rounded-full">
                          Late
                        </span>
                      )}
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                          r.locationType === 'school' && 'bg-pastel-blue text-blue-800',
                          r.locationType === 'office' && 'bg-pastel-green text-green-800',
                          r.locationType === 'wfh' && 'bg-pastel-pink text-pink-800'
                        )}
                      >
                        {r.locationType === 'school' ? r.schoolName ?? 'School' : r.locationType}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-brand-choco-soft mt-1 flex-wrap">
                      <span>In: <b className="text-brand-choco">{r.checkInAt ? fmtTime(r.checkInAt) : '—'}</b></span>
                      <span>Out: <b className="text-brand-choco">{r.checkOutAt ? fmtTime(r.checkOutAt) : '—'}</b></span>
                      <span>Hours: <b className="text-brand-choco">{minutesToHours(r.workingMinutes)}</b></span>
                      {u?.department && <span>· {u.department}</span>}
                    </div>
                    {r.checkInAddress && (
                      <div className="text-[11px] text-brand-choco-soft mt-1 flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="break-words truncate">{r.checkInAddress}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setView(r)}
                    className="btn-secondary text-xs flex-shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view && (
        <Modal
          open
          onClose={() => setView(null)}
          title={`${userMap.get(view.userId)?.name ?? 'Unknown'} — ${fmtDate(view.date)}`}
          size="lg"
        >
          <div className="p-6 space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <PhotoBlock
                title="Check-in"
                selfie={view.checkInSelfie}
                at={view.checkInAt}
                lat={view.checkInLat}
                lng={view.checkInLng}
                address={view.checkInAddress}
              />
              <PhotoBlock
                title="Check-out"
                selfie={view.checkOutSelfie}
                at={view.checkOutAt}
                lat={view.checkOutLat}
                lng={view.checkOutLng}
                address={view.checkOutAddress}
              />
            </div>
            <div className="rounded-2xl bg-brand-cream-dark p-4 text-sm grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-brand-choco-soft">Total hours</div>
                <div className="font-bold text-brand-choco">{minutesToHours(view.workingMinutes)}</div>
              </div>
              <div>
                <div className="text-xs text-brand-choco-soft">Location</div>
                <div className="font-bold text-brand-choco capitalize">{view.locationType}</div>
              </div>
              <div>
                <div className="text-xs text-brand-choco-soft">Status</div>
                <div className={cn('font-bold', view.isLate ? 'text-orange-700' : 'text-green-700')}>
                  {view.isLate ? 'Late' : 'On time'}
                </div>
              </div>
            </div>
            {view.notes && (
              <div>
                <div className="text-xs font-bold uppercase text-brand-choco-soft mb-1.5">
                  Notes for the day
                </div>
                <div className="rounded-2xl bg-brand-orange-50 p-3 text-sm text-brand-choco whitespace-pre-wrap">
                  {view.notes}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function PhotoBlock({
  title,
  selfie,
  at,
  lat,
  lng,
  address,
}: {
  title: string;
  selfie: string | null;
  at: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
}) {
  if (!selfie || !at) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-brand-choco/15 p-6 text-center text-brand-choco-soft text-sm">
        {title}: not recorded
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-brand-choco/10 overflow-hidden">
      <div className="aspect-square bg-brand-choco">
        <img src={selfie} alt={title} className="w-full h-full object-cover" />
      </div>
      <div className="p-3 text-xs space-y-1">
        <div className="font-bold text-brand-choco">
          {title} • {fmtTime(at)}
        </div>
        <div className="text-brand-choco-soft break-words">
          {address || (lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '—')}
        </div>
      </div>
    </div>
  );
}
