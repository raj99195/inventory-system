import { useAssets } from '@/hooks/useAssets';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Package,
  Laptop,
  Zap,
  Clock,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { usePermission } from '@/hooks/usePermission';
import {
  useAllRequests,
  approveRequest,
  rejectRequest,
} from '@/hooks/useRequests';
import { fmtDateTime } from '@/lib/attendance/datetime';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { canActOnUser } from '@/lib/permissions';
import type {
  AssetRequest,
  RequestStatus,
  RequestItemType,
} from '@/types';

const STATUS_META: Record<RequestStatus, { label: string; className: string }> = {
  pending:   { label: 'Pending',    className: 'bg-pastel-peach text-orange-800' },
  approved:  { label: 'Approved',   className: 'bg-pastel-blue text-blue-800' },
  fulfilled: { label: 'Fulfilled',  className: 'bg-pastel-green text-green-800' },
  rejected:  { label: 'Rejected',   className: 'bg-pastel-pink text-red-800' },
  cancelled: { label: 'Cancelled',  className: 'bg-brand-cream-dark text-brand-choco-soft' },
};

const ITEM_META: Record<RequestItemType, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  asset:   { icon: Laptop,  color: 'bg-pastel-blue text-blue-800' },
  product: { icon: Package, color: 'bg-pastel-green text-green-800' },
  kit:     { icon: Package, color: 'bg-pastel-peach text-orange-800' },
};

export default function RequestApprovalsPage() {
  const { userDoc } = useAuth();
  const { users } = useUsers();
  const { can } = usePermission();
  const { requests: allRequests, loading } = useAllRequests(500);
  const requests = useMemo(() => allRequests.filter((r) => canActOnUser(userDoc, users.find((u) => u.uid === r.userId))), [allRequests, users, userDoc]);

  const [tab, setTab] = useState<RequestStatus>('pending');
  const [decide, setDecide] = useState<{ req: AssetRequest; action: 'approve' | 'reject' } | null>(null);

  const canApprove = can('requests.approve');

  const filtered = useMemo(() => requests.filter((r) => r.status === tab), [requests, tab]);

  const counts = useMemo(() => {
    return requests.reduce<Record<string, number>>((a, r) => {
      a[r.status] = (a[r.status] || 0) + 1;
      return a;
    }, {});
  }, [requests]);

  if (!can('requests.viewAll')) return <Navigate to="/" replace />;
  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          Approvals Inbox
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-bold">Request Approvals</h1>
        <p className="text-brand-choco-soft mt-2">
          Review requests from your team. Approving auto-assigns the item.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-brand-choco/10 overflow-x-auto">
        {(['pending', 'fulfilled', 'approved', 'rejected', 'cancelled'] as RequestStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={cn(
              'px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition whitespace-nowrap flex items-center gap-2',
              tab === s ? 'border-brand-orange text-brand-orange-dark' : 'border-transparent text-brand-choco-soft hover:text-brand-choco'
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
          icon={tab === 'pending' ? Clock : Send}
          title={`No ${STATUS_META[tab].label.toLowerCase()} requests`}
          description="Nothing to show here right now."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const itemMeta = ITEM_META[r.itemType];
            const statusMeta = STATUS_META[r.status];
            const ItemIcon = itemMeta.icon;
            const showActions = r.status === 'pending' && canApprove;

            return (
              <div key={r.id} className="card !p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Item icon */}
                    <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0', itemMeta.color)}>
                      <ItemIcon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Requester + item */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-brand-choco">{r.userName}</span>
                        {r.userDepartment && (
                          <span className="text-xs text-brand-choco-soft">· {r.userDepartment}</span>
                        )}
                        <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', statusMeta.className)}>
                          {statusMeta.label}
                        </span>
                        {r.urgency === 'urgent' && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 inline-flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Urgent
                          </span>
                        )}
                      </div>

                      {/* Item */}
                      <div className="text-sm text-brand-choco mt-1">
                        Requesting <b>{r.itemName}</b>
                        {r.itemSku && <> ({r.itemSku})</>}
                        {r.quantity > 1 && <> · Qty: <b>{r.quantity}</b></>}
                      </div>

                      {/* Reason */}
                      {r.reason && (
                        <div className="text-xs text-brand-choco-soft mt-1.5 italic bg-brand-cream-dark rounded-lg p-2">
                          {r.reason}
                        </div>
                      )}

                      {/* Review notes */}
                      {r.reviewNotes && (
                        <div className="text-xs text-brand-choco-soft mt-1">
                          Notes: <b className="text-brand-choco">{r.reviewNotes}</b>
                          {r.reviewerName && <> — by {r.reviewerName}</>}
                        </div>
                      )}

                      {/* Timestamps */}
                      <div className="text-[11px] text-brand-choco-soft mt-1 flex items-center gap-2 flex-wrap">
                        <span>Requested {fmtDateTime(r.requestedAt)}</span>
                        {r.userEmail && <span>· {r.userEmail}</span>}
                      </div>
                    </div>
                  </div>

                  {showActions && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setDecide({ req: r, action: 'approve' })}
                        className="btn-secondary text-xs !text-green-700 hover:!bg-pastel-green"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => setDecide({ req: r, action: 'reject' })}
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
        <DecideModal decide={decide} onClose={() => setDecide(null)} />
      )}
    </div>
  );
}

function DecideModal({
  decide, onClose,
}: {
  decide: { req: AssetRequest; action: 'approve' | 'reject' };
  onClose: () => void;
}) {
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const isApprove = decide.action === 'approve';
  const r = decide.req;
  const needsAsset = isApprove && r.scope === 'office' && r.itemType === 'asset' && !r.itemId;
  const { assets } = useAssets(needsAsset, 'officeAssets');
  const [assetId, setAssetId] = useState('');

  const submit = async () => {
    setBusy(true);
    try {
      if (isApprove) {
        await approveRequest(r.id, remarks, assetId);
        if (r.itemType === 'asset') {
          toast.success('Request approved · asset auto-assigned');
        } else if (r.itemType === 'product') {
          toast.success('Request approved · stock deducted');
        } else {
          toast.success('Request approved');
        }
      } else {
        await rejectRequest(r.id, remarks);
        toast.success('Request rejected');
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
      title={`${isApprove ? 'Approve' : 'Reject'} request — ${r.userName}`}
      size="md"
    >
      <div className="p-6 space-y-4">
        <div className="rounded-2xl bg-brand-cream-dark p-4 text-sm space-y-1">
          <div className="font-bold text-brand-choco">{r.itemName}</div>
          {r.itemSku && <div className="text-xs text-brand-orange font-semibold">{r.itemSku}</div>}
          <div className="text-xs text-brand-choco-soft capitalize">
            {r.scope === 'office' ? (r.itemType === 'asset' ? 'Office Asset' : 'Office Inventory') : r.itemType}
            {r.quantity > 1 && ` · Qty: ${r.quantity}`}
          </div>
          <div className="mt-2 text-xs text-brand-choco-soft">Reason: {r.reason || '—'}</div>
        </div>

        {needsAsset && <label className="block text-sm font-semibold">Asset to assign<select className="input-field mt-2" value={assetId} onChange={e => setAssetId(e.target.value)}><option value="">Select an available asset</option>{assets.filter(a => a.status === 'available').map(a => <option key={a.id} value={a.id}>{a.name} · {a.assetId}</option>)}</select></label>}
        {isApprove && (
          <div className="rounded-xl bg-pastel-green border border-pastel-green-deep/30 p-3 text-xs text-green-900">
            <b>On approval:</b>{' '}
            {r.itemType === 'asset'
              ? `This asset will be auto-assigned to ${r.userName}.`
              : r.itemType === 'product'
              ? `${r.quantity} ${r.itemName} will be deducted from stock and marked as issued to ${r.userName}.`
              : 'This kit request will be marked approved — you can then fulfil it manually.'}
          </div>
        )}

        <div>
          <label className="text-sm font-semibold mb-1.5 block">
            Remarks {isApprove ? '(optional)' : '(reason for rejection)'}
          </label>
          <textarea
            rows={3}
            className="input-field resize-none"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={isApprove ? 'Any notes for the employee…' : 'Explain why this is being rejected…'}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-brand-choco/8">
          <button onClick={onClose} disabled={busy} className="btn-secondary">
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || (needsAsset && !assetId)}
            className={cn('btn-primary', !isApprove && '!bg-red-600 hover:!bg-red-700')}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isApprove ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                Reject
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
