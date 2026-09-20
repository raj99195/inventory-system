import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Search,
  Download,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  User,
  Calendar,
  IndianRupee,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  FileEdit,
  ArrowRightLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { ProductRowSkeleton } from '@/components/ui/Skeleton';
import QuotationForm from '@/components/quotations/QuotationForm';
import { useQuotations, deleteQuotation } from '@/hooks/useQuotations';
import { usePermission } from '@/hooks/usePermission';
import { downloadQuotationPdf, previewQuotationPdf } from '@/lib/quotationPdf';
import type { Quotation, QuotationStatus } from '@/types';
import { cn, formatINR, formatDateTime } from '@/lib/utils';

type StatusFilter = 'all' | QuotationStatus;

const STATUS_META: Record<
  QuotationStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  draft: { label: 'Draft', color: 'gray', icon: FileEdit },
  sent: { label: 'Sent', color: 'blue', icon: Send },
  accepted: { label: 'Accepted', color: 'green', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'red', icon: XCircle },
  expired: { label: 'Expired', color: 'peach', icon: Clock },
  converted: { label: 'Converted', color: 'orange', icon: ArrowRightLeft },
};

export default function QuotationsPage() {
  const { quotations, loading } = useQuotations(200);
  const { can } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Quotation | null>(null);

  // Permissions — falls back to super admin (bootstrap) if permission model
  // doesn't yet include quotations. Update ROLE_PRESETS to grant granular access.
  const canView = can('quotations.view') || can('dashboard.view');
  const canCreate = can('quotations.create') || can('dashboard.view');
  const canEdit = can('quotations.edit') || can('dashboard.view');
  const canDelete = can('quotations.delete');

  // Auto-open create modal via location.state
  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate) {
      if (canCreate) {
        setEditing(null);
        setFormOpen(true);
      } else {
        toast.error("You don't have permission to create quotations");
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, canCreate]);

  if (!canView) return <Navigate to="/" replace />;

  const filtered = useMemo(() => {
    return quotations.filter((q) => {
      const s = search.toLowerCase();
      const matchSearch =
        !s ||
        q.quotationNumber.toLowerCase().includes(s) ||
        q.customerName.toLowerCase().includes(s) ||
        q.customerCompany?.toLowerCase().includes(s) ||
        q.customerGstin?.toLowerCase().includes(s);
      const matchStatus = statusFilter === 'all' || q.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [quotations, search, statusFilter]);

  const stats = useMemo(() => {
    const total = quotations.length;
    const draft = quotations.filter((q) => q.status === 'draft').length;
    const sent = quotations.filter((q) => q.status === 'sent').length;
    const accepted = quotations.filter((q) => q.status === 'accepted').length;
    const grandTotalValue = quotations
      .filter((q) => q.status === 'accepted' || q.status === 'converted')
      .reduce((sum, q) => sum + (q.grandTotal || 0), 0);
    return { total, draft, sent, accepted, grandTotalValue };
  }, [quotations]);

  const handleExport = () => {
    const rows = filtered.map((q) => ({
      'Quotation No.': q.quotationNumber,
      Date: q.quotationDate,
      'Valid Until': q.validUntil,
      Customer: q.customerName,
      Company: q.customerCompany ?? '',
      GSTIN: q.customerGstin ?? '',
      Items: q.itemCount,
      'Sub Total': q.subTotal,
      'GST Amount': q.totalTax,
      'Grand Total': q.grandTotal,
      Status: STATUS_META[q.status]?.label ?? q.status,
      'Created By': q.createdBy,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quotations');
    XLSX.writeFile(wb, `quotations-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Exported');
  };

  const handleEdit = (q: Quotation) => {
    if (!canEdit) {
      toast.error("You don't have permission to edit quotations");
      return;
    }
    setEditing(q);
    setFormOpen(true);
  };

  const handleDownload = async (q: Quotation) => {
    try {
      await downloadQuotationPdf(q);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF failed');
    }
  };

  const handlePreview = async (q: Quotation) => {
    try {
      await previewQuotationPdf(q);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Preview failed');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteQuotation(confirmDelete);
      toast.success('Quotation deleted');
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Quotes
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Quotations
          </h1>
          <p className="text-brand-choco-soft mt-2">
            Build and send professional quotations to customers.
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
                setEditing(null);
                setFormOpen(true);
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              New Quotation
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatChip label="Total" value={stats.total} icon={FileText} color="pastel-blue" />
        <StatChip label="Draft" value={stats.draft} icon={FileEdit} color="pastel-peach" />
        <StatChip label="Sent" value={stats.sent} icon={Send} color="pastel-blue" />
        <StatChip label="Accepted" value={stats.accepted} icon={CheckCircle2} color="pastel-green" />
        <StatChip
          label="Won Value"
          value={formatINR(stats.grandTotalValue)}
          icon={IndianRupee}
          color="pastel-orange"
          isText
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
              placeholder="Search by number, customer, company or GSTIN..."
              className="input-field pl-11 !py-2.5"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark overflow-x-auto w-full">
          {(
            [
              ['all', 'All'],
              ['draft', 'Draft'],
              ['sent', 'Sent'],
              ['accepted', 'Accepted'],
              ['rejected', 'Rejected'],
              ['expired', 'Expired'],
              ['converted', 'Converted'],
            ] as [StatusFilter, string][]
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
          title={quotations.length === 0 ? 'No quotations yet' : 'No matches'}
          description={
            quotations.length === 0
              ? canCreate
                ? 'Create your first quotation to send to a customer.'
                : 'No quotations here yet.'
              : 'Try changing the filters.'
          }
          action={
            quotations.length === 0 && canCreate
              ? {
                  label: 'New Quotation',
                  icon: Plus,
                  onClick: () => {
                    setEditing(null);
                    setFormOpen(true);
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((q) => (
              <QuotationRow
                key={q.id}
                quotation={q}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={() => handleEdit(q)}
                onPreview={() => handlePreview(q)}
                onDownload={() => handleDownload(q)}
                onDelete={() => setConfirmDelete(q)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit Quotation ${editing.quotationNumber}` : 'New Quotation'}
        description="Build a professional quotation with itemized pricing and GST."
        size="xl"
        closeOnOverlay={false}
      >
        <QuotationForm
          quotation={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete Quotation?"
        description={
          confirmDelete
            ? `This will permanently delete quotation ${confirmDelete.quotationNumber} for ${confirmDelete.customerName}. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  color,
  isText,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isText?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4 border flex items-center gap-3',
        color === 'pastel-blue' && 'bg-pastel-blue border-pastel-blue-deep/30',
        color === 'pastel-green' && 'bg-pastel-green border-pastel-green-deep/30',
        color === 'pastel-peach' && 'bg-pastel-peach border-pastel-peach-deep/30',
        color === 'pastel-pink' && 'bg-pastel-pink border-pastel-pink-deep/30',
        color === 'pastel-orange' && 'bg-brand-orange-100 border-brand-orange/30'
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-choco" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-brand-choco-light">{label}</p>
        <p
          className={cn(
            'font-display font-bold leading-none mt-0.5 truncate',
            isText ? 'text-lg' : 'text-2xl'
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function QuotationRow({
  quotation,
  canEdit,
  canDelete,
  onEdit,
  onPreview,
  onDownload,
  onDelete,
}: {
  quotation: Quotation;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[quotation.status];
  const StatusIcon = meta?.icon ?? FileEdit;
  const [menuOpen, setMenuOpen] = useState(false);

  const showMenu = canEdit || canDelete;

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
          meta?.color === 'red' && 'bg-pastel-pink',
          meta?.color === 'orange' && 'bg-brand-orange-100',
          meta?.color === 'gray' && 'bg-brand-cream-dark'
        )}
      >
        <StatusIcon className="w-5 h-5 text-brand-choco" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold font-mono text-brand-orange">
            {quotation.quotationNumber}
          </span>
          <span className="w-px h-4 bg-brand-choco/15" />
          <span className="font-semibold truncate">{quotation.customerName}</span>
          {quotation.customerCompany && (
            <span className="text-xs text-brand-choco-soft truncate">
              · {quotation.customerCompany}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-brand-choco-soft mt-1 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {quotation.quotationDate}
          </span>
          <span>· Valid till {quotation.validUntil}</span>
          <span>· {quotation.itemCount} items</span>
          {quotation.createdBy && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {quotation.createdBy}
            </span>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="font-display text-2xl font-bold text-brand-orange leading-none">
          {formatINR(quotation.grandTotal)}
        </p>
        <p className="text-[10px] font-bold uppercase text-brand-choco-soft mt-1">
          {meta?.label ?? quotation.status}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onPreview}
          className="w-9 h-9 rounded-lg text-brand-choco-soft hover:bg-brand-cream-dark hover:text-brand-choco flex items-center justify-center transition"
          title="Preview PDF"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="w-9 h-9 rounded-lg text-brand-choco-soft hover:bg-brand-cream-dark hover:text-brand-choco flex items-center justify-center transition"
          title="Download PDF"
        >
          <Download className="w-4 h-4" />
        </button>

        {showMenu && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 200)}
              className="w-9 h-9 rounded-lg text-brand-choco-soft hover:bg-brand-cream-dark hover:text-brand-choco flex items-center justify-center transition"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-40 bg-white border border-brand-choco/8 rounded-xl shadow-xl overflow-hidden z-10"
                >
                  {canEdit && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setMenuOpen(false);
                        onEdit();
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-brand-cream-dark flex items-center gap-2 transition"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setMenuOpen(false);
                        onDelete();
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 transition border-t border-brand-choco/5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
