import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Search, Loader2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEmployees } from '@/hooks/useEmployees';
import { transferAsset } from '@/hooks/useAssignments';
import type { Asset, Employee } from '@/types';

interface Props {
  asset: Asset;
  fromEmployee: Employee;
  onClose: () => void;
}

export default function TransferForm({ asset, fromEmployee, onClose }: Props) {
  const { employees } = useEmployees();
  const [toEmployee, setToEmployee] = useState<Employee | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const targetOptions = useMemo(() => {
    const list = employees.filter(
      (e) => e.status === 'active' && e.id !== fromEmployee.id
    );
    if (!empSearch) return list.slice(0, 15);
    const q = empSearch.toLowerCase();
    return list
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [employees, empSearch, fromEmployee.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmployee) return toast.error('Select target employee');

    setSaving(true);
    try {
      await transferAsset({
        asset,
        fromEmployee,
        toEmployee,
        remarks,
      });
      toast.success(`${asset.assetId} transferred to ${toEmployee.name}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {/* Transfer flow */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="p-3 rounded-2xl bg-pastel-peach border border-pastel-peach-deep/30">
          <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
            From
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center text-white font-bold text-xs">
              {fromEmployee.name.charAt(0)}
            </div>
            <p className="font-bold text-sm truncate">{fromEmployee.name}</p>
          </div>
        </div>
        <ArrowRight className="w-6 h-6 text-brand-orange" />
        <div className="p-3 rounded-2xl bg-pastel-green border border-pastel-green-deep/30">
          <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
            To
          </p>
          <div className="flex items-center gap-2 mt-1">
            {toEmployee ? (
              <>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center text-white font-bold text-xs">
                  {toEmployee.name.charAt(0)}
                </div>
                <p className="font-bold text-sm truncate">{toEmployee.name}</p>
              </>
            ) : (
              <p className="text-sm text-brand-choco-soft">Select below</p>
            )}
          </div>
        </div>
      </div>

      {/* Asset info */}
      <div className="p-3 rounded-2xl bg-brand-cream-dark/50 flex items-center gap-3">
        <p className="text-xs text-brand-choco-soft">Asset:</p>
        <p className="text-sm font-bold text-brand-orange">{asset.assetId}</p>
        <p className="text-sm font-semibold truncate">{asset.name}</p>
      </div>

      {/* Target employee picker */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-semibold mb-2">
          <Users className="w-3.5 h-3.5 text-brand-choco-soft" />
          Transfer to Employee <span className="text-red-500">*</span>
        </label>
        {toEmployee ? (
          <div className="p-3 rounded-2xl bg-brand-cream-dark flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center text-white font-bold">
              {toEmployee.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-brand-orange">
                {toEmployee.employeeId}
              </p>
              <p className="font-bold truncate">{toEmployee.name}</p>
              <p className="text-xs text-brand-choco-soft">
                {toEmployee.designation} · {toEmployee.department}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToEmployee(null)}
              className="text-xs font-semibold text-brand-choco-soft hover:text-brand-orange"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
              <input
                autoFocus
                type="text"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="input-field pl-11"
                placeholder="Search employees..."
              />
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 border border-brand-choco/8 rounded-2xl p-2">
              {targetOptions.length === 0 ? (
                <p className="text-sm text-brand-choco-soft text-center py-4">
                  No employees found
                </p>
              ) : (
                targetOptions.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setToEmployee(e)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-brand-cream-dark text-left transition"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center text-white font-bold text-sm">
                      {e.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{e.name}</p>
                      <p className="text-xs text-brand-choco-soft">
                        {e.designation} · {e.department}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Remarks */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Reason / Remarks
        </label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={2}
          className="input-field resize-none"
          placeholder="Why is this transfer happening?"
        />
      </div>

      {toEmployee && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 rounded-2xl bg-brand-orange-100 border border-brand-orange/30 text-sm"
        >
          Asset condition, warranty and history will be preserved. Only ownership
          changes.
        </motion.div>
      )}

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
          disabled={saving || !toEmployee}
          className="btn-primary flex-1 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Transferring...
            </>
          ) : (
            'Confirm Transfer'
          )}
        </button>
      </div>
    </form>
  );
}
