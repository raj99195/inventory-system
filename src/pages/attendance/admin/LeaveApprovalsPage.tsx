import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { usePermission } from '@/hooks/usePermission';
import { useAllLeaves, approveLeave, rejectLeave } from '@/hooks/useLeaves';
import { useUsers } from '@/hooks/useUsers';
import { useAttendanceSettings } from '@/hooks/useAttendanceSettings';
import { fmtDate, fmtDateTime } from '@/lib/attendance/datetime';
import { cn } from '@/lib/utils';
import type { Leave, LeaveStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { canActOnUser } from '@/lib/permissions';

const STATUS_META: Record<LeaveStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-pastel-peach text-orange-800' },
  approved: { label: 'Approved', className: 'bg-pastel-green text-green-800' },
  rejected: { label: 'Rejected', className: 'bg-pastel-pink text-red-800' },
  cancelled: { label: 'Cancelled', className: 'bg-brand-cream-dark text-brand-choco-soft' },
};

export default function LeaveApprovalsPage() {
  const { userDoc } = useAuth();
  const { can } = usePermission();
  const { leaves, loading } = useAllLeaves(500);
  const { users } = useUsers();
  const { settings } = useAttendanceSettings();

  const [tab, setTab] = useState<LeaveStatus>('pending');
  const [decide, setDecide] = useState<{ leave: Leave; action: 'approve' | 'reject' } | null>(null);

  const userMap = useMemo(() => new Map(users.map((u) => [u.uid, u])), [users]);
  if (!can('leaves.viewAll')) {
    return <Navigate to="/" replace />;
  }

  const typeName = (code: string) =>
    settings.leaveTypes?.find((t) => t.code === code)?.name ?? code;

  const visible = leaves.filter((l) => canActOnUser(userDoc, userMap.get(l.userId)));
  const filtered = visible.filter((l) => l.status === tab);
  const counts = visible.reduce<Record<string, number>>((a, l) => {
    a[l.status] = (a[l.status] || 0) + 1;
    return a;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          Leave Requests
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-bold">Leave Approvals</h1>
        <p className="text-brand-choco-soft mt-2">
          Review and approve leave applications from your team.
        </p>
      </div>

      <div className="flex gap-1 border-b border-brand-choco/10 overflow-x-auto">
        {(['pending', 'approved', 'rejected', 'cancelled'] as LeaveStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={cn(
              'px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition whitespace-nowrap flex items-center gap-2',
              tab === s
                ? 'border-brand-orange text-brand-orange-dark'
                : 'border-transparent text-brand-choco-soft hover:text-brand-choco'
            )}
          >
            {STATUS_META[s].label}
            {counts[s] ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-cream-dark text-brand-choco">
                {counts[s]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No ${STATUS_META[tab].label.toLowerCase()} requests`}
          description="Nothing to show here right now."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => {
            const u = userMap.get(l.userId);
            const meta = STATUS_META[l.status];
            const canDecide = l.status === 'pending' && can('leaves.approve');
            return (
              <div key={l.id} className="card !p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-orange-light to-brand-orange text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                      {u?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-brand-choco">{u?.name ?? 'Unknown'}</span>
                        {u?.department && (
                          <span className="text-xs text-brand-choco-soft">· {u.department}</span>
                        )}
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
                        <b>{l.leaveType}</b> · {typeName(l.leaveType)} ·{' '}
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
                  </div>

                  {canDecide && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setDecide({ leave: l, action: 'approve' })}
                        className="btn-secondary text-xs !text-green-700 hover:!bg-pastel-green"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => setDecide({ leave: l, action: 'reject' })}
                        className="btn-secondary text-xs !text-red-600 hover:!bg-pastel-pink"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {decide && (
        <DecideModal
          decide={decide}
          user={userMap.get(decide.leave.userId)?.name ?? 'Unknown'}
          typeName={typeName(decide.leave.leaveType)}
          onClose={() => setDecide(null)}
        />
      )}
    </div>
  );
}

function DecideModal({
  decide,
  user,
  typeName,
  onClose,
}: {
  decide: { leave: Leave; action: 'approve' | 'reject' };
  user: string;
  typeName: string;
  onClose: () => void;
}) {
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const isApprove = decide.action === 'approve';

  const submit = async () => {
    setBusy(true);
    try {
      if (isApprove) {
        await approveLeave(decide.leave.id, remarks);
        toast.success('Leave approved · balance deducted');
      } else {
        await rejectLeave(decide.leave.id, remarks);
        toast.success('Leave rejected');
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${isApprove ? 'Approve' : 'Reject'} leave — ${user}`}
      size="md"
    >
      <div className="p-6 space-y-4">
        <div className="rounded-2xl bg-brand-cream-dark p-4 text-sm">
          <div className="font-bold text-brand-choco">
            {typeName} ({decide.leave.leaveType})
          </div>
          <div className="text-brand-choco-soft mt-1">
            {fmtDate(decide.leave.fromDate)} → {fmtDate(decide.leave.toDate)} · {decide.leave.days} day
            {decide.leave.days > 1 ? 's' : ''}
          </div>
          <div className="mt-2 text-xs text-brand-choco-soft">
            Reason: {decide.leave.reason || '—'}
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold mb-1.5 block">Remarks (optional)</label>
          <textarea
            rows={3}
            className="input-field resize-none"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add a note visible to the employee…"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={busy} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={cn(
              'btn-primary',
              !isApprove && '!bg-red-600 hover:!bg-red-700'
            )}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : isApprove ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
