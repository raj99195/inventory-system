import { useMemo } from 'react';
import { useProducts } from './useProducts';
import { useAssets } from './useAssets';
import { useEmployees } from './useEmployees';
import { useInvoices } from './useInvoices';

export interface SearchResult {
  type: 'product' | 'asset' | 'employee' | 'invoice';
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  path: string;
}

export function useGlobalSearch(query: string) {
  const { products } = useProducts();
  const { assets } = useAssets();
  const { employees } = useEmployees();
  const { invoices } = useInvoices(100);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const out: SearchResult[] = [];

    // Products
    products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .forEach((p) =>
        out.push({
          type: 'product',
          id: p.id,
          title: p.name,
          subtitle: `${p.sku} · ${p.category} · Stock ${p.currentStock}`,
          badge: 'Product',
          path: '/products',
        })
      );

    // Assets
    assets
      .filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.assetId.toLowerCase().includes(q) ||
          a.serialNumber.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .forEach((a) =>
        out.push({
          type: 'asset',
          id: a.id,
          title: a.name,
          subtitle: `${a.assetId} · ${a.category} · ${a.status}`,
          badge: 'Asset',
          path: '/assets',
        })
      );

    // Employees
    employees
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .forEach((e) =>
        out.push({
          type: 'employee',
          id: e.id,
          title: e.name,
          subtitle: `${e.employeeId} · ${e.designation}`,
          badge: 'Employee',
          path: '/employees',
        })
      );

    // Invoices
    invoices
      .filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.customerName?.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .forEach((i) =>
        out.push({
          type: 'invoice',
          id: i.id,
          title: i.invoiceNumber,
          subtitle: `${i.customerName ?? 'No customer'} · ₹${i.totalAmount}`,
          badge: 'Invoice',
          path: '/invoices',
        })
      );

    return out;
  }, [query, products, assets, employees, invoices]);

  return { results };
}
