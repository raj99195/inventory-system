import { useEffect, useState } from 'react';
import {
  Laptop,
  Hash,
  Tag,
  Layers,
  Barcode,
  IndianRupee,
  Calendar,
  Shield,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { z } from 'zod';
import type { Asset, AssetStatus, AssetCondition } from '@/types';
import {
  createAsset,
  updateAsset,
  generateAssetIdStr,
} from '@/hooks/useAssets';
import { cn } from '@/lib/utils';

const assetSchema = z.object({
  assetId: z.string().min(2, 'Asset ID required'),
  name: z.string().min(2, 'Name too short'),
  category: z.string().min(1, 'Category required'),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().min(1, 'Serial number required'),
  purchaseDate: z.string().min(1, 'Purchase date required'),
  purchaseCost: z.number().min(0, 'Must be ≥ 0'),
  warrantyStart: z.string().optional(),
  warrantyEnd: z.string().optional(),
  condition: z.enum(['new', 'good', 'fair', 'poor']),
  status: z.enum([
    'available',
    'assigned',
    'under-repair',
    'damaged',
    'lost',
    'retired',
    'disposed',
  ]),
  remarks: z.string().optional(),
});

type FormData = z.infer<typeof assetSchema>;

interface Props {
  asset?: Asset | null;
  onClose: () => void;
  onSaved?: () => void;
}

const ASSET_CATEGORIES = [
  'Laptop',
  'Desktop',
  'Monitor',
  'Mobile',
  'Keyboard',
  'Mouse',
  'VR Headset',
  'Camera',
  'Tools',
  'Office Equipment',
  'Development Equipment',
  'Networking',
  'Other',
];

export default function AssetForm({ asset, onClose, onSaved }: Props) {
  const isEdit = !!asset;
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {}
  );

  const [form, setForm] = useState<FormData>({
    assetId: asset?.assetId ?? '',
    name: asset?.name ?? '',
    category: asset?.category ?? '',
    brand: asset?.brand ?? '',
    model: asset?.model ?? '',
    serialNumber: asset?.serialNumber ?? '',
    purchaseDate: asset?.purchaseDate ?? new Date().toISOString().slice(0, 10),
    purchaseCost: asset?.purchaseCost ?? 0,
    warrantyStart: asset?.warrantyStart ?? '',
    warrantyEnd: asset?.warrantyEnd ?? '',
    condition: asset?.condition ?? 'new',
    status: asset?.status ?? 'available',
    remarks: asset?.remarks ?? '',
  });

  useEffect(() => {
    if (isEdit || form.assetId) return;
    generateAssetIdStr().then((id) =>
      setForm((f) => ({ ...f, assetId: id }))
    );
  }, [isEdit, form.assetId]);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = assetSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormData, string>> = {};
      parsed.error.issues.forEach((i) => {
        const key = i.path[0] as keyof FormData;
        errs[key] = i.message;
      });
      setErrors(errs);
      toast.error('Please fix the errors below');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && asset) {
        await updateAsset(asset.id, parsed.data, {
          name: asset.name,
          status: asset.status,
          condition: asset.condition,
        });
        toast.success('Asset updated');
      } else {
        await createAsset(parsed.data);
        toast.success('Asset registered');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {/* Basic */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Asset ID" icon={Hash} error={errors.assetId} required>
          <input
            type="text"
            value={form.assetId}
            onChange={(e) => set('assetId', e.target.value)}
            className="input-field"
            placeholder="Auto-generated"
          />
        </Field>

        <Field label="Asset Name" icon={Laptop} error={errors.name} required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="input-field"
            placeholder="e.g. Dell Precision 5570"
          />
        </Field>

        <Field label="Category" icon={Layers} error={errors.category} required>
          <input
            type="text"
            list="asset-categories"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="input-field"
            placeholder="Select or type"
          />
          <datalist id="asset-categories">
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field label="Brand" icon={Tag}>
          <input
            type="text"
            value={form.brand}
            onChange={(e) => set('brand', e.target.value)}
            className="input-field"
            placeholder="e.g. Dell"
          />
        </Field>

        <Field label="Model">
          <input
            type="text"
            value={form.model}
            onChange={(e) => set('model', e.target.value)}
            className="input-field"
            placeholder="e.g. Precision 5570"
          />
        </Field>

        <Field label="Serial Number" icon={Barcode} error={errors.serialNumber} required>
          <input
            type="text"
            value={form.serialNumber}
            onChange={(e) => set('serialNumber', e.target.value)}
            className="input-field"
            placeholder="e.g. DELL-784521"
          />
        </Field>
      </div>

      {/* Purchase & warranty */}
      <div className="p-4 rounded-2xl bg-brand-cream-dark/50">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-3">
          Purchase & Warranty
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Purchase Date" icon={Calendar} error={errors.purchaseDate} required>
            <input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => set('purchaseDate', e.target.value)}
              className="input-field"
            />
          </Field>

          <Field label="Purchase Cost" icon={IndianRupee} error={errors.purchaseCost}>
            <input
              type="number"
              step="0.01"
              value={form.purchaseCost}
              onChange={(e) => set('purchaseCost', +e.target.value)}
              className="input-field"
            />
          </Field>

          <Field label="Warranty Start" icon={Shield}>
            <input
              type="date"
              value={form.warrantyStart}
              onChange={(e) => set('warrantyStart', e.target.value)}
              className="input-field"
            />
          </Field>

          <Field label="Warranty End" icon={Shield}>
            <input
              type="date"
              value={form.warrantyEnd}
              onChange={(e) => set('warrantyEnd', e.target.value)}
              className="input-field"
            />
          </Field>
        </div>
      </div>

      {/* Condition & Status */}
      <div className="p-4 rounded-2xl bg-brand-cream-dark/50">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-3">
          Condition & Status
        </p>
        <div className="space-y-4">
          <Field label="Condition">
            <div className="grid grid-cols-4 gap-2">
              {(['new', 'good', 'fair', 'poor'] as AssetCondition[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('condition', c)}
                  className={cn(
                    'py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all',
                    form.condition === c
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
          </Field>

          <Field label="Status">
            <div className="grid grid-cols-4 gap-2">
              {(
                ['available', 'assigned', 'under-repair', 'damaged', 'lost', 'retired', 'disposed'] as AssetStatus[]
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status', s)}
                  className={cn(
                    'py-2 rounded-2xl text-[10px] font-bold uppercase tracking-wide transition-all',
                    form.status === s
                      ? s === 'available'
                        ? 'bg-pastel-green text-green-800'
                        : s === 'assigned'
                        ? 'bg-pastel-blue text-blue-800'
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
          </Field>
        </div>
      </div>

      <Field label="Remarks" icon={FileText}>
        <textarea
          value={form.remarks}
          onChange={(e) => set('remarks', e.target.value)}
          rows={3}
          className="input-field resize-none"
          placeholder="Any additional notes..."
        />
      </Field>

      <div className="flex gap-3 pt-4 border-t border-brand-choco/8 sticky bottom-0 bg-white -mx-6 px-6 pb-2">
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
              Saving...
            </>
          ) : (
            <>{isEdit ? 'Update Asset' : 'Register Asset'}</>
          )}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  icon: Icon,
  error,
  required,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold mb-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-brand-choco-soft" />}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}
