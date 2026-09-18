import { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { returnAsset } from '@/hooks/useAssignments';
import type { Asset, Employee, AssetCondition, AssetStatus } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  asset: Asset;
  employee: Employee;
  onClose: () => void;
}

export default function ReturnForm({ asset, employee, onClose }: Props) {
  const [condition, setCondition] = useState<AssetCondition>('good');
  const [newStatus, setNewStatus] = useState<AssetStatus>('available');
  const [receivedBy, setReceivedBy] = useState('');
  const [accessories, setAccessories] = useState('');
  const [damageDetails, setDamageDetails] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-suggest new status based on condition
  const suggestStatus = (c: AssetCondition): AssetStatus => {
    if (c === 'poor') return 'damaged';
    if (c === 'fair') return 'under-repair';
    return 'available';
  };

  const handleConditionChange = (c: AssetCondition) => {
    setCondition(c);
    setNewStatus(suggestStatus(c));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivedBy.trim()) return toast.error('Enter received by');

    setSaving(true);
    try {
      await returnAsset({
        asset,
        employee,
        conditionAtReturn: condition,
        newStatus,
        receivedBy,
        accessories: accessories
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        damageDetails,
        remarks,
      });
      toast.success(`${asset.assetId} returned`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {/* Summary */}
      <div className="p-4 rounded-2xl bg-brand-cream-dark/50 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center">
          <RotateCcw className="w-5 h-5 text-brand-orange" />
        </div>
        <div>
          <p className="text-xs font-bold text-brand-orange">{asset.assetId}</p>
          <p className="font-bold">{asset.name}</p>
          <p className="text-xs text-brand-choco-soft">
            Returning from <span className="font-semibold">{employee.name}</span>
          </p>
        </div>
      </div>

      {/* Condition */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Condition at Return <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(['new', 'good', 'fair', 'poor'] as AssetCondition[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleConditionChange(c)}
              className={cn(
                'py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all',
                condition === c
                  ? c === 'new'
                    ? 'bg-pastel-green text-green-800'
                    : c === 'good'
                    ? 'bg-pastel-blue text-blue-800'
                    : c === 'fair'
                    ? 'bg-pastel-peach text-orange-800'
                    : 'bg-pastel-pink text-red-800'
                  : 'bg-brand-cream-dark text-brand-choco-soft hover:bg-brand-cream-deep'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* New status */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Move Asset To <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['available', 'under-repair', 'damaged'] as AssetStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setNewStatus(s)}
              className={cn(
                'py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all',
                newStatus === s
                  ? s === 'available'
                    ? 'bg-pastel-green text-green-800'
                    : s === 'under-repair'
                    ? 'bg-pastel-peach text-orange-800'
                    : 'bg-pastel-pink text-red-800'
                  : 'bg-brand-cream-dark text-brand-choco-soft hover:bg-brand-cream-deep'
              )}
            >
              {s.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Received by */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Received By <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={receivedBy}
          onChange={(e) => setReceivedBy(e.target.value)}
          className="input-field"
          placeholder="Name of person receiving"
        />
      </div>

      {/* Accessories */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Accessories Returned
        </label>
        <input
          type="text"
          value={accessories}
          onChange={(e) => setAccessories(e.target.value)}
          className="input-field"
          placeholder="Charger, Mouse, Bag (comma separated)"
        />
      </div>

      {/* Damage details */}
      {(condition === 'fair' || condition === 'poor') && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <label className="flex items-center gap-1.5 text-sm font-semibold mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
            Damage / Issue Details
          </label>
          <textarea
            value={damageDetails}
            onChange={(e) => setDamageDetails(e.target.value)}
            rows={2}
            className="input-field resize-none"
            placeholder="Describe the damage or issue..."
          />
        </motion.div>
      )}

      {/* Remarks */}
      <div>
        <label className="block text-sm font-semibold mb-2">Remarks</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={2}
          className="input-field resize-none"
          placeholder="Any notes..."
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-brand-choco/8">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex-1 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Confirm Return'
          )}
        </button>
      </div>
    </form>
  );
}
