import type { Product, QuotationLineItem } from '@/types';
const round = (value: number) => Math.round(value * 100) / 100;
export function priceQuotationItem(item: QuotationLineItem, markup: number): QuotationLineItem {
  const baseRate = item.baseRate ?? item.rate;
  const margin = Math.max(0, item.marginValue ?? markup);
  const rate = round(baseRate + (item.marginMode === 'inr' ? margin : baseRate * margin / 100));
  const amount = round(item.quantity * rate * (1 - (item.discountPercent || 0) / 100) * (1 + (item.gstPercent || 0) / 100));
  return { ...item, baseRate, rate, amount };
}
export function applyGlobalMarkup(items: QuotationLineItem[]): QuotationLineItem[] {
  return items.map(({ marginMode: _mode, marginValue: _value, ...item }) => item);
}
export function productQuotationDefaults(product: Product) {
  return { description: product.name, hsn: product.hsn || product.sku || '', unit: product.unit || 'pcs', rate: product.purchasePrice ?? 0, gstPercent: product.gstPercent ?? 0 };
}
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function rankProducts(products: Product[], query: string, selectedId?: string, includeInactive = false): Product[] {
  const q = normalize(query);
  const tokens = q.split(' ').filter(Boolean);
  const score = (product: Product) => {
    const name = normalize(product.name), sku = normalize(product.hsn || product.sku || ''), brand = normalize(product.brand || '');
    if (product.id === selectedId) return 2000;
    if (!q) return 1;
    if (name === q) return 1500;
    if (name.startsWith(q)) return 1200;
    if (sku.startsWith(q)) return 1000;
    if (name.split(' ').some((word) => word.startsWith(q))) return 800;
    if (name.includes(q)) return 600;
    if (sku.includes(q)) return 500;
    if (tokens.every((token) => name.includes(token) || sku.includes(token))) return 400;
    if (brand.includes(q)) return 200;
    return 0;
  };
  return products.filter(p => includeInactive || p.status === 'active')
    .map(product => ({ product, score: score(product) }))
    .filter(entry => entry.score > 0)
    .sort((a,b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .map(entry => entry.product);
}
