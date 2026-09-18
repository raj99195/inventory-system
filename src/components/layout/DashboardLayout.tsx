import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  FileText,
  Users,
  Laptop,
  UserCheck,
  Wrench,
  BarChart3,
  History,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/stock', label: 'Stock Movement', icon: ArrowLeftRight },
  { to: '/invoices', label: 'Zoho Invoices', icon: FileText },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/assets', label: 'Assets', icon: Laptop },
  { to: '/assignments', label: 'Assignments', icon: UserCheck },
  { to: '/repairs', label: 'Repairs', icon: Wrench },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/audit', label: 'Audit Log', icon: History },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-brand-cream flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:flex-col w-72 bg-white border-r border-brand-choco/5 sticky top-0 h-screen">
        <SidebarContent onLogout={handleLogout} userEmail={user?.email ?? ''} />
      </aside>

      {/* Sidebar — mobile */}
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
                onNavigate={() => setSidebarOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-brand-cream/80 backdrop-blur-lg border-b border-brand-choco/5">
          <div className="flex items-center gap-4 px-4 lg:px-8 h-16">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-10 h-10 rounded-xl bg-white flex items-center justify-center"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex-1 max-w-xl relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
              <input
                type="text"
                placeholder="Search products, assets, invoices..."
                className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white border border-brand-choco/8 focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 outline-none text-sm"
              />
            </div>

            <button className="w-10 h-10 rounded-xl bg-white flex items-center justify-center relative">
              <Bell className="w-5 h-5 text-brand-choco-light" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-orange" />
            </button>

            <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-brand-choco/8">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center text-white font-bold text-sm">
                {user?.email?.[0]?.toUpperCase()}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold leading-tight">Admin</p>
                <p className="text-xs text-brand-choco-soft leading-tight">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  onLogout,
  userEmail,
  onNavigate,
}: {
  onLogout: () => void;
  userEmail: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center shadow-lg">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-lg leading-tight">
              STEMmantra
            </p>
            <p className="text-xs text-brand-choco-soft leading-tight">
              Inventory Portal
            </p>
          </div>
        </div>
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="lg:hidden w-8 h-8 rounded-lg hover:bg-brand-cream-dark flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 overflow-y-auto">
        <div className="mb-4 px-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-choco-soft">
            Main Menu
          </p>
        </div>
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-brand-orange to-brand-orange-light text-white shadow-lg shadow-brand-orange/25'
                    : 'text-brand-choco-light hover:bg-brand-cream-dark'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'w-5 h-5 transition',
                      isActive ? 'text-white' : 'text-brand-choco-soft group-hover:text-brand-orange'
                    )}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="p-4 mt-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-cream-dark to-brand-cream-deep border border-brand-orange/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-brand-orange font-bold">
              {userEmail[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">Admin</p>
              <p className="text-xs text-brand-choco-soft truncate">
                {userEmail}
              </p>
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
      </div>
    </>
  );
}
