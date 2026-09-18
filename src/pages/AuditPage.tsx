import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Search,
  Download,
  Calendar,
  User,
  Package,
  ArrowLeftRight,
  Laptop,
  Users,
  FileText,
  UserCheck,
  Layers,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Sparkles,
  Filter,
  ShieldCheck,
  Clock,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import EmptyState from '@/components/ui/EmptyState';
import { ProductRowSkeleton } from '@/components/ui/Skeleton';
import { useAuditLog } from '@/hooks/useAuditLog';
import type { AuditLog } from '@/types';
import { cn, formatDateTime } from '@/lib/utils';

type ModuleFilter =
  | 'all'
  | 'products'
  | 'stock'
  | 'assets'
  | 'employees'
  | 'assignments'
  | 'invoices'
  | 'categories';

type ActionFilter = 'all' | 'create' | 'update' | 'delete' | 'stock' | 'assign';

const MODULE_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  products: { icon: Package, color: 'blue', label: 'Products' },
  stock: { icon: ArrowLeftRight, color: 'orange', label: 'Stock' },
  assets: { icon: Laptop, color: 'peach', label: 'Assets' },
  employees: { icon: Users, color: 'green', label: 'Employees' },
  assignments: { icon: UserCheck, color: 'pink', label: 'Assignments' },
  invoices: { icon: FileText, color: 'blue', label: 'Invoices' },
  categories: { icon: Layers, color: 'orange', label: 'Categories' },
};

const ACTION_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; verb: string }
> = {
  create: { icon: Plus, color: 'green', verb: 'created' },
  update: { icon: Pencil, color: 'blue', verb: 'updated' },
  delete: { icon: Trash2, color: 'red', verb: 'deleted' },
  'stock-in': { icon: Plus, color: 'green', verb: 'stock-in' },
  'stock-out': { icon: Pencil, color: 'orange', verb: 'stock-out' },
  return: { icon: ArrowRight, color: 'blue', verb: 'returned' },
  damage: { icon: Trash2, color: 'red', verb: 'damaged' },
  lost: { icon: Trash2, color: 'red', verb: 'lost' },
  adjustment: { icon: Pencil, color: 'orange', verb: 'adjusted' },
  assign: { icon: UserCheck, color: 'green', verb: 'assigned' },
  transfer: { icon: ArrowRight, color: 'blue', verb: 'transferred' },
  upload: { icon: FileText, color: 'blue', verb: 'uploaded' },
  process: { icon: ShieldCheck, color: 'green', verb: 'processed' },
  cancel: { icon: Trash2, color: 'red', verb: 'cancelled' },
};

export default function AuditPage() {
  const { entries, loading } = useAuditLog(500);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        e.performedByEmail?.toLowerCase().includes(q) ||
        e.recordId?.toLowerCase().includes(q) ||
        e.action?.toLowerCase().includes(q) ||
        JSON.stringify(e.newValue ?? {}).toLowerCase().includes(q) ||
        JSON.stringify(e.previousValue ?? {}).toLowerCase().includes(q);
      const matchModule = moduleFilter === 'all' || e.module === moduleFilter;
      const matchAction =
        actionFilter === 'all' ||
        (actionFilter === 'stock' &&
          ['stock-in', 'stock-out', 'adjustment', 'damage', 'lost'].includes(e.action)) ||
        (actionFilter === 'assign' &&
          ['assign', 'return', 'transfer'].includes(e.action)) ||
        e.action === actionFilter;
      const createdAt = e.createdAt?.toDate?.() ?? null;
      const matchFrom = !dateFrom || (createdAt && createdAt >= new Date(dateFrom));
      const matchTo =
        !dateTo ||
        (createdAt &&
          createdAt <= new Date(new Date(dateTo).setHours(23, 59, 59)));
      return matchSearch && matchModule && matchAction && matchFrom && matchTo;
    });
  }, [entries, search, moduleFilter, actionFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const uniqueUsers = new Set(entries.map((e) => e.performedByEmail));
    const todayCount = entries.filter((e) => {
      const d = e.createdAt?.toDate?.();
      return d && d >= today;
    }).length;
    const weekCount = entries.filter((e) => {
      const d = e.createdAt?.toDate?.();
      return d && d >= weekAgo;
    }).length;
    return {
      total: entries.length,
      today: todayCount,
      week: weekCount,
      users: uniqueUsers.size,
    };
  }, [entries]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, AuditLog[]> = {};
    filtered.forEach((e) => {
      const d = e.createdAt?.toDate?.();
      if (!d) return;
      const key = d.toDateString();
      groups[key] = groups[key] ?? [];
      groups[key].push(e);
    });
    return Object.entries(groups).map(([date, items]) => ({
      date: new Date(date),
      items,
    }));
  }, [filtered]);

  const handleExport = () => {
    const rows = filtered.map((e) => ({
      Date: e.createdAt ? formatDateTime(e.createdAt) : '',
      Module: e.module,
      Action: e.action,
      'Record Type': e.recordType,
      'Record ID': e.recordId,
      'Previous Value': JSON.stringify(e.previousValue ?? {}),
      'New Value': JSON.stringify(e.newValue ?? {}),
      Reason: e.reason ?? '',
      'Performed By': e.performedByEmail,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
    XLSX.writeFile(wb, `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3 h-3" />
            Compliance
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Audit Log
          </h1>
          <p className="text-brand-choco-soft mt-2">
            Complete history of every action performed in the system.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={!filtered.length}
          className="btn-secondary disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip
          label="Total Entries"
          value={stats.total}
          icon={History}
          color="pastel-blue"
        />
        <StatChip
          label="Today"
          value={stats.today}
          icon={Clock}
          color="pastel-green"
        />
        <StatChip
          label="This Week"
          value={stats.week}
          icon={Activity}
          color="pastel-peach"
        />
        <StatChip
          label="Active Users"
          value={stats.users}
          icon={User}
          color="pastel-pink"
        />
      </div>

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user, record ID, action or content..."
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

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="w-4 h-4 text-brand-choco-soft" />
            <span className="text-xs font-bold uppercase text-brand-choco-soft">
              Module:
            </span>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark overflow-x-auto">
            {(
              [
                ['all', 'All'],
                ['products', 'Products'],
                ['stock', 'Stock'],
                ['assets', 'Assets'],
                ['employees', 'Employees'],
                ['assignments', 'Assignments'],
                ['invoices', 'Invoices'],
              ] as [ModuleFilter, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setModuleFilter(val)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                  moduleFilter === val
                    ? 'bg-white text-brand-choco shadow-sm'
                    : 'text-brand-choco-soft hover:text-brand-choco'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4 text-brand-choco-soft" />
            <span className="text-xs font-bold uppercase text-brand-choco-soft">
              Action:
            </span>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark overflow-x-auto">
            {(
              [
                ['all', 'All'],
                ['create', 'Created'],
                ['update', 'Updated'],
                ['delete', 'Deleted'],
                ['stock', 'Stock Changes'],
                ['assign', 'Assignments'],
              ] as [ActionFilter, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setActionFilter(val)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                  actionFilter === val
                    ? 'bg-white text-brand-choco shadow-sm'
                    : 'text-brand-choco-soft hover:text-brand-choco'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <ProductRowSkeleton key={i} />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={History}
          title={entries.length === 0 ? 'No activity yet' : 'No matches'}
          description={
            entries.length === 0
              ? 'System activity will appear here as you use the app.'
              : 'Try changing filters or search.'
          }
        />
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <DateGroup
              key={group.date.toISOString()}
              date={group.date}
              items={group.items}
              expanded={expanded}
              setExpanded={setExpanded}
            />
          ))}
        </div>
      )}
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

function DateGroup({
  date,
  items,
  expanded,
  setExpanded,
}: {
  date: Date;
  items: AuditLog[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
}) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  let label = date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  if (dateOnly.getTime() === today.getTime()) label = `Today · ${label}`;
  else if (dateOnly.getTime() === yesterday.getTime())
    label = `Yesterday · ${label}`;

  return (
    <div>
      <div className="sticky top-16 z-10 flex items-center gap-3 mb-4 -mx-4 lg:-mx-8 px-4 lg:px-8 py-3 bg-brand-cream/80 backdrop-blur-lg">
        <div className="h-px flex-1 bg-brand-choco/8" />
        <span className="text-xs font-bold uppercase tracking-widest text-brand-choco-soft px-3 py-1 rounded-full bg-white border border-brand-choco/8">
          {label}
        </span>
        <span className="text-xs text-brand-choco-soft">{items.length} events</span>
        <div className="h-px flex-1 bg-brand-choco/8" />
      </div>

      <div className="relative pl-6">
        {/* Vertical timeline line */}
        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-brand-orange/20 via-brand-orange/40 to-brand-orange/20 rounded-full" />

        <div className="space-y-3">
          {items.map((entry, i) => (
            <AuditEntry
              key={entry.id}
              entry={entry}
              isExpanded={expanded === entry.id}
              onToggle={() =>
                setExpanded(expanded === entry.id ? null : entry.id)
              }
              delay={i * 0.02}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditEntry({
  entry,
  isExpanded,
  onToggle,
  delay,
}: {
  entry: AuditLog;
  isExpanded: boolean;
  onToggle: () => void;
  delay: number;
}) {
  const moduleMeta = MODULE_META[entry.module] ?? {
    icon: History,
    color: 'blue',
    label: entry.module,
  };
  const actionMeta = ACTION_META[entry.action] ?? {
    icon: Sparkles,
    color: 'orange',
    verb: entry.action,
  };
  const ActionIcon = actionMeta.icon;
  const ModuleIcon = moduleMeta.icon;

  const hasDetails =
    entry.previousValue || entry.newValue || entry.reason;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="relative"
    >
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute -left-4 top-4 w-4 h-4 rounded-full border-2 border-brand-cream',
          actionMeta.color === 'green' && 'bg-green-500',
          actionMeta.color === 'blue' && 'bg-blue-500',
          actionMeta.color === 'red' && 'bg-red-500',
          actionMeta.color === 'orange' && 'bg-brand-orange'
        )}
      />

      <div
        className={cn(
          'card !p-4 cursor-pointer transition-all',
          isExpanded && 'shadow-lift'
        )}
        onClick={hasDetails ? onToggle : undefined}
      >
        <div className="flex items-start gap-3">
          {/* Action icon */}
          <div
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0',
              actionMeta.color === 'green' && 'bg-pastel-green',
              actionMeta.color === 'blue' && 'bg-pastel-blue',
              actionMeta.color === 'red' && 'bg-pastel-pink',
              actionMeta.color === 'orange' && 'bg-pastel-peach'
            )}
          >
            <ActionIcon className="w-4 h-4 text-brand-choco" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">
                <span className="text-brand-orange">{entry.performedByEmail}</span>{' '}
                <span className="text-brand-choco-soft">{actionMeta.verb}</span>
              </span>
              <span
                className={cn(
                  'badge',
                  moduleMeta.color === 'blue' && 'badge-info',
                  moduleMeta.color === 'green' && 'badge-success',
                  moduleMeta.color === 'peach' && 'badge-warning',
                  moduleMeta.color === 'pink' && 'badge-danger',
                  moduleMeta.color === 'orange' && 'bg-brand-orange-100 text-brand-orange-dark'
                )}
              >
                <ModuleIcon className="w-3 h-3" />
                {moduleMeta.label}
              </span>
              {entry.recordType && (
                <span className="text-xs text-brand-choco-soft">
                  · {entry.recordType}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-brand-choco-soft mt-1 flex-wrap">
              {entry.createdAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDateTime(entry.createdAt)}
                </span>
              )}
              {entry.recordId && (
                <span className="font-mono">ID: {entry.recordId.slice(0, 8)}...</span>
              )}
              {entry.reason && (
                <span className="italic">"{entry.reason}"</span>
              )}
            </div>
          </div>

          {hasDetails && (
            <ChevronDown
              className={cn(
                'w-4 h-4 text-brand-choco-soft transition-transform shrink-0',
                isExpanded && 'rotate-180'
              )}
            />
          )}
        </div>

        {/* Expandable diff view */}
        <AnimatePresence>
          {isExpanded && hasDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-brand-choco/8 overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {entry.previousValue && Object.keys(entry.previousValue).length > 0 && (
                  <div className="p-3 rounded-2xl bg-pastel-pink/40 border border-pastel-pink-deep/30">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-800 mb-2">
                      Previous Value
                    </p>
                    <DiffValue value={entry.previousValue} />
                  </div>
                )}
                {entry.newValue && Object.keys(entry.newValue).length > 0 && (
                  <div className="p-3 rounded-2xl bg-pastel-green/40 border border-pastel-green-deep/30">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-green-800 mb-2">
                      New Value
                    </p>
                    <DiffValue value={entry.newValue} />
                  </div>
                )}
              </div>
              {entry.reason && (
                <div className="mt-3 p-3 rounded-2xl bg-brand-cream-dark/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                    Reason
                  </p>
                  <p className="text-sm">{entry.reason}</p>
                </div>
              )}
              <div className="mt-3 text-xs text-brand-choco-soft font-mono">
                Full Record ID: <span className="font-semibold">{entry.recordId}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function DiffValue({ value }: { value: Record<string, unknown> }) {
  return (
    <div className="space-y-1 text-xs font-mono">
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="flex items-start gap-2">
          <span className="font-bold text-brand-choco-soft">{k}:</span>
          <span className="text-brand-choco break-all">
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}