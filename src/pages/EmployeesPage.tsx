import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Mail,
  Phone,
  Calendar,
  Building2,
  Briefcase,
  UserCheck,
  UserX,
  Download,
  Laptop,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { ProductRowSkeleton } from '@/components/ui/Skeleton';
import EmployeeForm from '@/components/employees/EmployeeForm';
import { useEmployees, deleteEmployee } from '@/hooks/useEmployees';
import { useAssets } from '@/hooks/useAssets';
import type { Employee, Asset } from '@/types';
import { cn, formatDate, formatINR } from '@/lib/utils';

type FilterStatus = 'all' | 'active' | 'inactive' | 'resigned' | 'terminated';

export default function EmployeesPage() {
  const { employees, loading } = useEmployees();
  const { assets } = useAssets();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const departments = useMemo(() => {
    return Array.from(new Set(employees.map((e) => e.department))).sort();
  }, [employees]);

  // Map of employeeId → assigned assets
  const assetsByEmployee = useMemo(() => {
    const map = new Map<string, Asset[]>();
    assets
      .filter((a) => a.status === 'assigned' && a.assignedTo)
      .forEach((a) => {
        const list = map.get(a.assignedTo!) ?? [];
        list.push(a);
        map.set(a.assignedTo!, list);
      });
    return map;
  }, [assets]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q);
      const matchDept = deptFilter === 'all' || e.department === deptFilter;
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, search, statusFilter, deptFilter]);

  const stats = useMemo(() => {
    return {
      total: employees.length,
      active: employees.filter((e) => e.status === 'active').length,
      resigned: employees.filter((e) => e.status === 'resigned').length,
      departments: departments.length,
    };
  }, [employees, departments]);

  const handleEdit = (e: Employee) => {
    setSelected(e);
    setFormOpen(true);
    setMenuOpen(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    // Block delete if employee has assets
    const assigned = assetsByEmployee.get(deleting.id) ?? [];
    if (assigned.length > 0) {
      toast.error(`Cannot remove — ${assigned.length} asset(s) still assigned. Return them first.`);
      setDeleting(null);
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteEmployee(deleting);
      toast.success('Employee removed');
      setDeleting(null);
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExport = () => {
    const rows = filtered.map((e) => ({
      'Employee ID': e.employeeId,
      Name: e.name,
      Department: e.department,
      Designation: e.designation,
      Email: e.email,
      Contact: e.contactNumber,
      'Joining Date': e.joiningDate,
      Status: e.status,
      'Assets Count': assetsByEmployee.get(e.id)?.length ?? 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, `employees-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Team Directory
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Employees
          </h1>
          <p className="text-brand-choco-soft mt-2">
            Manage your team members and their assigned assets.
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
            Add Employee
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip label="Total" value={stats.total} icon={Users} color="pastel-blue" />
        <StatChip
          label="Active"
          value={stats.active}
          icon={UserCheck}
          color="pastel-green"
        />
        <StatChip
          label="Resigned"
          value={stats.resigned}
          icon={UserX}
          color="pastel-peach"
        />
        <StatChip
          label="Departments"
          value={stats.departments}
          icon={Building2}
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
            placeholder="Search name, ID, email or department..."
            className="input-field pl-11 !py-2.5"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="input-field !py-2.5 !w-auto"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark overflow-x-auto">
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['resigned', 'Resigned'],
              ['inactive', 'Inactive'],
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

      {/* Grid */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <ProductRowSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={employees.length === 0 ? 'No employees yet' : 'No matches'}
          description={
            employees.length === 0
              ? 'Add your first team member to start managing assignments.'
              : 'Try different search or filter.'
          }
          action={
            employees.length === 0
              ? {
                  label: 'Add First Employee',
                  icon: Plus,
                  onClick: () => {
                    setSelected(null);
                    setFormOpen(true);
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filtered.map((emp) => (
              <EmployeeCard
                key={emp.id}
                employee={emp}
                assetCount={assetsByEmployee.get(emp.id)?.length ?? 0}
                onEdit={handleEdit}
                onDelete={setDeleting}
                onView={(e) => {
                  setSelected(e);
                  setDetailOpen(true);
                }}
                menuOpen={menuOpen === emp.id}
                setMenuOpen={(o) => setMenuOpen(o ? emp.id : null)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={selected ? 'Edit Employee' : 'Add New Employee'}
        description={
          selected
            ? 'Update employee details.'
            : 'Enter team member information.'
        }
        size="lg"
        closeOnOverlay={false}
      >
        <EmployeeForm employee={selected} onClose={() => setFormOpen(false)} />
      </Modal>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected?.name}
        size="lg"
      >
        {selected && (
          <EmployeeDetail
            employee={selected}
            assignedAssets={assetsByEmployee.get(selected.id) ?? []}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Remove Employee?"
        message={`"${deleting?.name}" will be removed. Their asset assignment history remains.`}
        confirmLabel="Remove"
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

const AVATAR_GRADIENTS = [
  'from-brand-orange-light to-brand-orange',
  'from-pastel-blue-deep to-blue-500',
  'from-pastel-green-deep to-green-500',
  'from-pastel-pink-deep to-pink-500',
  'from-pastel-peach-deep to-orange-500',
];

function getAvatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function StatusBadge({ status }: { status: Employee['status'] }) {
  return (
    <span
      className={cn(
        'badge',
        status === 'active' && 'badge-success',
        status === 'inactive' && 'badge-warning',
        status === 'resigned' && 'badge-info',
        status === 'terminated' && 'badge-danger'
      )}
    >
      {status}
    </span>
  );
}

function EmployeeCard({
  employee,
  assetCount,
  onEdit,
  onDelete,
  onView,
  menuOpen,
  setMenuOpen,
}: {
  employee: Employee;
  assetCount: number;
  onEdit: (e: Employee) => void;
  onDelete: (e: Employee) => void;
  onView: (e: Employee) => void;
  menuOpen: boolean;
  setMenuOpen: (o: boolean) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -3 }}
      className="card !p-5 flex flex-col cursor-pointer relative"
      onClick={() => onView(employee)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="relative">
          <div
            className={cn(
              'w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shadow-lg',
              getAvatarColor(employee.name)
            )}
          >
            {getInitials(employee.name)}
          </div>
          {/* Asset count badge on avatar */}
          {assetCount > 0 && (
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-brand-orange text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-md">
              {assetCount}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={employee.status} />
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
                      onClick={() => onEdit(employee)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-brand-choco hover:bg-brand-cream-dark"
                    >
                      <Edit className="w-4 h-4" /> Edit
                    </button>
                    <div className="h-px bg-brand-choco/8 my-1" />
                    <button
                      onClick={() => {
                        onDelete(employee);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <p className="text-xs font-semibold text-brand-orange">
        {employee.employeeId}
      </p>
      <h3 className="font-bold text-brand-choco text-lg leading-tight mt-0.5">
        {employee.name}
      </h3>
      <p className="text-sm text-brand-choco-soft mt-0.5">
        {employee.designation}
      </p>

      <div className="mt-4 pt-4 border-t border-brand-choco/8 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-brand-choco-light">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{employee.department}</span>
        </div>
        <div className="flex items-center gap-2 text-brand-choco-light">
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{employee.email}</span>
        </div>
        <div className="flex items-center gap-2 text-brand-choco-light">
          <Phone className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{employee.contactNumber}</span>
        </div>
        {assetCount > 0 && (
          <div className="flex items-center gap-2 text-brand-orange font-semibold pt-1">
            <Laptop className="w-3.5 h-3.5 shrink-0" />
            <span>
              {assetCount} asset{assetCount > 1 ? 's' : ''} assigned
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function EmployeeDetail({
  employee,
  assignedAssets,
}: {
  employee: Employee;
  assignedAssets: Asset[];
}) {
  const totalValue = assignedAssets.reduce(
    (sum, a) => sum + (a.purchaseCost || 0),
    0
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div
          className={cn(
            'w-24 h-24 rounded-3xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-3xl shadow-xl shrink-0',
            getAvatarColor(employee.name)
          )}
        >
          {getInitials(employee.name)}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-brand-orange">
            {employee.employeeId}
          </p>
          <h2 className="font-display text-3xl font-bold mt-1">
            {employee.name}
          </h2>
          <p className="text-brand-choco-soft mt-1">{employee.designation}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="badge badge-info">{employee.department}</span>
            <StatusBadge status={employee.status} />
            {assignedAssets.length > 0 && (
              <span className="badge bg-brand-orange-100 text-brand-orange-dark">
                <Laptop className="w-3 h-3" />
                {assignedAssets.length} asset{assignedAssets.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoRow icon={Mail} label="Email" value={employee.email} />
        <InfoRow icon={Phone} label="Contact" value={employee.contactNumber} />
        <InfoRow icon={Building2} label="Department" value={employee.department} />
        <InfoRow
          icon={Briefcase}
          label="Designation"
          value={employee.designation}
        />
        <InfoRow
          icon={Calendar}
          label="Joining Date"
          value={formatDate(employee.joiningDate)}
        />
      </div>

      {/* ASSIGNED ASSETS SECTION - live from Firestore */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5" />
            Assigned Assets
          </p>
          {assignedAssets.length > 0 && (
            <p className="text-xs text-brand-choco-soft">
              Total value:{' '}
              <span className="font-bold text-brand-orange">
                {formatINR(totalValue)}
              </span>
            </p>
          )}
        </div>

        {assignedAssets.length === 0 ? (
          <div className="p-6 rounded-2xl bg-brand-cream-dark/50 text-center">
            <Package className="w-8 h-8 text-brand-orange/40 mx-auto mb-2" />
            <p className="text-sm text-brand-choco-soft">
              No assets currently assigned to this employee.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {assignedAssets.map((asset) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-2xl bg-brand-cream-dark/50 flex items-center gap-3 hover:bg-brand-cream-dark transition"
              >
                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0">
                  <Laptop className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-brand-orange">
                      {asset.assetId}
                    </p>
                    <ConditionBadge condition={asset.condition} />
                  </div>
                  <p className="font-bold truncate">{asset.name}</p>
                  <p className="text-xs text-brand-choco-soft truncate">
                    {asset.category}
                    {asset.brand && ` · ${asset.brand}`}
                    {asset.serialNumber && ` · SN: ${asset.serialNumber}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold uppercase text-brand-choco-soft">
                    Cost
                  </p>
                  <p className="font-bold text-brand-orange">
                    {formatINR(asset.purchaseCost)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConditionBadge({ condition }: { condition: Asset['condition'] }) {
  const color = {
    new: 'bg-green-500',
    good: 'bg-blue-500',
    fair: 'bg-orange-500',
    poor: 'bg-red-500',
  }[condition];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-choco-soft">
      <span className={cn('w-1.5 h-1.5 rounded-full', color)} />
      <span className="capitalize">{condition}</span>
    </span>
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
