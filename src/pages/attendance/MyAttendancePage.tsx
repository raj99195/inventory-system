import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Download, MapPin, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useUserAttendance } from '@/hooks/useAttendance';
import { fmtDate, fmtTime, minutesToHours, monthStart, monthEnd } from '@/lib/attendance/datetime';
import { exportToCsv } from '@/lib/attendance/csvExport';
import EmptyState from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

export default function MyAttendancePage() {
  const { userDoc } = useAuth();
  const { can } = usePermission();
  const uid = userDoc?.uid ?? null;

  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());

  // Fetch a wide range then filter in-memory (Firestore listens by userId, sorted by date)
  const { records, loading } = useUserAttendance(uid, 500);

  if (!can('attendance.viewOwn')) {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(
    () => records.filter((r) => (!from || r.date >= from) && (!to || r.date <= to)),
    [records, from, to]
  );

  const handleExport = () => {
    if (!filtered.length) return;
    const rows = filtered.map((r) => ({
      Date: r.date,
      'Check-in': r.checkInAt ? new Date(r.checkInAt).toISOString() : '',
      'Check-out': r.checkOutAt ? new Date(r.checkOutAt).toISOString() : '',
      Hours: minutesToHours(r.workingMinutes),
      Late: r.isLate ? 'Yes' : 'No',
      LocationType: r.locationType,
      School: r.schoolName ?? '',
      'In Address': r.checkInAddress ?? '',
      'Out Address': r.checkOutAddress ?? '',
      Notes: r.notes ?? '',
    }));
    const count = exportToCsv(`my-attendance-${from}_to_${to}`, rows);
    toast.success(`Exported ${count} rows`);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          History
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-bold">My Attendance</h1>
        <p className="text-brand-choco-soft mt-2">
          Your daily records with check-in/out times, location and hours.
        </p>
      </div>

      <div className="card !p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-semibold text-brand-choco-soft block mb-1">From</label>
          <input
            type="date"
            className="input-field !py-2.5 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-semibold text-brand-choco-soft block mb-1">To</label>
          <input
            type="date"
            className="input-field !py-2.5 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button
          className="btn-secondary disabled:opacity-50"
          onClick={handleExport}
          disabled={!filtered.length}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title={records.length === 0 ? 'No records yet' : 'No records in this range'}
          description={
            records.length === 0
              ? 'Once you start checking in, records will appear here.'
              : 'Try widening the date range.'
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="card !p-4 hover:shadow-lift">
              <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
                <div className="flex-shrink-0">
                  <div className="text-xs font-semibold text-brand-choco-soft uppercase">
                    {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                  </div>
                  <div className="font-display text-2xl font-bold text-brand-choco leading-none mt-0.5">
                    {new Date(r.date).getDate()}
                  </div>
                  <div className="text-[10px] text-brand-choco-soft">
                    {new Date(r.date).toLocaleDateString('en-IN', { month: 'short' })}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-brand-choco">{fmtDate(r.date)}</span>
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
                      {r.locationType === 'school'
                        ? r.schoolName ?? 'School'
                        : r.locationType === 'office'
                        ? 'Office'
                        : 'WFH'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-brand-choco-soft mt-1 flex-wrap">
                    <span>In: <b className="text-brand-choco">{r.checkInAt ? fmtTime(r.checkInAt) : '—'}</b></span>
                    <span>Out: <b className="text-brand-choco">{r.checkOutAt ? fmtTime(r.checkOutAt) : '—'}</b></span>
                    <span>Hours: <b className="text-brand-choco">{minutesToHours(r.workingMinutes)}</b></span>
                  </div>
                  {r.checkInAddress && (
                    <div className="text-[11px] text-brand-choco-soft mt-1 flex items-start gap-1">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span className="break-words">{r.checkInAddress}</span>
                    </div>
                  )}
                  {r.notes && (
                    <div className="text-xs text-brand-choco-soft mt-1.5 italic bg-brand-cream-dark rounded-lg p-2">
                      {r.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
