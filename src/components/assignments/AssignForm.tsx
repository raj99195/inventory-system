import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Laptop,
  Users,
  Search,
  Loader2,
  UserCheck,
  Package,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAssets } from '@/hooks/useAssets';
import { useEmployees } from '@/hooks/useEmployees';
import { assignAsset } from '@/hooks/useAssignments';
import type { Asset, Employee, AssetCondition } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  onClose: () => void;
  presetAsset?: Asset | null;
  presetEmployee?: Employee | null;
}

export default function AssignForm({
  onClose,
  presetAsset,
  presetEmployee,
}: Props) {
  const { assets } = useAssets();
  const { employees } = useEmployees();
  const [asset, setAsset] = useState<Asset | null>(presetAsset ?? null);
  const [employee, setEmployee] = useState<Employee | null>(presetEmployee ?? null);
  const [condition, setCondition] = useState<AssetCondition>(
    presetAsset?.condition ?? 'good'
  );
  const [accessories, setAccessories] = useState('');
  const [remarks, setRemarks] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const availableAssets = useMemo(() => {
    const list = assets.filter((a) => a.status === 'available');
    if (!assetSearch) return list.slice(0, 15);
    const q = assetSearch.toLowerCase();
    return list
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.assetId.toLowerCase().includes(q) ||
          a.serialNumber.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [assets, assetSearch]);

  const activeEmployees = useMemo(() => {
    const list = employees.filter((e) => e.status === 'active');
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
  }, [employees, empSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return toast.error('Select an asset');
    if (!employee) return toast.error('Select an employee');

    setSaving(true);
    try {
      await assignAsset({
        asset,
        employee,
        conditionAtAssign: condition,
        accessories: accessories
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        remarks,
      });
      toast.success(`${asset.assetId} assigned to ${employee.name}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {/* Asset picker */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-semibold mb-2">
          <Laptop className="w-3.5 h-3.5 text-brand-choco-soft" />
          Select Asset <span className="text-red-500">*</span>
        </label>
        {asset ? (
          <div className="p-4 rounded-2xl bg-pastel-blue border border-pastel-blue-deep/30 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center">
              <Laptop className="w-5 h-5 text-brand-orange" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-brand-orange">
                {asset.assetId}
              </p>
              <p className="font-bold truncate">{asset.name}</p>
              <p className="text-xs text-brand-choco-soft">
                {asset.brand} · SN: {asset.serialNumber}
              </p>
            </div>
            {!presetAsset && (
              <button
                type="button"
                onClick={() => setAsset(null)}
                className="text-xs font-semibold text-brand-choco-soft hover:text-brand-orange"
              >
                Change
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
              <input
                type="text"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="input-field pl-11"
                placeholder="Search available assets..."
              />
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 border border-brand-choco/8 rounded-2xl p-2">
              {availableAssets.length === 0 ? (
                <p className="text-sm text-brand-choco-soft text-center py-4">
                  No available assets found
                </p>
              ) : (
                availableAssets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAsset(a);
                      setCondition(a.condition);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-brand-cream-dark text-left transition"
                  >
                    <div className="w-10 h-10 rounded-lg bg-brand-cream-dark flex items-center justify-center shrink-0">
                      <Laptop className="w-4 h-4 text-brand-orange" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{a.name}</p>
                      <p className="text-xs text-brand-orange">
                        {a.assetId} · {a.category}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Employee picker */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-semibold mb-2">
          <Users className="w-3.5 h-3.5 text-brand-choco-soft" />
          Assign To <span className="text-red-500">*</span>
        </label>
        {employee ? (
          <div className="p-4 rounded-2xl bg-pastel-green border border-pastel-green-deep/30 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center text-white font-bold">
              {employee.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-brand-orange">
                {employee.employeeId}
              </p>
              <p className="font-bold truncate">{employee.name}</p>
              <p className="text-xs text-brand-choco-soft">
                {employee.designation} · {employee.department}
              </p>
            </div>
            {!presetEmployee && (
              <button
                type="button"
                onClick={() => setEmployee(null)}
                className="text-xs font-semibold text-brand-choco-soft hover:text-brand-orange"
              >
                Change
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
              <input
                type="text"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="input-field pl-11"
                placeholder="Search active employees..."
              />
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 border border-brand-choco/8 rounded-2xl p-2">
              {activeEmployees.length === 0 ? (
                <p className="text-sm text-brand-choco-soft text-center py-4">
                  No active employees found
                </p>
              ) : (
                activeEmployees.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEmployee(e)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-brand-cream-dark text-left transition"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center text-white font-bold text-sm">
                      {e.name.charAt(0).toUpperCase()}
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

      {/* Condition */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Condition at Assignment
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(['new', 'good', 'fair', 'poor'] as AssetCondition[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCondition(c)}
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

      {/* Accessories */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-semibold mb-2">
          <Package className="w-3.5 h-3.5 text-brand-choco-soft" />
          Accessories Included
        </label>
        <input
          type="text"
          value={accessories}
          onChange={(e) => setAccessories(e.target.value)}
          className="input-field"
          placeholder="Charger, Mouse, Bag (comma separated)"
        />
      </div>

      {/* Remarks */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-semibold mb-2">
          <Tag className="w-3.5 h-3.5 text-brand-choco-soft" />
          Remarks
        </label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={2}
          className="input-field resize-none"
          placeholder="Any notes..."
        />
      </div>

      {/* Summary preview */}
      {asset && employee && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-2xl bg-brand-orange-100 border border-brand-orange/30 flex items-center gap-3"
        >
          <UserCheck className="w-5 h-5 text-brand-orange shrink-0" />
          <p className="text-sm">
            <span className="font-bold">{asset.assetId}</span> ({asset.name}){' '}
            will be assigned to{' '}
            <span className="font-bold">{employee.name}</span>.
          </p>
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
          disabled={saving || !asset || !employee}
          className="btn-primary flex-1 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Assigning...
            </>
          ) : (
            'Assign Asset'
          )}
        </button>
      </div>
    </form>
  );
}
