import { useId, useState } from 'react';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { PERMISSION_MODULES } from '@/lib/permissions';
import type { Permissions } from '@/types';
import { cn } from '@/lib/utils';

type ModuleKey = keyof Permissions;
interface PermissionRow {
  key: ModuleKey;
  label?: string;
  actions?: string[];
}
interface PermissionGroup { title: string; rows: PermissionRow[] }

const SECTIONS: { title: string; description: string; groups: PermissionGroup[] }[] = [
  { title: 'HRMS', description: 'Personal attendance, leaves and team management.', groups: [
    { title: 'Personal', rows: [
      { key: 'attendance', label: 'My Attendance', actions: ['markOwn', 'viewOwn'] },
      { key: 'leaves', label: 'My Leaves', actions: ['applyOwn', 'viewOwn', 'cancelOwn'] },
      { key: 'reimbursements', label: 'My Reimbursements', actions: ['createOwn', 'viewOwn'] },
    ] },
    { title: 'Management', rows: [
      { key: 'employees' },
      { key: 'attendance', label: 'Team Attendance', actions: ['viewAll', 'editAll', 'exportAll'] },
      { key: 'leaves', label: 'Leave Approvals', actions: ['viewAll', 'approve', 'exportAll'] },
      { key: 'schools' },
      { key: 'reimbursements', label: 'Reimbursement Management', actions: ['viewAll', 'pay'] },
    ] },
  ] },
  { title: 'Inventory', description: 'Stock, finance, assets and employee requests.', groups: [
    { title: 'Office', rows: [{ key: 'officeInventory' }, { key: 'officeAssets' }] },
    { title: 'Stock & Products', rows: [{ key: 'dashboard', label: 'Inventory Dashboard' }, { key: 'products' }, { key: 'kits' }, { key: 'stock' }, { key: 'categories' }] },
    { title: 'Finance', rows: [{ key: 'invoices' }, { key: 'quotations' }] },
    { title: 'Asset Management', rows: [{ key: 'assets' }, { key: 'assignments' }] },
    { title: 'Personal Requests', rows: [{ key: 'requests', label: 'My Requests', actions: ['createOwn', 'viewOwn', 'cancelOwn'] }] },
    { title: 'Request Management', rows: [{ key: 'requests', label: 'Request Approvals', actions: ['viewAll', 'approve'] }] },
  ] },
  { title: 'Administration', description: 'User access, audit history and system settings.', groups: [
    { title: 'Access & Settings', rows: [{ key: 'users' }, { key: 'audit' }, { key: 'settings' }] },
  ] },
];

function actionsFor(row: PermissionRow) {
  const module = PERMISSION_MODULES.find((item) => item.key === row.key)!;
  return module.actions.filter((action) => !row.actions || row.actions.includes(action.key));
}

const ACTION_LABELS: Record<string, string> = {
  'attendance.markOwn': 'Mark Attendance', 'attendance.viewOwn': 'My History',
  'attendance.viewAll': 'View Team', 'attendance.editAll': 'Edit Team',
  'leaves.applyOwn': 'Apply Leave', 'leaves.viewOwn': 'View My Leaves', 'leaves.cancelOwn': 'Cancel My Leave',
  'leaves.viewAll': 'View Team Leaves',
  'requests.createOwn': 'New Request', 'requests.viewOwn': 'View My Requests', 'requests.cancelOwn': 'Cancel My Request',
  'requests.viewAll': 'View Team Requests',
};

export default function PermissionMatrix({ permissions, onToggle }: {
  permissions: Permissions;
  onToggle: (module: ModuleKey, actions: string[], value: boolean) => void;
}) {
  const [active, setActive] = useState('HRMS');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'HRMS-Personal': true, 'Inventory-Stock & Products': true, 'Administration-Access & Settings': true });
  const id = useId();
  const enabled = (key: ModuleKey, action: string) => (permissions[key] as Record<string, boolean> | undefined)?.[action] === true;
  const counts = (rows: PermissionRow[]) => {
    const all = rows.flatMap((row) => actionsFor(row).map((action) => enabled(row.key, action.key)));
    return { enabled: all.filter(Boolean).length, total: all.length };
  };
  const section = SECTIONS.find((item) => item.title === active)!;

  return <div className="rounded-2xl border border-brand-choco/10 bg-white overflow-hidden">
    <div role="tablist" aria-label="Permission categories" className="flex gap-1 p-2 bg-brand-cream-dark/50 overflow-x-auto">
      {SECTIONS.map((item) => {
        const count = counts(item.groups.flatMap((group) => group.rows));
        return <button key={item.title} id={`${id}-${item.title}`} role="tab" type="button" tabIndex={active === item.title ? 0 : -1} aria-selected={active === item.title} aria-controls={`${id}-panel`} onClick={() => setActive(item.title)}
          onKeyDown={(event) => {
            const index = SECTIONS.indexOf(item);
            const nextIndex = event.key === 'ArrowRight' ? (index + 1) % SECTIONS.length : event.key === 'ArrowLeft' ? (index + SECTIONS.length - 1) % SECTIONS.length : event.key === 'Home' ? 0 : event.key === 'End' ? SECTIONS.length - 1 : -1;
            if (nextIndex < 0) return;
            event.preventDefault();
            setActive(SECTIONS[nextIndex].title);
            document.getElementById(`${id}-${SECTIONS[nextIndex].title}`)?.focus();
          }}
          className={cn('flex-1 min-w-fit flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-brand-orange', active === item.title ? 'bg-white text-brand-orange shadow-sm' : 'text-brand-choco-soft hover:bg-white/60')}>
          {item.title}<span className="rounded-full bg-brand-cream-dark px-2 py-0.5 text-[10px] text-brand-choco-soft">{count.enabled}/{count.total}</span>
        </button>;
      })}
    </div>
    <div id={`${id}-panel`} role="tabpanel" tabIndex={0} aria-labelledby={`${id}-${active}`} className="p-3 sm:p-4 space-y-3">
      <p className="text-xs text-brand-choco-soft">{section.description} Orange = enabled; outlined = disabled.</p>
      {section.groups.map((group) => {
        const count = counts(group.rows);
        const groupId = `${active}-${group.title}`;
        return <details key={groupId} open={!!expanded[groupId]} className="group rounded-xl border border-brand-choco/10">
          <summary onClick={(event) => { event.preventDefault(); setExpanded((previous) => ({ ...previous, [groupId]: !previous[groupId] })); }} className="flex cursor-pointer list-none items-center gap-2 p-3 font-bold text-sm bg-brand-cream-dark/40 rounded-xl [&::-webkit-details-marker]:hidden">
            <span className="flex-1">{group.title}</span><span className="text-xs font-medium text-brand-choco-soft">{count.enabled}/{count.total} enabled</span><ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="divide-y divide-brand-choco/5">
            {group.rows.map((row) => {
              const module = PERMISSION_MODULES.find((item) => item.key === row.key)!;
              const actions = actionsFor(row);
              const selected = actions.filter((action) => enabled(row.key, action.key)).length;
              const all = selected === actions.length;
              const label = row.label ?? module.label;
              return <div key={row.key} className="p-3 space-y-3 sm:space-y-0 sm:flex sm:items-start sm:gap-4">
                <div className="flex items-center justify-between gap-3 sm:w-52 sm:shrink-0">
                  <div><p className="text-sm font-semibold">{label}</p><p className="text-[10px] text-brand-choco-soft mt-0.5">{selected} of {actions.length} enabled</p></div>
                  <div className="flex flex-col items-center gap-1"><button type="button" role="checkbox" aria-checked={all ? true : selected ? 'mixed' : false} aria-label={`Select all ${label} permissions`} onClick={() => onToggle(row.key, actions.map((action) => action.key), !all)}
                    className={cn('w-8 h-8 shrink-0 border rounded-lg flex items-center justify-center transition focus-visible:outline-2 focus-visible:outline-brand-orange', all ? 'bg-brand-orange border-brand-orange text-white' : selected ? 'bg-brand-orange-50 border-brand-orange text-brand-orange' : 'border-brand-choco/20 hover:border-brand-orange')}>
                    {all ? <Check size={15} /> : selected ? <Minus size={15} /> : null}
                  </button><span className="text-[9px] font-semibold text-brand-choco-soft">All</span></div>
                </div>
                <div className="flex flex-wrap gap-2 flex-1">
                  {actions.map((action) => {
                    const isOn = enabled(row.key, action.key);
                    const actionLabel = ACTION_LABELS[`${row.key}.${action.key}`] ?? action.label;
                    return <button key={action.key} type="button" role="checkbox" aria-checked={isOn} aria-label={`${label}: ${actionLabel}`} onClick={() => onToggle(row.key, [action.key], !isOn)}
                      className={cn('inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition focus-visible:outline-2 focus-visible:outline-brand-orange', isOn ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-choco-soft border-brand-choco/15 hover:border-brand-orange/50')}>
                      {isOn ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 rounded border border-current/30" />}{actionLabel}
                    </button>;
                  })}
                </div>
              </div>;
            })}
          </div>
        </details>;
      })}
    </div>
  </div>;
}
