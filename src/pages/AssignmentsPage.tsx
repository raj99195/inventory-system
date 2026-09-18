import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCheck,
  Plus,
  Search,
  Laptop,
  ArrowRight,
  RotateCcw,
  Package,
  Users,
  Calendar,
  Download,
  History,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { ProductRowSkeleton } from '@/components/ui/Skeleton';
import AssignForm from '@/components/assignments/AssignForm';
import ReturnForm from '@/components/assignments/ReturnForm';
import TransferForm from '@/components/assignments/TransferForm';
import { useAssets } from '@/hooks/useAssets';
import { useEmployees } from '@/hooks/useEmployees';
import { useAssignments } from '@/hooks/useAssignments';
import type { Asset, Employee, AssetAssignment } from '@/types';
import { cn, formatDate, formatDateTime } from '@/lib/utils';

type Tab = 'current' | 'history';

export default function AssignmentsPage() {
  const { assets, loading: assetsLoading } = useAssets();
  const { employees } = useEmployees();
  const { assignments, loading: assignLoading } = useAssignments(500);
  const [tab, setTab] = useState<Tab>('current');
  const [search, setSearch] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [returnFor, setReturnFor] = useState<{
    asset: Asset;
    employee: Employee;
  } | null>(null);
  const [transferFor, setTransferFor] = useState<{
    asset: Asset;
    employee: Employee;
  } | null>(null);

  const employeeMap = useMemo(() => {
    return new Map(employees.map((e) => [e.id, e]));
  }, [employees]);

  // Current assignments = assets with status='assigned' and assignedTo set
  const currentAssignments = useMemo(() => {
    return assets
      .filter((a) => a.status === 'assigned' && a.assignedTo)
      .map((a) => ({
        asset: a,
        employee: employeeMap.get(a.assignedTo!),
      }))
      .filter((x) => x.employee)
      .filter((x) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          x.asset.name.toLowerCase().includes(q) ||
          x.asset.assetId.toLowerCase().includes(q) ||
          x.employee!.name.toLowerCase().includes(q) ||
          x.employee!.employeeId.toLowerCase().includes(q)
        );
      });
  }, [assets, employeeMap, search]);

  const filteredHistory = useMemo(() => {
    if (!search) return assignments;
    const q = search.toLowerCase();
    return assignments.filter(
      (a) =>
        a.assetName.toLowerCase().includes(q) ||
        a.employeeName.toLowerCase().includes(q)
    );
  }, [assignments, search]);

  const stats = useMemo(() => {
    return {
      assigned: currentAssignments.length,
      available: assets.filter((a) => a.status === 'available').length,
      totalAssets: assets.length,
      recentActions: assignments.slice(0, 100).length,
    };
  }, [currentAssignments, assets, assignments]);

  const handleExport = () => {
    const rows = filteredHistory.map((a) => ({
      Date: a.createdAt ? formatDateTime(a.createdAt) : '',
      Action: a.action,
      Asset: a.assetName,
      Employee: a.employeeName,
      'Condition (assign)': a.conditionAtAssign ?? '',
      'Condition (return)': a.conditionAtReturn ?? '',
      'Transferred From': a.transferredFrom ?? '',
      'Transferred To': a.transferredTo ?? '',
      'Received By': a.receivedBy ?? '',
      Remarks: a.remarks ?? '',
      'Performed By': a.performedBy,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assignments');
    XLSX.writeFile(
      wb,
      `assignments-${new Date().toISOString().slice(0, 10)}.xlsx`
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
            Ownership Tracking
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Asset Assignments
          </h1>
          <p className="text-brand-choco-soft mt-2">
            Assign, return and transfer assets between employees.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={!filteredHistory.length}
            className="btn-secondary disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button onClick={() => setAssignOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Assign Asset
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip
          label="Currently Assigned"
          value={stats.assigned}
          icon={UserCheck}
          color="pastel-blue"
        />
        <StatChip
          label="Available"
          value={stats.available}
          icon={Package}
          color="pastel-green"
        />
        <StatChip
          label="Total Assets"
          value={stats.totalAssets}
          icon={Laptop}
          color="pastel-peach"
        />
        <StatChip
          label="Actions Logged"
          value={stats.recentActions}
          icon={History}
          color="pastel-pink"
        />
      </div>

      {/* Tabs + Search */}
      <div className="card !p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark">
          <button
            onClick={() => setTab('current')}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-bold transition-all',
              tab === 'current'
                ? 'bg-white text-brand-choco shadow-sm'
                : 'text-brand-choco-soft hover:text-brand-choco'
            )}
          >
            Current ({stats.assigned})
          </button>
          <button
            onClick={() => setTab('history')}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-bold transition-all',
              tab === 'history'
                ? 'bg-white text-brand-choco shadow-sm'
                : 'text-brand-choco-soft hover:text-brand-choco'
            )}
          >
            History ({assignments.length})
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search asset or employee..."
            className="input-field pl-11 !py-2.5"
          />
        </div>
      </div>

      {/* Content */}
      {tab === 'current' ? (
        assetsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <ProductRowSkeleton key={i} />
            ))}
          </div>
        ) : currentAssignments.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="No active assignments"
            description="Assign an asset to an employee to see it here."
            action={{
              label: 'Assign Asset',
              icon: Plus,
              onClick: () => setAssignOpen(true),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {currentAssignments.map(({ asset, employee }) => (
                <AssignmentCard
                  key={asset.id}
                  asset={asset}
                  employee={employee!}
                  onReturn={() => setReturnFor({ asset, employee: employee! })}
                  onTransfer={() =>
                    setTransferFor({ asset, employee: employee! })
                  }
                />
              ))}
            </AnimatePresence>
          </div>
        )
      ) : assignLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <ProductRowSkeleton key={i} />
          ))}
        </div>
      ) : filteredHistory.length === 0 ? (
        <EmptyState
          icon={History}
          title="No history"
          description="Assignments will show here once you start assigning assets."
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filteredHistory.map((a) => (
              <HistoryRow key={a.id} assignment={a} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign Asset"
        description="Give an available asset to an active employee."
        size="lg"
        closeOnOverlay={false}
      >
        <AssignForm onClose={() => setAssignOpen(false)} />
      </Modal>

      <Modal
        open={!!returnFor}
        onClose={() => setReturnFor(null)}
        title="Return Asset"
        description="Take back the asset from the employee."
        size="lg"
        closeOnOverlay={false}
      >
        {returnFor && (
          <ReturnForm
            asset={returnFor.asset}
            employee={returnFor.employee}
            onClose={() => setReturnFor(null)}
          />
        )}
      </Modal>

      <Modal
        open={!!transferFor}
        onClose={() => setTransferFor(null)}
        title="Transfer Asset"
        description="Move this asset to a different employee."
        size="lg"
        closeOnOverlay={false}
      >
        {transferFor && (
          <TransferForm
            asset={transferFor.asset}
            fromEmployee={transferFor.employee}
            onClose={() => setTransferFor(null)}
          />
        )}
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

function AssignmentCard({
  asset,
  employee,
  onReturn,
  onTransfer,
}: {
  asset: Asset;
  employee: Employee;
  onReturn: () => void;
  onTransfer: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -3 }}
      className="card !p-5"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
        {/* Asset */}
        <div className="p-3 rounded-2xl bg-pastel-blue border border-pastel-blue-deep/30">
          <div className="flex items-center gap-2 mb-1">
            <Laptop className="w-4 h-4 text-brand-choco" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft">
              Asset
            </p>
          </div>
          <p className="text-xs font-bold text-brand-orange">
            {asset.assetId}
          </p>
          <p className="font-bold text-sm truncate">{asset.name}</p>
          <p className="text-xs text-brand-choco-soft truncate">
            {asset.category}
          </p>
        </div>

        <ArrowRight className="w-6 h-6 text-brand-orange" />

        {/* Employee */}
        <div className="p-3 rounded-2xl bg-pastel-green border border-pastel-green-deep/30">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-brand-choco" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft">
              Assigned To
            </p>
          </div>
          <p className="text-xs font-bold text-brand-orange">
            {employee.employeeId}
          </p>
          <p className="font-bold text-sm truncate">{employee.name}</p>
          <p className="text-xs text-brand-choco-soft truncate">
            {employee.department}
          </p>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-brand-choco/8">
        <button
          onClick={onReturn}
          className="btn-secondary flex-1 !py-2 !text-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Return
        </button>
        <button
          onClick={onTransfer}
          className="btn-primary flex-1 !py-2 !text-sm"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Transfer
        </button>
      </div>
    </motion.div>
  );
}

function HistoryRow({ assignment }: { assignment: AssetAssignment }) {
  const meta = {
    assigned: { icon: UserCheck, color: 'green', label: 'Assigned' },
    returned: { icon: RotateCcw, color: 'peach', label: 'Returned' },
    transferred: { icon: ArrowRight, color: 'blue', label: 'Transferred' },
  }[assignment.action];
  const Icon = meta.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="card !p-4 flex items-center gap-4"
    >
      <div
        className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
          meta.color === 'green' && 'bg-pastel-green',
          meta.color === 'peach' && 'bg-pastel-peach',
          meta.color === 'blue' && 'bg-pastel-blue'
        )}
      >
        <Icon className="w-5 h-5 text-brand-choco" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge badge-info">{meta.label}</span>
          <span className="font-bold">{assignment.assetName}</span>
          <span className="text-brand-choco-soft">→</span>
          <span className="font-bold">{assignment.employeeName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-brand-choco-soft mt-1 flex-wrap">
          {assignment.conditionAtAssign && (
            <span>Condition: {assignment.conditionAtAssign}</span>
          )}
          {assignment.conditionAtReturn && (
            <span>Returned as: {assignment.conditionAtReturn}</span>
          )}
          {assignment.transferredFrom && (
            <span>
              From: {assignment.transferredFrom}
            </span>
          )}
          <span>By: {assignment.performedBy}</span>
          {assignment.createdAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDateTime(assignment.createdAt)}
            </span>
          )}
        </div>
        {assignment.remarks && (
          <p className="text-xs text-brand-choco-soft italic mt-1 truncate">
            "{assignment.remarks}"
          </p>
        )}
      </div>
    </motion.div>
  );
}
