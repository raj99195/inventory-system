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
} from 'lucide-react';
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
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

// Mock data — will be replaced with Firestore queries
const stockMovementData = [
  { day: 'Mon', in: 45, out: 22 },
  { day: 'Tue', in: 30, out: 40 },
  { day: 'Wed', in: 60, out: 28 },
  { day: 'Thu', in: 25, out: 55 },
  { day: 'Fri', in: 80, out: 35 },
  { day: 'Sat', in: 55, out: 18 },
  { day: 'Sun', in: 20, out: 12 },
];

const assetStatusData = [
  { name: 'Available', value: 45, color: '#A8D5A2' },
  { name: 'Assigned', value: 82, color: '#F97316' },
  { name: 'Under Repair', value: 8, color: '#F7CB92' },
  { name: 'Damaged', value: 5, color: '#F0A8B4' },
];

const categoryStockData = [
  { category: 'VR', stock: 85 },
  { category: 'Laptop', stock: 42 },
  { category: 'Monitor', stock: 38 },
  { category: 'Sensors', stock: 120 },
  { category: 'Cables', stock: 210 },
  { category: 'Tools', stock: 65 },
];

const recentActivity = [
  { icon: PackageCheck, text: 'Stock In: VR Controller +20', time: '2m ago', color: 'green' },
  { icon: FileText, text: 'Invoice INV-1025 verified', time: '15m ago', color: 'blue' },
  { icon: UserCheck, text: 'Asset AST-00045 assigned to Raj', time: '1h ago', color: 'orange' },
  { icon: Wrench, text: 'Repair reported: Dell Laptop', time: '2h ago', color: 'peach' },
  { icon: PackageX, text: 'Damage: 2 VR Headsets', time: '3h ago', color: 'pink' },
];

const productStats = [
  { label: 'Total Products', value: '128', change: '+12', trend: 'up', color: 'pastel-blue', icon: Package },
  { label: 'Available Stock', value: '2,847', change: '+8.2%', trend: 'up', color: 'pastel-green', icon: PackageCheck },
  { label: 'Low Stock Items', value: '14', change: '+3', trend: 'up', color: 'pastel-peach', icon: AlertTriangle, warning: true },
  { label: 'Out of Stock', value: '5', change: '-2', trend: 'down', color: 'pastel-pink', icon: PackageX, warning: true },
];

const assetStats = [
  { label: 'Total Assets', value: '140', icon: Laptop, color: 'pastel-blue' },
  { label: 'Assigned', value: '82', icon: UserCheck, color: 'pastel-green' },
  { label: 'Under Repair', value: '8', icon: Wrench, color: 'pastel-peach' },
  { label: 'Damaged', value: '5', icon: AlertTriangle, color: 'pastel-pink' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
            Overview
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">
            Dashboard
          </h1>
          <p className="text-brand-choco-soft mt-2">
            Complete inventory & asset summary at a glance.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-brand-choco-soft">
          <Clock className="w-4 h-4" />
          Last updated just now
        </div>
      </div>

      {/* Product Stats */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-choco-soft mb-3">
          Product Inventory
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {productStats.map((s, i) => (
            <StatCard key={s.label} {...s} delay={i * 0.05} />
          ))}
        </div>
      </section>

      {/* Asset Stats */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-choco-soft mb-3">
          Company Assets
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {assetStats.map((s, i) => (
            <StatCard key={s.label} {...s} delay={i * 0.05} />
          ))}
        </div>
      </section>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Movement Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
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
        </motion.div>

        {/* Asset Status Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <h3 className="font-display text-2xl font-bold">Asset Status</h3>
          <p className="text-sm text-brand-choco-soft mt-1 mb-4">
            Current distribution
          </p>
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
        {/* Category Stock Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-2xl font-bold">
                Stock by Category
              </h3>
              <p className="text-sm text-brand-choco-soft mt-1">
                Current levels across product categories
              </p>
            </div>
          </div>
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
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-2xl font-bold">Recent Activity</h3>
            <button className="text-xs font-bold text-brand-orange flex items-center gap-1 hover:underline">
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {recentActivity.map((a, i) => (
              <div
                key={i}
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
                    {a.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  trend,
  icon: Icon,
  color,
  warning,
  delay = 0,
}: {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  warning?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4 }}
      className={cn(
        'relative overflow-hidden rounded-3xl p-6 border transition-all',
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
        {change && (
          <div
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
              trend === 'up' && !warning && 'bg-white/70 text-green-700',
              trend === 'up' && warning && 'bg-white/70 text-orange-700',
              trend === 'down' && 'bg-white/70 text-red-700'
            )}
          >
            {trend === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {change}
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-brand-choco-light">{label}</p>
      <p className="font-display text-4xl font-bold mt-1">{value}</p>
    </motion.div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="font-semibold">{label}</span>
    </div>
  );
}
