import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Plus, Loader2, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useUserLeaves, cancelLeave } from '@/hooks/useLeaves';
import { useAttendanceSettings } from '@/hooks/useAttendanceSettings';
import { fmtDate, fmtDateTime } from '@/lib/attendance/datetime';
import EmptyState from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import type { LeaveStatus } from '@/types';

const STATUS_META: Record<LeaveStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-pastel-peach text-orange-800' },
  approved: { label: 'Approved', className: 'bg-pastel-green text-green-800' },
  rejected: { label: 'Rejected', className: 'bg-pastel-pink text-red-800' },
  cancelled: { label: 'Cancelled', className: 'bg-brand-cream-dark text-brand-choco-soft' },
};

export default function MyLeavesPage() {
  const navigate = useNavigate();
  const { userDoc } = useAuth();
  const { can } = usePermission();
  const uid = userDoc?.uid ?? null;

  const { leaves, loading } = useUserLeaves(uid, 200);
  const { settings } = useAttendanceSettings();
  const leaveTypes = settings.leaveTypes ?? [];

  if (!can('leaves.viewOwn')) {
    return <Navigate to="/" replace />;
  }

  const typeName = (code: string) =>
    leaveTypes.find((t) => t.code === code)?.name ?? code;

  const canCancel = can('leaves.cancelOwn');
  const canApply = can('leaves.applyOwn');

  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await cancelLeave(id);
      toast.success('Leave cancelled');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Leaves
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">My Leaves</h1>
          <p className="text-brand-choco-soft mt-2">
            Track your leave applications and their approval status.
          </p>
        </div>
        {canApply && (
          <Link to="/attendance/apply-leave" className="btn-primary">
            <Plus className="w-4 h-4" />
            Apply Leave
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
        </div>
      ) : leaves.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No leaves yet"
          description="You haven't applied for any leaves."
          action={canApply ? { label: 'Apply Leave', icon: Plus, onClick: () => navigate('/attendance/apply-leave') } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {leaves.map((l) => {
            const meta = STATUS_META[l.status] ?? STATUS_META.pending;
            const isCancellable =
              canCancel && (l.status === 'pending' || l.status === 'approved');
            return (
              <div key={l.id} className="card !p-4 hover:shadow-lift">
                <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-brand-choco">{l.leaveType}</span>
                      <span className="text-xs text-brand-choco-soft">
                        {typeName(l.leaveType)}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                          meta.className
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="text-sm text-brand-choco mt-1">
                      {fmtDate(l.fromDate)} → {fmtDate(l.toDate)}{' '}
                      <span className="text-brand-choco-soft">({l.days} day{l.days > 1 ? 's' : ''})</span>
                    </div>
                    {l.reason && (
                      <div className="text-xs text-brand-choco-soft mt-1.5 italic bg-brand-cream-dark rounded-lg p-2">
                        {l.reason}
                      </div>
                    )}
                    {l.reviewNotes && (
                      <div className="text-xs text-brand-choco-soft mt-1">
                        Remarks: <b className="text-brand-choco">{l.reviewNotes}</b>
                      </div>
                    )}
                    <div className="text-[11px] text-brand-choco-soft mt-1">
                      Applied {fmtDateTime(l.appliedAt)}
                    </div>
                  </div>

                  {isCancellable && (
                    <button
                      onClick={() => cancel(l.id)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 inline-flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
