import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Plus,
  Search,
  Grid3x3,
  List,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Power,
  PowerOff,
  AlertTriangle,
  PackageCheck,
  PackageX,
  Download,
  IndianRupee,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { ProductRowSkeleton } from '@/components/ui/Skeleton';
import ProductForm from '@/components/products/ProductForm';
import {
  useProducts,
  deleteProduct,
  toggleProductStatus,
} from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import type { Product } from '@/types';
import { cn, formatINR, formatDate } from '@/lib/utils';

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'active' | 'inactive' | 'discontinued' | 'low' | 'out';

export default function ProductsPage() {
  const { products, loading } = useProducts();
  const { categories } = useCategories();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q);
      const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'low'
          ? p.currentStock > 0 && p.currentStock <= p.minStockLevel
          : statusFilter === 'out'
          ? p.currentStock === 0
          : p.status === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [products, search, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      active: products.filter((p) => p.status === 'active').length,
      low: products.filter(
        (p) => p.currentStock > 0 && p.currentStock <= p.minStockLevel
      ).length,
      out: products.filter((p) => p.currentStock === 0).length,
    };
  }, [products]);

  const handleEdit = (p: Product) => {
    setSelected(p);
    setFormOpen(true);
    setMenuOpen(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await deleteProduct(deleting);
      toast.success('Product deleted');
      setDeleting(null);
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggle = async (p: Product) => {
    try {
      await toggleProductStatus(p);
      toast.success(`Product ${p.status === 'active' ? 'deactivated' : 'activated'}`);
      setMenuOpen(null);
    } catch {
      toast.error('Update failed');
    }
  };

  const handleExport = () => {
    const rows = filtered.map((p) => ({
      SKU: p.sku,
      Name: p.name,
      Category: p.category,
      Brand: p.brand ?? '',
      Unit: p.unit,
      'Purchase Price': p.purchasePrice,
      'Selling Price': p.sellingPrice,
      'GST %': p.gstPercent,
      'Current Stock': p.currentStock,
      'Min Stock': p.minStockLevel,
      Status: p.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `products-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Exported to Excel');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Product Master
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Products
          </h1>
          <p className="text-brand-choco-soft mt-2">
            Manage your saleable product catalog and stock levels.
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
          <button
            onClick={() => {
              setSelected(null);
              setFormOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip
          label="Total"
          value={stats.total}
          icon={Package}
          color="pastel-blue"
        />
        <StatChip
          label="Active"
          value={stats.active}
          icon={PackageCheck}
          color="pastel-green"
        />
        <StatChip
          label="Low Stock"
          value={stats.low}
          icon={AlertTriangle}
          color="pastel-peach"
        />
        <StatChip
          label="Out of Stock"
          value={stats.out}
          icon={PackageX}
          color="pastel-pink"
        />
      </div>

      {/* Toolbar */}
      <div className="card !p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU or brand..."
            className="input-field pl-11 !py-2.5"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-field !py-2.5 !w-auto"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Status filter chips */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark overflow-x-auto">
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['low', 'Low'],
              ['out', 'Out'],
            ] as [FilterStatus, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                statusFilter === val
                  ? 'bg-white text-brand-choco shadow-sm'
                  : 'text-brand-choco-soft hover:text-brand-choco'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* View mode */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center transition-all',
              viewMode === 'grid'
                ? 'bg-white shadow-sm text-brand-orange'
                : 'text-brand-choco-soft'
            )}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center transition-all',
              viewMode === 'list'
                ? 'bg-white shadow-sm text-brand-orange'
                : 'text-brand-choco-soft'
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <ProductRowSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={products.length === 0 ? 'No products yet' : 'No matches'}
          description={
            products.length === 0
              ? 'Add your first product to start tracking inventory.'
              : 'Try changing your filters or search terms.'
          }
          action={
            products.length === 0
              ? {
                  label: 'Add Your First Product',
                  icon: Plus,
                  onClick: () => {
                    setSelected(null);
                    setFormOpen(true);
                  },
                }
              : undefined
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filtered.map((p) => (
              <ProductGridCard
                key={p.id}
                product={p}
                onEdit={handleEdit}
                onDelete={setDeleting}
                onToggle={handleToggle}
                onView={(p) => {
                  setSelected(p);
                  setDetailOpen(true);
                }}
                menuOpen={menuOpen === p.id}
                setMenuOpen={(open) => setMenuOpen(open ? p.id : null)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-choco/8 text-left text-xs font-bold uppercase tracking-wider text-brand-choco-soft">
                  <th className="p-4">Product</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 text-right">Stock</th>
                  <th className="p-4 text-right">Price</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <ProductListRow
                    key={p.id}
                    product={p}
                    onEdit={handleEdit}
                    onDelete={setDeleting}
                    onToggle={handleToggle}
                    onView={(p) => {
                      setSelected(p);
                      setDetailOpen(true);
                    }}
                    menuOpen={menuOpen === p.id}
                    setMenuOpen={(open) => setMenuOpen(open ? p.id : null)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={selected ? 'Edit Product' : 'Add New Product'}
        description={
          selected ? 'Update product details.' : 'Enter product information below.'
        }
        size="lg"
        closeOnOverlay={false}
      >
        <ProductForm
          product={selected}
          onClose={() => setFormOpen(false)}
        />
      </Modal>

      {/* Detail modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.name}
        size="lg"
      >
        {selected && <ProductDetail product={selected} />}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Product?"
        message={`"${deleting?.name}" will be permanently removed. Stock history remains for audit.`}
        confirmLabel="Delete Product"
        loading={deleteLoading}
      />
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

function StockBadge({ p }: { p: Product }) {
  if (p.currentStock === 0)
    return (
      <span className="badge badge-danger">
        <PackageX className="w-3 h-3" /> Out
      </span>
    );
  if (p.currentStock <= p.minStockLevel)
    return (
      <span className="badge badge-warning">
        <AlertTriangle className="w-3 h-3" /> Low
      </span>
    );
  return (
    <span className="badge badge-success">
      <PackageCheck className="w-3 h-3" /> OK
    </span>
  );
}

interface RowProps {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onToggle: (p: Product) => void;
  onView: (p: Product) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

function ProductGridCard({
  product,
  onEdit,
  onDelete,
  onToggle,
  onView,
  menuOpen,
  setMenuOpen,
}: RowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -3 }}
      className="card !p-4 flex flex-col group cursor-pointer relative"
      onClick={() => onView(product)}
    >
      <div className="aspect-square rounded-2xl bg-brand-cream-dark overflow-hidden mb-3 relative">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16 text-brand-orange/30" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <StockBadge p={product} />
        </div>
        <div className="absolute top-2 right-2">
          <ActionsMenu
            product={product}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
            open={menuOpen}
            setOpen={setMenuOpen}
          />
        </div>
      </div>
      <p className="text-xs font-semibold text-brand-orange">{product.sku}</p>
      <h3 className="font-bold text-brand-choco truncate">{product.name}</h3>
      <p className="text-xs text-brand-choco-soft truncate">
        {product.category} · {product.brand || '—'}
      </p>
      <div className="flex items-end justify-between mt-3 pt-3 border-t border-brand-choco/8">
        <div>
          <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
            Stock
          </p>
          <p className="font-display font-bold text-lg leading-none">
            {product.currentStock}
            <span className="text-xs text-brand-choco-soft ml-1">
              {product.unit}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
            Price
          </p>
          <p className="font-display font-bold text-lg leading-none text-brand-orange">
            {formatINR(product.sellingPrice)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function ProductListRow({
  product,
  onEdit,
  onDelete,
  onToggle,
  onView,
  menuOpen,
  setMenuOpen,
}: RowProps) {
  return (
    <tr
      className="border-b border-brand-choco/5 hover:bg-brand-cream-dark/50 transition cursor-pointer"
      onClick={() => onView(product)}
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-cream-dark overflow-hidden shrink-0">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-5 h-5 text-brand-orange/40" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate">{product.name}</p>
            <p className="text-xs text-brand-choco-soft truncate">
              {product.brand || '—'}
            </p>
          </div>
        </div>
      </td>
      <td className="p-4 text-sm font-semibold text-brand-orange">
        {product.sku}
      </td>
      <td className="p-4 text-sm">{product.category}</td>
      <td className="p-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <StockBadge p={product} />
          <span className="font-bold">
            {product.currentStock}
            <span className="text-xs text-brand-choco-soft ml-1">
              {product.unit}
            </span>
          </span>
        </div>
      </td>
      <td className="p-4 text-right font-bold text-brand-orange">
        {formatINR(product.sellingPrice)}
      </td>
      <td className="p-4">
        <span
          className={cn(
            'badge',
            product.status === 'active' && 'badge-success',
            product.status === 'inactive' && 'badge-warning',
            product.status === 'discontinued' && 'badge-danger'
          )}
        >
          {product.status}
        </span>
      </td>
      <td className="p-4 relative">
        <ActionsMenu
          product={product}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
          open={menuOpen}
          setOpen={setMenuOpen}
        />
      </td>
    </tr>
  );
}

function ActionsMenu({
  product,
  onEdit,
  onDelete,
  onToggle,
  open,
  setOpen,
}: {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onToggle: (p: Product) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="w-8 h-8 rounded-xl bg-white/90 hover:bg-white flex items-center justify-center shadow-sm"
      >
        <MoreVertical className="w-4 h-4 text-brand-choco" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 mt-1 w-44 bg-white rounded-2xl shadow-2xl border border-brand-choco/8 py-1 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <MenuItem
                icon={Edit}
                label="Edit"
                onClick={() => onEdit(product)}
              />
              <MenuItem
                icon={product.status === 'active' ? PowerOff : Power}
                label={product.status === 'active' ? 'Deactivate' : 'Activate'}
                onClick={() => onToggle(product)}
              />
              <div className="h-px bg-brand-choco/8 my-1" />
              <MenuItem
                icon={Trash2}
                label="Delete"
                onClick={() => {
                  onDelete(product);
                  setOpen(false);
                }}
                danger
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-left transition',
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-brand-choco hover:bg-brand-cream-dark'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function ProductDetail({ product }: { product: Product }) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex gap-6 flex-col sm:flex-row">
        <div className="w-full sm:w-64 h-64 rounded-3xl bg-brand-cream-dark overflow-hidden shrink-0">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-24 h-24 text-brand-orange/30" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-brand-orange">{product.sku}</p>
          <h2 className="font-display text-3xl font-bold mt-1">
            {product.name}
          </h2>
          <p className="text-brand-choco-soft mt-2">
            {product.description || 'No description'}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="badge badge-info">{product.category}</span>
            {product.brand && (
              <span className="badge badge-info">{product.brand}</span>
            )}
            <StockBadge p={product} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DetailBox
          label="Current Stock"
          value={`${product.currentStock} ${product.unit}`}
          highlight
        />
        <DetailBox
          label="Min Alert"
          value={`${product.minStockLevel} ${product.unit}`}
        />
        <DetailBox
          label="Purchase"
          value={formatINR(product.purchasePrice)}
        />
        <DetailBox
          label="Selling"
          value={formatINR(product.sellingPrice)}
          highlight
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-2xl bg-brand-cream-dark/50">
          <p className="text-xs font-bold uppercase text-brand-choco-soft">
            GST
          </p>
          <p className="font-bold mt-1">{product.gstPercent}%</p>
        </div>
        <div className="p-3 rounded-2xl bg-brand-cream-dark/50">
          <p className="text-xs font-bold uppercase text-brand-choco-soft">
            Created
          </p>
          <p className="font-bold mt-1">
            {product.createdAt ? formatDate(product.createdAt) : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'p-4 rounded-2xl border',
        highlight
          ? 'bg-pastel-peach border-pastel-peach-deep/30'
          : 'bg-brand-cream-dark border-brand-choco/8'
      )}
    >
      <p className="text-xs font-bold uppercase text-brand-choco-soft">
        {label}
      </p>
      <p className="font-display text-2xl font-bold mt-1 flex items-center gap-1">
        {value}
      </p>
    </div>
  );
}
