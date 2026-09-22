import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package, PackageX, AlertTriangle, Laptop, UserCheck,
  ArrowUpRight, ArrowDownToLine, ArrowUpFromLine, FileText,
  Eye, EyeOff, TrendingUp, TrendingDown,
  Users, BarChart2, Search, Wrench, ShoppingCart,
  BadgeDollarSign, Percent,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { cn, formatINR, formatDateTime } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import { useAssets } from '@/hooks/useAssets';
import { useEmployees } from '@/hooks/useEmployees';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { useAssignments } from '@/hooks/useAssignments';
import { useInvoices } from '@/hooks/useInvoices';
import { useQuotations } from '@/hooks/useQuotations';

type DateRange = '7d'|'30d'|'90d'|'all';
const RANGE_DAYS: Record<DateRange,number> = { '7d':7,'30d':30,'90d':90,'all':99999 };

function inRange(date: Date|null|undefined, range: DateRange): boolean {
  if (!date) return false;
  if (range==='all') return true;
  return date >= new Date(Date.now() - RANGE_DAYS[range]*86400000);
}

export default function DashboardPage() {
  const { products, loading:pLoading } = useProducts();
  const { assets }       = useAssets();
  const { employees }    = useEmployees();
  const { transactions } = useStockTransactions(1000);
  const { assignments }  = useAssignments(50);
  const { invoices }     = useInvoices(500);
  const { quotations }   = useQuotations(500);

  const [presentMode, setPresentMode] = useState(false);
  const [range, setRange]             = useState<DateRange>('30d');
  const [custSearch, setCustSearch]   = useState('');

  const blur = presentMode ? 'blur-sm select-none pointer-events-none' : '';

  // ─── Product KPIs ──────────────────────────────────────────
  const productStats = useMemo(() => ({
    total:        products.length,
    totalStock:   products.reduce((s,p) => s+(p.currentStock||0), 0),
    low:          products.filter(p => p.currentStock>0 && p.currentStock<=p.minStockLevel).length,
    out:          products.filter(p => p.currentStock===0).length,
    inventoryVal: products.reduce((s,p) => s+(p.currentStock||0)*(p.purchasePrice||0), 0),
  }), [products]);

  const productMap = useMemo(() => new Map(products.map(p => [p.id,p])), [products]);

  // ─── Financial KPIs ────────────────────────────────────────
  const financial = useMemo(() => {
    const tx = transactions.filter(t => inRange(t.createdAt?.toDate?.(), range));

    const purchaseValue = tx
      .filter(t => t.quantity>0 && (t.type==='stock-in'||t.type==='return'))
      .reduce((s,t) => s+(productMap.get(t.productId)?.purchasePrice??0)*Math.abs(t.quantity), 0);

    const quoteSales = quotations
      .filter(q => (q.status==='accepted'||q.status==='converted') && inRange(q.updatedAt?.toDate?.(), range))
      .reduce((s,q) => s+(q.grandTotal||0), 0);

    const stockOutSales = tx
      .filter(t => t.quantity<0 && t.type==='stock-out')
      .reduce((s,t) => s+(productMap.get(t.productId)?.sellingPrice??0)*Math.abs(t.quantity), 0);

    const totalSales  = quoteSales + stockOutSales;
    const grossProfit = totalSales - purchaseValue;
    const margin      = totalSales>0 ? (grossProfit/totalSales)*100 : 0;
    return { purchaseValue, quoteSales, stockOutSales, totalSales, grossProfit, margin };
  }, [transactions, quotations, productMap, range]);

  // ─── Stock movement chart ───────────────────────────────────
  const stockMovementData = useMemo(() => {
    const days = range==='all' ? 90 : RANGE_DAYS[range];
    const step = days<=30 ? 1 : 7;
    const buckets: { day:string; date:Date; in:number; out:number }[] = [];
    const now = new Date();
    for (let i=Math.floor(days/step)-1; i>=0; i--) {
      const d=new Date(now); d.setDate(d.getDate()-i*step); d.setHours(0,0,0,0);
      buckets.push({ day:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}), date:d, in:0, out:0 });
    }
    transactions.forEach(t => {
      const txDate=t.createdAt?.toDate?.(); if (!txDate||!inRange(txDate,range)) return;
      const txDay=new Date(txDate); txDay.setHours(0,0,0,0);
      const bucket = buckets.find(b => Math.abs(b.date.getTime()-txDay.getTime()) < step*86400000);
      if (!bucket) return;
      if (t.quantity>0) bucket.in+=t.quantity; else bucket.out+=Math.abs(t.quantity);
    });
    return buckets.map(({day,in:i,out}) => ({day, in:i, out}));
  }, [transactions, range]);

  // ─── Revenue chart ──────────────────────────────────────────
  const revenueData = useMemo(() => {
    const m: Record<string,{month:string;purchase:number;sales:number}> = {};
    transactions.filter(t=>t.quantity>0&&inRange(t.createdAt?.toDate?.(),range)).forEach(t => {
      const d=t.createdAt?.toDate?.(); if (!d) return;
      const k=d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
      if (!m[k]) m[k]={month:k,purchase:0,sales:0};
      m[k].purchase+=(productMap.get(t.productId)?.purchasePrice??0)*t.quantity;
    });
    quotations.filter(q=>(q.status==='accepted'||q.status==='converted')&&inRange(q.updatedAt?.toDate?.(),range)).forEach(q => {
      const d=q.updatedAt?.toDate?.(); if (!d) return;
      const k=d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
      if (!m[k]) m[k]={month:k,purchase:0,sales:0};
      m[k].sales+=q.grandTotal||0;
    });
    return Object.values(m).slice(-6);
  }, [transactions, quotations, productMap, range]);

  // ─── Pipeline ───────────────────────────────────────────────
  const pipeline = useMemo(() => {
    const all = quotations.filter(q=>inRange(q.createdAt?.toDate?.(),range));
    return [
      {name:'Draft',    value:all.filter(q=>q.status==='draft').length,     color:'#C4B5A5'},
      {name:'Sent',     value:all.filter(q=>q.status==='sent').length,      color:'#93C5FD'},
      {name:'Accepted', value:all.filter(q=>q.status==='accepted').length,  color:'#86EFAC'},
      {name:'Rejected', value:all.filter(q=>q.status==='rejected').length,  color:'#FCA5A5'},
      {name:'Converted',value:all.filter(q=>q.status==='converted').length, color:'#F97316'},
    ].filter(d=>d.value>0);
  }, [quotations, range]);

  // ─── Assets ─────────────────────────────────────────────────
  const assetStats = useMemo(() => ({
    total:     assets.length,
    totalValue:assets.reduce((s,a)=>s+(a.purchaseCost||0),0),
    statusData:[
      {name:'Available',  value:assets.filter(a=>a.status==='available').length,    color:'#A8D5A2'},
      {name:'Assigned',   value:assets.filter(a=>a.status==='assigned').length,     color:'#F97316'},
      {name:'Under Repair',value:assets.filter(a=>a.status==='under-repair').length,color:'#F7CB92'},
      {name:'Damaged',    value:assets.filter(a=>a.status==='damaged').length,      color:'#F0A8B4'},
    ].filter(d=>d.value>0),
  }), [assets]);

  // ─── Category stock ─────────────────────────────────────────
  const categoryData = useMemo(() => {
    const b:Record<string,number>={};
    products.forEach(p=>{ b[p.category]=(b[p.category]??0)+(p.currentStock||0); });
    return Object.entries(b).map(([category,stock])=>({category,stock})).sort((a,b)=>b.stock-a.stock).slice(0,8);
  }, [products]);

  // ─── Customer Analytics — Quotations + Invoices ─────────────
  const customerAnalytics = useMemo(() => {
    type CEntry = {
      name:string; company:string;
      quoteCount:number; quoteTotal:number; quoteAccepted:number;
      invoiceCount:number; invoiceTotal:number;
      draft:number; sent:number; accepted:number; rejected:number;
      lastActivity:Date|null;
    };
    const map: Record<string,CEntry> = {};

    const ensureKey = (key:string, name:string, company='') => {
      if (!map[key]) map[key] = { name, company, quoteCount:0, quoteTotal:0, quoteAccepted:0, invoiceCount:0, invoiceTotal:0, draft:0, sent:0, accepted:0, rejected:0, lastActivity:null };
    };
    const touch = (key:string, d:Date|null) => {
      if (d && (!map[key].lastActivity || d>map[key].lastActivity!)) map[key].lastActivity=d;
    };

    // From Quotations
    quotations.forEach(q => {
      const key = (q.customerName||'unknown').toLowerCase().trim();
      ensureKey(key, q.customerName||'Unknown', q.customerCompany||'');
      map[key].quoteCount++;
      map[key].quoteTotal+=q.grandTotal||0;
      if (q.status==='accepted'||q.status==='converted') map[key].quoteAccepted+=q.grandTotal||0;
      if (q.status==='draft')    map[key].draft++;
      if (q.status==='sent')     map[key].sent++;
      if (q.status==='accepted'||q.status==='converted') map[key].accepted++;
      if (q.status==='rejected') map[key].rejected++;
      touch(key, q.updatedAt?.toDate?.()??null);
    });

    // From Invoices (purchase/sale partners)
    invoices.forEach(inv => {
      const rawName = inv.customerName?.trim();
      if (!rawName) return;
      const key = rawName.toLowerCase();
      ensureKey(key, rawName);
      map[key].invoiceCount++;
      map[key].invoiceTotal+=inv.totalAmount||0;
      touch(key, inv.uploadedAt?.toDate?.()??null);
    });

    return Object.values(map)
      .filter(c =>
        !custSearch ||
        c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
        c.company.toLowerCase().includes(custSearch.toLowerCase())
      )
      .sort((a,b) => (b.quoteTotal+b.invoiceTotal)-(a.quoteTotal+a.invoiceTotal));
  }, [quotations, invoices, custSearch]);

  // ─── Recent activity ────────────────────────────────────────
  const recentActivity = useMemo(() => {
    const items: {icon:React.ComponentType<{className?:string}>;text:string;time:Date;color:string;link:string}[] = [];
    transactions.slice(0,12).forEach(t => {
      const d=t.createdAt?.toDate?.(); if (!d) return;
      items.push({ icon:t.quantity>0?ArrowDownToLine:ArrowUpFromLine,
        text:`${t.quantity>0?'Stock In':'Stock Out'}: ${t.productName} (${t.quantity>0?'+':''}${t.quantity})`,
        time:d, color:t.quantity>0?'green':'peach', link:'/stock' });
    });
    assignments.slice(0,5).forEach(a => {
      const d=a.createdAt?.toDate?.(); if (!d) return;
      items.push({ icon:UserCheck, text:`${a.action}: ${a.assetName} → ${a.employeeName}`, time:d, color:'blue', link:'/assignments' });
    });
    invoices.slice(0,5).forEach(i => {
      const d=i.uploadedAt?.toDate?.(); if (!d) return;
      items.push({ icon:FileText, text:`Invoice ${i.invoiceNumber} ${i.status==='stock-updated'?'processed':'uploaded'}`, time:d, color:'pink', link:'/invoices' });
    });
    return items.sort((a,b)=>b.time.getTime()-a.time.getTime()).slice(0,10);
  }, [transactions, assignments, invoices]);

  const weekIn  = transactions.filter(t=>t.quantity>0&&inRange(t.createdAt?.toDate?.(),'7d')).reduce((s,t)=>s+t.quantity,0);
  const weekOut = transactions.filter(t=>t.quantity<0&&inRange(t.createdAt?.toDate?.(),'7d')).reduce((s,t)=>s+Math.abs(t.quantity),0);

  return (
    <div className="space-y-6">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange"/>Overview
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold">Dashboard</h1>
          <p className="text-brand-choco-soft mt-2">Live inventory &amp; financial summary at a glance.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Range filter */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-brand-cream-dark text-xs">
            {(['7d','30d','90d','all'] as DateRange[]).map(r=>(
              <button key={r} onClick={()=>setRange(r)}
                className={cn('px-3 py-1.5 rounded-full font-bold transition-all',
                  range===r?'bg-white text-brand-choco shadow-sm':'text-brand-choco-soft hover:text-brand-choco'
                )}>
                {r==='all'?'All':r}
              </button>
            ))}
          </div>

          {/* Present Mode — no banner, just button changes */}
          <button onClick={()=>setPresentMode(v=>!v)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all',
              presentMode
                ? 'bg-brand-orange text-white shadow-lg ring-4 ring-brand-orange/25'
                : 'bg-brand-cream-dark text-brand-choco hover:bg-brand-orange-100'
            )}>
            {presentMode ? <><EyeOff className="w-4 h-4"/>Show Numbers</> : <><Eye className="w-4 h-4"/>Present Mode</>}
          </button>
        </div>
      </div>

      {/* ─── Charts (FIRST) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Movement */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.05}} className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-xl font-bold">Stock Movement</h3>
              <div className="flex items-center gap-4 mt-1">
                <LDot color="#F97316" label="Stock In"/>
                <LDot color="#8B6F5A" label="Stock Out"/>
              </div>
            </div>
            <div className="text-right text-xs">
              <p className="text-brand-choco-soft">7 days</p>
              <p><span className={cn('font-bold text-green-700',blur)}>+{weekIn.toLocaleString('en-IN')}</span> in</p>
              <p><span className={cn('font-bold text-red-600',blur)}>-{weekOut.toLocaleString('en-IN')}</span> out</p>
            </div>
          </div>
          {pLoading ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-brand-choco-soft">Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stockMovementData}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F97316" stopOpacity={0.4}/><stop offset="100%" stopColor="#F97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B6F5A" stopOpacity={0.25}/><stop offset="100%" stopColor="#8B6F5A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3D28170F"/>
                <XAxis dataKey="day" stroke="#8B6F5A" fontSize={11} axisLine={false} tickLine={false}/>
                <YAxis stroke="#8B6F5A" fontSize={11} axisLine={false} tickLine={false} width={35}/>
                <Tooltip contentStyle={{background:'#FFF8F0',border:'1.5px solid rgba(61,40,23,0.1)',borderRadius:'16px'}}/>
                <Area type="monotone" dataKey="in"  stroke="#F97316" strokeWidth={2.5} fill="url(#gIn)"  name="Stock In"/>
                <Area type="monotone" dataKey="out" stroke="#8B6F5A" strokeWidth={2.5} fill="url(#gOut)" name="Stock Out"/>
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Pipeline */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.1}} className="card">
          <h3 className="font-display text-xl font-bold mb-1">Quotation Pipeline</h3>
          <p className="text-sm text-brand-choco-soft mb-4">{range==='all'?'All time':`Last ${range}`}</p>
          {pipeline.length===0 ? (
            <div className="h-[180px] flex items-center justify-center text-sm text-brand-choco-soft">No quotations yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pipeline} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value">
                    {pipeline.map(e=><Cell key={e.name} fill={e.color}/>)}
                  </Pie>
                  <Tooltip contentStyle={{background:'#FFF8F0',border:'1.5px solid rgba(61,40,23,0.1)',borderRadius:'16px'}}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pipeline.map(d=>(
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{background:d.color}}/><span className="font-medium">{d.name}</span></div>
                    <span className="font-bold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Revenue chart */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.15}} className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-xl font-bold">Purchase vs Sales Revenue</h3>
            <p className="text-sm text-brand-choco-soft">Stock transactions + accepted quotations</p>
          </div>
          <div className="flex items-center gap-4"><LDot color="#60A5FA" label="Purchase"/><LDot color="#34D399" label="Sales"/></div>
        </div>
        {revenueData.length===0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-brand-choco-soft">No revenue data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3D28170F"/>
              <XAxis dataKey="month" stroke="#8B6F5A" fontSize={11} axisLine={false} tickLine={false}/>
              <YAxis stroke="#8B6F5A" fontSize={11} axisLine={false} tickLine={false} width={60}
                tickFormatter={v=>v>=100000?`₹${(v/100000).toFixed(0)}L`:v>=1000?`₹${(v/1000).toFixed(0)}K`:`₹${v}`}/>
              <Tooltip formatter={(v:number)=>[formatINR(v),'']} contentStyle={{background:'#FFF8F0',border:'1.5px solid rgba(61,40,23,0.1)',borderRadius:'16px'}}/>
              <Bar dataKey="purchase" fill="#93C5FD" radius={[6,6,0,0]} name="Purchase"/>
              <Bar dataKey="sales"    fill="#6EE7B7" radius={[6,6,0,0]} name="Sales"/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* ─── Financial KPIs ─── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-3">
          Financial Overview · {range==='all'?'All Time':`Last ${range}`}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <FC label="Inventory Value" value={formatINR(productStats.inventoryVal)} icon={Package}       color="blue"  hint="Stock × purchase price" blur={blur}/>
          <FC label="Purchase Value"  value={formatINR(financial.purchaseValue)}   icon={ShoppingCart}  color="peach" hint="Stock-in × purchase price" blur={blur}/>
          <FC label="Sales Value"     value={formatINR(financial.totalSales)}      icon={BadgeDollarSign} color="green" hint="Accepted quotes + stock-out" blur={blur}/>
          <FC label={financial.grossProfit>=0?'Gross Profit':'Gross Loss'}
              value={formatINR(Math.abs(financial.grossProfit))}
              icon={financial.grossProfit>=0?TrendingUp:TrendingDown}
              color={financial.grossProfit>=0?'green':'pink'}
              hint="Sales − Purchase" blur={blur}
              accent={financial.grossProfit>=0?'profit':'loss'}/>
          <FC label="Margin %" value={`${financial.margin.toFixed(1)}%`} icon={Percent}
              color={financial.margin>=0?'green':'pink'} hint="Profit / Sales" blur={blur}
              accent={financial.margin>=20?'profit':financial.margin<0?'loss':undefined}/>
        </div>
      </div>

      {/* ─── Count cards ─── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-3">Product Inventory</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SC label="Total Products"  value={productStats.total}      icon={Package}       color="pastel-blue"  link="/products" blur={blur}/>
          <SC label="Available Stock" value={productStats.totalStock}  icon={BarChart2}     color="pastel-green" link="/products" blur={blur}/>
          <SC label="Low Stock"       value={productStats.low}         icon={AlertTriangle} color="pastel-peach" link="/products" blur={blur} warn/>
          <SC label="Out of Stock"    value={productStats.out}         icon={PackageX}      color="pastel-pink"  link="/products" blur={blur} warn/>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-3">Company Assets</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SC label="Total Assets"   value={assetStats.total}                                                   icon={Laptop}    color="pastel-blue"  link="/assets"      blur={blur}/>
          <SC label="Assigned"       value={assetStats.statusData.find(s=>s.name==='Assigned')?.value??0}       icon={UserCheck} color="pastel-peach" link="/assignments" blur={blur}/>
          <SC label="Under Repair"   value={assetStats.statusData.find(s=>s.name==='Under Repair')?.value??0}   icon={Wrench}    color="pastel-pink"  link="/assets"      blur={blur}/>
          <SC label="Team Members"   value={employees.filter(e=>e.status==='active').length}                    icon={Users}     color="pastel-green" link="/employees"   blur={blur}/>
        </div>
      </div>

      {/* ─── Bottom grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.3}} className="card">
          <h3 className="font-display text-xl font-bold mb-1">Stock by Category</h3>
          <p className="text-sm text-brand-choco-soft mb-4">Units per category</p>
          {categoryData.length===0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-brand-choco-soft">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#3D28170F" horizontal={false}/>
                <XAxis type="number" stroke="#8B6F5A" fontSize={11} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="category" width={90} stroke="#8B6F5A" fontSize={10} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:'#FFF8F0',border:'1.5px solid rgba(61,40,23,0.1)',borderRadius:'16px'}}/>
                <defs><linearGradient id="gH" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FB923C"/><stop offset="100%" stopColor="#F97316"/></linearGradient></defs>
                <Bar dataKey="stock" fill="url(#gH)" radius={[0,8,8,0]} name="Stock"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Asset status */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.35}} className="card">
          <h3 className="font-display text-xl font-bold mb-1">Asset Status</h3>
          <p className="text-sm text-brand-choco-soft mb-2">
            Total value: <span className={cn('font-bold text-brand-orange', blur)}>{formatINR(assetStats.totalValue)}</span>
          </p>
          {assetStats.statusData.length===0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-brand-choco-soft">No assets yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={assetStats.statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={4} dataKey="value">
                    {assetStats.statusData.map(e=><Cell key={e.name} fill={e.color}/>)}
                  </Pie>
                  <Tooltip contentStyle={{background:'#FFF8F0',border:'1.5px solid rgba(61,40,23,0.1)',borderRadius:'16px'}}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {assetStats.statusData.map(s=>(
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{background:s.color}}/><span className="font-medium">{s.name}</span></div>
                    <span className="font-bold">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

        {/* Recent activity */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.4}} className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl font-bold">Recent Activity</h3>
            <Link to="/audit" className="text-xs font-bold text-brand-orange flex items-center gap-1 hover:underline">View all <ArrowUpRight className="w-3 h-3"/></Link>
          </div>
          {recentActivity.length===0 ? (
            <div className="py-8 text-center text-sm text-brand-choco-soft">No activity yet</div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((a,i)=>(
                <Link key={i} to={a.link} className="flex items-start gap-3 p-2.5 rounded-2xl hover:bg-brand-cream-dark transition">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    a.color==='green'&&'bg-pastel-green', a.color==='blue'&&'bg-pastel-blue',
                    a.color==='orange'&&'bg-brand-orange-100', a.color==='peach'&&'bg-pastel-peach', a.color==='pink'&&'bg-pastel-pink')}>
                    <a.icon className="w-4 h-4 text-brand-choco"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{a.text}</p>
                    <p className="text-[10px] text-brand-choco-soft mt-0.5">{formatDateTime(a.time)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ─── Customer Analytics (Quotations + Invoices) ─── */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.45}} className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-xl font-bold">Customer Analytics</h3>
            <p className="text-sm text-brand-choco-soft">Quotation + Invoice data grouped by customer / supplier</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-choco-soft"/>
              <input type="text" value={custSearch} onChange={e=>setCustSearch(e.target.value)}
                placeholder="Search customer..." className="pl-9 pr-3 py-2 rounded-xl bg-brand-cream-dark text-sm outline-none focus:ring-2 focus:ring-brand-orange/30 w-48"/>
            </div>
            <Link to="/quotations" className="text-xs font-bold text-brand-orange hover:underline flex items-center gap-1">
              Quotations <ArrowUpRight className="w-3 h-3"/>
            </Link>
          </div>
        </div>

        {customerAnalytics.length===0 ? (
          <div className="py-12 text-center text-sm text-brand-choco-soft">
            {quotations.length===0&&invoices.length===0
              ? 'No transactions yet — create quotations or upload invoices to see analytics'
              : 'No customers match your search'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-choco/8">
                  <th className="text-left py-2 px-3 text-[10px] font-bold uppercase text-brand-choco-soft">Customer / Supplier</th>
                  <th className="text-center py-2 px-3 text-[10px] font-bold uppercase text-brand-choco-soft">Quotes</th>
                  <th className="text-right py-2 px-3 text-[10px] font-bold uppercase text-brand-choco-soft">Quote Value</th>
                  <th className="text-right py-2 px-3 text-[10px] font-bold uppercase text-brand-choco-soft">Accepted</th>
                  <th className="text-center py-2 px-3 text-[10px] font-bold uppercase text-brand-choco-soft">Invoices</th>
                  <th className="text-right py-2 px-3 text-[10px] font-bold uppercase text-brand-choco-soft">Invoice Total</th>
                  <th className="text-center py-2 px-3 text-[10px] font-bold uppercase text-brand-choco-soft">Status</th>
                  <th className="text-right py-2 px-3 text-[10px] font-bold uppercase text-brand-choco-soft">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {customerAnalytics.slice(0,15).map((c,i)=>(
                  <tr key={i} className="border-b border-brand-choco/5 hover:bg-brand-cream-dark/40 transition">
                    <td className="py-3 px-3">
                      <p className="font-semibold truncate max-w-[150px]">{c.name}</p>
                      {c.company && <p className="text-[10px] text-brand-choco-soft truncate max-w-[150px]">{c.company}</p>}
                    </td>
                    <td className="py-3 px-3 text-center"><span className="font-bold text-brand-orange">{c.quoteCount||'—'}</span></td>
                    <td className="py-3 px-3 text-right"><span className={cn('font-bold',blur)}>{c.quoteTotal>0?formatINR(c.quoteTotal):'—'}</span></td>
                    <td className="py-3 px-3 text-right"><span className={cn('font-bold text-green-700',blur)}>{c.quoteAccepted>0?formatINR(c.quoteAccepted):'—'}</span></td>
                    <td className="py-3 px-3 text-center"><span className="font-bold">{c.invoiceCount||'—'}</span></td>
                    <td className="py-3 px-3 text-right"><span className={cn('font-bold',blur)}>{c.invoiceTotal>0?formatINR(c.invoiceTotal):'—'}</span></td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {c.draft>0    && <span className="px-1.5 py-0.5 rounded-full bg-brand-cream-dark text-[10px] font-bold text-brand-choco-soft">{c.draft}D</span>}
                        {c.sent>0     && <span className="px-1.5 py-0.5 rounded-full bg-pastel-blue text-[10px] font-bold text-blue-900">{c.sent}S</span>}
                        {c.accepted>0 && <span className="px-1.5 py-0.5 rounded-full bg-pastel-green text-[10px] font-bold text-green-900">{c.accepted}✓</span>}
                        {c.rejected>0 && <span className="px-1.5 py-0.5 rounded-full bg-pastel-pink text-[10px] font-bold text-red-900">{c.rejected}✗</span>}
                        {c.invoiceCount>0 && <span className="px-1.5 py-0.5 rounded-full bg-brand-orange-100 text-[10px] font-bold text-brand-orange">{c.invoiceCount}📄</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-[11px] text-brand-choco-soft">
                      {c.lastActivity ? c.lastActivity.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customerAnalytics.length>15 && (
              <p className="text-xs text-brand-choco-soft text-center py-3">
                Showing 15 of {customerAnalytics.length} ·{' '}
                <Link to="/quotations" className="text-brand-orange font-bold hover:underline">View all quotations</Link>
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────
function FC({ label,value,icon:Icon,color,hint,blur,accent }: {
  label:string;value:string;icon:React.ComponentType<{className?:string}>;
  color:string;hint:string;blur:string;accent?:'profit'|'loss';
}) {
  return (
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
      className={cn('rounded-2xl p-4 border flex flex-col gap-2',
        color==='blue' &&'bg-pastel-blue border-pastel-blue-deep/30',
        color==='green'&&'bg-pastel-green border-pastel-green-deep/30',
        color==='peach'&&'bg-pastel-peach border-pastel-peach-deep/30',
        color==='pink' &&'bg-pastel-pink border-pastel-pink-deep/30',
      )}>
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center"><Icon className={cn('w-4 h-4',accent==='profit'&&'text-green-700',accent==='loss'&&'text-red-600',!accent&&'text-brand-choco')}/></div>
        {accent && <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',accent==='profit'?'bg-green-200 text-green-900':'bg-red-100 text-red-800')}>{accent==='profit'?'▲ Profit':'▼ Loss'}</span>}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft">{label}</p>
        <p className={cn('font-display text-xl font-bold mt-0.5 transition-all',blur,accent==='profit'&&!blur&&'text-green-800',accent==='loss'&&!blur&&'text-red-700')}>{value}</p>
        <p className="text-[9px] text-brand-choco-soft mt-0.5">{hint}</p>
      </div>
    </motion.div>
  );
}

function SC({ label,value,icon:Icon,color,link,blur,warn }: {
  label:string;value:number;icon:React.ComponentType<{className?:string}>;
  color:string;link?:string;blur:string;warn?:boolean;
}) {
  const inner = (
    <motion.div whileHover={{y:-3,scale:1.01}} transition={{type:'spring',stiffness:400}}
      className={cn('rounded-2xl p-4 border cursor-pointer transition-all',
        color==='pastel-blue' &&'bg-pastel-blue border-pastel-blue-deep/30',
        color==='pastel-green'&&'bg-pastel-green border-pastel-green-deep/30',
        color==='pastel-peach'&&'bg-pastel-peach border-pastel-peach-deep/30',
        color==='pastel-pink' &&'bg-pastel-pink border-pastel-pink-deep/30',
      )}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center"><Icon className="w-5 h-5 text-brand-choco"/></div>
        {warn&&value>0&&<span className="badge bg-white/70 text-orange-700 text-[10px]"><AlertTriangle className="w-3 h-3"/>Alert</span>}
      </div>
      <p className="text-xs font-semibold text-brand-choco-light">{label}</p>
      <p className={cn('font-display text-3xl font-bold mt-0.5 transition-all',blur)}>{value.toLocaleString('en-IN')}</p>
    </motion.div>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

function LDot({ color, label }: { color:string; label:string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="w-2.5 h-2.5 rounded-full" style={{background:color}}/>
      <span className="font-semibold text-brand-choco-soft">{label}</span>
    </div>
  );
}