import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { returnOffice, type OfficeKind } from '@/lib/office';
import { canActOnUser } from '@/lib/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useUsers } from '@/hooks/useUsers';
import { useAssets } from '@/hooks/useAssets';
import { useProducts } from '@/hooks/useProducts';
import AssetForm from '@/components/assets/AssetForm';
import Modal from '@/components/ui/Modal';
import type { Asset, Product } from '@/types';

interface OfficeAssignment { id: string; kind: OfficeKind; itemId: string; itemName: string; userId: string; userName: string; quantity: number; status: string }
export default function OfficePage({ kind }: { kind: OfficeKind }) {
  const { can } = usePermission();
  const { userDoc } = useAuth();
  const { users } = useUsers();
  const isAsset = kind === 'officeAssets';
  const title = isAsset ? 'Office Assets' : 'Office Inventory';
  const canManage = ['create', 'edit', 'delete', 'assign', 'return'].some((action) => can(`${kind}.${action}`));
  const { assets, loading: assetsLoading } = useAssets(isAsset && canManage, 'officeAssets');
  const { products, loading: productsLoading, error } = useProducts(!isAsset, 'officeInventory');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Asset | Product | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<OfficeAssignment[]>([]);
  const [historyError, setHistoryError] = useState(false);
  useEffect(() => { if (!userDoc) return; return onSnapshot(canManage ? collection(db, 'officeAssignments') : query(collection(db, 'officeAssignments'), where('userId', '==', userDoc.uid)), (snap) => {
    setHistory(snap.docs.map((d) => ({ ...d.data(), id: d.id } as OfficeAssignment))); setHistoryError(false);
  }, () => setHistoryError(true)); }, [canManage, userDoc?.uid]);
  const rows = (isAsset ? assets : products).filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase()));
  const visibleHistory = history.filter((a) => a.kind === kind && (a.userId === userDoc?.uid || canActOnUser(userDoc, users.find((u) => u.uid === a.userId))));
  const remove = async (item: Asset | Product) => {
    if (!window.confirm(`Remove ${item.name}?`)) return;
    try { await deleteDoc(doc(db, kind, item.id)); toast.success('Removed'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed'); }
  };
  if (!can(`${kind}.view`)) return <Navigate to="/" replace />;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase text-brand-orange">{canManage ? 'Office Management' : 'Personal'}</p><h1 className="font-display text-4xl font-bold mt-2">{title}</h1><p className="text-brand-choco-soft mt-2">{canManage ? (isAsset ? 'Track office equipment, assignments and returns.' : 'Manage office products and stock.') : (isAsset ? 'Request equipment by name and view your assigned items.' : 'Browse office products, request items and view your assignments.')}</p></div><div className="flex flex-wrap gap-2">{can('requests.createOwn') && <Link to={isAsset ? '/requests/new?type=assets' : '/requests/new?type=products'} className="btn-secondary">Request Item</Link>}{can(`${kind}.create`) && <button className="btn-primary" onClick={() => setEditing(null)}>Add {isAsset ? 'Asset' : 'Product'}</button>}</div></div>
    {(!isAsset || canManage) && <input aria-label={`Search ${title}`} className="input-field" placeholder="Search name or category…" value={search} onChange={(e) => setSearch(e.target.value)} />}
    {error && !isAsset && <p role="alert" className="text-red-600">Unable to load office inventory.</p>}
    {(!isAsset || canManage) && ((isAsset ? assetsLoading : productsLoading) ? <p>Loading…</p> : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{rows.map((item) => <div key={item.id} className="card !p-5 space-y-3"><p className="text-xs text-brand-orange">{isAsset ? (item as Asset).assetId : (item as Product).sku}</p><h2 className="font-bold">{item.name}</h2><p className="text-sm text-brand-choco-soft">{item.category} · {isAsset ? item.status : `${(item as Product).currentStock} ${(item as Product).unit} available`}</p><div className="flex flex-wrap gap-2">{can(`${kind}.edit`) && (!isAsset || item.status !== 'assigned') && <button className="btn-secondary" onClick={() => setEditing(item)}>Edit</button>}{can(`${kind}.delete`) && (!isAsset || item.status !== 'assigned') && <button className="btn-secondary" onClick={() => remove(item)}>Delete</button>}</div></div>)}{rows.length === 0 && <p className="text-brand-choco-soft">{search.trim() ? 'No items match your search.' : can(`${kind}.create`) ? 'No office items found. Add an item to get started.' : isAsset ? 'No office assets are available yet.' : 'No office products are available yet.'}</p>}</div>)}
    <section className="card space-y-4"><h2 className="font-display text-xl font-bold">{canManage ? 'Assignments & Returns' : 'My Assignments'}</h2>{historyError && <p role="alert">Unable to load assignments.</p>}{visibleHistory.length === 0 && <p className="text-sm text-brand-choco-soft">{canManage ? 'No assignments yet.' : 'No items have been assigned to you yet.'}</p>}{visibleHistory.map((a) => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-choco/10 pt-3"><div><p className="font-semibold">{a.itemName} × {a.quantity}</p><p className="text-sm text-brand-choco-soft">{a.userName} · {a.status}</p></div>{a.status === 'assigned' && can(`${kind}.return`) && canActOnUser(userDoc, users.find((u) => u.uid === a.userId)) && <button disabled={busy} className="btn-secondary" onClick={async () => { setBusy(true); try { await returnOffice(a.id); toast.success('Returned to office stock'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Return failed'); } finally { setBusy(false); } }}>Return</button>}</div>)}</section>
    {editing !== undefined && <Modal open onClose={() => setEditing(undefined)} title={`${editing ? 'Edit' : 'Add'} ${isAsset ? 'Office Asset' : 'Office Product'}`} size="lg">{isAsset ? <AssetForm source="officeAssets" asset={editing as Asset | null} onClose={() => setEditing(undefined)} /> : <OfficeProductForm product={editing as Product | null} onClose={() => setEditing(undefined)} />}</Modal>}
  </div>;
}

function OfficeProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { products } = useProducts();
  const [form, setForm] = useState({ name: product?.name ?? '', sku: product?.sku ?? '', category: product?.category ?? '', brand: product?.brand ?? '', description: product?.description ?? '', unit: product?.unit ?? 'pcs', purchasePrice: product?.purchasePrice ?? 0, sellingPrice: product?.sellingPrice ?? 0, gstPercent: product?.gstPercent ?? 0, minStockLevel: product?.minStockLevel ?? 0, currentStock: product?.currentStock ?? 0, status: product?.status ?? 'active' });
  const [busy, setBusy] = useState(false);
  const names = useMemo(() => [...new Set(products.map((p) => p.name))].sort(), [products]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      if (!form.name.trim() || !form.sku.trim() || !form.category.trim() || !form.unit.trim() || Object.values(form).some((v) => typeof v === 'number' && (!Number.isFinite(v) || v < 0))) throw new Error('Enter valid product details');
      if (!Number.isSafeInteger(form.currentStock)) throw new Error('Stock must be a whole number');
      const data = { ...form, name: form.name.trim(), updatedAt: serverTimestamp() };
      if (product) await runTransaction(db, async (tx) => { const ref = doc(db, 'officeInventory', product.id); const snap = await tx.get(ref); if (!snap.exists() || snap.data().currentStock !== product.currentStock) throw new Error('Stock changed. Close and reopen this form.'); tx.update(ref, data); });
      else await addDoc(collection(db, 'officeInventory'), { ...data, createdAt: serverTimestamp() });
      toast.success('Office product saved'); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed'); } finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="p-6 space-y-4"><p className="text-sm text-brand-choco-soft">Name suggestions come from the main product catalog. All other details and stock must be entered manually.</p><div className="grid sm:grid-cols-2 gap-4">{(['name', 'sku', 'category', 'brand', 'unit'] as const).map((key) => <label key={key} className="text-sm font-semibold capitalize">{key}<input required={key !== 'brand'} list={key === 'name' ? 'office-product-names' : undefined} className="input-field mt-2" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} /></label>)}<datalist id="office-product-names">{names.map((name) => <option key={name} value={name} />)}</datalist>{(['currentStock', 'minStockLevel'] as const).map((key) => <label key={key} className="text-sm font-semibold">{{currentStock:'Available stock',minStockLevel:'Minimum stock',purchasePrice:'Purchase price',sellingPrice:'Selling price',gstPercent:'GST %'}[key]}<input required type="number" min="0" step={key === 'currentStock' ? '1' : 'any'} className="input-field mt-2" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))} /></label>)}<label className="text-sm font-semibold">Status<select className="input-field mt-2" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Product['status'] }))}><option value="active">Active</option><option value="inactive">Inactive</option><option value="discontinued">Discontinued</option></select></label></div><label className="block text-sm font-semibold">Description<textarea className="input-field mt-2" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label><button disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save Office Product'}</button></form>;
}
