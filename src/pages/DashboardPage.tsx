import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  PackageCheck,
  AlertTriangle,
  PackageX,
  Laptop,
  UserCheck,
  Wrench,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Clock,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { cn, formatDateTime, formatINR } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import { useAssets } from '@/hooks/useAssets';
import { useEmployees } from '@/hooks/useEmployees';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { useAssignments } from '@/hooks/useAssignments';
import { useInvoices } from '@/hooks/useInvoices';

export default function DashboardPage() {
  const { products, loading: pLoading } = useProducts();
  const { assets } = useAssets();
  const { employees } = useEmployees();
  const { transactions } = useStockTransactions(200);
  const { assignments } = useAssignments(50);
  const { invoices } = useInvoices(50);

  // ============ Product Stats ============
  const productStats = useMemo(() => {
    const total = products.length;
    const totalStock = products.reduce((s, p) => s + (p.currentStock || 0), 0);
    const low = products.filter(
      (p) => p.currentStock > 0 && p.currentStock <= p.minStockLevel
    ).length;
    const out = products.filter((p) => p.currentStock === 0).length;
    return { total, totalStock, low, out };
  }, [products]);

  // ============ Asset Stats ============
  const assetStats = useMemo(() => {
    const buckets: Record<string, number> = {
      available: 0,
      assigned: 0,
      'under-repair': 0,
      damaged: 0,
      lost: 0,
      retired: 0,
      disposed: 0,
    };
    assets.forEach((a) => {
      buckets[a.status] = (buckets[a.status] ?? 0) + 1;
    });
    const totalValue = assets.reduce((s, a) => s + (a.purchaseCost || 0), 0);
    return {
      total: assets.length,
      totalValue,
      ...buckets,
    };
  }, [assets]);

  // ============ Stock Movement Chart (last 7 days) ============
  const stockMovementData = useMemo(() => {
    const days: { day: string; date: Date; in: number; out: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d,
        in: 0,
        out: 0,
      });
    }
    transactions.forEach((t) => {
      const txDate = t.createdAt?.toDate?.();
      if (!txDate) return;
      const dayStart = new Date(txDate);
      dayStart.setHours(0, 0, 0, 0);
      const bucket = days.find((d) => d.date.getTime() === dayStart.getTime());
      if (!bucket) return;
      if (t.quantity > 0) bucket.in += t.quantity;
      else bucket.out += Math.abs(t.quantity);
    });
    return days.map(({ day, in: i, out }) => ({ day, in: i, out }));
  }, [transactions]);

  // ============ Asset Status Pie ============
  const assetStatusData = useMemo(() => {
    const items = [
      { name: 'Available', value: assetStats.available, color: '#A8D5A2' },
      { name: 'Assigned', value: assetStats.assigned, color: '#F97316' },
      { name: 'Under Repair', value: assetStats['under-repair'], color: '#F7CB92' },
      { name: 'Damaged', value: assetStats.damaged, color: '#F0A8B4' },
    ];
    return items.filter((i) => i.value > 0);
  }, [assetStats]);

  // ============ Category Stock Bar ============
  const categoryStockData = useMemo(() => {
    const byCat: Record<string, number> = {};
    products.forEach((p) => {
      byCat[p.category] = (byCat[p.category] ?? 0) + (p.currentStock || 0);
    });
    return Object.entries(byCat)
      .map(([category, stock]) => ({ category, stock }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 8);
  }, [products]);

  // ============ Recent Activity ============
  const recentActivity = useMemo(() => {
    interface Item {
      icon: React.ComponentType<{ className?: string }>;
      text: string;
      time: Date;
      color: string;
      link: string;
    }
    const items: Item[] = [];

    transactions.slice(0, 20).forEach((t) => {
      const txDate = t.createdAt?.toDate?.();
      if (!txDate) return;
      items.push({
        icon: t.quantity > 0 ? ArrowDownToLine : ArrowUpFromLine,
        text: `${t.quantity > 0 ? 'Stock In' : 'Stock Out'}: ${t.productName} ${t.quantity > 0 ? '+' : ''}${t.quantity}`,
        time: txDate,
        color: t.quantity > 0 ? 'green' : 'peach',
        link: '/stock',
      });
    });

    assignments.slice(0, 10).forEach((a) => {
      const d = a.createdAt?.toDate?.();
      if (!d) return;
      items.push({
        icon: UserCheck,
        text: `${a.action === 'assigned' ? 'Assigned' : a.action === 'returned' ? 'Returned' : 'Transferred'}: ${a.assetName} → ${a.employeeName}`,
        time: d,
        color: a.action === 'returned' ? 'blue' : 'orange',
        link: '/assignments',
      });
    });

    invoices.slice(0, 5).forEach((i) => {
      const d = i.uploadedAt?.toDate?.();
      if (!d) return;
      items.push({
        icon: FileText,
        text: `Invoice ${i.invoiceNumber} ${i.status === 'stock-updated' ? 'processed' : 'uploaded'}`,
        time: d,
        color: 'pink',
        link: '/invoices',
      });
    });

    return items.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 8);
  }, [transactions, assignments, invoices]);

  // ============ Weekly In/Out totals ============
  const weeklyTotals = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let inTotal = 0;
    let outTotal = 0;
    transactions.forEach((t) => {
      const d = t.createdAt?.toDate?.();
      if (!d || d < weekAgo) return;
      if (t.quantity > 0) inTotal += t.quantity;
      else outTotal += Math.abs(t.quantity);
    });
    return { inTotal, outTotal };
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
            Overview
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Dashboard
          </h1>
          <p className="text-brand-choco-soft mt-2">
            Live inventory & asset summary at a glance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-sm text-brand-choco-soft">
            <Clock className="w-4 h-4" />
            Real-time
          </div>
        </div>
      </motion.div>

      {/* Products */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-choco-soft mb-3">
          Product Inventory
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Products"
            value={productStats.total}
            icon={Package}
            color="pastel-blue"
            link="/products"
            delay={0}
          />
          <StatCard
            label="Available Stock"
            value={productStats.totalStock}
            icon={PackageCheck}
            color="pastel-green"
            link="/products"
            delay={0.05}
          />
          <StatCard
            label="Low Stock Items"
            value={productStats.low}
            icon={AlertTriangle}
            color="pastel-peach"
            link="/products"
            warning
            delay={0.1}
          />
          <StatCard
            label="Out of Stock"
            value={productStats.out}
            icon={PackageX}
            color="pastel-pink"
            link="/products"
            warning
            delay={0.15}
          />
        </div>
      </section>

      {/* Assets */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-choco-soft">
            Company Assets
          </h2>
          <p className="text-xs text-brand-choco-soft">
            Total value:{' '}
            <span className="font-bold text-brand-orange">
              {formatINR(assetStats.totalValue)}
            </span>
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Assets"
            value={assetStats.total}
            icon={Laptop}
            color="pastel-blue"
            link="/assets"
            delay={0}
          />
          <StatCard
            label="Assigned"
            value={assetStats.assigned}
            icon={UserCheck}
            color="pastel-green"
            link="/assignments"
            delay={0.05}
          />
          <StatCard
            label="Under Repair"
            value={assetStats['under-repair']}
            icon={Wrench}
            color="pastel-peach"
            link="/assets"
            delay={0.1}
          />
          <StatCard
            label="Damaged"
            value={assetStats.damaged}
            icon={AlertTriangle}
            color="pastel-pink"
            link="/assets"
            delay={0.15}
          />
        </div>
      </section>

      {/* Team quick stats */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MiniStat
            label="Team Members"
            value={employees.length}
            icon={Users}
            trend={employees.filter((e) => e.status === 'active').length}
            trendLabel="active"
            link="/employees"
          />
          <MiniStat
            label="Stock In (7 days)"
            value={weeklyTotals.inTotal}
            icon={TrendingUp}
            trend={weeklyTotals.inTotal}
            trendLabel="units"
            positive
            link="/stock"
          />
          <MiniStat
            label="Stock Out (7 days)"
            value={weeklyTotals.outTotal}
            icon={TrendingDown}
            trend={weeklyTotals.outTotal}
            trendLabel="units"
            link="/stock"
          />
        </div>
      </section>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-2xl font-bold">Stock Movement</h3>
              <p className="text-sm text-brand-choco-soft mt-1">
                Last 7 days · In vs Out
              </p>
            </div>
            <div className="flex gap-4 text-xs">
              <LegendDot color="#F97316" label="Stock In" />
              <LegendDot color="#8B6F5A" label="Stock Out" />
            </div>
          </div>
          {pLoading ? (
            <div className="h-[280px] flex items-center justify-center text-brand-choco-soft">
              Loading...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stockMovementData}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B6F5A" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#8B6F5A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3D28170F" />
                <XAxis
                  dataKey="day"
                  stroke="#8B6F5A"
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#8B6F5A"
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#FFF8F0',
                    border: '1.5px solid rgba(61, 40, 23, 0.1)',
                    borderRadius: '16px',
                    fontWeight: 500,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="in"
                  stroke="#F97316"
                  strokeWidth={3}
                  fill="url(#gIn)"
                />
                <Area
                  type="monotone"
                  dataKey="out"
                  stroke="#8B6F5A"
                  strokeWidth={3}
                  fill="url(#gOut)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card"
        >
          <h3 className="font-display text-2xl font-bold">Asset Status</h3>
          <p className="text-sm text-brand-choco-soft mt-1 mb-4">
            Current distribution
          </p>
          {assetStatusData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-brand-choco-soft">
              No assets yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={assetStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {assetStatusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#FFF8F0',
                    border: '1.5px solid rgba(61, 40, 23, 0.1)',
                    borderRadius: '16px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-2 mt-4">
            {assetStatusData.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="font-medium">{s.name}</span>
                </div>
                <span className="font-bold">{s.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-2xl font-bold">
                Stock by Category
              </h3>
              <p className="text-sm text-brand-choco-soft mt-1">
                Current levels across categories
              </p>
            </div>
          </div>
          {categoryStockData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-brand-choco-soft">
              Add products to see category breakdown
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryStockData}>
                <defs>
                  <linearGradient id="gBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FB923C" />
                    <stop offset="100%" stopColor="#F97316" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3D28170F" />
                <XAxis
                  dataKey="category"
                  stroke="#8B6F5A"
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#8B6F5A"
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(249, 115, 22, 0.05)' }}
                  contentStyle={{
                    background: '#FFF8F0',
                    border: '1.5px solid rgba(61, 40, 23, 0.1)',
                    borderRadius: '16px',
                  }}
                />
                <Bar dataKey="stock" fill="url(#gBar)" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-2xl font-bold">Recent Activity</h3>
            <Link
              to="/audit"
              className="text-xs font-bold text-brand-orange flex items-center gap-1 hover:underline"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <div className="py-8 text-center text-sm text-brand-choco-soft">
              No activity yet
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((a, i) => (
                <Link
                  key={i}
                  to={a.link}
                  className="flex items-start gap-3 p-3 rounded-2xl hover:bg-brand-cream-dark transition"
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      a.color === 'green' && 'bg-pastel-green',
                      a.color === 'blue' && 'bg-pastel-blue',
                      a.color === 'orange' && 'bg-brand-orange-100',
                      a.color === 'peach' && 'bg-pastel-peach',
                      a.color === 'pink' && 'bg-pastel-pink'
                    )}
                  >
                    <a.icon className="w-4 h-4 text-brand-choco" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{a.text}</p>
                    <p className="text-xs text-brand-choco-soft mt-0.5">
                      {formatDateTime(a.time)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  warning,
  delay = 0,
  link,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  warning?: boolean;
  delay?: number;
  link?: string;
}) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={cn(
        'relative overflow-hidden rounded-3xl p-6 border transition-all cursor-pointer',
        color === 'pastel-blue' && 'bg-pastel-blue border-pastel-blue-deep/30',
        color === 'pastel-green' && 'bg-pastel-green border-pastel-green-deep/30',
        color === 'pastel-peach' && 'bg-pastel-peach border-pastel-peach-deep/30',
        color === 'pastel-pink' && 'bg-pastel-pink border-pastel-pink-deep/30'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl bg-white/70 backdrop-blur flex items-center justify-center">
          <Icon className="w-6 h-6 text-brand-choco" />
        </div>
        {warning && value > 0 && (
          <div className="badge bg-white/70 text-orange-700">
            <AlertTriangle className="w-3 h-3" />
            Alert
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-brand-choco-light">{label}</p>
      <p className="font-display text-4xl font-bold mt-1">{value.toLocaleString('en-IN')}</p>
    </motion.div>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}

function MiniStat({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  positive,
  link,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  trend: number;
  trendLabel: string;
  positive?: boolean;
  link?: string;
}) {
  const inner = (
    <div className="card !p-5 flex items-center justify-between cursor-pointer hover:shadow-lift transition">
      <div>
        <p className="text-xs font-bold uppercase text-brand-choco-soft">
          {label}
        </p>
        <p className="font-display text-3xl font-bold mt-1">{value.toLocaleString('en-IN')}</p>
        <p
          className={cn(
            'text-xs font-semibold mt-1',
            positive ? 'text-green-700' : 'text-brand-choco-soft'
          )}
        >
          {trend.toLocaleString('en-IN')} {trendLabel}
        </p>
      </div>
      <div className="w-14 h-14 rounded-2xl bg-brand-orange-100 flex items-center justify-center">
        <Icon className="w-7 h-7 text-brand-orange" />
      </div>
    </div>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="font-semibold">{label}</span>
    </div>
  );
}
