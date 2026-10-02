import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Camera as CameraIcon,
  LogOut,
  CheckCircle2,
  Clock,
  Calendar as CalendarIcon,
  FileText,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useTodaysAttendance, useUserAttendance } from '@/hooks/useAttendance';
import { useUserLeaves } from '@/hooks/useLeaves';
import { useLeaveBalance } from '@/hooks/useLeaves';
import { useAttendanceSettings } from '@/hooks/useAttendanceSettings';
import { fmtTime, minutesToHours, monthStart, monthEnd } from '@/lib/attendance/datetime';
import { cn } from '@/lib/utils';
import { hrmsHomePath } from '@/lib/permissions';
import AttendanceReminderCard from '@/components/attendance/AttendanceReminderCard';

export default function AttendanceHomePage({ embedded = false }: { embedded?: boolean }) {
  const { userDoc } = useAuth();
  const { can } = usePermission();
  const uid = userDoc?.uid ?? null;

  const { record: today, loading: loadingToday } = useTodaysAttendance(uid);
  const { records: monthly, loading: loadingMonthly } = useUserAttendance(uid, 60);
  const { leaves, loading: loadingLeaves } = useUserLeaves(uid, 50);
  const { balance, loading: balanceLoading, error: balanceError } = useLeaveBalance(uid);
  const { settings } = useAttendanceSettings();

  const loading = loadingToday || loadingMonthly || loadingLeaves || balanceLoading;

  const monthlyStats = useMemo(() => {
    const start = monthStart();
    const end = monthEnd();
    const inMonth = monthly.filter((r) => r.date >= start && r.date <= end);
    const totalMinutes = inMonth.reduce((s, r) => s + (r.workingMinutes || 0), 0);
    return { presentDays: inMonth.length, totalMinutes };
  }, [monthly]);

  const pendingLeaves = leaves.filter((l) => l.status === 'pending').length;

  if (!embedded && hrmsHomePath(userDoc) === '/attendance/admin') return <Navigate to="/attendance/admin" replace />;
  if (balanceError) return <p role="alert">Unable to load leave policy. Check your connection and reload.</p>;
  if (loading || !userDoc) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
      </div>
    );
  }

  const canMark = can('attendance.markOwn');
  const canApplyLeave = can('leaves.applyOwn');
  const checkedIn = !!today?.checkInAt;
  const checkedOut = !!today?.checkOutAt;

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <div className="rounded-3xl bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-6 sm:p-8 shadow-lift">
        <div className="text-white/80 text-sm">Namaste,</div>
        <div className="font-display text-3xl font-bold break-words">
          {userDoc.name || userDoc.email}
        </div>
        <div className="mt-1 text-white/90 text-sm">
          {userDoc.designation}
          {userDoc.department && ` · ${userDoc.department}`}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {canMark && !checkedIn && (
            <Link
              to="/attendance/mark"
              className="inline-flex items-center gap-2 bg-white text-brand-orange-dark font-bold px-4 py-2.5 rounded-2xl hover:bg-brand-cream transition"
            >
              <CameraIcon className="w-4 h-4" />
              Check In Now
            </Link>
          )}
          {canMark && checkedIn && !checkedOut && (
            <Link
              to="/attendance/mark"
              className="inline-flex items-center gap-2 bg-white text-brand-orange-dark font-bold px-4 py-2.5 rounded-2xl hover:bg-brand-cream transition"
            >
              <LogOut className="w-4 h-4" />
              Check Out
            </Link>
          )}
          {checkedOut && (
            <div className="inline-flex items-center gap-2 bg-white/20 text-white border border-white/30 font-bold px-4 py-2.5 rounded-2xl">
              <CheckCircle2 className="w-4 h-4" />
              Day done — {minutesToHours(today?.workingMinutes)}
            </div>
          )}
          {canApplyLeave && (
            <Link
              to="/attendance/apply-leave"
              className="inline-flex items-center gap-2 bg-white/15 text-white border border-white/30 font-bold px-4 py-2.5 rounded-2xl hover:bg-white/25 transition"
            >
              <FileText className="w-4 h-4" />
              Apply Leave
            </Link>
          )}
        </div>
      </div>

      {/* Today */}
      <AttendanceReminderCard />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Today Check-in"
          value={today?.checkInAt ? fmtTime(today.checkInAt) : '—'}
          icon={CameraIcon}
          tone="pastel-green"
        />
        <StatCard
          label="Today Check-out"
          value={today?.checkOutAt ? fmtTime(today.checkOutAt) : '—'}
          icon={LogOut}
          tone="pastel-blue"
        />
        <StatCard
          label="Working Time"
          value={today?.workingMinutes ? minutesToHours(today.workingMinutes) : '—'}
          icon={Clock}
          tone="pastel-peach"
        />
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Present days (month)" value={monthlyStats.presentDays} icon={CalendarIcon} tone="pastel-green" />
        <StatCard label="Total hours (month)" value={minutesToHours(monthlyStats.totalMinutes)} icon={Clock} tone="pastel-peach" />
        <StatCard label="Pending leave requests" value={pendingLeaves} icon={FileText} tone="pastel-pink" />
      </div>

      {/* Leave balances */}
      {settings.leaveTypes?.length > 0 && (
        <div className="card !p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-brand-choco">
              Leave Balance ({new Date().getFullYear()})
            </h2>
            {canApplyLeave && (
              <Link
                to="/attendance/apply-leave"
                className="text-sm font-semibold text-brand-orange hover:text-brand-orange-dark"
              >
                Apply →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {settings.leaveTypes.map((t) => (
              <div
                key={t.code}
                className="rounded-2xl border border-brand-choco/10 p-3 hover:border-brand-orange/40 transition"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: t.colorHex }}
                  />
                  <div className="text-xs font-bold text-brand-choco-soft">
                    {t.code}
                  </div>
                </div>
                <div className="font-display text-2xl font-bold text-brand-choco mt-1">
                  {balance?.balances?.[t.code] ?? t.default}
                </div>
                <div className="text-[11px] text-brand-choco-soft mt-1 truncate">
                  {t.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'pastel-green' | 'pastel-blue' | 'pastel-peach' | 'pastel-pink';
}) {
  return (
    <div className="card !p-5">
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
          tone === 'pastel-green' && 'bg-pastel-green',
          tone === 'pastel-blue' && 'bg-pastel-blue',
          tone === 'pastel-peach' && 'bg-pastel-peach',
          tone === 'pastel-pink' && 'bg-pastel-pink'
        )}
      >
        <Icon className="w-5 h-5 text-brand-choco" />
      </div>
      <div className="text-sm text-brand-choco-soft">{label}</div>
      <div className="font-display text-2xl font-bold text-brand-choco mt-1 break-words">
        {value}
      </div>
    </div>
  );
}
