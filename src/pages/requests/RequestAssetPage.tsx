import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Package, Laptop, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useProducts } from '@/hooks/useProducts';
import { createRequests } from '@/hooks/useRequests';
import type { RequestUrgency } from '@/types';

export default function RequestAssetPage() {
  const { userDoc } = useAuth();
  const { can } = usePermission();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('type') === 'products' ? 'products' : 'assets');
  const { products, loading, error } = useProducts(tab === 'products', 'officeInventory');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [assetName, setAssetName] = useState('');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<RequestUrgency>('normal');
  const [busy, setBusy] = useState(false);
  if (!can('requests.createOwn')) return <Navigate to="/" replace />;
  const selected = Object.entries(cart);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDoc || busy) return;
    if (!reason.trim()) return toast.error('Please provide a reason');
    const common = { scope: 'office' as const, userId: userDoc.uid, userName: userDoc.name, userEmail: userDoc.email, userDepartment: userDoc.department, reason, urgency };
    setBusy(true);
    try {
      if (tab === 'assets') {
        if (!assetName.trim()) throw new Error('Enter the asset you need');
        await createRequests([{ ...common, itemType: 'asset', itemId: '', itemName: assetName.trim(), quantity: 1 }]);
        setAssetName('');
      } else {
        const items = selected.map(([id, quantity]) => {
          const product = products.find(p => p.id === id);
          if (!product || product.status !== 'active' || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > product.currentStock) throw new Error('Check selected quantities and available stock');
          return { ...common, itemType: 'product' as const, itemId: id, itemName: product.name, itemSku: product.sku, quantity };
        });
        await createRequests(items);
        setCart({});
      }
      setReason('');
      toast.success('Request submitted for approval');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Submission failed'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <div><h1 className="font-display text-4xl font-bold">Request Items</h1><p className="text-brand-choco-soft mt-2">Request company equipment or select multiple inventory products.</p></div>
    <div className="flex flex-wrap gap-2"><button disabled={busy} className={tab === 'assets' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('assets')}><Laptop className="w-4 h-4" />Company Assets</button><button disabled={busy} className={tab === 'products' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('products')}><Package className="w-4 h-4" />Company Inventory</button></div>
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
      {tab === 'assets' ? <div className="card space-y-3"><label className="block font-semibold">Asset needed<input required className="input-field mt-2" placeholder="e.g. Laptop, projector or keyboard" value={assetName} maxLength={200} onChange={e => setAssetName(e.target.value)} /></label><p className="text-sm text-brand-choco-soft">Your approver will select and assign an available asset.</p></div> : <>
        <input aria-label="Search products" className="input-field" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
        {loading ? <p>Loading products…</p> : error ? <p role="alert">Unable to load products. Please try again.</p> : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{products.filter(p => p.status === 'active' && `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(search.toLowerCase())).map(p => <div className="card !p-5 space-y-3" key={p.id}><h2 className="font-bold">{p.name}</h2><p className="text-sm text-brand-choco-soft">{p.category} · {p.currentStock} {p.unit} available</p><button type="button" className="btn-secondary" disabled={p.currentStock < 1 || p.id in cart || selected.length >= 50} onClick={() => setCart(c => ({ ...c, [p.id]: 1 }))}>{p.id in cart ? 'Selected' : p.currentStock > 0 ? 'Add to request' : 'Out of stock'}</button></div>)}</div>}
        {selected.length > 0 && <section className="card space-y-3"><h2 className="font-bold">Selected products ({selected.length})</h2>{selected.map(([id, qty]) => <div key={id} className="flex flex-wrap items-center gap-3"><span className="flex-1 min-w-32">{products.find(p => p.id === id)?.name ?? 'Unavailable product'}</span><input aria-label={`Quantity for ${products.find(p => p.id === id)?.name}`} className="input-field !w-24" type="number" min="1" max={products.find(p => p.id === id)?.currentStock} step="1" required value={qty} onChange={e => setCart(c => ({ ...c, [id]: Number(e.target.value) }))} /><button aria-label="Remove product" type="button" className="btn-secondary" onClick={() => setCart(c => { const next = { ...c }; delete next[id]; return next; })}><Trash2 className="w-4 h-4" /></button></div>)}</section>}
      </>}
      <div className="card space-y-4"><label className="block font-semibold">Reason<textarea required className="input-field mt-2" rows={3} value={reason} onChange={e => setReason(e.target.value)} /></label><label className="block font-semibold">Urgency<select className="input-field mt-2" value={urgency} onChange={e => setUrgency(e.target.value as RequestUrgency)}><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label><button disabled={busy || (tab === 'products' && (loading || !!error || !selected.length))} className="btn-primary"><Send className="w-4 h-4" />{busy ? 'Submitting…' : tab === 'products' ? `Submit ${selected.length} products` : 'Submit Request'}</button></div>
      </fieldset>
    </form>
  </div>;
}
