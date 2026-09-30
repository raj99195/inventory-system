import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users as UsersIcon,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Shield,
  UserCheck,
  ShieldCheck,
  Mail,
  Copy,
  Building,
  School as SchoolIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import UserForm from '@/components/users/UserForm';
import { useUsers, deleteUser, toggleUserActive } from '@/hooks/useUsers';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS, canManageUser, myLevel, roleLevel } from '@/lib/permissions';
import type { AppUser, AppRole } from '@/types';
import { cn, formatDate } from '@/lib/utils';

type RoleFilter = 'all' | AppRole;

export default function UsersPage() {
  const { users: allUsers, loading } = useUsers();
  const { can } = usePermission();
  const { user: currentUser, userDoc } = useAuth();
  const myLvl = myLevel(userDoc);
  const users = useMemo(() => allUsers.filter((u) => u.uid === userDoc?.uid || roleLevel(u.role) < myLvl), [allUsers, userDoc?.uid, myLvl]);
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate && can('users.create')) {
      setSelected(null);
      setFormOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, can]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q);
      const matchRole = roleFilter === 'all' ? true : u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.active).length,
      superAdmins: users.filter((u) => u.role === 'super_admin').length,
      admins: users.filter((u) => u.role === 'admin').length,
    };
  }, [users]);

  const handleEdit = (u: AppUser) => {
    // Anti-escalation: cannot edit peer/higher, but can edit self
    if (u.uid === currentUser?.uid || !canManageUser(myLvl, u)) {
      return toast.error("You can't edit a user at your level or above");
    }
    setSelected(u);
    setFormOpen(true);
    setMenuOpen(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    if (deleting.uid === currentUser?.uid) {
      toast.error('You cannot delete yourself');
      return;
    }
    if (!canManageUser(myLvl, deleting)) {
      toast.error("You can't delete a user at your level or above");
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteUser(deleting);
      toast.success('User deleted');
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error('Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggle = async (u: AppUser) => {
    if (u.uid === currentUser?.uid) {
      toast.error('You cannot deactivate yourself');
      return;
    }
    if (!canManageUser(myLvl, u)) {
      toast.error("You can't modify a user at your level or above");
      return;
    }
    try {
      await toggleUserActive(u);
      toast.success(`User ${u.active ? 'deactivated' : 'activated'}`);
      setMenuOpen(null);
    } catch {
      toast.error('Update failed');
    }
  };

  const roleFilterOptions: [RoleFilter, string][] = [
    ['all', 'All'],
    ['super_admin', 'Super Admin'],
    ['admin', 'Admin'],
    ['hr', 'HR'],
    ['manager', 'Manager'],
    ['accountant', 'Accountant'],
    ['employee', 'Employee'],
    ['custom', 'Custom'],
  ];

  if (!can('users.view') && !can('users.create')) return <Navigate to="/" replace />;
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Access Control
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Users & Roles
          </h1>
          <p className="text-brand-choco-soft mt-2">
            Manage who can access this system and what they can do.
          </p>
        </div>
        {can('users.create') && (
          <button
            onClick={() => {
              setSelected(null);
              setFormOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip label="Total Users" value={stats.total} icon={UsersIcon} color="pastel-blue" />
        <StatChip label="Active" value={stats.active} icon={UserCheck} color="pastel-green" />
        <StatChip label="Super Admins" value={stats.superAdmins} icon={ShieldCheck} color="pastel-peach" />
        <StatChip label="Admins" value={stats.admins} icon={Shield} color="pastel-pink" />
      </div>

      <div className="card !p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or department..."
            className="input-field pl-11 !py-2.5"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark overflow-x-auto">
          {roleFilterOptions.filter(([val]) => val === 'all' || roleLevel(val as AppRole) < myLvl || val === userDoc?.role).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setRoleFilter(val)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                roleFilter === val
                  ? 'bg-white text-brand-choco shadow-sm'
                  : 'text-brand-choco-soft hover:text-brand-choco'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card !p-8 text-center text-brand-choco-soft">Loading users...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={users.length === 0 ? 'No users yet' : 'No matches'}
          description={
            users.length === 0
              ? 'Create your first user to grant access to the system.'
              : 'Try changing your filters or search.'
          }
          action={
            users.length === 0 && can('users.create')
              ? {
                  label: 'Add First User',
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((u) => {
              const isSelf = u.uid === currentUser?.uid;
              const canManage = canManageUser(myLvl, u);
              return (
                <UserCard
                  key={u.uid}
                  user={u}
                  isSelf={isSelf}
                  canEdit={!isSelf && canManage && can('users.edit')}
                  canDelete={can('users.delete') && !isSelf && canManage}
                  canToggle={can('users.edit') && !isSelf && canManage}
                  onEdit={handleEdit}
                  onDelete={setDeleting}
                  onToggle={handleToggle}
                  menuOpen={menuOpen === u.uid}
                  setMenuOpen={(open) => setMenuOpen(open ? u.uid : null)}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={selected ? 'Edit User' : 'Create New User'}
        description={
          selected
            ? 'Update user details, role and permissions.'
            : 'Add a new user with role-based permissions.'
        }
        size="xl"
        closeOnOverlay={false}
      >
        <UserForm user={selected} onClose={() => setFormOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete User?"
        message={`"${deleting?.name}" (${deleting?.email}) will lose all access immediately. Their Firebase Auth account remains but cannot sign in without a user record.`}
        confirmLabel="Delete User"
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
        <p className="font-display text-2xl font-bold leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function UserCard({
  user,
  isSelf,
  canEdit,
  canDelete,
  canToggle,
  onEdit,
  onDelete,
  onToggle,
  menuOpen,
  setMenuOpen,
}: {
  user: AppUser;
  isSelf: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canToggle: boolean;
  onEdit: (u: AppUser) => void;
  onDelete: (u: AppUser) => void;
  onToggle: (u: AppUser) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}) {
  const roleColor: Record<AppRole, string> = {
    super_admin: 'bg-brand-orange text-white',
    admin: 'bg-pastel-blue-deep/30 text-brand-choco',
    hr: 'bg-pastel-pink-deep/30 text-brand-choco',
    manager: 'bg-pastel-peach-deep/40 text-brand-choco',
    accountant: 'bg-pastel-green-deep/30 text-brand-choco',
    employee: 'bg-brand-cream-dark text-brand-choco',
    custom: 'bg-pastel-peach-deep/40 text-brand-choco',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn('card !p-5 relative', !user.active && 'opacity-60')}
    >
      {(canEdit || canDelete || canToggle) && (
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-xl bg-white hover:bg-brand-cream-dark flex items-center justify-center shadow-sm border border-brand-choco/8"
          >
            <MoreVertical className="w-4 h-4 text-brand-choco" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 mt-1 w-44 bg-white rounded-2xl shadow-2xl border border-brand-choco/8 py-1 z-50"
                >
                  {canEdit && <MenuItem icon={Edit} label="Edit" onClick={() => onEdit(user)} />}
                  {canToggle && (
                    <MenuItem
                      icon={user.active ? PowerOff : Power}
                      label={user.active ? 'Deactivate' : 'Activate'}
                      onClick={() => onToggle(user)}
                    />
                  )}
                  {canDelete && (
                    <>
                      <div className="h-px bg-brand-choco/8 my-1" />
                      <MenuItem
                        icon={Trash2}
                        label="Delete"
                        onClick={() => {
                          onDelete(user);
                          setMenuOpen(false);
                        }}
                        danger
                      />
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex items-start gap-3 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0">
          {user.name[0]?.toUpperCase() ?? user.email[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-brand-choco truncate">{user.name}</h3>
            {isSelf && <span className="badge badge-info text-[9px]">You</span>}
          </div>
          <p className="text-xs text-brand-choco-soft truncate flex items-center gap-1">
            <Mail className="w-3 h-3" />
            <span className="min-w-0 truncate">{user.email}</span>
            <button type="button" aria-label={`Copy email for ${user.name}`} className="ml-1 w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-brand-orange-50 hover:text-brand-orange" onClick={() => { void navigator.clipboard.writeText(user.email).then(() => toast.success('Email copied'), () => toast.error('Could not copy email')); }}><Copy size={14} /></button>
          </p>
          {user.designation && (
            <p className="text-[11px] text-brand-choco-soft truncate mt-0.5">
              {user.designation}
              {user.department && ` · ${user.department}`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
            roleColor[user.role]
          )}
        >
          <Shield className="w-3 h-3" />
          {ROLE_LABELS[user.role]}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold',
            user.active
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              user.active ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            )}
          />
          {user.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {(user.department || (user.assignedSchools && user.assignedSchools.length > 0)) && (
        <div className="mt-3 flex items-center gap-3 text-[11px] text-brand-choco-soft flex-wrap">
          {user.department && (
            <span className="inline-flex items-center gap-1">
              <Building className="w-3 h-3" />
              {user.department}
            </span>
          )}
          {user.assignedSchools && user.assignedSchools.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <SchoolIcon className="w-3 h-3" />
              {user.assignedSchools.length} school{user.assignedSchools.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-brand-choco/8 flex items-center justify-between text-[10px] text-brand-choco-soft">
        <span>Created {user.createdAt ? formatDate(user.createdAt) : '—'}</span>
        {user.joinedOn && <span>Joined {user.joinedOn}</span>}
      </div>
    </motion.div>
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
        danger ? 'text-red-600 hover:bg-red-50' : 'text-brand-choco hover:bg-brand-cream-dark'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
