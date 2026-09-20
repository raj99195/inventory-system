import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Laptop,
  Plus,
  Search,
  Grid3x3,
  List,
  MoreVertical,
  Edit,
  Trash2,
  Download,
  Shield,
  ShieldAlert,
  Calendar,
  Barcode,
  Tag,
  CheckCircle2,
  UserCheck,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { ProductRowSkeleton } from '@/components/ui/Skeleton';
import AssetForm from '@/components/assets/AssetForm';
import { useAssets, deleteAsset } from '@/hooks/useAssets';
import { usePermission } from '@/hooks/usePermission';
import type { Asset, AssetStatus } from '@/types';
import { cn, formatDate, formatINR } from '@/lib/utils';

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | AssetStatus;

export default function AssetsPage() {
  const { assets, loading } = useAssets();
  const { can } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const canCreate = can('assets.create');
  const canEdit = can('assets.edit');
  const canDeletePerm = can('assets.delete');

  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate) {
      if (canCreate) {
        setSelected(null);
        setFormOpen(true);
      } else {
        toast.error("You don't have permission to register assets");
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, canCreate]);

  if (!can('assets.view')) {
    return <Navigate to="/" replace />;
  }

  const categories = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.category))).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.assetId.toLowerCase().includes(q) ||
        a.serialNumber.toLowerCase().includes(q) ||
        a.brand?.toLowerCase().includes(q);
      const matchCategory = categoryFilter === 'all' || a.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [assets, search, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    return {
      total: assets.length,
      available: assets.filter((a) => a.status === 'available').length,
      assigned: assets.filter((a) => a.status === 'assigned').length,
      repair: assets.filter((a) => a.status === 'under-repair').length,
    };
  }, [assets]);

  const totalValue = useMemo(() => {
    return assets.reduce((sum, a) => sum + (a.purchaseCost || 0), 0);
  }, [assets]);

  const handleEdit = (a: Asset) => {
    if (!canEdit) {
      toast.error("You don't have permission to edit assets");
      return;
    }
    setSelected(a);
    setFormOpen(true);
    setMenuOpen(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    if (!canDeletePerm) {
      toast.error("You don't have permission to delete assets");
      setDeleting(null);
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteAsset(deleting);
      toast.success('Asset removed');
      setDeleting(null);
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExport = () => {
    const rows = filtered.map((a) => ({
      'Asset ID': a.assetId,
      Name: a.name,
      Category: a.category,
      Brand: a.brand ?? '',
      Model: a.model ?? '',
      'Serial No': a.serialNumber,
      'Purchase Date': a.purchaseDate,
      'Purchase Cost': a.purchaseCost,
      'Warranty End': a.warrantyEnd ?? '',
      Condition: a.condition,
      Status: a.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    XLSX.writeFile(wb, `assets-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Asset Register
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Company Assets
          </h1>
          <p className="text-brand-choco-soft mt-2">
            Laptops, monitors, VR headsets and equipment inventory.
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
              Register Asset
            </button>
          )}
        </div>
      </div>

      {/* Total value banner */}
      {assets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card !p-5 flex items-center justify-between bg-gradient-to-r from-brand-cream-deep to-brand-cream-dark border border-brand-orange/20"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft">
              Total Asset Value
            </p>
            <p className="font-display text-3xl font-bold text-brand-orange mt-1">
              {formatINR(totalValue)}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center">
            <Laptop className="w-7 h-7 text-brand-orange" />
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip label="Total" value={stats.total} icon={Laptop} color="pastel-blue" />
        <StatChip
          label="Available"
          value={stats.available}
          icon={CheckCircle2}
          color="pastel-green"
        />
        <StatChip
          label="Assigned"
          value={stats.assigned}
          icon={UserCheck}
          color="pastel-peach"
        />
        <StatChip
          label="In Repair"
          value={stats.repair}
          icon={Wrench}
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
            placeholder="Search name, ID, serial no, brand..."
            className="input-field pl-11 !py-2.5"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-field !py-2.5 !w-auto"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark overflow-x-auto">
          {(
            [
              ['all', 'All'],
              ['available', 'Available'],
              ['assigned', 'Assigned'],
              ['under-repair', 'Repair'],
              ['damaged', 'Damaged'],
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
          icon={Laptop}
          title={assets.length === 0 ? 'No assets registered' : 'No matches'}
          description={
            assets.length === 0
              ? canCreate
                ? 'Register your first asset to start tracking equipment.'
                : 'No assets registered. Contact an admin.'
              : 'Try different search or filter.'
          }
          action={
            assets.length === 0 && canCreate
              ? {
                  label: 'Register First Asset',
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
            {filtered.map((a) => (
              <AssetGridCard
                key={a.id}
                asset={a}
                canEdit={canEdit}
                canDelete={canDeletePerm}
                onEdit={handleEdit}
                onDelete={setDeleting}
                onView={(a) => {
                  setSelected(a);
                  setDetailOpen(true);
                }}
                menuOpen={menuOpen === a.id}
                setMenuOpen={(o) => setMenuOpen(o ? a.id : null)}
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
                  <th className="p-4">Asset</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Serial No</th>
                  <th className="p-4">Warranty</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Cost</th>
                  <th className="p-4 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <AssetListRow
                    key={a.id}
                    asset={a}
                    canEdit={canEdit}
                    canDelete={canDeletePerm}
                    onEdit={handleEdit}
                    onDelete={setDeleting}
                    onView={(a) => {
                      setSelected(a);
                      setDetailOpen(true);
                    }}
                    menuOpen={menuOpen === a.id}
                    setMenuOpen={(o) => setMenuOpen(o ? a.id : null)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={selected ? 'Edit Asset' : 'Register New Asset'}
        description={
          selected ? 'Update asset details.' : 'Enter asset information below.'
        }
        size="lg"
        closeOnOverlay={false}
      >
        <AssetForm asset={selected} onClose={() => setFormOpen(false)} />
      </Modal>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.name}
        size="lg"
      >
        {selected && <AssetDetail asset={selected} />}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Asset?"
        message={`"${deleting?.name}" (${deleting?.assetId}) will be permanently removed.`}
        confirmLabel="Delete Asset"
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

function StatusBadge({ status }: { status: AssetStatus }) {
  const config = {
    available: { cls: 'badge-success', label: 'Available' },
    assigned: { cls: 'badge-info', label: 'Assigned' },
    'under-repair': { cls: 'badge-warning', label: 'In Repair' },
    damaged: { cls: 'badge-danger', label: 'Damaged' },
    lost: { cls: 'badge-danger', label: 'Lost' },
    retired: { cls: 'badge-warning', label: 'Retired' },
    disposed: { cls: 'badge-danger', label: 'Disposed' },
  }[status];
  return <span className={cn('badge', config.cls)}>{config.label}</span>;
}

function ConditionDot({ condition }: { condition: Asset['condition'] }) {
  const color = {
    new: 'bg-green-500',
    good: 'bg-blue-500',
    fair: 'bg-orange-500',
    poor: 'bg-red-500',
  }[condition];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className={cn('w-2 h-2 rounded-full', color)} />
      <span className="capitalize">{condition}</span>
    </span>
  );
}

function WarrantyStatus({ end }: { end?: string }) {
  if (!end) return <span className="text-xs text-brand-choco-soft">—</span>;
  const endDate = new Date(end);
  const now = new Date();
  const days = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
        <ShieldAlert className="w-3 h-3" />
        Expired
      </span>
    );
  if (days < 30)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600">
        <ShieldAlert className="w-3 h-3" />
        {days}d left
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
      <Shield className="w-3 h-3" />
      {formatDate(end)}
    </span>
  );
}

interface RowProps {
  asset: Asset;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (a: Asset) => void;
  onDelete: (a: Asset) => void;
  onView: (a: Asset) => void;
  menuOpen: boolean;
  setMenuOpen: (o: boolean) => void;
}

function AssetActionsMenu({
  asset,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  menuOpen,
  setMenuOpen,
}: {
  asset: Asset;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (a: Asset) => void;
  onDelete: (a: Asset) => void;
  menuOpen: boolean;
  setMenuOpen: (o: boolean) => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        className="w-8 h-8 rounded-xl bg-brand-cream-dark hover:bg-brand-cream-deep flex items-center justify-center"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      <AnimatePresence>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 mt-1 w-40 bg-white rounded-2xl shadow-2xl border border-brand-choco/8 py-1 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              {canEdit && (
                <button
                  onClick={() => onEdit(asset)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-brand-choco hover:bg-brand-cream-dark"
                >
                  <Edit className="w-4 h-4" /> Edit
                </button>
              )}
              {canEdit && canDelete && (
                <div className="h-px bg-brand-choco/8 my-1" />
              )}
              {canDelete && (
                <button
                  onClick={() => {
                    onDelete(asset);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function AssetGridCard({
  asset,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
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
      className="card !p-5 flex flex-col cursor-pointer relative"
      onClick={() => onView(asset)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-orange-100 to-brand-cream-deep flex items-center justify-center">
          <Laptop className="w-7 h-7 text-brand-orange" />
        </div>
        {hasAnyAction && (
          <AssetActionsMenu
            asset={asset}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={onEdit}
            onDelete={onDelete}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
          />
        )}
      </div>

      <p className="text-xs font-semibold text-brand-orange">{asset.assetId}</p>
      <h3 className="font-bold text-brand-choco leading-tight mt-0.5">
        {asset.name}
      </h3>
      <p className="text-xs text-brand-choco-soft mt-0.5 truncate">
        {asset.category} · {asset.brand || '—'}
      </p>

      <div className="mt-4 pt-4 border-t border-brand-choco/8 flex items-center justify-between">
        <StatusBadge status={asset.status} />
        <ConditionDot condition={asset.condition} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <div>
          <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
            Cost
          </p>
          <p className="font-bold text-brand-orange">
            {formatINR(asset.purchaseCost)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
            Warranty
          </p>
          <WarrantyStatus end={asset.warrantyEnd} />
        </div>
      </div>
    </motion.div>
  );
}

function AssetListRow({
  asset,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onView,
  menuOpen,
  setMenuOpen,
}: RowProps) {
  const hasAnyAction = canEdit || canDelete;

  return (
    <tr
      className="border-b border-brand-choco/5 hover:bg-brand-cream-dark/50 transition cursor-pointer"
      onClick={() => onView(asset)}
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-cream-dark flex items-center justify-center shrink-0">
            <Laptop className="w-5 h-5 text-brand-orange" />
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate">{asset.name}</p>
            <p className="text-xs text-brand-orange font-semibold">
              {asset.assetId}
            </p>
          </div>
        </div>
      </td>
      <td className="p-4 text-sm">{asset.category}</td>
      <td className="p-4 text-sm font-mono text-brand-choco-soft">
        {asset.serialNumber}
      </td>
      <td className="p-4">
        <WarrantyStatus end={asset.warrantyEnd} />
      </td>
      <td className="p-4">
        <div className="flex flex-col gap-1">
          <StatusBadge status={asset.status} />
          <ConditionDot condition={asset.condition} />
        </div>
      </td>
      <td className="p-4 text-right font-bold text-brand-orange">
        {formatINR(asset.purchaseCost)}
      </td>
      <td className="p-4 relative">
        {hasAnyAction && (
          <AssetActionsMenu
            asset={asset}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={onEdit}
            onDelete={onDelete}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
          />
        )}
      </td>
    </tr>
  );
}

function AssetDetail({ asset }: { asset: Asset }) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-6 flex-col sm:flex-row">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-orange-100 to-brand-cream-deep flex items-center justify-center shrink-0">
          <Laptop className="w-12 h-12 text-brand-orange" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-brand-orange">{asset.assetId}</p>
          <h2 className="font-display text-3xl font-bold mt-1">{asset.name}</h2>
          <p className="text-brand-choco-soft mt-1">
            {asset.brand} {asset.model ? `· ${asset.model}` : ''}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="badge badge-info">{asset.category}</span>
            <StatusBadge status={asset.status} />
            <ConditionDot condition={asset.condition} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DetailBox label="Purchase Cost" value={formatINR(asset.purchaseCost)} highlight />
        <DetailBox label="Purchase Date" value={formatDate(asset.purchaseDate)} />
        <DetailBox
          label="Warranty End"
          value={asset.warrantyEnd ? formatDate(asset.warrantyEnd) : '—'}
        />
        <DetailBox label="Serial No." value={asset.serialNumber} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoRow icon={Tag} label="Brand & Model" value={`${asset.brand ?? '—'} ${asset.model ?? ''}`} />
        <InfoRow icon={Barcode} label="Serial Number" value={asset.serialNumber} />
        <InfoRow icon={Calendar} label="Purchase Date" value={formatDate(asset.purchaseDate)} />
        <InfoRow
          icon={Shield}
          label="Warranty Period"
          value={
            asset.warrantyStart && asset.warrantyEnd
              ? `${formatDate(asset.warrantyStart)} → ${formatDate(asset.warrantyEnd)}`
              : '—'
          }
        />
      </div>

      {asset.remarks && (
        <div className="p-4 rounded-2xl bg-brand-cream-dark/50">
          <p className="text-xs font-bold uppercase text-brand-choco-soft mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Remarks
          </p>
          <p className="text-sm">{asset.remarks}</p>
        </div>
      )}
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
      <p className="font-display text-lg font-bold mt-1 truncate">{value}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="p-4 rounded-2xl bg-brand-cream-dark/50 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-brand-orange" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-brand-choco-soft">
          {label}
        </p>
        <p className="font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}
