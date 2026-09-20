import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Package,
  Boxes,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Layers,
  Search,
  Link2,
  IndianRupee,
  ArrowDown,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { z } from 'zod';
import type { Kit, KitComponent, Product } from '@/types';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import {
  createKit,
  updateKit,
  generateKitSku,
  assembleMoreKits,
} from '@/hooks/useKits';
import { cn, formatINR } from '@/lib/utils';

// ---------- Common Units ----------
const UNIT_OPTIONS = [
  'pcs',
  'box',
  'set',
  'pair',
  'm',
  'cm',
  'kg',
  'g',
  'litre',
  'ml',
  'roll',
  'pack',
];

// ---------- Validation ----------
const kitSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  sku: z.string().min(1, 'SKU is required'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  sellingPrice: z.number().min(0, 'Price cannot be negative'),
  gstPercent: z.number().min(0).max(100),
  status: z.enum(['active', 'inactive', 'discontinued']),
});

interface Props {
  kit: Kit | null;
  onClose: () => void;
}

export default function KitForm({ kit, onClose }: Props) {
  const { categories } = useCategories();
  const { products } = useProducts();

  const [name, setName] = useState(kit?.name ?? '');
  const [sku, setSku] = useState(kit?.sku ?? '');
  const [category, setCategory] = useState(kit?.category ?? 'DIY Kit');
  const [description, setDescription] = useState(kit?.description ?? '');
  const [sellingPrice, setSellingPrice] = useState<number>(
    kit?.sellingPrice ?? 0
  );
  const [gstPercent, setGstPercent] = useState<number>(kit?.gstPercent ?? 18);
  const [status, setStatus] = useState<Kit['status']>(kit?.status ?? 'active');
  const [components, setComponents] = useState<KitComponent[]>(
    kit?.components ?? []
  );

  // 🚀 Initial batch qty — for a new kit this is how many pre-assembled units to build
  //    For an existing kit, this becomes the "Assemble more" quantity
  const [initialBatchQty, setInitialBatchQty] = useState<number>(1);

  // Manual/picker entry state
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState<number>(1);
  const [newUnit, setNewUnit] = useState<string>('pcs');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newRemarks, setNewRemarks] = useState('');
  const [linkedProduct, setLinkedProduct] = useState<Product | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [assembling, setAssembling] = useState(false);

  // Live product map for stock lookups
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  // Auto-generate SKU on first render for new kit
  useEffect(() => {
    if (!kit && !sku) {
      generateKitSku().then(setSku).catch(() => setSku('KIT-0001'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const suggestions = useMemo(() => {
    if (!newName || newName.length < 1) return [];
    const q = newName.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.brand?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 6);
  }, [products, newName]);

  const totals = useMemo(
    () => ({
      componentCount: components.length,
      totalPieces: components.reduce((sum, c) => sum + c.quantity, 0),
      componentCost: components.reduce(
        (sum, c) => sum + c.quantity * (c.price || 0),
        0
      ),
    }),
    [components]
  );

  const margin = sellingPrice - totals.componentCost;
  const marginPct =
    totals.componentCost > 0
      ? ((margin / totals.componentCost) * 100).toFixed(1)
      : '—';

  // 🚀 STOCK IMPACT ANALYSIS
  //    For each LINKED component, calculate what will be deducted from products stock
  //    and whether there's enough inventory available.
  const stockImpact = useMemo(() => {
    const rows = components.map((c) => {
      const linked = c.productId ? productMap.get(c.productId) : undefined;
      const isLinked = !!linked;
      const currentStock = linked?.currentStock ?? 0;
      const deductQty = c.quantity * Math.max(1, initialBatchQty);
      const insufficient = isLinked && currentStock < deductQty;
      const newStock = isLinked ? Math.max(0, currentStock - deductQty) : 0;
      return {
        name: c.name,
        isLinked,
        productSku: linked?.sku ?? c.productSku,
        currentStock,
        deductQty,
        newStock,
        insufficient,
      };
    });

    const linkedRows = rows.filter((r) => r.isLinked);
    const manualCount = rows.filter((r) => !r.isLinked).length;
    const insufficientCount = rows.filter((r) => r.insufficient).length;

    return {
      rows,
      linkedRows,
      linkedCount: linkedRows.length,
      manualCount,
      insufficientCount,
      hasBlocker: insufficientCount > 0,
    };
  }, [components, productMap, initialBatchQty]);

  const handleSelectProduct = (p: Product) => {
    setNewName(p.name);
    setNewUnit(p.unit);
    setNewPrice(p.sellingPrice);
    setLinkedProduct(p);
    setShowSuggestions(false);
  };

  const handleNameChange = (val: string) => {
    setNewName(val);
    setShowSuggestions(true);
    if (linkedProduct && val !== linkedProduct.name) {
      setLinkedProduct(null);
    }
  };

  const handleAddComponent = () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.error('Component name is required');
      return;
    }
    if (newQty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    const newComp: KitComponent = {
      name: trimmedName,
      quantity: newQty,
      unit: newUnit,
      price: newPrice,
      remarks: newRemarks.trim() || undefined,
      ...(linkedProduct && {
        productId: linkedProduct.id,
        productSku: linkedProduct.sku,
      }),
    };

    const existingIdx = components.findIndex(
      (c) =>
        c.name.toLowerCase() === trimmedName.toLowerCase() &&
        c.unit === newUnit
    );
    if (existingIdx >= 0) {
      const updated = [...components];
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: updated[existingIdx].quantity + newQty,
      };
      setComponents(updated);
      toast.success(`Merged with existing: ${trimmedName}`);
    } else {
      setComponents([...components, newComp]);
    }

    setNewName('');
    setNewQty(1);
    setNewUnit('pcs');
    setNewPrice(0);
    setNewRemarks('');
    setLinkedProduct(null);
    setShowSuggestions(false);
  };

  const handleUpdateComponent = (idx: number, patch: Partial<KitComponent>) => {
    const updated = [...components];
    updated[idx] = { ...updated[idx], ...patch };
    setComponents(updated);
  };

  const handleRemoveComponent = (idx: number) => {
    setComponents(components.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddComponent();
    }
  };

  const handleSubmit = async () => {
    const result = kitSchema.safeParse({
      name,
      sku,
      category,
      description,
      sellingPrice,
      gstPercent,
      status,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      toast.error('Please fix the errors below');
      return;
    }
    if (components.length === 0) {
      toast.error('Add at least one component to the kit');
      return;
    }

    // 🚀 Block create if any linked component has insufficient stock
    if (!kit && stockImpact.hasBlocker) {
      toast.error(
        `Insufficient stock for ${stockImpact.insufficientCount} component${
          stockImpact.insufficientCount > 1 ? 's' : ''
        }. Reduce batch size or restock products first.`,
        { duration: 5000 }
      );
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        category,
        description: description.trim(),
        components,
        componentCount: totals.componentCount,
        totalPieces: totals.totalPieces,
        componentCost: totals.componentCost,
        sellingPrice,
        gstPercent,
        status,
      };

      if (kit) {
        await updateKit(kit.id, payload, {
          name: kit.name,
          sku: kit.sku,
          category: kit.category,
          sellingPrice: kit.sellingPrice,
          componentCount: kit.componentCount,
          totalPieces: kit.totalPieces,
        });
        toast.success('Kit updated');
      } else {
        await createKit(
          payload as Omit<Kit, 'id' | 'createdAt' | 'updatedAt' | 'currentStock'>,
          { initialBatchQty }
        );
        toast.success(
          `Kit created — ${initialBatchQty} unit${initialBatchQty > 1 ? 's' : ''} assembled from stock`
        );
      }
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : kit ? 'Update failed' : 'Create failed';
      toast.error(msg, { duration: 6000 });
    } finally {
      setSaving(false);
    }
  };

  // 🚀 Assemble more units of an existing kit
  const handleAssembleMore = async () => {
    if (!kit) return;
    if (initialBatchQty <= 0) {
      toast.error('Enter a quantity greater than 0');
      return;
    }
    if (stockImpact.hasBlocker) {
      toast.error('Insufficient component stock. Restock first.');
      return;
    }

    setAssembling(true);
    try {
      await assembleMoreKits(kit, initialBatchQty);
      toast.success(
        `Assembled ${initialBatchQty} more unit${initialBatchQty > 1 ? 's' : ''}`
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Assembly failed';
      toast.error(msg, { duration: 6000 });
    } finally {
      setAssembling(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Basic Info */}
      <section className="space-y-4">
        <SectionHeader
          icon={Boxes}
          title="Kit Details"
          subtitle="Basic information about this kit"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Kit Name" error={errors.name} required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arduino Starter Kit"
              className="input-field"
            />
          </Field>

          <Field label="SKU" error={errors.sku} required>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              placeholder="KIT-0001"
              className="input-field font-mono"
            />
          </Field>

          <Field label="Category" error={errors.category} required>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="DIY Kit"
              className="input-field"
              list="kit-categories"
            />
            <datalist id="kit-categories">
              <option value="DIY Kit" />
              <option value="Robotics Kit" />
              <option value="Electronics Kit" />
              <option value="STEM Kit" />
              {categories.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </Field>

          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Kit['status'])}
              className="input-field"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's in this kit? Who is it for?"
            rows={2}
            className="input-field resize-none"
          />
        </Field>
      </section>

      {/* Pricing */}
      <section className="space-y-4">
        <SectionHeader
          icon={IndianRupee}
          title="Kit Pricing"
          subtitle="Selling price for the entire kit"
        />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Selling Price (₹)" error={errors.sellingPrice}>
            <input
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(Number(e.target.value))}
              placeholder="0"
              min={0}
              step={0.01}
              className="input-field"
            />
          </Field>

          <Field label="GST %" error={errors.gstPercent}>
            <input
              type="number"
              value={gstPercent}
              onChange={(e) => setGstPercent(Number(e.target.value))}
              placeholder="18"
              min={0}
              max={100}
              step={0.01}
              className="input-field"
            />
          </Field>
        </div>

        {/* Margin preview */}
        {totals.componentCost > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-pastel-blue border border-pastel-blue-deep/30">
              <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
                Component Cost
              </p>
              <p className="font-display font-bold text-base mt-0.5">
                {formatINR(totals.componentCost)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-pastel-peach border border-pastel-peach-deep/30">
              <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
                Selling Price
              </p>
              <p className="font-display font-bold text-base mt-0.5">
                {formatINR(sellingPrice)}
              </p>
            </div>
            <div
              className={cn(
                'p-3 rounded-xl border',
                margin >= 0
                  ? 'bg-pastel-green border-pastel-green-deep/30'
                  : 'bg-pastel-pink border-pastel-pink-deep/30'
              )}
            >
              <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
                Margin
              </p>
              <p className="font-display font-bold text-base mt-0.5">
                {formatINR(margin)}
                <span className="text-xs text-brand-choco-soft ml-1">
                  ({marginPct}%)
                </span>
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Components */}
      <section className="space-y-4">
        <SectionHeader
          icon={Boxes}
          title="Components"
          subtitle="Search from Products list OR type manually — set your own price"
        />

        {/* Entry row */}
        <div className="p-4 rounded-2xl bg-brand-cream-dark/50 border border-brand-choco/8 space-y-3">
          <div className="grid grid-cols-12 gap-2">
            {/* Name with product autocomplete */}
            <div className="col-span-12 md:col-span-5 relative" ref={suggestionRef}>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                Component Name / Search Product
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-choco-soft pointer-events-none" />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type name or search products..."
                  className="input-field pl-9"
                />
              </div>

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-brand-choco/12 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
                  >
                    {suggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-brand-cream-dark/70 border-b border-brand-choco/5 last:border-b-0 transition"
                      >
                        <Package className="w-4 h-4 text-brand-orange shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">
                            {p.name}
                          </p>
                          <p className="text-[10px] text-brand-choco-soft">
                            {p.sku} · Stock: {p.currentStock} · ₹
                            {p.sellingPrice}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-brand-orange">
                          Select
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Qty */}
            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                Qty
              </label>
              <input
                type="number"
                value={newQty}
                onChange={(e) => setNewQty(Number(e.target.value))}
                onKeyDown={handleKeyDown}
                min={1}
                className="input-field text-center"
              />
            </div>

            {/* Unit */}
            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                Unit
              </label>
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="input-field"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                Price (₹)
              </label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                onKeyDown={handleKeyDown}
                min={0}
                step={0.01}
                className="input-field"
              />
            </div>

            {/* Add button */}
            <div className="col-span-12 md:col-span-1 flex items-end">
              <button
                type="button"
                onClick={handleAddComponent}
                className="btn-primary w-full h-10 !px-0"
                title="Add component"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Remarks (optional) */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
              Remarks (optional)
            </label>
            <input
              type="text"
              value={newRemarks}
              onChange={(e) => setNewRemarks(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. color variant, brand, note..."
              className="input-field text-sm"
            />
          </div>

          <div className="flex items-center gap-3 text-[10px] text-brand-choco-soft flex-wrap">
            <span>
              Press{' '}
              <kbd className="px-1 py-0.5 rounded bg-white border border-brand-choco/10 font-mono text-[9px]">
                Enter
              </kbd>{' '}
              to quickly add
            </span>
            {linkedProduct && (
              <span className="flex items-center gap-1 text-brand-orange font-bold">
                <Link2 className="w-3 h-3" />
                Linked to {linkedProduct.sku}
              </span>
            )}
          </div>
        </div>

        {/* Components list */}
        {components.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-brand-choco/15 p-8 text-center">
            <Boxes className="w-10 h-10 text-brand-choco-soft/40 mx-auto mb-2" />
            <p className="text-sm text-brand-choco-soft">
              No components added yet. Search a product or type manually above.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-choco/8 overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              <AnimatePresence initial={false}>
                {components.map((c, idx) => (
                  <ComponentRow
                    key={`${c.name}-${c.unit}-${idx}`}
                    component={c}
                    index={idx}
                    isFirst={idx === 0}
                    linkedProduct={
                      c.productId ? productMap.get(c.productId) : undefined
                    }
                    batchQty={initialBatchQty}
                    onUpdate={(patch) => handleUpdateComponent(idx, patch)}
                    onRemove={() => handleRemoveComponent(idx)}
                  />
                ))}
              </AnimatePresence>
            </div>
            <div className="bg-brand-cream-dark px-4 py-3 border-t border-brand-choco/8 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold uppercase text-brand-choco-soft tracking-wider">
                Total
              </span>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-brand-orange" />
                  <span className="text-brand-orange">
                    {totals.componentCount}
                  </span>{' '}
                  components
                </span>
                <span className="w-px h-4 bg-brand-choco/15" />
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-brand-orange" />
                  <span className="text-brand-orange">
                    {totals.totalPieces}
                  </span>{' '}
                  pieces
                </span>
                <span className="w-px h-4 bg-brand-choco/15" />
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-brand-orange" />
                  <span className="text-brand-orange">
                    {formatINR(totals.componentCost)}
                  </span>{' '}
                  cost
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 🚀 ASSEMBLY / STOCK IMPACT */}
      {components.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={Sparkles}
            title={kit ? 'Assemble More Units' : 'Assembly & Stock Impact'}
            subtitle={
              kit
                ? `Currently ${kit.currentStock} unit${kit.currentStock === 1 ? '' : 's'} in stock — assemble more from component inventory`
                : 'Building the kit will deduct linked-product stock atomically'
            }
          />

          <div className="p-4 rounded-2xl bg-brand-cream-dark/50 border border-brand-choco/8 space-y-4">
            <Field
              label={
                kit ? 'Additional Quantity to Assemble' : 'Initial Batch Quantity'
              }
            >
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={initialBatchQty}
                  onChange={(e) =>
                    setInitialBatchQty(Math.max(1, Number(e.target.value) || 1))
                  }
                  min={1}
                  step={1}
                  className="input-field w-32 text-center font-bold text-lg"
                />
                <p className="text-xs text-brand-choco-soft">
                  {kit ? (
                    <>
                      Adds <b>{initialBatchQty}</b> to the kit's existing stock of{' '}
                      <b>{kit.currentStock}</b> — final total will be{' '}
                      <b className="text-brand-orange">
                        {kit.currentStock + initialBatchQty}
                      </b>
                    </>
                  ) : (
                    <>
                      Building <b>{initialBatchQty}</b> unit
                      {initialBatchQty === 1 ? '' : 's'} — components will be
                      deducted from product stock
                    </>
                  )}
                </p>
              </div>
            </Field>

            {/* Stock impact preview */}
            {stockImpact.linkedCount > 0 && (
              <div className="rounded-xl border border-brand-choco/8 overflow-hidden">
                <div className="px-3 py-2 bg-white border-b border-brand-choco/5 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft">
                    Product Stock Impact ({stockImpact.linkedCount} linked)
                  </p>
                  {stockImpact.manualCount > 0 && (
                    <p className="text-[10px] text-brand-choco-soft">
                      +{stockImpact.manualCount} manual (no stock impact)
                    </p>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-brand-choco/5">
                  {stockImpact.rows
                    .filter((r) => r.isLinked)
                    .map((r, i) => (
                      <div
                        key={i}
                        className={cn(
                          'px-3 py-2 flex items-center gap-3 text-sm',
                          r.insufficient ? 'bg-red-50' : 'bg-white'
                        )}
                      >
                        <span className="text-xs font-mono font-bold text-brand-orange w-20 shrink-0 truncate">
                          {r.productSku}
                        </span>
                        <span className="flex-1 min-w-0 truncate font-semibold">
                          {r.name}
                        </span>
                        <span className="text-xs text-brand-choco-soft shrink-0">
                          Have <b>{r.currentStock}</b>
                        </span>
                        <ArrowDown className="w-3 h-3 text-brand-choco-soft rotate-[-90deg] shrink-0" />
                        <span className="text-xs shrink-0">
                          Deduct{' '}
                          <b
                            className={cn(
                              r.insufficient ? 'text-red-600' : 'text-brand-orange'
                            )}
                          >
                            {r.deductQty}
                          </b>
                        </span>
                        <ArrowDown className="w-3 h-3 text-brand-choco-soft rotate-[-90deg] shrink-0" />
                        <span
                          className={cn(
                            'text-xs font-bold shrink-0 w-20 text-right',
                            r.insufficient ? 'text-red-600' : 'text-green-700'
                          )}
                        >
                          {r.insufficient ? (
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Short {r.deductQty - r.currentStock}
                            </span>
                          ) : (
                            <>Left {r.newStock}</>
                          )}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Manual components note */}
            {stockImpact.manualCount > 0 && stockImpact.linkedCount === 0 && (
              <div className="p-3 rounded-xl bg-pastel-blue/40 border border-pastel-blue-deep/30 flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <p className="text-blue-900">
                  <b>{stockImpact.manualCount}</b> manual component
                  {stockImpact.manualCount > 1 ? 's' : ''} — these won't affect
                  product stock (they're not linked to any product).
                </p>
              </div>
            )}

            {/* Blocker warning */}
            {stockImpact.hasBlocker && (
              <div className="p-3 rounded-xl bg-red-50 border-2 border-red-300 flex items-start gap-2 text-sm">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-900">
                    Cannot {kit ? 'assemble' : 'create'} — insufficient stock for{' '}
                    {stockImpact.insufficientCount} component
                    {stockImpact.insufficientCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-red-800 text-xs mt-0.5">
                    Reduce the batch quantity or restock the flagged products
                    before proceeding.
                  </p>
                </div>
              </div>
            )}

            {/* Success ready state */}
            {!stockImpact.hasBlocker && stockImpact.linkedCount > 0 && (
              <div className="p-3 rounded-xl bg-pastel-green/40 border border-pastel-green-deep/30 flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
                <p className="text-green-900 font-semibold">
                  Ready to {kit ? 'assemble' : 'build'} — all linked components
                  have sufficient stock
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-choco/8">
        <button
          type="button"
          onClick={onClose}
          disabled={saving || assembling}
          className="btn-secondary"
        >
          Cancel
        </button>

        {/* Assemble-more button visible only when editing an existing kit */}
        {kit && components.length > 0 && (
          <button
            type="button"
            onClick={handleAssembleMore}
            disabled={assembling || saving || stockImpact.hasBlocker}
            className="btn-secondary disabled:opacity-60"
            title={
              stockImpact.hasBlocker
                ? 'Insufficient component stock'
                : 'Assemble more units'
            }
          >
            {assembling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Assembling...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Assemble +{initialBatchQty}
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || assembling || (!kit && stockImpact.hasBlocker)}
          className="btn-primary min-w-40 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              {kit ? 'Update Kit' : `Create & Build ${initialBatchQty}`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** ---------------- Component Row ---------------- */
function ComponentRow({
  component,
  index,
  isFirst,
  linkedProduct,
  batchQty,
  onUpdate,
  onRemove,
}: {
  component: KitComponent;
  index: number;
  isFirst: boolean;
  linkedProduct?: Product;
  batchQty: number;
  onUpdate: (patch: Partial<KitComponent>) => void;
  onRemove: () => void;
}) {
  const lineTotal = component.quantity * (component.price || 0);
  const deductQty = component.quantity * Math.max(1, batchQty);
  const insufficient =
    !!linkedProduct && linkedProduct.currentStock < deductQty;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'p-3 hover:bg-brand-cream-dark/50 transition',
        !isFirst && 'border-t border-brand-choco/5',
        insufficient && 'bg-red-50/60'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
            insufficient
              ? 'bg-red-100 text-red-700'
              : 'bg-brand-orange-100 text-brand-orange'
          )}
        >
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={component.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="text-sm font-bold bg-transparent border-0 outline-none focus:bg-white focus:px-2 focus:py-1 focus:rounded-lg focus:border focus:border-brand-orange transition min-w-0 flex-1"
            />
            {component.productId ? (
              <span
                title={`Linked to product ${component.productSku}`}
                className="badge badge-info text-[9px] shrink-0"
              >
                <Link2 className="w-2.5 h-2.5" />
                {component.productSku}
              </span>
            ) : (
              <span
                title="Manual component — won't affect stock"
                className="badge text-[9px] shrink-0 bg-brand-choco/8 text-brand-choco-soft"
              >
                manual
              </span>
            )}
          </div>

          {/* Stock line — linked products only */}
          {linkedProduct && (
            <p
              className={cn(
                'text-[10px] mt-0.5 font-semibold',
                insufficient ? 'text-red-600' : 'text-brand-choco-soft'
              )}
            >
              Stock: {linkedProduct.currentStock} · Will deduct{' '}
              <b>{deductQty}</b>
              {insufficient && (
                <span className="ml-1 inline-flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" />
                  short by {deductQty - linkedProduct.currentStock}
                </span>
              )}
            </p>
          )}

          {component.remarks && (
            <p className="text-[10px] text-brand-choco-soft truncate mt-0.5">
              {component.remarks}
            </p>
          )}
        </div>

        {/* Qty */}
        <input
          type="number"
          value={component.quantity}
          onChange={(e) => onUpdate({ quantity: Number(e.target.value) })}
          min={0}
          className="h-9 w-16 px-2 rounded-lg bg-white border-2 border-brand-choco/8 focus:border-brand-orange outline-none text-sm font-bold text-center shrink-0"
        />
        <span className="text-xs font-semibold text-brand-choco-soft w-10 truncate shrink-0">
          {component.unit}
        </span>

        {/* Price */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-brand-choco-soft">₹</span>
          <input
            type="number"
            value={component.price}
            onChange={(e) => onUpdate({ price: Number(e.target.value) })}
            min={0}
            step={0.01}
            className="h-9 w-20 px-2 rounded-lg bg-white border-2 border-brand-choco/8 focus:border-brand-orange outline-none text-sm font-bold text-center"
          />
        </div>

        {/* Line total */}
        <div className="text-right shrink-0 w-20">
          <p className="text-[9px] font-bold uppercase text-brand-choco-soft">
            Total
          </p>
          <p className="text-sm font-bold text-brand-orange">
            {formatINR(lineTotal)}
          </p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center transition shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

/** ---------------- Helpers ---------------- */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand-orange-100 flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-orange" />
      </div>
      <div>
        <h3 className="font-display font-bold text-base">{title}</h3>
        <p className="text-xs text-brand-choco-soft">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}