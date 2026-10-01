import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Users as UsersIcon,
  Clock,
  AlertTriangle,
  MapPin,
  FileText,
  Loader2,
  CheckCircle2,
  LogOut,
} from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { useAllAttendance } from '@/hooks/useAttendance';
import { useAllLeaves } from '@/hooks/useLeaves';
import { useUsers } from '@/hooks/useUsers';
import { fmtTime, minutesToHours, todayKey } from '@/lib/attendance/datetime';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { canActOnUser } from '@/lib/permissions';
import AttendanceReminderCard from '@/components/attendance/AttendanceReminderCard';

export default function AttendanceAdminDashboardPage() {
  const { can } = usePermission();
  const { records, loading: loadingRecs } = useAllAttendance(500);
  const { leaves, loading: loadingLeaves } = useAllLeaves(500);
  const { users: allUsers, loading: loadingUsers } = useUsers();
  const { userDoc } = useAuth();
  const users = useMemo(() => allUsers.filter((u) => canActOnUser(userDoc, u)), [allUsers, userDoc]);

  const loading = loadingRecs || loadingLeaves || loadingUsers;
  const today = todayKey();
  const active = users.filter((u) => u.active);
  const userMap = useMemo(() => new Map(users.map((u) => [u.uid, u])), [users]);
  const todayRecs = useMemo(() => records.filter((r) => r.date === today && userMap.has(r.userId)), [records, today, userMap]);

  const stats = useMemo(() => {
    const checkedIn = todayRecs.filter((r) => r.checkInAt).length;
    const checkedOut = todayRecs.filter((r) => r.checkOutAt).length;
    const late = todayRecs.filter((r) => r.isLate).length;
    const wfh = todayRecs.filter((r) => r.locationType === 'wfh').length;
    const pendingLeaves = leaves.filter((l) => l.status === 'pending' && userMap.has(l.userId)).length;
    return { checkedIn, checkedOut, late, wfh, pendingLeaves };
  }, [todayRecs, leaves, userMap]);

  if (!can('attendance.viewAll')) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          Today's Snapshot
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-bold">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h1>
        <p className="text-brand-choco-soft mt-2">
          {active.length} active employees · {stats.checkedIn} checked in · {stats.late} late · {stats.wfh} WFH
        </p>
      </div>

      <AttendanceReminderCard />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Checked-in Today" value={stats.checkedIn} total={active.length} icon={CheckCircle2} tone="pastel-green" />
        <Stat label="Checked-out" value={stats.checkedOut} total={active.length} icon={LogOut} tone="pastel-blue" />
        <Stat label="Late arrivals" value={stats.late} icon={AlertTriangle} tone="pastel-peach" />
        <Stat label="Work from home" value={stats.wfh} icon={MapPin} tone="pastel-pink" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {can('leaves.viewAll') && (
          <Link to="/attendance/admin/leaves" className="card !p-5 hover:shadow-lift transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pastel-peach flex items-center justify-center">
                  <FileText className="w-5 h-5 text-orange-800" />
                </div>
                <div>
                  <div className="font-bold text-brand-choco">Pending leave requests</div>
                  <p className="text-xs text-brand-choco-soft">Review and approve applications</p>
                </div>
              </div>
              <span
                className={cn(
                  'text-xs font-bold px-2.5 py-1 rounded-full',
                  stats.pendingLeaves > 0 ? 'bg-pastel-peach text-orange-800' : 'bg-pastel-green text-green-800'
                )}
              >
                {stats.pendingLeaves}
              </span>
            </div>
          </Link>
        )}
        {can('users.view') && (
          <Link to="/users" className="card !p-5 hover:shadow-lift transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pastel-blue flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-blue-800" />
                </div>
                <div>
                  <div className="font-bold text-brand-choco">Employees</div>
                  <p className="text-xs text-brand-choco-soft">Manage users, roles, permissions, locations</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-orange-50 text-brand-orange-dark">
                {active.length}
              </span>
            </div>
          </Link>
        )}
      </div>

      {todayRecs.length > 0 && (
        <div className="card !p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-bold text-brand-choco">Today's Attendance</h2>
            <Link
              to="/attendance/admin/view"
              className="text-sm font-semibold text-brand-orange hover:text-brand-orange-dark"
            >
              See all →
            </Link>
          </div>
          <div className="divide-y divide-brand-choco/8">
            {todayRecs.slice(0, 8).map((a) => {
              const u = userMap.get(a.userId);
              return (
                <div key={a.id} className="py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-orange-light to-brand-orange text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                    {u?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-brand-choco truncate">{u?.name ?? 'Unknown'}</div>
                    <div className="text-xs text-brand-choco-soft flex items-center gap-1.5 flex-wrap">
                      <Clock className="w-3 h-3" />
                      In: <b>{a.checkInAt ? fmtTime(a.checkInAt) : '—'}</b>
                      {a.checkOutAt && (
                        <>
                          {' '}· Out: <b>{fmtTime(a.checkOutAt)}</b>
                        </>
                      )}
                      {a.workingMinutes > 0 && <> · {minutesToHours(a.workingMinutes)}</>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                        a.isLate ? 'bg-pastel-peach text-orange-800' : 'bg-pastel-green text-green-800'
                      )}
                    >
                      {a.isLate ? 'Late' : 'On time'}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-brand-choco-soft">{a.locationType}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  total,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  total?: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'pastel-green' | 'pastel-blue' | 'pastel-peach' | 'pastel-pink';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4 border',
        tone === 'pastel-green' && 'bg-pastel-green border-pastel-green-deep/30',
        tone === 'pastel-blue' && 'bg-pastel-blue border-pastel-blue-deep/30',
        tone === 'pastel-peach' && 'bg-pastel-peach border-pastel-peach-deep/30',
        tone === 'pastel-pink' && 'bg-pastel-pink border-pastel-pink-deep/30'
      )}
    >
      <div className="w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center mb-2">
        <Icon className="w-4 h-4 text-brand-choco" />
      </div>
      <div className="text-xs font-semibold text-brand-choco-light">{label}</div>
      <div className="font-display text-2xl font-bold text-brand-choco mt-0.5">
        {value}
        {total != null && <span className="text-brand-choco-soft text-base font-medium"> / {total}</span>}
      </div>
    </div>
  );
}
