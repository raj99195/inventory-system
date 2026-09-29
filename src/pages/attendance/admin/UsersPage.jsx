import { useEffect, useState, useMemo } from 'react';
import { useToast } from '../../components/ui/Toast.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Table } from '../../components/ui/Table.jsx';
import { EmptyState, PageLoader, Spinner } from '../../components/ui/EmptyState.jsx';
import { listUsers, updateUser, deleteUser } from '../../services/users.service.js';
import { createEmployee, restoreEmployee } from '../../services/auth.service.js';
import { getSettings } from '../../services/settings.service.js';
import { listSchools } from '../../services/schools.service.js';
import { forwardGeocode } from '../../utils/geocode.js';
import { ROLES, ROLE_LABELS } from '../../constants/roles.js';
import {
  PERMISSIONS, PERMISSION_MATRIX, ROLE_PRESETS, LOCKED_PERMS,
  permissionsForRole, hasPermission,
  canGrantPerms, getAssignableRoles, canManageUser, myLevel
} from '../../constants/permissions.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { fmtDate } from '../../utils/datetime.js';

export default function UsersPage() {
  const toast = useToast();
  const { can } = usePermissions();
  const { profile: myProfile } = useAuth();
  const myLvl = myLevel(myProfile);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => { setLoading(true); listUsers().then(u => { setUsers(u); setLoading(false); }); };
  useEffect(load, []);

  const filtered = users.filter(u => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (u.name || '').toLowerCase().includes(s) ||
           (u.email || '').toLowerCase().includes(s) ||
           (u.department || '').toLowerCase().includes(s);
  });

  const isSelf = (u) => u.id === myProfile?.id;

  const toggleActive = async (u) => {
    if (isSelf(u)) return toast.warn("You can't deactivate yourself");
    if (!canManageUser(myLvl, u)) return toast.error("You can't modify a user at your level or above");
    await updateUser(u.id, { active: !u.active });
    toast.success(`User ${u.active ? 'deactivated' : 'activated'}`);
    load();
  };

  const remove = async (u) => {
    if (isSelf(u)) return toast.warn("You can't delete yourself");
    if (!canManageUser(myLvl, u)) return toast.error("You can't delete a user at your level or above");
    if (!confirm(`Delete ${u.name}?`)) return;
    try { await deleteUser(u.id); toast.success('User deleted'); load(); }
    catch (e) { toast.error(e.message); }
  };

  const openEdit = (u) => {
    if (!canManageUser(myLvl, u) && !isSelf(u)) {
      return toast.error("You can't edit a user at your level or above");
    }
    setEditing(u);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input className="input max-w-xs flex-1" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
        {can(PERMISSIONS.USERS_CREATE) && (
          <button className="btn-primary ml-auto" onClick={() => setCreating(true)}>+ Add User</button>
        )}
      </div>

      {loading ? <PageLoader /> : filtered.length === 0
        ? <EmptyState title="No users" subtitle="Add your first employee to get started."
            action={can(PERMISSIONS.USERS_CREATE) && <button className="btn-primary" onClick={() => setCreating(true)}>+ Add User</button>} />
        : (
          <div className="card">
            <Table
              columns={[
                { label: 'Name', render: u => (
                  <div>
                    <div className="font-semibold text-ink-900 flex items-center gap-2">
                      {u.name || '—'}
                      {isSelf(u) && <span className="badge-brand text-[10px]">You</span>}
                    </div>
                    <div className="text-xs text-ink-500 break-all">{u.email}</div>
                  </div>
                )},
                { label: 'Role', render: u => (
                  <span className={u.role === 'super_admin' || u.role === 'admin' ? 'badge-brand' : 'badge-blue'}>
                    {ROLE_LABELS[u.role] || 'Custom'}
                  </span>
                )},
                { label: 'Department', render: u => u.department || '—' },
                { label: 'Schools', render: u => u.assignedSchools?.length ? `${u.assignedSchools.length} assigned` : '—' },
                { label: 'Joined', render: u => fmtDate(u.joinedOn) },
                { label: 'Status', render: u => u.active !== false ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span> },
                { label: '', render: u => <RowActions u={u} isSelf={isSelf(u)} canManage={canManageUser(myLvl, u)} can={can} onEdit={openEdit} onToggle={toggleActive} onDelete={remove} /> }
              ]}
              rows={filtered}
              mobileCard={u => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-ink-900 break-words flex items-center gap-2">
                        {u.name}
                        {isSelf(u) && <span className="badge-brand text-[10px]">You</span>}
                      </div>
                      <div className="text-xs text-ink-500 break-all">{u.email}</div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className={u.role === 'super_admin' || u.role === 'admin' ? 'badge-brand' : 'badge-blue'}>{ROLE_LABELS[u.role] || 'Custom'}</span>
                        {u.active !== false ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span>}
                      </div>
                    </div>
                  </div>
                  {(u.department || u.assignedSchools?.length) && (
                    <div className="text-xs text-ink-600">
                      {u.designation} {u.department && `· ${u.department}`}
                      {u.assignedSchools?.length ? ` · ${u.assignedSchools.length} school${u.assignedSchools.length > 1 ? 's' : ''}` : ''}
                    </div>
                  )}
                  <div className="pt-1">
                    <RowActions u={u} isSelf={isSelf(u)} canManage={canManageUser(myLvl, u)} can={can} onEdit={openEdit} onToggle={toggleActive} onDelete={remove} />
                  </div>
                </div>
              )}
            />
          </div>
        )}

      {creating && <CreateUserModal myLvl={myLvl} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
      {editing && <EditUserModal user={editing} myLvl={myLvl} myProfile={myProfile} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function RowActions({ u, isSelf, canManage, can, onEdit, onToggle, onDelete }) {
  const editable = (canManage || isSelf) && can(PERMISSIONS.USERS_EDIT);
  const deletable = canManage && !isSelf && can(PERMISSIONS.USERS_DELETE);
  const togglable = canManage && !isSelf && can(PERMISSIONS.USERS_EDIT);
  return (
    <div className="flex gap-3 items-center">
      {editable && <button className="text-xs font-semibold text-brand-600" onClick={() => onEdit(u)}>Edit</button>}
      {togglable && (
        <button className="text-xs font-semibold text-ink-600" onClick={() => onToggle(u)}>
          {u.active !== false ? 'Deactivate' : 'Activate'}
        </button>
      )}
      {deletable && <button className="text-xs font-semibold text-red-600" onClick={() => onDelete(u)}>Delete</button>}
    </div>
  );
}

// =============================================================================
function CreateUserModal({ myLvl, onClose, onCreated }) {
  const toast = useToast();
  const [schools, setSchools] = useState([]);
  const [departments, setDepartments] = useState([]);
  const assignableRoles = useMemo(() => getAssignableRoles(myLvl), [myLvl]);
  const assignableKeys = Object.keys(assignableRoles);
  const defaultRole = assignableKeys.includes('employee') ? 'employee' : assignableKeys[0];

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    role: defaultRole || 'employee',
    permissions: permissionsForRole(defaultRole || 'employee').filter(p => !LOCKED_PERMS.has(p)),
    department: '', designation: '', phone: '',
    joinedOn: today,
    assignedSchools: []
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    listSchools().then(setSchools);
    getSettings().then(s => setDepartments(s.departments || []));
  }, []);

  const pickRole = (role) => {
    if (!(role in assignableRoles)) return;
    setForm(f => ({ ...f, role, permissions: permissionsForRole(role).filter(p => !LOCKED_PERMS.has(p)) }));
  };
  const togglePerm = (perm) => {
    if (LOCKED_PERMS.has(perm)) return;
    setForm(f => {
      const has = f.permissions.includes(perm);
      return { ...f, permissions: has ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm] };
    });
  };
  const toggleSchool = (id) => setForm(f => ({
    ...f,
    assignedSchools: f.assignedSchools.includes(id)
      ? f.assignedSchools.filter(x => x !== id)
      : [...f.assignedSchools, id]
  }));

  // Set to a soft-deleted user when their email collides on create.
  // Renders the RestoreConfirm modal on top so admin can confirm the restore.
  const [restorePrompt, setRestorePrompt] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.warn('Password must be at least 6 chars');
    if (!canGrantPerms(form.permissions)) return toast.error('Cannot grant locked permissions');
    setBusy(true);
    try {
      await createEmployee(form);
      toast.success(`User ${form.name} created — welcome email queued`);
      onCreated();
    } catch (err) {
      if (err.code === 'EMAIL_PREVIOUSLY_USED') {
        setRestorePrompt(err.deletedUser);
      } else if (err.code === 'auth/email-already-in-use') {
        toast.error('This email already exists in Firebase Auth but no matching record was found. Delete it from Firebase Console → Authentication.');
      } else {
        toast.error(err.message || 'Failed');
      }
    }
    finally { setBusy(false); }
  };

  const doRestore = async () => {
    if (!restorePrompt) return;
    setBusy(true);
    try {
      await restoreEmployee(restorePrompt.id, form);
      toast.success(`${form.name} restored — a password reset email was sent to ${restorePrompt.originalEmail}`);
      setRestorePrompt(null);
      onCreated();
    } catch (err) { toast.error(err.message || 'Restore failed'); }
    finally { setBusy(false); }
  };

  if (assignableKeys.length === 0) {
    return (
      <Modal open onClose={onClose} title="Add New User" size="md"
        footer={<button className="btn-secondary" onClick={onClose}>Close</button>}>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          You don't have permission to create any user role.
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Add New User" size="xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="create-user-form" className="btn-primary" disabled={busy}>
            {busy ? <Spinner className="text-white" /> : 'Create User'}
          </button>
        </>
      }>
      <form id="create-user-form" onSubmit={submit} className="space-y-6">
        <div>
          <SectionHeader title="Basic Information" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="label">Full name *</label>
              <input className="input" required value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div><label className="label">Email *</label>
              <input type="email" className="input" required value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div><label className="label">Temp password *</label>
              <input type="text" className="input" required minLength="6" value={form.password} onChange={e => set('password', e.target.value)} /></div>
            <div><label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div><label className="label">Department</label>
              <DepartmentPicker value={form.department} options={departments} onChange={v => set('department', v)} />
            </div>
            <div className="md:col-span-2"><label className="label">Designation</label>
              <input className="input" value={form.designation} onChange={e => set('designation', e.target.value)} /></div>
            <div className="md:col-span-2"><label className="label">Date of Joining *</label>
              <input type="date" className="input" required value={form.joinedOn} onChange={e => set('joinedOn', e.target.value)} /></div>
          </div>
        </div>

        <div>
          <SectionHeader title="Role" subtitle="Only roles below your level are shown" />
          <RolePicker assignableRoles={assignableRoles} activeRole={form.role} onPick={pickRole} />
        </div>

        <div>
          <SectionHeader title="Permissions" subtitle="Role loads default permissions — toggle any to add or remove" />
          <PermissionsToggle perms={form.permissions} onToggle={togglePerm} />
        </div>

        <div>
          <SectionHeader title="Assigned Schools" subtitle="Employee will only see these schools in the check-in picker" />
          <SchoolAssign schools={schools} assigned={form.assignedSchools} toggle={toggleSchool} />
        </div>
      </form>

      <p className="mt-4 text-xs text-ink-500">
        📧 A welcome email with credentials will be sent (if EmailJS is configured).
      </p>

      {restorePrompt && (
        <RestoreConfirmModal
          deletedUser={restorePrompt}
          newName={form.name}
          busy={busy}
          onCancel={() => setRestorePrompt(null)}
          onConfirm={doRestore}
        />
      )}
    </Modal>
  );
}

function RestoreConfirmModal({ deletedUser, newName, busy, onCancel, onConfirm }) {
  return (
    <Modal open onClose={onCancel} title="Email previously used" size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner className="text-white" /> : 'Restore & continue'}
          </button>
        </>
      }>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-800">
          <strong>{deletedUser.originalEmail}</strong> was used earlier by
          <strong> {deletedUser.name || '(unknown)'}</strong>, who was deleted on{' '}
          {deletedUser.deletedAt ? new Date(deletedUser.deletedAt).toLocaleDateString() : 'an earlier date'}.
        </div>
        <p className="text-ink-700">
          The Firebase Auth account with this email still exists. Instead of failing, we can
          <strong> restore that account with the new details you entered</strong>
          {newName ? <> for <strong>{newName}</strong></> : null}.
        </p>
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-blue-900 text-xs">
          <strong>Important:</strong> The temp password you entered will <strong>not</strong> be used.
          A password reset email will be sent to <strong>{deletedUser.originalEmail}</strong> —
          the user must open it and set their own password before first login.
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
function EditUserModal({ user, myLvl, myProfile, onClose, onSaved }) {
  const toast = useToast();
  const isSelf = user.id === myProfile?.id;
  const [schools, setSchools] = useState([]);
  const assignableRoles = useMemo(() => getAssignableRoles(myLvl), [myLvl]);
  const assignableKeys = Object.keys(assignableRoles);

  const [form, setForm] = useState({
    ...user,
    permissions: (user.permissions || permissionsForRole(user.role || ROLES.EMPLOYEE)).filter(p => !LOCKED_PERMS.has(p)),
    assignedSchools: user.assignedSchools || [],
    officeAddress: user.officeAddress || '',
    officeLat: user.officeLat ?? '',
    officeLng: user.officeLng ?? '',
    officeRadiusM: user.officeRadiusM ?? ''
  });
  const [departments, setDepartments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    Promise.all([getSettings(), listSchools()])
      .then(([s, sc]) => {
        setDepartments(s.departments || []);
        setSchools(sc);
      });
  }, [user.id]);

  const pickRole = (role) => {
    if (isSelf) return;
    if (!(role in assignableRoles)) return;
    setForm(f => ({ ...f, role, permissions: permissionsForRole(role).filter(p => !LOCKED_PERMS.has(p)) }));
  };
  const togglePerm = (perm) => {
    if (isSelf) return;
    if (LOCKED_PERMS.has(perm)) return;
    setForm(f => {
      const has = f.permissions.includes(perm);
      return { ...f, permissions: has ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm] };
    });
  };
  const toggleSchool = (id) => setForm(f => ({
    ...f,
    assignedSchools: f.assignedSchools.includes(id)
      ? f.assignedSchools.filter(x => x !== id)
      : [...f.assignedSchools, id]
  }));

  const fetchCoords = async () => {
    if (!form.officeAddress?.trim()) return toast.warn('Enter address first');
    setGeocoding(true);
    try {
      const r = await forwardGeocode(form.officeAddress);
      if (r) { set('officeLat', r.lat); set('officeLng', r.lng); toast.success('Coordinates fetched'); }
      else toast.error('Address not found');
    } catch (e) { toast.error('Geocoding failed'); }
    finally { setGeocoding(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!isSelf && !canGrantPerms(form.permissions)) return toast.error('Cannot grant locked permissions');
    setBusy(true);
    try {
      const payload = {
        name: form.name, department: form.department, designation: form.designation, phone: form.phone,
        joinedOn: form.joinedOn || null,
        assignedSchools: form.assignedSchools,
        officeAddress: form.officeAddress || '',
        officeLat: form.officeLat === '' ? null : parseFloat(form.officeLat),
        officeLng: form.officeLng === '' ? null : parseFloat(form.officeLng),
        officeRadiusM: form.officeRadiusM === '' ? null : parseInt(form.officeRadiusM)
      };
      if (!isSelf) {
        payload.role = form.role;
        // Preserve any locked perms the user already has (e.g. legacy super_admin editing themselves - not applicable here since !isSelf)
        const existingLocked = (user.permissions || []).filter(p => LOCKED_PERMS.has(p));
        payload.permissions = [...form.permissions, ...existingLocked];
      }
      await updateUser(user.id, payload);
      toast.success('User updated');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Edit • ${user.name}${isSelf ? ' (you)' : ''}`} size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button form="edit-user-form" className="btn-primary" disabled={busy}>
            {busy ? <Spinner className="text-white" /> : 'Save Changes'}
          </button>
        </>
      }>
      <form id="edit-user-form" onSubmit={save} className="space-y-6">
        {isSelf && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            🔒 You're editing your own profile. Role and permissions can't be changed here.
          </div>
        )}

        <div>
          <SectionHeader title="Basic Information" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Name</label><input className="input" value={form.name || ''} onChange={e => set('name', e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
            <div><label className="label">Department</label>
              <DepartmentPicker value={form.department || ''} options={departments} onChange={v => set('department', v)} />
            </div>
            <div><label className="label">Designation</label><input className="input" value={form.designation || ''} onChange={e => set('designation', e.target.value)} /></div>
            <div className="md:col-span-2"><label className="label">Email</label><input className="input" value={form.email} disabled /></div>
            <div className="md:col-span-2"><label className="label">Date of Joining</label>
              <input type="date" className="input" value={form.joinedOn || ''} onChange={e => set('joinedOn', e.target.value)} /></div>
          </div>
        </div>

        {!isSelf && assignableKeys.length > 0 && (
          <>
            <div>
              <SectionHeader title="Role" subtitle="Only roles below your level are shown" />
              <RolePicker assignableRoles={assignableRoles} activeRole={form.role} onPick={pickRole} />
            </div>
            <div>
              <SectionHeader title="Permissions" subtitle="Toggle any to add or remove" />
              <PermissionsToggle perms={form.permissions} onToggle={togglePerm} />
            </div>
          </>
        )}

        <div>
          <SectionHeader title="Assigned Schools" />
          <SchoolAssign schools={schools} assigned={form.assignedSchools} toggle={toggleSchool} />
        </div>

        <div>
          <SectionHeader title="Office Location (Personal Geofence)" subtitle="Overrides org default for Office check-ins" />
          <div className="space-y-3">
            <div>
              <label className="label">Office address</label>
              <div className="flex gap-2">
                <input className="input flex-1" value={form.officeAddress} onChange={e => set('officeAddress', e.target.value)} />
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={fetchCoords} disabled={geocoding}>
                  {geocoding ? <Spinner /> : 'Fetch coords'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Lat</label>
                <input className="input" type="number" step="any" value={form.officeLat} onChange={e => set('officeLat', e.target.value)} /></div>
              <div><label className="label">Lng</label>
                <input className="input" type="number" step="any" value={form.officeLng} onChange={e => set('officeLng', e.target.value)} /></div>
              <div><label className="label">Radius (m)</label>
                <input className="input" type="number" min="10" value={form.officeRadiusM} onChange={e => set('officeRadiusM', e.target.value)} /></div>
            </div>
          </div>
        </div>


      </form>
    </Modal>
  );
}

// =============================================================================
const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-3">
    <h3 className="text-sm font-bold text-ink-900">{title}</h3>
    {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
  </div>
);

function RolePicker({ assignableRoles, activeRole, onPick }) {
  const entries = Object.entries(assignableRoles);
  if (entries.length === 0) {
    return <div className="text-sm text-ink-500 rounded-lg bg-ink-50 p-3">No roles available for you to assign.</div>;
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
      {entries.map(([key, preset]) => {
        const active = activeRole === key;
        return (
          <button type="button" key={key} onClick={() => onPick(key)} title={preset.description}
            className={`rounded-xl border p-2.5 text-left transition
              ${active ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-ink-200 hover:border-ink-300'}`}>
            <div className="text-xs font-bold text-ink-900">{preset.label}</div>
            <div className="text-[10px] text-ink-500 leading-tight mt-0.5 line-clamp-2">{preset.description}</div>
          </button>
        );
      })}
    </div>
  );
}

function PermissionsToggle({ perms, onToggle }) {
  return (
    <div className="rounded-xl border border-ink-100 overflow-hidden divide-y divide-ink-100">
      {PERMISSION_MATRIX.map(group => {
        // Skip modules with no toggleable items
        const items = group.items.filter(item => !LOCKED_PERMS.has(item.key));
        if (items.length === 0) return null;
        return (
          <div key={group.module} className="p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="w-full sm:w-40 font-semibold text-sm text-ink-800">{group.module}</div>
            <div className="flex flex-wrap gap-2 flex-1">
              {items.map(item => {
                const checked = hasPermission(perms, item.key);
                return (
                  <label key={item.key}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs cursor-pointer transition hover:opacity-90
                      ${checked ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600'}`}>
                    <input type="checkbox" checked={checked} onChange={() => onToggle(item.key)} className="sr-only" />
                    {checked ? '✓' : '+'} {item.label}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DepartmentPicker({ value, options, onChange }) {
  // Combobox: dropdown of stored departments + "Other" that reveals a text input.
  // If the current value isn't in options (legacy user or manual entry), we auto-switch to Other.
  const inOptions = value && options.includes(value);
  const [mode, setMode] = useState(inOptions || !value ? 'select' : 'other');

  const handleSelect = (v) => {
    if (v === '__other__') {
      setMode('other');
      onChange('');
    } else {
      setMode('select');
      onChange(v);
    }
  };

  if (mode === 'other') {
    return (
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Type department name"
          value={value} onChange={e => onChange(e.target.value)} />
        {options.length > 0 && (
          <button type="button" className="btn-secondary text-xs whitespace-nowrap"
            onClick={() => { setMode('select'); onChange(''); }}>Pick from list</button>
        )}
      </div>
    );
  }

  return (
    <select className="input" value={inOptions ? value : ''} onChange={e => handleSelect(e.target.value)}>
      <option value="">— Select —</option>
      {options.map(d => <option key={d} value={d}>{d}</option>)}
      <option value="__other__">+ Other (type new)</option>
    </select>
  );
}

function SchoolAssign({ schools, assigned, toggle }) {
  if (!schools.length) {
    return <div className="text-sm text-ink-500 rounded-lg bg-ink-50 p-3">No schools yet. Go to Schools → Add School first.</div>;
  }
  return (
    <div className="rounded-xl border border-ink-100 divide-y divide-ink-100 max-h-64 overflow-y-auto">
      {schools.map(s => {
        const isOn = assigned.includes(s.id);
        return (
          <label key={s.id} className={`flex items-center gap-3 p-3 cursor-pointer transition ${isOn ? 'bg-brand-50' : 'hover:bg-ink-50'}`}>
            <input type="checkbox" checked={isOn} onChange={() => toggle(s.id)} className="w-4 h-4" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{s.name}</div>
              <div className="text-xs text-ink-500">In {s.inTime} · Out {s.outTime}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}