import type { Product, QuotationLineItem } from '@/types';
const round = (value: number) => Math.round(value * 100) / 100;
export function priceQuotationItem(item: QuotationLineItem, markup: number): QuotationLineItem {
  const rate = round(item.rate * (1 + Math.max(0, markup) / 100));
  const amount = round(item.quantity * rate * (1 - (item.discountPercent || 0) / 100) * (1 + (item.gstPercent || 0) / 100));
  return { ...item, baseRate: item.rate, rate, amount };
}
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function rankProducts(products: Product[], query: string, selectedId?: string): Product[] {
  const q = normalize(query);
  const tokens = q.split(' ').filter(Boolean);
  const score = (product: Product) => {
    const name = normalize(product.name), sku = normalize(product.sku || '');
    if (product.id === selectedId) return 10000;
    if (q && (name === q || sku === q)) return 1000;
    if (q && (name.includes(q) || q.includes(name))) return 500;
    return tokens.reduce((sum, token) => sum + (name.includes(token) || sku.includes(token) ? 10 : 0), 0);
  };
  return products.filter(p => p.status === 'active')
    .map(product => ({ product, score: score(product) }))
    .sort((a,b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .map(entry => entry.product);
}
