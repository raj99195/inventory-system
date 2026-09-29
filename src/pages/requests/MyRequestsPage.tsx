import { Link, Navigate } from 'react-router-dom';
import {
  Plus,
  Loader2,
  Package,
  Laptop,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useUserRequests, cancelRequest } from '@/hooks/useRequests';
import { fmtDate, fmtDateTime } from '@/lib/attendance/datetime';
import { cn } from '@/lib/utils';
import type { RequestStatus, RequestItemType } from '@/types';

const STATUS_META: Record<RequestStatus, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: 'Pending',    className: 'bg-pastel-peach text-orange-800',      icon: Clock },
  approved:  { label: 'Approved',   className: 'bg-pastel-blue text-blue-800',         icon: CheckCircle2 },
  fulfilled: { label: 'Fulfilled',  className: 'bg-pastel-green text-green-800',       icon: CheckCircle2 },
  rejected:  { label: 'Rejected',   className: 'bg-pastel-pink text-red-800',          icon: XCircle },
  cancelled: { label: 'Cancelled',  className: 'bg-brand-cream-dark text-brand-choco-soft', icon: X },
};

const ITEM_META: Record<RequestItemType, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  asset:   { icon: Laptop,  color: 'bg-pastel-blue text-blue-800' },
  product: { icon: Package, color: 'bg-pastel-green text-green-800' },
  kit:     { icon: Package, color: 'bg-pastel-peach text-orange-800' },
};

export default function MyRequestsPage() {
  const { userDoc } = useAuth();
  const { can } = usePermission();
  const uid = userDoc?.uid ?? null;
  const { requests, loading } = useUserRequests(uid, 200);

  if (!can('requests.viewOwn')) {
    return <Navigate to="/" replace />;
  }

  const canCreate = can('requests.createOwn');
  const canCancel = can('requests.cancelOwn');

  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this request?')) return;
    try {
      await cancelRequest(id);
      toast.success('Request cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cancel failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Requests
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">My Requests</h1>
          <p className="text-brand-choco-soft mt-2">
            Track your asset & product requests and their approval status.
          </p>
        </div>
        {canCreate && (
          <Link to="/requests/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            New Request
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No requests yet"
          description="You haven't requested any assets or products."
          action={canCreate ? { label: 'New Request', icon: Plus, onClick: () => {} } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const statusMeta = STATUS_META[r.status];
            const itemMeta = ITEM_META[r.itemType];
            const StatusIcon = statusMeta.icon;
            const ItemIcon = itemMeta.icon;
            const isCancellable = canCancel && r.status === 'pending';

            return (
              <div key={r.id} className="card !p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0', itemMeta.color)}>
                      <ItemIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-brand-choco">{r.itemName}</span>
                        {r.itemSku && <span className="text-xs text-brand-orange font-semibold">{r.itemSku}</span>}
                        <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1', statusMeta.className)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusMeta.label}
                        </span>
                        {r.urgency === 'urgent' && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 inline-flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Urgent
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-brand-choco-soft mt-1">
                        <span className="capitalize">{r.itemType}</span>
                        {r.quantity > 1 && <> · Qty: <b className="text-brand-choco">{r.quantity}</b></>}
                        <> · Applied {fmtDateTime(r.requestedAt)}</>
                      </div>
                      {r.reason && (
                        <div className="text-xs text-brand-choco-soft mt-1.5 italic bg-brand-cream-dark rounded-lg p-2">
                          {r.reason}
                        </div>
                      )}
                      {r.reviewNotes && (
                        <div className="text-xs text-brand-choco-soft mt-1">
                          Notes from {r.reviewerName ?? 'reviewer'}: <b className="text-brand-choco">{r.reviewNotes}</b>
                        </div>
                      )}
                      {r.status === 'fulfilled' && r.fulfilledAt && (
                        <div className="text-[11px] text-green-700 mt-1 font-semibold">
                          ✓ Auto-assigned on {fmtDate(r.fulfilledAt)}
                          {r.assignmentId && ' (see Asset Assignments)'}
                        </div>
                      )}
                    </div>
                  </div>

                  {isCancellable && (
                    <button
                      onClick={() => cancel(r.id)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 inline-flex items-center gap-1 flex-shrink-0"
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
