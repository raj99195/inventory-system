import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftRight,
  Plus,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  AlertTriangle,
  Sliders,
  X,
  Download,
  TrendingUp,
  TrendingDown,
  Package,
  User,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { ProductRowSkeleton } from '@/components/ui/Skeleton';
import StockTransactionForm from '@/components/stock/StockTransactionForm';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { usePermission } from '@/hooks/usePermission';
import type { StockTransaction, StockTxType } from '@/types';
import { cn, formatDateTime } from '@/lib/utils';

type FilterType = 'all' | StockTxType;

const TYPE_META: Record<
  StockTxType,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    label: string;
  }
> = {
  'stock-in': { icon: ArrowDownToLine, color: 'green', label: 'Stock In' },
  'stock-out': { icon: ArrowUpFromLine, color: 'blue', label: 'Stock Out' },
  return: { icon: RotateCcw, color: 'peach', label: 'Return' },
  damage: { icon: AlertTriangle, color: 'pink', label: 'Damage' },
  lost: { icon: X, color: 'pink', label: 'Lost' },
  adjustment: { icon: Sliders, color: 'orange', label: 'Adjustment' },
  correction: { icon: Sliders, color: 'orange', label: 'Correction' },
};

export default function StockPage() {
  const { transactions, loading } = useStockTransactions(500);
  const { can } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  // ANY stock action permission allows creating a transaction
  const canCreate =
    can('stock.stockIn') ||
    can('stock.stockOut') ||
    can('stock.adjustment');

  // Auto-open create modal via location.state (only if allowed)
  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate) {
      if (canCreate) {
        setFormOpen(true);
      } else {
        toast.error("You don't have permission to create stock transactions");
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, canCreate]);

  // Route guard
  if (!can('stock.view')) {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        t.productName.toLowerCase().includes(q) ||
        t.productSku.toLowerCase().includes(q) ||
        t.reason?.toLowerCase().includes(q);
      const matchType = typeFilter === 'all' || t.type === typeFilter;
      const createdAt = t.createdAt?.toDate?.() ?? null;
      const matchFrom = !dateFrom || (createdAt && createdAt >= new Date(dateFrom));
      const matchTo =
        !dateTo || (createdAt && createdAt <= new Date(new Date(dateTo).setHours(23, 59, 59)));
      return matchSearch && matchType && matchFrom && matchTo;
    });
  }, [transactions, search, typeFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recent = transactions.filter((t) => {
      const d = t.createdAt?.toDate?.();
      return d && d >= weekAgo;
    });
    return {
      total: transactions.length,
      stockIn: recent
        .filter((t) => t.type === 'stock-in' || t.type === 'return')
        .reduce((sum, t) => sum + Math.abs(t.quantity), 0),
      stockOut: recent
        .filter((t) => ['stock-out', 'damage', 'lost'].includes(t.type))
        .reduce((sum, t) => sum + Math.abs(t.quantity), 0),
      adjustments: recent.filter((t) => t.type === 'adjustment').length,
    };
  }, [transactions]);

  const handleExport = () => {
    const rows = filtered.map((t) => ({
      Date: t.createdAt ? formatDateTime(t.createdAt) : '',
      Product: t.productName,
      SKU: t.productSku,
      Type: TYPE_META[t.type]?.label ?? t.type,
      Quantity: t.quantity,
      'Balance After': t.balanceAfter,
      Source: t.source,
      Reason: t.reason ?? '',
      Remarks: t.remarks ?? '',
      'Performed By': t.performedBy,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Movements');
    XLSX.writeFile(
      wb,
      `stock-movements-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    toast.success('Exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Ledger
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Stock Movement
          </h1>
          <p className="text-brand-choco-soft mt-2">
            Manual stock-in, stock-out, returns and adjustments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={!filtered.length}
            className="btn-secondary disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          {canCreate && (
            <button onClick={() => setFormOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              New Transaction
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip
          label="Total Transactions"
          value={stats.total}
          icon={ArrowLeftRight}
          color="pastel-blue"
        />
        <StatChip
          label="Stock In (7d)"
          value={stats.stockIn}
          icon={TrendingUp}
          color="pastel-green"
        />
        <StatChip
          label="Stock Out (7d)"
          value={stats.stockOut}
          icon={TrendingDown}
          color="pastel-peach"
        />
        <StatChip
          label="Adjustments (7d)"
          value={stats.adjustments}
          icon={Sliders}
          color="pastel-pink"
        />
      </div>

      {/* Toolbar */}
      <div className="card !p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, SKU or reason..."
              className="input-field pl-11 !py-2.5"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-choco-soft" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-field !py-2.5 text-sm"
            />
            <span className="text-brand-choco-soft">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-field !py-2.5 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark overflow-x-auto w-full">
          {(
            [
              ['all', 'All'],
              ['stock-in', 'Stock In'],
              ['stock-out', 'Stock Out'],
              ['return', 'Return'],
              ['damage', 'Damage'],
              ['lost', 'Lost'],
              ['adjustment', 'Adjustment'],
            ] as [FilterType, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTypeFilter(val)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                typeFilter === val
                  ? 'bg-white text-brand-choco shadow-sm'
                  : 'text-brand-choco-soft hover:text-brand-choco'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <ProductRowSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={transactions.length === 0 ? 'No transactions yet' : 'No matches'}
          description={
            transactions.length === 0
              ? canCreate
                ? 'Record your first stock movement to start the ledger.'
                : 'No transactions recorded. Contact an admin.'
              : 'Try changing filters or dates.'
          }
          action={
            transactions.length === 0 && canCreate
              ? {
                  label: 'First Transaction',
                  icon: Plus,
                  onClick: () => setFormOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New Stock Transaction"
        description="Update stock levels manually with audit trail."
        size="lg"
        closeOnOverlay={false}
      >
        <StockTransactionForm onClose={() => setFormOpen(false)} />
      </Modal>
    </div>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4 border flex items-center gap-3',
        color === 'pastel-blue' && 'bg-pastel-blue border-pastel-blue-deep/30',
        color === 'pastel-green' && 'bg-pastel-green border-pastel-green-deep/30',
        color === 'pastel-peach' && 'bg-pastel-peach border-pastel-peach-deep/30',
        color === 'pastel-pink' && 'bg-pastel-pink border-pastel-pink-deep/30'
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-choco" />
      </div>
      <div>
        <p className="text-xs font-semibold text-brand-choco-light">{label}</p>
        <p className="font-display text-2xl font-bold leading-none mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: StockTransaction }) {
  const meta = TYPE_META[tx.type];
  const Icon = meta?.icon ?? Package;
  const isPositive = tx.quantity > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="card !p-4 flex items-center gap-4 hover:shadow-lift"
    >
      <div
        className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
          meta?.color === 'green' && 'bg-pastel-green',
          meta?.color === 'blue' && 'bg-pastel-blue',
          meta?.color === 'peach' && 'bg-pastel-peach',
          meta?.color === 'pink' && 'bg-pastel-pink',
          meta?.color === 'orange' && 'bg-brand-orange-100'
        )}
      >
        <Icon className="w-5 h-5 text-brand-choco" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold truncate">{tx.productName}</span>
          <span className="text-xs font-semibold text-brand-orange">
            {tx.productSku}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-brand-choco-soft mt-0.5 flex-wrap">
          <span className="font-semibold">{meta?.label ?? tx.type}</span>
          {tx.reason && <span>· {tx.reason}</span>}
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {tx.performedBy}
          </span>
          {tx.createdAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDateTime(tx.createdAt)}
            </span>
          )}
        </div>
        {tx.remarks && (
          <p className="text-xs text-brand-choco-soft mt-1 italic truncate">
            "{tx.remarks}"
          </p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p
          className={cn(
            'font-display text-2xl font-bold leading-none',
            isPositive ? 'text-green-700' : 'text-red-600'
          )}
        >
          {isPositive ? '+' : ''}
          {tx.quantity}
        </p>
        <p className="text-xs text-brand-choco-soft mt-1">
          Balance: <span className="font-bold">{tx.balanceAfter}</span>
        </p>
      </div>
    </motion.div>
  );
}