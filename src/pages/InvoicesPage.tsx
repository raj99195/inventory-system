import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Upload,
  Search,
  Download,
  Eye,
  Trash2,
  MoreVertical,
  CheckCircle2,
  Clock,
  XCircle,
  User,
  Calendar,
  IndianRupee,
  Package,
  Hash,
  Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { ProductRowSkeleton } from '@/components/ui/Skeleton';
import InvoiceUploadFlow from '@/components/invoices/InvoiceUploadFlow';
import { useInvoices, deleteInvoice } from '@/hooks/useInvoices';
import { usePermission } from '@/hooks/usePermission';
import type { Invoice, InvoiceStatus } from '@/types';
import { cn, formatDate, formatDateTime, formatINR } from '@/lib/utils';

type FilterStatus = 'all' | InvoiceStatus;

const STATUS_META: Record<
  InvoiceStatus,
  { badge: string; label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  uploaded: { badge: 'badge-info', label: 'Uploaded', icon: Upload },
  extracted: { badge: 'badge-info', label: 'Extracted', icon: FileText },
  'pending-verification': { badge: 'badge-warning', label: 'Pending', icon: Clock },
  verified: { badge: 'badge-info', label: 'Verified', icon: CheckCircle2 },
  'stock-updated': { badge: 'badge-success', label: 'Processed', icon: CheckCircle2 },
  failed: { badge: 'badge-danger', label: 'Failed', icon: XCircle },
  cancelled: { badge: 'badge-warning', label: 'Cancelled', icon: XCircle },
};

export default function InvoicesPage() {
  const { invoices, loading } = useInvoices(300);
  const { can } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const canUpload = can('invoices.upload');
  const canDeletePerm = can('invoices.delete');

  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate) {
      if (canUpload) {
        setUploadOpen(true);
      } else {
        toast.error("You don't have permission to upload invoices");
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, canUpload]);

  if (!can('invoices.view')) {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: invoices.length,
      processed: invoices.filter((i) => i.status === 'stock-updated').length,
      pending: invoices.filter(
        (i) => i.status === 'pending-verification' || i.status === 'verified'
      ).length,
      totalValue: invoices
        .filter((i) => i.status === 'stock-updated')
        .reduce((sum, i) => sum + (i.totalAmount || 0), 0),
    };
  }, [invoices]);

  const handleDelete = async () => {
    if (!deleting) return;
    if (!canDeletePerm) {
      toast.error("You don't have permission to delete invoices");
      setDeleting(null);
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteInvoice(deleting);
      toast.success('Invoice deleted');
      setDeleting(null);
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExport = () => {
    const rows = filtered.map((i) => ({
      'Invoice #': i.invoiceNumber,
      Date: i.invoiceDate,
      Customer: i.customerName ?? '',
      GSTIN: i.customerGstin ?? '',
      'Total Amount': i.totalAmount,
      'Line Items': i.lineItems?.length ?? 0,
      Status: STATUS_META[i.status]?.label ?? i.status,
      'Uploaded By': i.uploadedBy,
      'Uploaded At': i.uploadedAt ? formatDateTime(i.uploadedAt) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `invoices-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Invoice Manager
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Invoices
          </h1>
          <p className="text-brand-choco-soft mt-2">
            Upload invoice PDFs — auto-extract & update stock.
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
          {canUpload && (
            <button onClick={() => setUploadOpen(true)} className="btn-primary">
              <Upload className="w-4 h-4" />
              Upload PDF
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip
          label="Total Invoices"
          value={stats.total.toString()}
          icon={FileText}
          color="pastel-blue"
        />
        <StatChip
          label="Processed"
          value={stats.processed.toString()}
          icon={CheckCircle2}
          color="pastel-green"
        />
        <StatChip
          label="Pending"
          value={stats.pending.toString()}
          icon={Clock}
          color="pastel-peach"
        />
        <StatChip
          label="Value Processed"
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
            placeholder="Search invoice # or customer..."
            className="input-field pl-11 !py-2.5"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark overflow-x-auto">
          {(
            [
              ['all', 'All'],
              ['stock-updated', 'Processed'],
              ['pending-verification', 'Pending'],
              ['cancelled', 'Cancelled'],
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
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <ProductRowSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={invoices.length === 0 ? 'No invoices yet' : 'No matches'}
          description={
            invoices.length === 0
              ? canUpload
                ? 'Upload your first invoice PDF to start.'
                : 'No invoices yet. Contact an admin to upload.'
              : 'Try changing search or filter.'
          }
          action={
            invoices.length === 0 && canUpload
              ? {
                  label: 'Upload First Invoice',
                  icon: Upload,
                  onClick: () => setUploadOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                canDelete={canDeletePerm}
                onView={(i) => {
                  setSelected(i);
                  setDetailOpen(true);
                }}
                onDelete={setDeleting}
                menuOpen={menuOpen === inv.id}
                setMenuOpen={(o) => setMenuOpen(o ? inv.id : null)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Upload flow modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Import Invoice"
        description="PDF → auto extract → verify → update stock"
        size="xl"
        closeOnOverlay={false}
      >
        <InvoiceUploadFlow onClose={() => setUploadOpen(false)} />
      </Modal>

      {/* Detail modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.invoiceNumber}
        description="Invoice details & line items"
        size="lg"
      >
        {selected && <InvoiceDetail invoice={selected} />}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Invoice Record?"
        message={`Invoice ${deleting?.invoiceNumber} record will be removed. Stock transactions already applied will NOT be reversed.`}
        confirmLabel="Delete"
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
      <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-brand-choco" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-brand-choco-light">{label}</p>
        <p className="font-display text-xl font-bold leading-none mt-0.5 truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

function InvoiceRow({
  invoice,
  canDelete,
  onView,
  onDelete,
  menuOpen,
  setMenuOpen,
}: {
  invoice: Invoice;
  canDelete: boolean;
  onView: (i: Invoice) => void;
  onDelete: (i: Invoice) => void;
  menuOpen: boolean;
  setMenuOpen: (o: boolean) => void;
}) {
  const meta = STATUS_META[invoice.status];
  const StatusIcon = meta?.icon ?? FileText;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="card !p-4 flex items-center gap-4 hover:shadow-lift cursor-pointer"
      onClick={() => onView(invoice)}
    >
      <div className="w-12 h-12 rounded-2xl bg-brand-cream-dark flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-brand-orange" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-brand-orange">
            {invoice.invoiceNumber}
          </span>
          <span className={cn('badge', meta?.badge)}>
            <StatusIcon className="w-3 h-3" />
            {meta?.label ?? invoice.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-brand-choco-soft mt-1 flex-wrap">
          {invoice.customerName && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {invoice.customerName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(invoice.invoiceDate)}
          </span>
          <span className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            {invoice.lineItems?.length ?? 0} items
          </span>
          <span>By: {invoice.uploadedBy}</span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="font-display text-xl font-bold text-brand-orange">
          {formatINR(invoice.totalAmount)}
        </p>
        {invoice.uploadedAt && (
          <p className="text-xs text-brand-choco-soft">
            {formatDateTime(invoice.uploadedAt)}
          </p>
        )}
      </div>

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
                <button
                  onClick={() => {
                    onView(invoice);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-brand-choco hover:bg-brand-cream-dark"
                >
                  <Eye className="w-4 h-4" /> View
                </button>
                {canDelete && (
                  <>
                    <div className="h-px bg-brand-choco/8 my-1" />
                    <button
                      onClick={() => {
                        onDelete(invoice);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const meta = STATUS_META[invoice.status];
  const StatusIcon = meta?.icon ?? FileText;
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold text-brand-orange">
            <Hash className="inline w-3 h-3 mr-0.5" />
            Invoice
          </p>
          <h2 className="font-display text-3xl font-bold mt-0.5">
            {invoice.invoiceNumber}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn('badge', meta?.badge)}>
              <StatusIcon className="w-3 h-3" />
              {meta?.label}
            </span>
            <span className="text-xs text-brand-choco-soft">
              <Calendar className="inline w-3 h-3 mr-0.5" />
              {formatDate(invoice.invoiceDate)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-brand-choco-soft">Total Amount</p>
          <p className="font-display text-3xl font-bold text-brand-orange">
            {formatINR(invoice.totalAmount)}
          </p>
        </div>
      </div>

      {(invoice.customerName || invoice.customerGstin) && (
        <div className="p-4 rounded-2xl bg-brand-cream-dark/50">
          <p className="text-xs font-bold uppercase text-brand-choco-soft mb-2">
            <User className="inline w-3 h-3 mr-1" /> Customer
          </p>
          <p className="font-bold">{invoice.customerName || '—'}</p>
          {invoice.customerGstin && (
            <p className="text-xs text-brand-choco-soft mt-1">
              <Building2 className="inline w-3 h-3 mr-1" />
              GSTIN: {invoice.customerGstin}
            </p>
          )}
        </div>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-2">
          Line Items ({invoice.lineItems?.length ?? 0})
        </p>
        <div className="overflow-x-auto rounded-2xl border border-brand-choco/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-choco/8 text-left text-xs font-bold uppercase tracking-wider text-brand-choco-soft bg-brand-cream-dark/50">
                <th className="p-3">Product</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems?.map((item, i) => (
                <tr key={i} className="border-b border-brand-choco/5">
                  <td className="p-3">
                    <p className="font-semibold">{item.productName}</p>
                    {item.matchedProductId ? (
                      <p className="text-xs text-green-700 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Matched
                      </p>
                    ) : (
                      <p className="text-xs text-red-600 mt-0.5">Not matched</p>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {item.quantity}
                  </td>
                  <td className="p-3 text-right">{formatINR(item.rate)}</td>
                  <td className="p-3 text-right font-bold">
                    {formatINR(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-2xl bg-brand-cream-dark/50">
          <p className="text-xs font-bold uppercase text-brand-choco-soft">
            Uploaded By
          </p>
          <p className="font-semibold mt-1">{invoice.uploadedBy}</p>
        </div>
        <div className="p-3 rounded-2xl bg-brand-cream-dark/50">
          <p className="text-xs font-bold uppercase text-brand-choco-soft">
            Uploaded At
          </p>
          <p className="font-semibold mt-1">
            {invoice.uploadedAt ? formatDateTime(invoice.uploadedAt) : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
