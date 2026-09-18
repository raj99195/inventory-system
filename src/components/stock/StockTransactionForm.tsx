import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  AlertTriangle,
  X,
  Sliders,
  Search,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Product, StockTxType } from '@/types';
import { useProducts } from '@/hooks/useProducts';
import {
  createStockTransaction,
  createAdjustment,
} from '@/hooks/useStockTransactions';
import { cn } from '@/lib/utils';

interface Props {
  onClose: () => void;
  presetProduct?: Product | null;
}

const TX_TYPES: {
  value: StockTxType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}[] = [
  {
    value: 'stock-in',
    label: 'Stock In',
    icon: ArrowDownToLine,
    color: 'green',
    description: 'Received new stock',
  },
  {
    value: 'stock-out',
    label: 'Stock Out',
    icon: ArrowUpFromLine,
    color: 'blue',
    description: 'Dispatched / sold',
  },
  {
    value: 'return',
    label: 'Return',
    icon: RotateCcw,
    color: 'peach',
    description: 'Returned by customer',
  },
  {
    value: 'damage',
    label: 'Damage',
    icon: AlertTriangle,
    color: 'pink',
    description: 'Damaged in transit / storage',
  },
  {
    value: 'lost',
    label: 'Lost',
    icon: X,
    color: 'pink',
    description: 'Missing / lost',
  },
  {
    value: 'adjustment',
    label: 'Adjustment',
    icon: Sliders,
    color: 'orange',
    description: 'Manual correction (+/-)',
  },
];

const REASONS_BY_TYPE: Record<StockTxType, string[]> = {
  'stock-in': ['New Purchase', 'Zoho Invoice', 'Supplier Delivery', 'Transfer In'],
  'stock-out': ['Sale', 'Dispatch', 'Sample', 'Internal Use', 'Transfer Out'],
  return: ['Customer Return', 'Wrong Item', 'Quality Issue'],
  damage: ['Storage Damage', 'Transit Damage', 'Manufacturing Defect'],
  lost: ['Theft', 'Misplaced', 'Unknown'],
  adjustment: ['Physical Count Mismatch', 'Data Correction', 'System Error'],
  correction: ['System Correction'],
};

export default function StockTransactionForm({ onClose, presetProduct }: Props) {
  const { products } = useProducts();
  const [step, setStep] = useState<'type' | 'details'>(
    presetProduct ? 'details' : 'type'
  );
  const [type, setType] = useState<StockTxType>('stock-in');
  const [productSearch, setProductSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(presetProduct ?? null);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [adjustmentSign, setAdjustmentSign] = useState<'+' | '-'>('+');
  const [saving, setSaving] = useState(false);

  const filteredProducts = useMemo(() => {
    const activeProducts = products.filter((p) => p.status === 'active');
    if (!productSearch) return activeProducts.slice(0, 20);
    const q = productSearch.toLowerCase();
    return activeProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [products, productSearch]);

  const currentType = TX_TYPES.find((t) => t.value === type)!;

  const newBalance = useMemo(() => {
    if (!selected) return 0;
    const positive: StockTxType[] = ['stock-in', 'return'];
    const negative: StockTxType[] = ['stock-out', 'damage', 'lost'];
    if (positive.includes(type)) return selected.currentStock + quantity;
    if (negative.includes(type)) return selected.currentStock - quantity;
    // adjustment
    return selected.currentStock + (adjustmentSign === '+' ? quantity : -quantity);
  }, [selected, type, quantity, adjustmentSign]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return toast.error('Select a product');
    if (quantity <= 0) return toast.error('Quantity must be positive');
    if (newBalance < 0) return toast.error('Insufficient stock');
    if (!reason) return toast.error('Select or type a reason');

    setSaving(true);
    try {
      if (type === 'adjustment') {
        const delta = adjustmentSign === '+' ? quantity : -quantity;
        await createAdjustment(selected, delta, reason, remarks);
      } else {
        await createStockTransaction({
          product: selected,
          type,
          quantity,
          reason,
          remarks,
        });
      }
      toast.success(`${currentType.label} recorded`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Step 1: Type selector */}
      {step === 'type' && (
        <>
          <p className="text-sm text-brand-choco-soft">
            What kind of stock movement is this?
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TX_TYPES.map((t) => (
              <motion.button
                key={t.value}
                whileHover={{ y: -2 }}
                type="button"
                onClick={() => {
                  setType(t.value);
                  setReason('');
                  setStep('details');
                }}
                className={cn(
                  'p-4 rounded-2xl border-2 text-left transition-all',
                  t.color === 'green' && 'border-pastel-green-deep/40 bg-pastel-green hover:bg-pastel-green-deep/30',
                  t.color === 'blue' && 'border-pastel-blue-deep/40 bg-pastel-blue hover:bg-pastel-blue-deep/30',
                  t.color === 'peach' && 'border-pastel-peach-deep/40 bg-pastel-peach hover:bg-pastel-peach-deep/30',
                  t.color === 'pink' && 'border-pastel-pink-deep/40 bg-pastel-pink hover:bg-pastel-pink-deep/30',
                  t.color === 'orange' && 'border-brand-orange/30 bg-brand-orange-100 hover:bg-brand-orange-200'
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center mb-2">
                  <t.icon className="w-5 h-5 text-brand-choco" />
                </div>
                <p className="font-bold text-sm">{t.label}</p>
                <p className="text-xs text-brand-choco-soft mt-0.5">
                  {t.description}
                </p>
              </motion.button>
            ))}
          </div>
        </>
      )}

      {/* Step 2: Details */}
      {step === 'details' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type indicator */}
          <div
            className={cn(
              'p-4 rounded-2xl border-2 flex items-center gap-3',
              currentType.color === 'green' && 'border-pastel-green-deep/40 bg-pastel-green',
              currentType.color === 'blue' && 'border-pastel-blue-deep/40 bg-pastel-blue',
              currentType.color === 'peach' && 'border-pastel-peach-deep/40 bg-pastel-peach',
              currentType.color === 'pink' && 'border-pastel-pink-deep/40 bg-pastel-pink',
              currentType.color === 'orange' && 'border-brand-orange/30 bg-brand-orange-100'
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
              <currentType.icon className="w-5 h-5 text-brand-choco" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">{currentType.label}</p>
              <p className="text-xs text-brand-choco-soft">
                {currentType.description}
              </p>
            </div>
            {!presetProduct && (
              <button
                type="button"
                onClick={() => setStep('type')}
                className="text-xs font-semibold text-brand-choco-soft hover:text-brand-orange"
              >
                Change
              </button>
            )}
          </div>

          {/* Product picker */}
          {!selected ? (
            <div>
              <label className="block text-sm font-semibold mb-2">
                <Package className="inline w-3.5 h-3.5 mr-1" />
                Select Product
              </label>
              <div className="relative mb-3">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
                <input
                  autoFocus
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="input-field pl-11"
                  placeholder="Search by name or SKU..."
                />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1 border border-brand-choco/8 rounded-2xl p-2">
                {filteredProducts.length === 0 ? (
                  <p className="text-sm text-brand-choco-soft text-center py-4">
                    No active products found
                  </p>
                ) : (
                  filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelected(p)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-brand-cream-dark text-left transition"
                    >
                      <div className="w-10 h-10 rounded-lg bg-brand-cream-dark flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-brand-orange" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-brand-orange">{p.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-brand-choco-soft">Stock</p>
                        <p className="font-bold">{p.currentStock} {p.unit}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Selected product */}
              <div className="p-4 rounded-2xl bg-brand-cream-dark/50 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center">
                  <Package className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-brand-orange">
                    {selected.sku}
                  </p>
                  <p className="font-bold truncate">{selected.name}</p>
                  <p className="text-xs text-brand-choco-soft">
                    Current: {selected.currentStock} {selected.unit} · Min: {selected.minStockLevel}
                  </p>
                </div>
                {!presetProduct && (
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-xs font-semibold text-brand-choco-soft hover:text-brand-orange"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Quantity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    {type === 'adjustment' && (
                      <div className="flex gap-1 p-1 rounded-2xl bg-brand-cream-dark">
                        <button
                          type="button"
                          onClick={() => setAdjustmentSign('+')}
                          className={cn(
                            'px-4 rounded-xl font-bold transition',
                            adjustmentSign === '+'
                              ? 'bg-pastel-green text-green-800'
                              : 'text-brand-choco-soft'
                          )}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustmentSign('-')}
                          className={cn(
                            'px-4 rounded-xl font-bold transition',
                            adjustmentSign === '-'
                              ? 'bg-pastel-pink text-red-800'
                              : 'text-brand-choco-soft'
                          )}
                        >
                          −
                        </button>
                      </div>
                    )}
                    <input
                      type="number"
                      min="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(0, +e.target.value))}
                      className="input-field flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <input
                    list={`reasons-${type}`}
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input-field"
                    placeholder="Select or type reason"
                  />
                  <datalist id={`reasons-${type}`}>
                    {REASONS_BY_TYPE[type].map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Live preview */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-gradient-to-r from-brand-cream-deep to-brand-cream-dark border border-brand-orange/20"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-3">
                  Preview
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-brand-choco-soft">Current</p>
                    <p className="font-display text-2xl font-bold">
                      {selected.currentStock}
                      <span className="text-sm text-brand-choco-soft ml-1">
                        {selected.unit}
                      </span>
                    </p>
                  </div>
                  <ArrowRight className="w-6 h-6 text-brand-orange" />
                  <div className="text-center">
                    <p className="text-xs text-brand-choco-soft">Change</p>
                    <p className="font-display text-xl font-bold text-brand-orange">
                      {type === 'adjustment'
                        ? adjustmentSign === '+'
                          ? `+${quantity}`
                          : `−${quantity}`
                        : ['stock-in', 'return'].includes(type)
                        ? `+${quantity}`
                        : `−${quantity}`}
                    </p>
                  </div>
                  <ArrowRight className="w-6 h-6 text-brand-orange" />
                  <div className="text-right">
                    <p className="text-xs text-brand-choco-soft">New Balance</p>
                    <p
                      className={cn(
                        'font-display text-2xl font-bold',
                        newBalance < 0
                          ? 'text-red-600'
                          : newBalance <= selected.minStockLevel
                          ? 'text-orange-600'
                          : 'text-green-700'
                      )}
                    >
                      {newBalance}
                      <span className="text-sm text-brand-choco-soft ml-1">
                        {selected.unit}
                      </span>
                    </p>
                  </div>
                </div>
                {newBalance < 0 && (
                  <p className="text-xs text-red-600 mt-3 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Cannot go below zero — reduce quantity
                  </p>
                )}
                {newBalance >= 0 && newBalance <= selected.minStockLevel && (
                  <p className="text-xs text-orange-700 mt-3 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Will trigger low-stock alert
                  </p>
                )}
              </motion.div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Remarks
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  className="input-field resize-none"
                  placeholder="Any additional notes..."
                />
              </div>
            </>
          )}

          {/* Actions */}
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
              disabled={saving || !selected || newBalance < 0}
              className="btn-primary flex-1 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Transaction'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
