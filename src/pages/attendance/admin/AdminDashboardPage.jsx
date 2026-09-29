import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAllAttendance } from '../../services/attendance.service.js';
import { listAllLeaves } from '../../services/leaves.service.js';
import { listUsers, getUserBalance, setUserBalance } from '../../services/users.service.js';
import { getSettings } from '../../services/settings.service.js';
import { fmtTime, minutesToHhMm, todayStr } from '../../utils/datetime.js';
import { PageLoader, Spinner } from '../../components/ui/EmptyState.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { PERMISSIONS } from '../../constants/permissions.js';

export default function AdminDashboardPage() {
  const { can } = usePermissions();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      const [att, lv, us] = await Promise.all([
        listAllAttendance({ from: todayStr(), to: todayStr() }),
        listAllLeaves(),
        listUsers()
      ]);
      setStats({ att, lv, us });
    })();
  }, []);

  if (!stats) return <PageLoader />;

  const active = stats.us.filter(u => u.active !== false);
  const checkedIn = stats.att.filter(a => a.checkIn).length;
  const checkedOut = stats.att.filter(a => a.checkOut).length;
  const late = stats.att.filter(a => a.status === 'late').length;
  const pendingLeaves = stats.lv.filter(l => l.status === 'pending').length;
  const offSite = stats.att.filter(a => a.checkIn?.withinOffice === false).length;

  /**
   * Reset every active user's leave balance to the CURRENT settings defaults
   * for this year. Existing docs get their balances overwritten with the
   * current leaveTypes defaults; used/approved leaves are NOT deducted
   * (that's a fresh reset).
   *
   * Use this after changing leave types in Settings to bring existing users
   * in line with the new defaults.
   */
  const syncAllBalances = async () => {
    if (!confirm(
      `Reset leave balances for ALL ${active.length} active users to the current Settings defaults for ${new Date().getFullYear()}?\n\n` +
      `This overwrites existing balances — used/approved leaves are NOT re-deducted.\n\n` +
      `Only run after changing leave types in Settings.`
    )) return;

    setSyncing(true);
    try {
      const settings = await getSettings();
      const year = new Date().getFullYear();
      const defaults = Object.fromEntries((settings.leaveTypes || []).map(t => [t.code, t.default]));

      let done = 0;
      for (const u of active) {
        await setUserBalance(u.id, year, { ...defaults });
        done++;
      }
      toast.success(`Synced balances for ${done} users to current defaults`);
    } catch (e) {
      toast.error(e.message || 'Sync failed');
    } finally { setSyncing(false); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 text-white p-5 sm:p-6 shadow-pop">
        <div className="text-brand-50 text-sm">Today's snapshot</div>
        <div className="text-2xl font-extrabold">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div className="mt-1 text-brand-50/90 text-sm">
          {active.length} active employees · {checkedIn} checked in · {late} late · {offSite} off-site
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Checked-in Today" value={checkedIn} total={active.length} tone="green" />
        <Stat label="Checked-out" value={checkedOut} total={active.length} tone="blue" />
        <Stat label="Late arrivals" value={late} tone="amber" />
        <Stat label="Off-site" value={offSite} tone="amber" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {can(PERMISSIONS.LEAVES_ALL_VIEW) && (
          <Link to="/admin/leaves" className="card p-5 hover:shadow-pop transition block">
            <div className="flex items-center justify-between">
              <div className="font-bold text-ink-900">Pending leave requests</div>
              <div className={pendingLeaves > 0 ? 'badge-amber' : 'badge-green'}>
                {pendingLeaves}
              </div>
            </div>
            <p className="text-sm text-ink-500 mt-1">Review and approve incoming leave applications.</p>
          </Link>
        )}
        {can(PERMISSIONS.USERS_VIEW) && (
          <Link to="/admin/users" className="card p-5 hover:shadow-pop transition block">
            <div className="flex items-center justify-between">
              <div className="font-bold text-ink-900">Employees</div>
              <div className="badge-brand">{active.length}</div>
            </div>
            <p className="text-sm text-ink-500 mt-1">Manage users, roles, permissions, and office locations.</p>
          </Link>
        )}
      </div>

      {/* Sync balances — Settings edit permission required */}
      {can(PERMISSIONS.SETTINGS_EDIT) && (
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-ink-900">Sync leave balances</div>
              <p className="text-sm text-ink-500 mt-1">
                Overwrite every active user's balance for this year with the current Settings defaults.
                Use this after changing leave types.
              </p>
            </div>
            <button className="btn-secondary whitespace-nowrap" onClick={syncAllBalances} disabled={syncing}>
              {syncing ? <Spinner /> : 'Sync all now'}
            </button>
          </div>
        </div>
      )}

      {/* Today's list */}
      {can(PERMISSIONS.ATTENDANCE_ALL_VIEW) && stats.att.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-ink-900">Today's Attendance</h2>
            <Link to="/admin/attendance" className="text-sm font-semibold text-brand-600">See all →</Link>
          </div>
          <div className="divide-y divide-ink-100">
            {stats.att.slice(0, 8).map(a => {
              const u = stats.us.find(x => x.id === a.userId);
              return (
                <div key={a.id} className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
                    {u?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{u?.name || '—'}</div>
                    <div className="text-xs text-ink-500">
                      In: {a.checkIn ? fmtTime(a.checkIn.at) : '—'}
                      {a.checkOut && ` · Out: ${fmtTime(a.checkOut.at)}`}
                      {a.workingMinutes != null && ` · ${minutesToHhMm(a.workingMinutes)}`}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={a.status === 'present' ? 'badge-green' : a.status === 'late' ? 'badge-amber' : 'badge-gray'}>
                      {a.status}
                    </span>
                    {a.checkIn?.withinOffice === false && (
                      <span className="badge-amber text-[10px]">Off-site</span>
                    )}
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

function Stat({ label, value, total, tone }) {
  const map = {
    green: 'bg-emerald-50 text-emerald-700',
    blue:  'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    brand: 'bg-brand-50 text-brand-700'
  };
  return (
    <div className="card p-4">
      <div className={`w-8 h-8 rounded-lg ${map[tone]} flex items-center justify-center mb-2 text-xs font-bold`}>#</div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-0.5 text-2xl font-extrabold text-ink-900">
        {value}{total != null && <span className="text-ink-400 text-lg font-medium"> / {total}</span>}
      </div>
    </div>
  );
}