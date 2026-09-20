import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Boxes,
  Plus,
  Search,
  Grid3x3,
  List,
  MoreVertical,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Package,
  PackageCheck,
  Download,
  Layers,
  IndianRupee,
  Link2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { ProductRowSkeleton } from '@/components/ui/Skeleton';
import KitForm from '@/components/kits/KitForm';
import {
  useKits,
  deleteKit,
  toggleKitStatus,
} from '@/hooks/useKits';
import { useCategories } from '@/hooks/useCategories';
import { usePermission } from '@/hooks/usePermission';
import type { Kit } from '@/types';
import { cn, formatINR, formatDate } from '@/lib/utils';

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'active' | 'inactive' | 'discontinued';

export default function KitsPage() {
  const { kits, loading } = useKits();
  const { categories } = useCategories();
  const { can } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Kit | null>(null);
  const [deleting, setDeleting] = useState<Kit | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Permission flags
  const canCreate = can('kits.create');
  const canEdit = can('kits.edit');
  const canDeletePerm = can('kits.delete');

  // Auto-open create modal via location.state (only if allowed)
  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate) {
      if (canCreate) {
        setSelected(null);
        setFormOpen(true);
      } else {
        toast.error("You don't have permission to create kits");
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, canCreate]);

  // Route guard — no view permission → redirect
  if (!can('kits.view')) {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(() => {
    return kits.filter((k) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        k.name.toLowerCase().includes(q) ||
        k.sku.toLowerCase().includes(q) ||
        k.category.toLowerCase().includes(q);
      const matchCategory =
        categoryFilter === 'all' || k.category === categoryFilter;
      const matchStatus =
        statusFilter === 'all' ? true : k.status === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [kits, search, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    return {
      total: kits.length,
      active: kits.filter((k) => k.status === 'active').length,
      totalComponents: kits.reduce((sum, k) => sum + k.componentCount, 0),
      totalValue: kits.reduce((sum, k) => sum + (k.sellingPrice || 0), 0),
    };
  }, [kits]);

  const handleEdit = (k: Kit) => {
    if (!canEdit) {
      toast.error("You don't have permission to edit kits");
      return;
    }
    setSelected(k);
    setFormOpen(true);
    setMenuOpen(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    if (!canDeletePerm) {
      toast.error("You don't have permission to delete kits");
      setDeleting(null);
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteKit(deleting);
      toast.success('Kit deleted');
      setDeleting(null);
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggle = async (k: Kit) => {
    if (!canEdit) {
      toast.error("You don't have permission to edit kits");
      return;
    }
    try {
      await toggleKitStatus(k);
      toast.success(
        `Kit ${k.status === 'active' ? 'deactivated' : 'activated'}`
      );
      setMenuOpen(null);
    } catch {
      toast.error('Update failed');
    }
  };

  const handleExport = () => {
    const rows = filtered.map((k) => ({
      SKU: k.sku,
      Name: k.name,
      Category: k.category,
      'Component Types': k.componentCount,
      'Total Pieces': k.totalPieces,
      'Component Cost': k.componentCost || 0,
      'Selling Price': k.sellingPrice,
      Margin: (k.sellingPrice || 0) - (k.componentCost || 0),
      'GST %': k.gstPercent,
      Status: k.status,
      Components: k.components
        .map((c) => `${c.name} × ${c.quantity} ${c.unit} @ ₹${c.price}`)
        .join('; '),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kits');
    XLSX.writeFile(wb, `kits-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Exported to Excel');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Kit Master
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">Kits</h1>
          <p className="text-brand-choco-soft mt-2">
            Bundle multiple components into a single saleable kit.
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
            <button
              onClick={() => {
                setSelected(null);
                setFormOpen(true);
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              Add Kit
            </button>
          )}
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip
          label="Total Kits"
          value={String(stats.total)}
          icon={Boxes}
          color="pastel-blue"
        />
        <StatChip
          label="Active"
          value={String(stats.active)}
          icon={PackageCheck}
          color="pastel-green"
        />
        <StatChip
          label="Components"
          value={String(stats.totalComponents)}
          icon={Layers}
          color="pastel-peach"
        />
        <StatChip
          label="Total Value"
          value={formatINR(stats.totalValue)}
          icon={IndianRupee}
          color="pastel-pink"
        />
      </div>

      {/* Toolbar */}
      <div className="card !p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU or category..."
            className="input-field pl-11 !py-2.5"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-field !py-2.5 !w-auto"
        >
          <option value="all">All Categories</option>
          <option value="DIY Kit">DIY Kit</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark overflow-x-auto">
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['inactive', 'Inactive'],
              ['discontinued', 'Discontinued'],
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
          icon={Boxes}
          title={kits.length === 0 ? 'No kits yet' : 'No matches'}
          description={
            kits.length === 0
              ? canCreate
                ? 'Create your first kit by bundling components together.'
                : 'No kits available. Contact an admin to create one.'
              : 'Try changing your filters or search terms.'
          }
          action={
            kits.length === 0 && canCreate
              ? {
                  label: 'Create Your First Kit',
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
            {filtered.map((k) => (
              <KitGridCard
                key={k.id}
                kit={k}
                canEdit={canEdit}
                canDelete={canDeletePerm}
                onEdit={handleEdit}
                onDelete={setDeleting}
                onToggle={handleToggle}
                onView={(k) => {
                  setSelected(k);
                  setDetailOpen(true);
                }}
                menuOpen={menuOpen === k.id}
                setMenuOpen={(open) => setMenuOpen(open ? k.id : null)}
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
                  <th className="p-4">Kit</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 text-right">Components</th>
                  <th className="p-4 text-right">Cost</th>
                  <th className="p-4 text-right">Price</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((k) => (
                  <KitListRow
                    key={k.id}
                    kit={k}
                    canEdit={canEdit}
                    canDelete={canDeletePerm}
                    onEdit={handleEdit}
                    onDelete={setDeleting}
                    onToggle={handleToggle}
                    onView={(k) => {
                      setSelected(k);
                      setDetailOpen(true);
                    }}
                    menuOpen={menuOpen === k.id}
                    setMenuOpen={(open) => setMenuOpen(open ? k.id : null)}
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
        title={selected ? 'Edit Kit' : 'Create New Kit'}
        description={
          selected
            ? 'Update kit details and components.'
            : 'Bundle multiple components into a saleable kit.'
        }
        size="lg"
        closeOnOverlay={false}
      >
        <KitForm kit={selected} onClose={() => setFormOpen(false)} />
      </Modal>

      {/* Detail modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.name}
        size="lg"
      >
        {selected && <KitDetail kit={selected} />}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Kit?"
        message={`"${deleting?.name}" will be permanently removed.`}
        confirmLabel="Delete Kit"
        loading={deleteLoading}
      />
    </div>
  );
}

/** ---------------- Stat Chip ---------------- */
function StatChip({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
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
      <div className="min-w-0">
        <p className="text-xs font-semibold text-brand-choco-light">{label}</p>
        <p className="font-display text-2xl font-bold leading-none mt-0.5 truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

/** ---------------- Grid Card ---------------- */
interface RowProps {
  kit: Kit;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (k: Kit) => void;
  onDelete: (k: Kit) => void;
  onToggle: (k: Kit) => void;
  onView: (k: Kit) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

function KitGridCard({
  kit,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onToggle,
  onView,
  menuOpen,
  setMenuOpen,
}: RowProps) {
  const hasAnyAction = canEdit || canDelete;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -3 }}
      className="card !p-4 flex flex-col group cursor-pointer relative"
      onClick={() => onView(kit)}
    >
      <div className="aspect-square rounded-2xl bg-gradient-to-br from-pastel-blue via-pastel-peach to-pastel-pink overflow-hidden mb-3 relative">
        {kit.imageUrl ? (
          <img
            src={kit.imageUrl}
            alt={kit.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Boxes className="w-20 h-20 text-brand-choco/30" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span
            className={cn(
              'badge',
              kit.status === 'active' && 'badge-success',
              kit.status === 'inactive' && 'badge-warning',
              kit.status === 'discontinued' && 'badge-danger'
            )}
          >
            {kit.status}
          </span>
        </div>
        {hasAnyAction && (
          <div className="absolute top-2 right-2">
            <ActionsMenu
              kit={kit}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
              open={menuOpen}
              setOpen={setMenuOpen}
            />
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[10px] font-bold text-brand-choco">
            <Layers className="w-3 h-3" />
            {kit.componentCount} types
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[10px] font-bold text-brand-choco">
            <Package className="w-3 h-3" />
            {kit.totalPieces} pcs
          </span>
        </div>
      </div>
      <p className="text-xs font-semibold text-brand-orange">{kit.sku}</p>
      <h3 className="font-bold text-brand-choco truncate">{kit.name}</h3>
      <p className="text-xs text-brand-choco-soft truncate">{kit.category}</p>
      <div className="flex items-end justify-between mt-3 pt-3 border-t border-brand-choco/8">
        <div>
          <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
            Cost
          </p>
          <p className="font-display font-bold text-sm leading-none text-brand-choco-light">
            {formatINR(kit.componentCost || 0)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
            Sell Price
          </p>
          <p className="font-display font-bold text-lg leading-none text-brand-orange">
            {formatINR(kit.sellingPrice)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/** ---------------- List Row ---------------- */
function KitListRow({
  kit,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onToggle,
  onView,
  menuOpen,
  setMenuOpen,
}: RowProps) {
  const hasAnyAction = canEdit || canDelete;

  return (
    <tr
      className="border-b border-brand-choco/5 hover:bg-brand-cream-dark/50 transition cursor-pointer"
      onClick={() => onView(kit)}
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pastel-blue to-pastel-pink overflow-hidden shrink-0 flex items-center justify-center">
            {kit.imageUrl ? (
              <img
                src={kit.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Boxes className="w-5 h-5 text-brand-choco/40" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate">{kit.name}</p>
            <p className="text-xs text-brand-choco-soft truncate">
              {kit.description || '—'}
            </p>
          </div>
        </div>
      </td>
      <td className="p-4 text-sm font-semibold text-brand-orange font-mono">
        {kit.sku}
      </td>
      <td className="p-4 text-sm">{kit.category}</td>
      <td className="p-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="badge badge-info">
            <Layers className="w-3 h-3" /> {kit.componentCount}
          </span>
          <span className="font-bold">
            {kit.totalPieces}
            <span className="text-xs text-brand-choco-soft ml-1">pcs</span>
          </span>
        </div>
      </td>
      <td className="p-4 text-right text-sm font-semibold text-brand-choco-light">
        {formatINR(kit.componentCost || 0)}
      </td>
      <td className="p-4 text-right font-bold text-brand-orange">
        {formatINR(kit.sellingPrice)}
      </td>
      <td className="p-4">
        <span
          className={cn(
            'badge',
            kit.status === 'active' && 'badge-success',
            kit.status === 'inactive' && 'badge-warning',
            kit.status === 'discontinued' && 'badge-danger'
          )}
        >
          {kit.status}
        </span>
      </td>
      <td className="p-4 relative">
        {hasAnyAction && (
          <ActionsMenu
            kit={kit}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
            open={menuOpen}
            setOpen={setMenuOpen}
          />
        )}
      </td>
    </tr>
  );
}

/** ---------------- Actions Menu ---------------- */
function ActionsMenu({
  kit,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onToggle,
  open,
  setOpen,
}: {
  kit: Kit;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (k: Kit) => void;
  onDelete: (k: Kit) => void;
  onToggle: (k: Kit) => void;
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
              {canEdit && (
                <>
                  <MenuItem
                    icon={Edit}
                    label="Edit"
                    onClick={() => onEdit(kit)}
                  />
                  <MenuItem
                    icon={kit.status === 'active' ? PowerOff : Power}
                    label={kit.status === 'active' ? 'Deactivate' : 'Activate'}
                    onClick={() => onToggle(kit)}
                  />
                </>
              )}
              {canEdit && canDelete && <div className="h-px bg-brand-choco/8 my-1" />}
              {canDelete && (
                <MenuItem
                  icon={Trash2}
                  label="Delete"
                  onClick={() => {
                    onDelete(kit);
                    setOpen(false);
                  }}
                  danger
                />
              )}
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

/** ---------------- Kit Detail ---------------- */
function KitDetail({ kit }: { kit: Kit }) {
  const margin = (kit.sellingPrice || 0) - (kit.componentCost || 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex gap-6 flex-col sm:flex-row">
        <div className="w-full sm:w-64 h-64 rounded-3xl bg-gradient-to-br from-pastel-blue via-pastel-peach to-pastel-pink overflow-hidden shrink-0">
          {kit.imageUrl ? (
            <img
              src={kit.imageUrl}
              alt={kit.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Boxes className="w-24 h-24 text-brand-choco/30" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-brand-orange font-mono">
            {kit.sku}
          </p>
          <h2 className="font-display text-3xl font-bold mt-1">{kit.name}</h2>
          <p className="text-brand-choco-soft mt-2">
            {kit.description || 'No description'}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="badge badge-info">{kit.category}</span>
            <span className="badge badge-info">
              <Layers className="w-3 h-3" /> {kit.componentCount} components
            </span>
            <span className="badge badge-info">
              <Package className="w-3 h-3" /> {kit.totalPieces} pieces
            </span>
            <span
              className={cn(
                'badge',
                kit.status === 'active' && 'badge-success',
                kit.status === 'inactive' && 'badge-warning',
                kit.status === 'discontinued' && 'badge-danger'
              )}
            >
              {kit.status}
            </span>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DetailBox
          label="Component Cost"
          value={formatINR(kit.componentCost || 0)}
        />
        <DetailBox
          label="Selling Price"
          value={formatINR(kit.sellingPrice)}
          highlight
        />
        <DetailBox
          label="Margin"
          value={formatINR(margin)}
          positive={margin >= 0}
        />
        <DetailBox label="GST" value={`${kit.gstPercent}%`} />
      </div>

      {/* Components */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-lg">Components</h3>
          <span className="text-xs font-bold text-brand-choco-soft">
            {kit.components.length} items · {kit.totalPieces} pieces
          </span>
        </div>
        <div className="rounded-2xl border border-brand-choco/8 overflow-hidden">
          {kit.components.map((c, idx) => {
            const lineTotal = c.quantity * (c.price || 0);
            return (
              <div
                key={idx}
                className={cn(
                  'flex items-center gap-3 p-3',
                  idx !== 0 && 'border-t border-brand-choco/5'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-brand-orange-100 flex items-center justify-center shrink-0 text-xs font-bold text-brand-orange">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold truncate">{c.name}</p>
                    {c.productId && (
                      <span className="badge badge-info text-[9px] shrink-0">
                        <Link2 className="w-2.5 h-2.5" />
                        {c.productSku}
                      </span>
                    )}
                  </div>
                  {c.remarks && (
                    <p className="text-[10px] text-brand-choco-soft truncate">
                      {c.remarks}
                    </p>
                  )}
                </div>
                <div className="text-center shrink-0 w-20">
                  <p className="font-display font-bold text-lg leading-none">
                    {c.quantity}
                  </p>
                  <p className="text-[10px] text-brand-choco-soft">{c.unit}</p>
                </div>
                <div className="text-center shrink-0 w-20">
                  <p className="text-sm font-bold text-brand-choco-light">
                    {formatINR(c.price || 0)}
                  </p>
                  <p className="text-[10px] text-brand-choco-soft">per unit</p>
                </div>
                <div className="text-right shrink-0 w-24">
                  <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
                    Total
                  </p>
                  <p className="text-sm font-bold text-brand-orange">
                    {formatINR(lineTotal)}
                  </p>
                </div>
              </div>
            );
          })}
          <div className="bg-brand-cream-dark px-4 py-3 border-t border-brand-choco/8 flex items-center justify-between">
            <span className="text-sm font-bold uppercase text-brand-choco-soft tracking-wider">
              Total Component Cost
            </span>
            <span className="font-display font-bold text-xl text-brand-orange">
              {formatINR(kit.componentCost || 0)}
            </span>
          </div>
        </div>
      </div>

      <div className="text-xs text-brand-choco-soft">
        Created {kit.createdAt ? formatDate(kit.createdAt) : '—'}
      </div>
    </div>
  );
}

function DetailBox({
  label,
  value,
  highlight,
  positive,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={cn(
        'p-4 rounded-2xl border',
        highlight && 'bg-pastel-peach border-pastel-peach-deep/30',
        positive === true && !highlight && 'bg-pastel-green border-pastel-green-deep/30',
        positive === false && !highlight && 'bg-pastel-pink border-pastel-pink-deep/30',
        positive === undefined && !highlight && 'bg-brand-cream-dark border-brand-choco/8'
      )}
    >
      <p className="text-xs font-bold uppercase text-brand-choco-soft">
        {label}
      </p>
      <p className="font-display text-xl font-bold mt-1 truncate">{value}</p>
    </div>
  );
}