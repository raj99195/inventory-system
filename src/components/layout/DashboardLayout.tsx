import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ArrowLeftRight,
  FileText,
  Receipt,
  Users,
  Laptop,
  UserCheck,
  History,
  LogOut,
  Menu,
  X,
  Search,
  Sparkles,
  ChevronDown,
  Command,
  Plus,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch';
import {
  QuickAddProvider,
  useQuickAdd,
  type QuickAddType,
} from '@/contexts/QuickAddContext';
import { ROLE_LABELS } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Logo from '@/components/ui/Logo';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  viewPerm: string;
  createPerm?: string;
  /** If present, sidebar + opens a global modal INSTEAD of navigating */
  quickAddType?: QuickAddType;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
    viewPerm: 'dashboard.view',
  },
  {
    to: '/products',
    label: 'Products',
    icon: Package,
    viewPerm: 'products.view',
    createPerm: 'products.create',
    quickAddType: 'products',
    children: [
      {
        to: '/kits',
        label: 'Kits',
        icon: Boxes,
        viewPerm: 'kits.view',
        createPerm: 'kits.create',
        quickAddType: 'kits',
      },
    ],
  },
  {
    to: '/stock',
    label: 'Stock Movement',
    icon: ArrowLeftRight,
    viewPerm: 'stock.view',
    createPerm: 'stock.stockIn',
    quickAddType: 'stock',
  },
  {
    to: '/invoices',
    label: 'Invoices',
    icon: FileText,
    viewPerm: 'invoices.view',
    createPerm: 'invoices.upload',
    quickAddType: 'invoices',
  },
  {
    to: '/quotations',
    label: 'Quotations',
    icon: Receipt,
    viewPerm: 'quotations.view',
    createPerm: 'quotations.create',
    // No quickAddType — QuickAddContext doesn't have quotations yet;
    // sidebar hover "+" falls back to navigating with openCreate state
  },
  {
    to: '/employees',
    label: 'Employees',
    icon: Users,
    viewPerm: 'employees.view',
    createPerm: 'employees.create',
    quickAddType: 'employees',
  },
  {
    to: '/assets',
    label: 'Assets',
    icon: Laptop,
    viewPerm: 'assets.view',
    createPerm: 'assets.create',
    quickAddType: 'assets',
  },
  {
    to: '/assignments',
    label: 'Assignments',
    icon: UserCheck,
    viewPerm: 'assignments.view',
    createPerm: 'assignments.assign',
    quickAddType: 'assignments',
  },
  // Users & Roles removed from sidebar — accessible via user dropdown (top-right) instead
];

const QUICK_ACTIONS: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  perm: string;
  quickAddType?: QuickAddType;
}[] = [
  { label: 'New Product', icon: Package, href: '/products', perm: 'products.create', quickAddType: 'products' },
  { label: 'New Kit', icon: Boxes, href: '/kits', perm: 'kits.create', quickAddType: 'kits' },
  { label: 'Stock Movement', icon: ArrowLeftRight, href: '/stock', perm: 'stock.stockIn', quickAddType: 'stock' },
  { label: 'Upload Invoice', icon: FileText, href: '/invoices', perm: 'invoices.upload', quickAddType: 'invoices' },
  { label: 'New Quotation', icon: Receipt, href: '/quotations', perm: 'quotations.create' },
  { label: 'Add Employee', icon: Users, href: '/employees', perm: 'employees.create', quickAddType: 'employees' },
  { label: 'Register Asset', icon: Laptop, href: '/assets', perm: 'assets.create', quickAddType: 'assets' },
  { label: 'Assign Asset', icon: UserCheck, href: '/assignments', perm: 'assignments.assign', quickAddType: 'assignments' },
  { label: 'New User', icon: Shield, href: '/users', perm: 'users.create', quickAddType: 'users' },
];

export default function DashboardLayout() {
  const { user, userDoc, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login');
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <QuickAddProvider>
      <div className="min-h-screen bg-brand-cream flex">
        <aside className="hidden lg:flex lg:flex-col w-72 bg-white border-r border-brand-choco/5 sticky top-0 h-screen">
          <SidebarContent
            onLogout={handleLogout}
            userEmail={user?.email ?? ''}
            userName={userDoc?.name ?? 'User'}
            userRole={userDoc?.role ?? null}
          />
        </aside>

        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-brand-choco/40 backdrop-blur-sm z-40 lg:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden flex flex-col"
              >
                <SidebarContent
                  onLogout={handleLogout}
                  userEmail={user?.email ?? ''}
                  userName={userDoc?.name ?? 'User'}
                  userRole={userDoc?.role ?? null}
                  onNavigate={() => setSidebarOpen(false)}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-brand-cream/70 backdrop-blur-xl border-b border-brand-choco/5">
            <div className="flex items-center gap-3 px-4 lg:px-8 h-20">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden w-11 h-11 rounded-2xl bg-white border border-brand-choco/8 flex items-center justify-center hover:bg-brand-cream-dark transition"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="hidden lg:flex flex-col mr-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-choco-soft">
                  {pageTitle.category}
                </span>
                <h2 className="font-display font-bold text-lg leading-tight">
                  {pageTitle.title}
                </h2>
              </div>

              <div className="flex-1" />

              <GlobalSearch />
              <QuickActionsMenu />
              <UserMenu
                userEmail={user?.email ?? ''}
                userName={userDoc?.name ?? 'User'}
                userRole={userDoc?.role ?? null}
                onLogout={handleLogout}
              />
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </QuickAddProvider>
  );
}

function getPageTitle(path: string) {
  const map: Record<string, { category: string; title: string }> = {
    '/': { category: 'Overview', title: 'Dashboard' },
    '/products': { category: 'Inventory', title: 'Products' },
    '/kits': { category: 'Inventory', title: 'Kits' },
    '/stock': { category: 'Inventory', title: 'Stock Movement' },
    '/invoices': { category: 'Inventory', title: 'Invoices' },
    '/quotations': { category: 'Sales', title: 'Quotations' },
    '/employees': { category: 'Team', title: 'Employees' },
    '/assets': { category: 'Assets', title: 'Company Assets' },
    '/assignments': { category: 'Assets', title: 'Assignments' },
    '/audit': { category: 'Compliance', title: 'Audit Log' },
    '/users': { category: 'Access Control', title: 'Users & Roles' },
  };
  return map[path] ?? { category: 'Portal', title: 'STEMmantra' };
}

/** ------------- Sidebar Item ------------- */
function SidebarNavItem({
  item,
  onNavigate,
  indent,
}: {
  item: NavItem;
  onNavigate?: () => void;
  indent?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { open: openQuickAdd, supports } = useQuickAdd();

  const isActive = location.pathname === item.to;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.quickAddType && supports(item.quickAddType)) {
      openQuickAdd(item.quickAddType);
    } else {
      navigate(item.to, { state: { openCreate: true } });
    }
    onNavigate?.();
  };

  const showCreateButton = item.createPerm && can(item.createPerm) && !isActive;

  return (
    <div className={cn('group relative', indent && 'ml-6')}>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive: navActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all pr-10',
            navActive
              ? 'bg-gradient-to-r from-brand-orange to-brand-orange-light text-white shadow-lg shadow-brand-orange/25'
              : 'text-brand-choco-light hover:bg-brand-cream-dark'
          )
        }
      >
        {({ isActive: navActive }) => (
          <>
            <item.icon
              className={cn(
                'w-5 h-5 transition shrink-0',
                navActive
                  ? 'text-white'
                  : 'text-brand-choco-soft group-hover:text-brand-orange'
              )}
            />
            <span className="flex-1 truncate">{item.label}</span>
            {navActive && (
              <motion.div
                layoutId="activeDot"
                className="w-1.5 h-1.5 rounded-full bg-white shrink-0"
              />
            )}
          </>
        )}
      </NavLink>

      {showCreateButton && (
        <button
          onClick={handleQuickAdd}
          title={`Add new ${item.label.toLowerCase()}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-white shadow-md border border-brand-choco/8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-brand-orange hover:text-white hover:border-brand-orange hover:scale-105 z-10"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/** ------------- Global Search ------------- */
function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { results } = useGlobalSearch(query);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const goto = (r: SearchResult) => {
    navigate(r.path);
    setOpen(false);
    setQuery('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goto(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="flex-1 max-w-md relative">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft pointer-events-none group-focus-within:text-brand-orange transition" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="Search anything..."
          className="w-full pl-11 pr-20 py-3 rounded-2xl bg-white border-2 border-brand-choco/8 focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 outline-none text-sm font-medium transition shadow-sm hover:shadow"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-cream-dark text-[10px] font-mono font-bold text-brand-choco-soft border border-brand-choco/10">
          <Command className="w-2.5 h-2.5" /> K
        </kbd>
      </div>

      <AnimatePresence>
        {open && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-full mt-2 left-0 right-0 bg-white rounded-3xl shadow-2xl border border-brand-choco/8 overflow-hidden z-50"
          >
            {results.length === 0 ? (
              <div className="p-8 text-center">
                <Search className="w-10 h-10 text-brand-choco-soft/40 mx-auto mb-3" />
                <p className="text-sm text-brand-choco-soft">
                  No matches for "<span className="font-semibold">{query}</span>"
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto py-2">
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => goto(r)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition',
                      activeIdx === i && 'bg-brand-cream-dark'
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        r.type === 'product' && 'bg-pastel-blue',
                        r.type === 'asset' && 'bg-pastel-peach',
                        r.type === 'employee' && 'bg-pastel-green',
                        r.type === 'invoice' && 'bg-pastel-pink'
                      )}
                    >
                      {r.type === 'product' && <Package className="w-4 h-4" />}
                      {r.type === 'asset' && <Laptop className="w-4 h-4" />}
                      {r.type === 'employee' && <Users className="w-4 h-4" />}
                      {r.type === 'invoice' && <FileText className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {r.title}
                      </p>
                      <p className="text-xs text-brand-choco-soft truncate">
                        {r.subtitle}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-brand-choco-soft tracking-wider">
                      {r.badge}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="border-t border-brand-choco/8 px-4 py-2.5 flex items-center gap-3 text-[10px] text-brand-choco-soft bg-brand-cream-dark/40">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-brand-choco/10 font-mono">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-brand-choco/10 font-mono">↵</kbd> open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-brand-choco/10 font-mono">esc</kbd> close
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** ------------- Quick Actions ------------- */
function QuickActionsMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { can } = usePermission();
  const { open: openQuickAdd, supports } = useQuickAdd();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const allowedActions = QUICK_ACTIONS.filter((a) => can(a.perm));

  if (allowedActions.length === 0) return null;

  const handleAction = (action: typeof QUICK_ACTIONS[number]) => {
    if (action.quickAddType && supports(action.quickAddType)) {
      openQuickAdd(action.quickAddType);
    } else {
      navigate(action.href, { state: { openCreate: true } });
    }
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'hidden sm:flex items-center gap-2 h-12 px-4 rounded-2xl font-semibold text-sm transition-all',
          'bg-gradient-to-r from-brand-orange to-brand-orange-light text-white shadow-lg shadow-brand-orange/25 hover:shadow-xl hover:shadow-brand-orange/30'
        )}
      >
        <Plus className="w-4 h-4" />
        <span className="hidden md:inline">Quick Add</span>
        <ChevronDown
          className={cn('w-4 h-4 transition', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-brand-choco/8 py-2 z-50"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-choco-soft px-4 py-2">
              Quick Actions
            </p>
            {allowedActions.map((action) => (
              <button
                key={action.href}
                onClick={() => handleAction(action)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold hover:bg-brand-cream-dark transition text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-brand-orange-100 flex items-center justify-center">
                  <action.icon className="w-4 h-4 text-brand-orange" />
                </div>
                {action.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** ------------- User Menu (with Audit Log link) ------------- */
function UserMenu({
  userEmail,
  userName,
  userRole,
  onLogout,
}: {
  userEmail: string;
  userName: string;
  userRole: string | null;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { can } = usePermission();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const initial = (userName?.[0] ?? userEmail?.[0] ?? '?').toUpperCase();
  const roleLabel = userRole
    ? ROLE_LABELS[userRole as keyof typeof ROLE_LABELS]
    : 'Signed in';

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-12 pl-1 pr-3 rounded-2xl bg-white border-2 border-brand-choco/8 hover:border-brand-orange/40 transition shadow-sm"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center text-white font-bold text-sm shadow-md">
          {initial}
        </div>
        <div className="hidden md:block text-left">
          <p className="text-sm font-bold leading-tight">{userName}</p>
          <p className="text-[10px] text-brand-choco-soft leading-tight">
            {roleLabel}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-brand-choco-soft transition hidden md:block',
            open && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-brand-choco/8 overflow-hidden z-50"
          >
            <div className="p-4 bg-gradient-to-br from-brand-orange-100 to-brand-cream-deep">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{userName}</p>
                  <p className="text-xs text-brand-choco-soft truncate">
                    {userEmail}
                  </p>
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white/70 text-[10px] font-bold text-brand-choco">
                    {userRole === 'super_admin' ? (
                      <ShieldCheck className="w-2.5 h-2.5" />
                    ) : (
                      <Shield className="w-2.5 h-2.5" />
                    )}
                    {roleLabel}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-[10px] font-bold text-green-700 bg-white/60 backdrop-blur-sm px-2 py-1 rounded-full w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Online · Firebase authenticated
              </div>
            </div>

            <div className="p-2">
              {can('audit.view') && (
                <button
                  onClick={() => {
                    navigate('/audit');
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-brand-choco hover:bg-brand-cream-dark transition text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-brand-orange-100 flex items-center justify-center">
                    <History className="w-4 h-4 text-brand-orange" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold leading-tight">Audit Log</p>
                    <p className="text-[10px] text-brand-choco-soft leading-tight mt-0.5">
                      View all system activity
                    </p>
                  </div>
                </button>
              )}

              {can('users.view') && (
                <button
                  onClick={() => {
                    navigate('/users');
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-brand-choco hover:bg-brand-cream-dark transition text-left"
                >
                  <div className="w-8 h-8 rounded-xl bg-brand-orange-100 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-brand-orange" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold leading-tight">
                      Users & Roles
                    </p>
                    <p className="text-[10px] text-brand-choco-soft leading-tight mt-0.5">
                      Manage access
                    </p>
                  </div>
                </button>
              )}

              <div className="h-px bg-brand-choco/8 my-1" />

              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** ------------- Sidebar ------------- */
function SidebarContent({
  onLogout,
  userEmail,
  userName,
  userRole,
  onNavigate,
}: {
  onLogout: () => void;
  userEmail: string;
  userName: string;
  userRole: string | null;
  onNavigate?: () => void;
}) {
  const { can } = usePermission();

  const visibleItems = navItems
    .filter((item) => can(item.viewPerm))
    .map((item) => ({
      ...item,
      children: item.children?.filter((c) => can(c.viewPerm)) ?? [],
    }));

  const initial = (userName?.[0] ?? userEmail?.[0] ?? '?').toUpperCase();
  const roleLabel = userRole
    ? ROLE_LABELS[userRole as keyof typeof ROLE_LABELS]
    : '';

  return (
    <>
      <div className="p-6 pb-4 flex items-center justify-between">
        <Logo variant="wide" size="lg" />
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="lg:hidden w-8 h-8 rounded-lg hover:bg-brand-cream-dark flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-brand-choco/8 to-transparent mx-6" />

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="mb-3 px-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-choco-soft">
            Main Menu
          </p>
        </div>
        <div className="space-y-1">
          {visibleItems.map((item, idx) => (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="space-y-1"
            >
              <SidebarNavItem item={item} onNavigate={onNavigate} />
              {item.children?.map((child) => (
                <SidebarNavItem
                  key={child.to}
                  item={child}
                  onNavigate={onNavigate}
                  indent
                />
              ))}
            </motion.div>
          ))}
        </div>
      </nav>

      <div className="p-4 mt-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-cream-dark to-brand-cream-deep border border-brand-orange/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-brand-orange font-bold">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{userName}</p>
              <p className="text-xs text-brand-choco-soft truncate">
                {userEmail}
              </p>
              {roleLabel && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white text-[9px] font-bold text-brand-choco">
                  {userRole === 'super_admin' ? (
                    <ShieldCheck className="w-2.5 h-2.5" />
                  ) : (
                    <Shield className="w-2.5 h-2.5" />
                  )}
                  {roleLabel}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white hover:bg-brand-orange hover:text-white transition-all text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-brand-choco-soft">
          <Sparkles className="w-3 h-3" />
          v1.0 · STEMmantra
        </div>
      </div>
    </>
  );
}