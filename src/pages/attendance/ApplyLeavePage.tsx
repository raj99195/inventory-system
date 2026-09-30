import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Info, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { applyLeave, useLeaveBalance } from '@/hooks/useLeaves';
import { useAttendanceSettings } from '@/hooks/useAttendanceSettings';
import { todayKey, daysBetween } from '@/lib/attendance/datetime';
import { cn } from '@/lib/utils';


export default function ApplyLeavePage() {
  const { userDoc } = useAuth();
  const { can } = usePermission();
  const nav = useNavigate();
  const uid = userDoc?.uid ?? '';

  const { settings, loading: settingsLoading, error: settingsError } = useAttendanceSettings();
  const leaveTypes = settings.leaveTypes ?? [];

  const [type, setType] = useState<string>(leaveTypes[0]?.code ?? 'CL');
  const [from, setFrom] = useState<string>(todayKey());
  const [to, setTo] = useState<string>(todayKey());
  const [reason, setReason] = useState('');
  const [halfDay, setHalfDay] = useState(false);
  const [busy, setBusy] = useState(false);
  const { balance, loading: balanceLoading, error: balanceError } = useLeaveBalance(uid || null, Number(from.slice(0, 4)) || new Date().getFullYear());
  useEffect(() => {
    if (!leaveTypes.some((item) => item.code === type)) setType(leaveTypes[0]?.code ?? '');
  }, [leaveTypes, type]);

  if (!can('leaves.applyOwn')) {
    return <Navigate to="/" replace />;
  }

  if (settingsError || balanceError) return <p role="alert">Unable to load leave settings or balances. Check your connection and reload.</p>;
  if (settingsLoading || balanceLoading) return <p>Loading leave policy…</p>;

  const days = halfDay ? 0.5 : daysBetween(from, to);
  const avail = balance?.balances?.[type] ?? leaveTypes.find((item) => item.code === type)?.default ?? 0;
  const selectedType = leaveTypes.find((t) => t.code === type);
  const maxDays = selectedType?.maxDaysPerApplication ?? 3;
  const overQuota = days > avail;
  const overLimit = days > maxDays;

  const onFromChange = (val: string) => {
    setFrom(val);
    if (halfDay) { setTo(val); return; }
    if (!val) return;
    const maxTo = new Date(val);
    maxTo.setDate(maxTo.getDate() + maxDays - 1);
    const maxToStr = maxTo.toISOString().slice(0, 10);
    if (new Date(to) > maxTo) setTo(maxToStr);
    if (new Date(val) > new Date(to)) setTo(val);
  };

  const maxToDate = (() => {
    if (!from) return undefined;
    const d = new Date(from);
    d.setDate(d.getDate() + maxDays - 1);
    return d.toISOString().slice(0, 10);
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || settingsLoading || balanceLoading || !selectedType) return;
    if (days < 0.5 || from.slice(0, 4) !== to.slice(0, 4)) return toast.error('Choose dates within the same calendar year.');
    if (overLimit) {
      return toast.error(
        `Max ${maxDays} days per application. Split longer leaves.`
      );
    }
    if (overQuota) {
      return toast.error(`You only have ${avail} ${type} days available`);
    }
    if (!uid) return;
    setBusy(true);
    try {
      await applyLeave({ userId: uid, leaveType: type, fromDate: from, toDate: halfDay ? from : to, reason, halfDay });
      toast.success('Leave application submitted');
      nav('/attendance/leaves');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => nav(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-brand-choco-soft hover:text-brand-choco"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <form onSubmit={submit} className="card !p-5 sm:!p-6 space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-choco">Apply for Leave</h1>
          <p className="text-sm text-brand-choco-soft mt-1">
            Choose a leave type, pick dates, and add a reason for your manager.
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold mb-2 block">Leave Type</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {leaveTypes.map((t) => {
              const isActive = type === t.code;
              const bal = balance?.balances?.[t.code] ?? t.default;
              return (
                <button
                  type="button"
                  key={t.code}
                  onClick={() => setType(t.code)}
                  className={cn(
                    'rounded-2xl border p-3 text-left transition',
                    isActive
                      ? 'border-brand-orange bg-brand-orange-50 ring-2 ring-brand-orange-100'
                      : 'border-brand-choco/10 hover:border-brand-choco/25'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: t.colorHex }}
                    />
                    <div className="text-xs font-bold text-brand-choco">{t.code}</div>
                  </div>
                  <div className="text-[11px] text-brand-choco-soft leading-tight mt-0.5 line-clamp-2">
                    {t.name}
                  </div>
                  <div className="text-[10px] text-brand-choco-soft mt-1">
                    Balance: <b className="text-brand-choco">{bal}</b>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={halfDay} onChange={(e) => { setHalfDay(e.target.checked); if (e.target.checked) setTo(from); }} />Half day (0.5 day)</label>
        <p className="text-xs text-brand-choco-soft">CL, SL and EL earn 0.5 day each per completed month after joining, within January–December.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold mb-1.5 block">From</label>
            <input
              type="date"
              required
              className="input-field"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">To</label>
            <input
              type="date"
              required
              className="input-field"
              value={to}
              min={from}
              max={maxToDate}
              disabled={halfDay}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <p className="text-[11px] text-brand-choco-soft flex items-center gap-1 -mt-2">
          <Info className="w-3 h-3" />
          Max {maxDays} days per application. Split longer leaves into separate
          requests.
        </p>

        <div>
          <label className="text-sm font-semibold mb-1.5 block">Reason</label>
          <textarea
            rows={3}
            className="input-field resize-none"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Add context for your manager…"
            required
          />
        </div>

        <div
          className={cn(
            'rounded-2xl p-4 border',
            overQuota || overLimit
              ? 'border-red-200 bg-red-50'
              : 'border-brand-choco/10 bg-brand-cream-dark/40'
          )}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm text-brand-choco">
              Applying for <b>{days}</b> day{days > 1 ? 's' : ''} of{' '}
              <b>{selectedType?.name ?? type}</b>
            </div>
            {overLimit && (
              <div className="text-xs font-semibold text-red-600">
                Max {maxDays} days allowed
              </div>
            )}
            {!overLimit && overQuota && (
              <div className="text-xs font-semibold text-red-600">Insufficient balance</div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => nav(-1)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || settingsLoading || balanceLoading || overQuota || overLimit || !selectedType || days < 0.5}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
