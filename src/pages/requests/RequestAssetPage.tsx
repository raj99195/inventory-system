import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Search,
  Loader2,
  Package,
  Laptop,
  Send,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useAssets } from '@/hooks/useAssets';
import { useProducts } from '@/hooks/useProducts';
import { createRequest } from '@/hooks/useRequests';
import type { Asset, Product, RequestItemType, RequestUrgency } from '@/types';
import { cn } from '@/lib/utils';

type Tab = 'assets' | 'products';

interface SelectedItem {
  type: RequestItemType;
  id: string;
  name: string;
  sku?: string;
  meta?: string; // extra display info
}

export default function RequestAssetPage() {
  const { userDoc } = useAuth();
  const { can } = usePermission();
  const { assets, loading: loadingA } = useAssets();
  const { products, loading: loadingP } = useProducts();

  const [tab, setTab] = useState<Tab>('assets');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  if (!can('requests.createOwn')) {
    return <Navigate to="/" replace />;
  }

  // Only show available assets
  const availableAssets = useMemo(
    () => assets.filter((a) => a.status === 'available'),
    [assets]
  );

  // Only show products with stock > 0
  const inStockProducts = useMemo(
    () => products.filter((p) => (p.currentStock ?? 0) > 0 && p.status === 'active'),
    [products]
  );

  const filteredAssets = useMemo(() => {
    if (!search) return availableAssets;
    const q = search.toLowerCase();
    return availableAssets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.assetId.toLowerCase().includes(q) ||
        (a.brand ?? '').toLowerCase().includes(q) ||
        (a.model ?? '').toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [availableAssets, search]);

  const filteredProducts = useMemo(() => {
    if (!search) return inStockProducts;
    const q = search.toLowerCase();
    return inStockProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [inStockProducts, search]);

  const loading = loadingA || loadingP;

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange-50 text-brand-orange-dark text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          New Request
        </div>
        <h1 className="font-display text-4xl lg:text-5xl font-bold">Request an Item</h1>
        <p className="text-brand-choco-soft mt-2">
          Browse available assets or products. Submit a request — admin approves and it's auto-assigned to you.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-brand-choco/10">
        <TabButton active={tab === 'assets'} onClick={() => setTab('assets')} icon={Laptop} label="Assets" count={availableAssets.length} />
        <TabButton active={tab === 'products'} onClick={() => setTab('products')} icon={Package} label="Products" count={inStockProducts.length} />
      </div>

      {/* Search */}
      <div className="card !p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-choco-soft" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'assets' ? 'Search available assets…' : 'Search products in stock…'}
            className="input-field pl-11 !py-2.5"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
        </div>
      ) : tab === 'assets' ? (
        filteredAssets.length === 0 ? (
          <EmptyState
            icon={Laptop}
            title={availableAssets.length === 0 ? 'No available assets' : 'No matches'}
            description={
              availableAssets.length === 0
                ? 'All assets are currently assigned or under repair.'
                : 'Try a different search term.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets.map((a) => (
              <AssetCard key={a.id} asset={a} onRequest={() => setSelected({
                type: 'asset', id: a.id, name: a.name, sku: a.assetId,
                meta: `${a.category}${a.brand ? ' · ' + a.brand : ''}${a.model ? ' · ' + a.model : ''}`,
              })} />
            ))}
          </div>
        )
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title={inStockProducts.length === 0 ? 'No products in stock' : 'No matches'}
          description={
            inStockProducts.length === 0
              ? 'No products currently have stock available.'
              : 'Try a different search term.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} product={p} onRequest={() => setSelected({
              type: 'product', id: p.id, name: p.name, sku: p.sku,
              meta: `${p.category} · Stock: ${p.currentStock} ${p.unit}`,
            })} />
          ))}
        </div>
      )}

      {selected && userDoc && (
        <RequestModal
          selected={selected}
          userDoc={userDoc}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition flex items-center gap-2',
        active ? 'border-brand-orange text-brand-orange-dark' : 'border-transparent text-brand-choco-soft hover:text-brand-choco'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-cream-dark text-brand-choco">
        {count}
      </span>
    </button>
  );
}

function AssetCard({ asset, onRequest }: { asset: Asset; onRequest: () => void }) {
  return (
    <div className="card !p-5 hover:shadow-lift">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl bg-pastel-blue flex items-center justify-center flex-shrink-0">
          <Laptop className="w-5 h-5 text-blue-800" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-brand-orange">{asset.assetId}</div>
          <h3 className="font-bold text-brand-choco truncate">{asset.name}</h3>
          <p className="text-xs text-brand-choco-soft truncate">
            {asset.category}
            {asset.brand && ` · ${asset.brand}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <div>
          <div className="text-[10px] font-bold text-brand-choco-soft uppercase">Condition</div>
          <div className="font-semibold text-brand-choco capitalize">{asset.condition}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-brand-choco-soft uppercase">Serial</div>
          <div className="font-semibold text-brand-choco truncate">{asset.serialNumber || '—'}</div>
        </div>
      </div>

      <button onClick={onRequest} className="btn-primary w-full">
        <Send className="w-4 h-4" />
        Request this Asset
      </button>
    </div>
  );
}

function ProductCard({ product, onRequest }: { product: Product; onRequest: () => void }) {
  return (
    <div className="card !p-5 hover:shadow-lift">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl bg-pastel-green flex items-center justify-center flex-shrink-0">
          <Package className="w-5 h-5 text-green-800" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-brand-orange">{product.sku}</div>
          <h3 className="font-bold text-brand-choco truncate">{product.name}</h3>
          <p className="text-xs text-brand-choco-soft truncate">
            {product.category}
            {product.brand && ` · ${product.brand}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <div>
          <div className="text-[10px] font-bold text-brand-choco-soft uppercase">In Stock</div>
          <div className="font-bold text-green-700">
            {product.currentStock} {product.unit}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-brand-choco-soft uppercase">Unit</div>
          <div className="font-semibold text-brand-choco">{product.unit}</div>
        </div>
      </div>

      <button onClick={onRequest} className="btn-primary w-full">
        <Send className="w-4 h-4" />
        Request
      </button>
    </div>
  );
}

function RequestModal({
  selected, userDoc, onClose,
}: {
  selected: SelectedItem;
  userDoc: { uid: string; name: string; email: string; department?: string };
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<RequestUrgency>('normal');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error('Please provide a reason');
    setBusy(true);
    try {
      await createRequest({
        userId: userDoc.uid,
        userName: userDoc.name,
        userEmail: userDoc.email,
        userDepartment: userDoc.department,
        itemType: selected.type,
        itemId: selected.id,
        itemName: selected.name,
        itemSku: selected.sku,
        quantity: selected.type === 'asset' ? 1 : quantity,
        reason,
        urgency,
      });
      toast.success('Request submitted — awaiting approval');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Request Item" size="md">
      <form onSubmit={submit} className="p-6 space-y-5">
        {/* Selected item summary */}
        <div className="rounded-2xl bg-brand-cream-dark p-4">
          <div className="text-[10px] font-bold uppercase text-brand-choco-soft mb-1">
            {selected.type === 'asset' ? 'Asset' : 'Product'}
          </div>
          <div className="font-bold text-brand-choco">{selected.name}</div>
          {selected.sku && <div className="text-xs text-brand-orange font-semibold">{selected.sku}</div>}
          {selected.meta && <div className="text-xs text-brand-choco-soft mt-1">{selected.meta}</div>}
        </div>

        {/* Quantity (products only) */}
        {selected.type === 'product' && (
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Quantity *</label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="input-field"
            />
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="text-sm font-semibold mb-1.5 block">Reason *</label>
          <textarea
            rows={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input-field resize-none"
            placeholder="Why do you need this? (e.g. Working on VR project, need this for demo…)"
          />
        </div>

        {/* Urgency */}
        <div>
          <label className="text-sm font-semibold mb-1.5 block">Urgency</label>
          <div className="grid grid-cols-2 gap-2">
            {(['normal', 'urgent'] as RequestUrgency[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                className={cn(
                  'py-2.5 rounded-2xl text-sm font-bold capitalize transition',
                  urgency === u
                    ? u === 'urgent'
                      ? 'bg-pastel-peach text-orange-800 ring-2 ring-orange-400'
                      : 'bg-brand-orange-50 text-brand-orange-dark ring-2 ring-brand-orange'
                    : 'bg-brand-cream-dark text-brand-choco-soft'
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-pastel-blue border border-pastel-blue-deep/30 p-3 text-xs text-brand-choco flex items-start gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Once you submit, this goes to an approver. On approval, the {selected.type} will be auto-assigned to you.
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-brand-choco/8">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Request
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

