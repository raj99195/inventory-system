import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  IndianRupee,
  Hash,
  Layers,
  Tag,
  Ruler,
  Percent,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { z } from 'zod';
import type { Product, ProductStatus } from '@/types';
import { createProduct, updateProduct, generateSku } from '@/hooks/useProducts';
import { useCategories, createCategory } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

const productSchema = z.object({
  name: z.string().min(2, 'Name too short').max(100),
  sku: z.string().min(2, 'SKU required'),
  category: z.string().min(1, 'Category required'),
  brand: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().min(1, 'Unit required'),
  purchasePrice: z.number().min(0, 'Must be ≥ 0'),
  sellingPrice: z.number().min(0, 'Must be ≥ 0'),
  gstPercent: z.number().min(0).max(100),
  minStockLevel: z.number().int().min(0),
  currentStock: z.number().int().min(0),
  status: z.enum(['active', 'inactive', 'discontinued']),
});

type FormData = z.infer<typeof productSchema>;

interface Props {
  product?: Product | null;
  onClose: () => void;
  onSaved?: () => void;
}

const UNITS = ['pcs', 'box', 'kg', 'gm', 'ltr', 'ml', 'mtr', 'set', 'pair'];

export default function ProductForm({ product, onClose, onSaved }: Props) {
  const isEdit = !!product;
  const { categories } = useCategories();
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {}
  );

  const [form, setForm] = useState<FormData>({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    category: product?.category ?? '',
    brand: product?.brand ?? '',
    description: product?.description ?? '',
    unit: product?.unit ?? 'pcs',
    purchasePrice: product?.purchasePrice ?? 0,
    sellingPrice: product?.sellingPrice ?? 0,
    gstPercent: product?.gstPercent ?? 18,
    minStockLevel: product?.minStockLevel ?? 10,
    currentStock: product?.currentStock ?? 0,
    status: product?.status ?? 'active',
  });

  // Auto-generate SKU when category changes for new product
  useEffect(() => {
    if (isEdit || !form.category || form.sku) return;
    generateSku(form.category).then((sku) =>
      setForm((f) => ({ ...f, sku }))
    );
  }, [form.category, isEdit, form.sku]);

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleNewCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await createCategory(newCatName.trim());
      set('category', newCatName.trim());
      setNewCatName('');
      setShowNewCat(false);
      toast.success('Category added');
    } catch {
      toast.error('Failed to add category');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = productSchema.safeParse(form);
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
      if (isEdit && product) {
        await updateProduct(
          product.id,
          parsed.data,
          {
            name: product.name,
            sellingPrice: product.sellingPrice,
            currentStock: product.currentStock,
          }
        );
        toast.success('Product updated');
      } else {
        await createProduct(parsed.data);
        toast.success('Product created');
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
      {/* Basic info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Product Name"
          icon={Package}
          error={errors.name}
          required
        >
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="input-field"
            placeholder="e.g. VR Controller"
          />
        </Field>

        <Field label="SKU / Product Code" icon={Hash} error={errors.sku} required>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => set('sku', e.target.value)}
            className="input-field"
            placeholder="Auto-generated"
          />
        </Field>

        <Field label="Category" icon={Layers} error={errors.category} required>
          <div className="flex gap-2">
            <select
              value={form.category}
              onChange={(e) => {
                if (e.target.value === '__new') setShowNewCat(true);
                else set('category', e.target.value);
              }}
              className="input-field flex-1"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              <option value="__new">➕ Add new category</option>
            </select>
          </div>
          {showNewCat && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 flex gap-2"
            >
              <input
                autoFocus
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNewCategory())}
                className="input-field flex-1"
                placeholder="New category name"
              />
              <button
                type="button"
                onClick={handleNewCategory}
                className="btn-primary px-4"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowNewCat(false)}
                className="btn-secondary px-4"
              >
                Cancel
              </button>
            </motion.div>
          )}
        </Field>

        <Field label="Brand" icon={Tag}>
          <input
            type="text"
            value={form.brand}
            onChange={(e) => set('brand', e.target.value)}
            className="input-field"
            placeholder="e.g. Sony"
          />
        </Field>

        <Field label="Unit" icon={Ruler} error={errors.unit} required>
          <select
            value={form.unit}
            onChange={(e) => set('unit', e.target.value)}
            className="input-field"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <div className="grid grid-cols-3 gap-2">
            {(['active', 'inactive', 'discontinued'] as ProductStatus[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status', s)}
                  className={cn(
                    'py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all',
                    form.status === s
                      ? s === 'active'
                        ? 'bg-pastel-green text-green-800'
                        : s === 'inactive'
                        ? 'bg-pastel-peach text-orange-800'
                        : 'bg-pastel-pink text-red-800'
                      : 'bg-brand-cream-dark text-brand-choco-soft hover:bg-brand-cream-deep'
                  )}
                >
                  {s}
                </button>
              )
            )}
          </div>
        </Field>
      </div>

      {/* Pricing */}
      <div className="p-4 rounded-2xl bg-brand-cream-dark/50">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-3">
          Pricing & Tax
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Purchase Price" icon={IndianRupee} error={errors.purchasePrice}>
            <input
              type="number"
              step="0.01"
              value={form.purchasePrice}
              onChange={(e) => set('purchasePrice', +e.target.value)}
              className="input-field"
            />
          </Field>
          <Field label="Selling Price" icon={IndianRupee} error={errors.sellingPrice}>
            <input
              type="number"
              step="0.01"
              value={form.sellingPrice}
              onChange={(e) => set('sellingPrice', +e.target.value)}
              className="input-field"
            />
          </Field>
          <Field label="GST %" icon={Percent} error={errors.gstPercent}>
            <input
              type="number"
              value={form.gstPercent}
              onChange={(e) => set('gstPercent', +e.target.value)}
              className="input-field"
            />
          </Field>
        </div>
      </div>

      {/* Stock */}
      <div className="p-4 rounded-2xl bg-brand-cream-dark/50">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-3">
          Stock Levels
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Current Stock" error={errors.currentStock}>
            <input
              type="number"
              value={form.currentStock}
              onChange={(e) => set('currentStock', +e.target.value)}
              className="input-field"
              disabled={isEdit}
            />
            {isEdit && (
              <p className="text-xs text-brand-choco-soft mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Edit stock via Stock Movement to keep audit trail
              </p>
            )}
          </Field>
          <Field label="Minimum Stock Alert" error={errors.minStockLevel}>
            <input
              type="number"
              value={form.minStockLevel}
              onChange={(e) => set('minStockLevel', +e.target.value)}
              className="input-field"
            />
          </Field>
        </div>
      </div>

      {/* Description */}
      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
          className="input-field resize-none"
          placeholder="Optional product description..."
        />
      </Field>

      {/* Actions */}
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
            <>{isEdit ? 'Update Product' : 'Create Product'}</>
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