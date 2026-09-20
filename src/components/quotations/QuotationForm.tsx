import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Package,
  FileText,
  AlertCircle,
  Loader2,
  Search,
  Link2,
  IndianRupee,
  Download,
  Eye,
  User,
  Hash,
  Calendar,
  Building2,
  Mail,
  Phone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { z } from 'zod';
import type { Quotation, QuotationLineItem, Product } from '@/types';
import { useProducts } from '@/hooks/useProducts';
import {
  createQuotation,
  updateQuotation,
  generateQuotationNumber,
} from '@/hooks/useQuotations';
import {
  downloadQuotationPdf,
  previewQuotationPdf,
} from '@/lib/quotationPdf';
import { cn, formatINR } from '@/lib/utils';

const UNIT_OPTIONS = ['pcs', 'nos', 'box', 'set', 'pair', 'm', 'cm', 'kg', 'g', 'litre', 'ml'];

const DEFAULT_TERMS = `1. Payment: 50% advance, balance on delivery.
2. Delivery: Within 7-10 working days from confirmation.
3. Prices are subject to change without prior notice.
4. GST as applicable.
5. Any dispute is subject to Delhi jurisdiction only.`;

const quotationSchema = z.object({
  quotationNumber: z.string().min(1, 'Quotation number is required'),
  quotationDate: z.string().min(1, 'Date is required'),
  validUntil: z.string().min(1, 'Validity date is required'),
  customerName: z.string().min(2, 'Customer name is required'),
});

interface Props {
  quotation: Quotation | null;
  onClose: () => void;
}

export default function QuotationForm({ quotation, onClose }: Props) {
  const { products } = useProducts();

  // Header
  const [quotationNumber, setQuotationNumber] = useState(
    quotation?.quotationNumber ?? ''
  );
  const [quotationDate, setQuotationDate] = useState(
    quotation?.quotationDate ?? new Date().toISOString().slice(0, 10)
  );
  const [validUntil, setValidUntil] = useState(
    quotation?.validUntil ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState<Quotation['status']>(
    quotation?.status ?? 'draft'
  );

  // Customer
  const [customerName, setCustomerName] = useState(quotation?.customerName ?? '');
  const [customerCompany, setCustomerCompany] = useState(
    quotation?.customerCompany ?? ''
  );
  const [customerAddress, setCustomerAddress] = useState(
    quotation?.customerAddress ?? ''
  );
  const [customerGstin, setCustomerGstin] = useState(quotation?.customerGstin ?? '');
  const [customerEmail, setCustomerEmail] = useState(quotation?.customerEmail ?? '');
  const [customerPhone, setCustomerPhone] = useState(quotation?.customerPhone ?? '');

  // Items
  const [items, setItems] = useState<QuotationLineItem[]>(quotation?.items ?? []);

  // New-item entry state
  const [newDescription, setNewDescription] = useState('');
  const [newHsn, setNewHsn] = useState('');
  const [newQty, setNewQty] = useState<number>(1);
  const [newUnit, setNewUnit] = useState<string>('pcs');
  const [newRate, setNewRate] = useState<number>(0);
  const [newDiscount, setNewDiscount] = useState<number>(0);
  const [newGst, setNewGst] = useState<number>(18);
  const [newRemarks, setNewRemarks] = useState('');
  const [linkedProduct, setLinkedProduct] = useState<Product | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Terms & notes
  const [terms, setTerms] = useState(quotation?.terms ?? DEFAULT_TERMS);
  const [notes, setNotes] = useState(quotation?.notes ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Auto-generate quotation number for new quotations
  useEffect(() => {
    if (!quotation && !quotationNumber) {
      generateQuotationNumber()
        .then(setQuotationNumber)
        .catch(() => setQuotationNumber(`Q-${new Date().getFullYear()}-0001`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const suggestions = useMemo(() => {
    if (!newDescription || newDescription.length < 1) return [];
    const q = newDescription.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.brand?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 6);
  }, [products, newDescription]);

  // ─── LIVE TOTALS ────────────────────────────────────────────────
  const totals = useMemo(() => {
    let subTotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;

    for (const it of items) {
      const base = it.quantity * it.rate;
      const disc = (base * (it.discountPercent || 0)) / 100;
      const afterDisc = base - disc;
      const tax = (afterDisc * (it.gstPercent || 0)) / 100;
      subTotal += base;
      totalDiscount += disc;
      totalTax += tax;
      grandTotal += afterDisc + tax;
    }

    return {
      subTotal: round2(subTotal),
      totalDiscount: round2(totalDiscount),
      totalTax: round2(totalTax),
      grandTotal: round2(grandTotal),
    };
  }, [items]);

  const handleSelectProduct = (p: Product) => {
    setNewDescription(p.name);
    setNewUnit(p.unit);
    setNewRate(p.sellingPrice);
    setNewGst(p.gstPercent);
    setLinkedProduct(p);
    setShowSuggestions(false);
  };

  const handleAddItem = () => {
    const desc = newDescription.trim();
    if (!desc) {
      toast.error('Description is required');
      return;
    }
    if (newQty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    const base = newQty * newRate;
    const afterDisc = base * (1 - (newDiscount || 0) / 100);
    const amount = round2(afterDisc * (1 + (newGst || 0) / 100));

    const item: QuotationLineItem = {
      description: desc,
      hsn: newHsn.trim() || undefined,
      quantity: newQty,
      unit: newUnit,
      rate: newRate,
      discountPercent: newDiscount || 0,
      gstPercent: newGst || 0,
      amount,
      remarks: newRemarks.trim() || undefined,
      ...(linkedProduct && {
        productId: linkedProduct.id,
        productSku: linkedProduct.sku,
      }),
    };

    setItems([...items, item]);

    // Reset
    setNewDescription('');
    setNewHsn('');
    setNewQty(1);
    setNewUnit('pcs');
    setNewRate(0);
    setNewDiscount(0);
    setNewGst(18);
    setNewRemarks('');
    setLinkedProduct(null);
    setShowSuggestions(false);
  };

  const handleUpdateItem = (idx: number, patch: Partial<QuotationLineItem>) => {
    const updated = [...items];
    const merged = { ...updated[idx], ...patch };
    // Recompute amount whenever quantity/rate/discount/gst changes
    const base = merged.quantity * merged.rate;
    const afterDisc = base * (1 - (merged.discountPercent || 0) / 100);
    merged.amount = round2(afterDisc * (1 + (merged.gstPercent || 0) / 100));
    updated[idx] = merged;
    setItems(updated);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const validate = (): boolean => {
    const result = quotationSchema.safeParse({
      quotationNumber,
      quotationDate,
      validUntil,
      customerName,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      toast.error('Please fix the errors above');
      return false;
    }
    if (items.length === 0) {
      toast.error('Add at least one line item');
      return false;
    }
    setErrors({});
    return true;
  };

  const buildPayload = () => ({
    quotationNumber: quotationNumber.trim(),
    quotationDate,
    validUntil,
    customerName: customerName.trim(),
    customerCompany: customerCompany.trim() || undefined,
    customerAddress: customerAddress.trim() || undefined,
    customerGstin: customerGstin.trim() || undefined,
    customerEmail: customerEmail.trim() || undefined,
    customerPhone: customerPhone.trim() || undefined,
    items,
    itemCount: items.length,
    subTotal: totals.subTotal,
    totalDiscount: totals.totalDiscount,
    totalTax: totals.totalTax,
    grandTotal: totals.grandTotal,
    terms: terms.trim() || undefined,
    notes: notes.trim() || undefined,
    status,
  });

  const handleSave = async (opts?: { download?: boolean }) => {
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = buildPayload();

      if (quotation) {
        await updateQuotation(quotation.id, payload, {
          quotationNumber: quotation.quotationNumber,
          customerName: quotation.customerName,
          grandTotal: quotation.grandTotal,
        });
      } else {
        await createQuotation(
          payload as Omit<Quotation, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
        );
      }

      toast.success(quotation ? 'Quotation updated' : 'Quotation created');

      if (opts?.download) {
        // Build a "virtual" quotation from payload for immediate PDF download
        const virtual: Quotation = {
          id: quotation?.id ?? 'temp',
          ...payload,
          createdBy: '',
          // Timestamps not required for PDF rendering
        } as unknown as Quotation;
        await downloadQuotationPdf(virtual);
      }

      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!validate()) return;
    setDownloading(true);
    try {
      const virtual: Quotation = {
        id: quotation?.id ?? 'temp',
        ...buildPayload(),
        createdBy: '',
      } as unknown as Quotation;
      await downloadQuotationPdf(virtual);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF generation failed');
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = async () => {
    if (!validate()) return;
    setPreviewing(true);
    try {
      const virtual: Quotation = {
        id: quotation?.id ?? 'temp',
        ...buildPayload(),
        createdBy: '',
      } as unknown as Quotation;
      await previewQuotationPdf(virtual);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* ─── Header ─── */}
      <section className="space-y-4">
        <SectionHeader
          icon={FileText}
          title="Quotation Details"
          subtitle="Auto-generated number, date and validity"
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Quotation No." error={errors.quotationNumber} required>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-choco-soft" />
              <input
                type="text"
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                className="input-field pl-9 font-mono"
              />
            </div>
          </Field>
          <Field label="Date" error={errors.quotationDate} required>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-choco-soft" />
              <input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="input-field pl-9"
              />
            </div>
          </Field>
          <Field label="Valid Until" error={errors.validUntil} required>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-choco-soft" />
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="input-field pl-9"
              />
            </div>
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Quotation['status'])}
              className="input-field"
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
              <option value="converted">Converted</option>
            </select>
          </Field>
        </div>
      </section>

      {/* ─── Customer ─── */}
      <section className="space-y-4">
        <SectionHeader
          icon={User}
          title="Customer Details"
          subtitle="Who is this quotation for?"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Customer Name" error={errors.customerName} required>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Rajesh Kumar"
              className="input-field"
            />
          </Field>
          <Field label="Company Name">
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-choco-soft" />
              <input
                type="text"
                value={customerCompany}
                onChange={(e) => setCustomerCompany(e.target.value)}
                placeholder="e.g. ABC Enterprises"
                className="input-field pl-9"
              />
            </div>
          </Field>
        </div>
        <Field label="Address">
          <textarea
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            placeholder="Street, City, State, PIN"
            rows={2}
            className="input-field resize-none"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="GSTIN">
            <input
              type="text"
              value={customerGstin}
              onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
              placeholder="e.g. 09ABCDE1234F1Z5"
              className="input-field font-mono uppercase"
            />
          </Field>
          <Field label="Email">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-choco-soft" />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                className="input-field pl-9"
              />
            </div>
          </Field>
          <Field label="Phone">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-choco-soft" />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="input-field pl-9"
              />
            </div>
          </Field>
        </div>
      </section>

      {/* ─── Line Items ─── */}
      <section className="space-y-4">
        <SectionHeader
          icon={Package}
          title="Line Items"
          subtitle="Add products from catalog or enter manually. GST calculated per item."
        />

        {/* Item entry row */}
        <div className="p-4 rounded-2xl bg-brand-cream-dark/50 border border-brand-choco/8 space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <div
              className="col-span-12 md:col-span-5 relative"
              ref={suggestionRef}
            >
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                Description / Search Product
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-choco-soft pointer-events-none" />
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => {
                    setNewDescription(e.target.value);
                    setShowSuggestions(true);
                    if (linkedProduct && e.target.value !== linkedProduct.name) {
                      setLinkedProduct(null);
                    }
                  }}
                  placeholder="Type name or search products..."
                  className="input-field pl-9"
                />
              </div>
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-brand-choco/12 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
                  >
                    {suggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-brand-cream-dark/70 border-b border-brand-choco/5 last:border-b-0 transition"
                      >
                        <Package className="w-4 h-4 text-brand-orange shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">
                            {p.name}
                          </p>
                          <p className="text-[10px] text-brand-choco-soft">
                            {p.sku} · ₹{p.sellingPrice} · GST {p.gstPercent}%
                          </p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                HSN Code
              </label>
              <input
                type="text"
                value={newHsn}
                onChange={(e) => setNewHsn(e.target.value)}
                placeholder="e.g. 8523"
                className="input-field"
              />
            </div>

            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                Qty
              </label>
              <input
                type="number"
                value={newQty}
                onChange={(e) => setNewQty(Number(e.target.value))}
                min={1}
                className="input-field text-center"
              />
            </div>

            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                Unit
              </label>
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="input-field"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-12 md:col-span-1 flex items-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="btn-primary w-full h-10 !px-0"
                title="Add item"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4 md:col-span-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                Rate (₹)
              </label>
              <input
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(Number(e.target.value))}
                min={0}
                step={0.01}
                className="input-field"
              />
            </div>
            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                Discount %
              </label>
              <input
                type="number"
                value={newDiscount}
                onChange={(e) => setNewDiscount(Number(e.target.value))}
                min={0}
                max={100}
                step={0.01}
                className="input-field"
              />
            </div>
            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                GST %
              </label>
              <input
                type="number"
                value={newGst}
                onChange={(e) => setNewGst(Number(e.target.value))}
                min={0}
                max={100}
                step={0.01}
                className="input-field"
              />
            </div>
            <div className="col-span-12 md:col-span-5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">
                Remarks (optional)
              </label>
              <input
                type="text"
                value={newRemarks}
                onChange={(e) => setNewRemarks(e.target.value)}
                placeholder="e.g. Color, model variant..."
                className="input-field"
              />
            </div>
          </div>

          {linkedProduct && (
            <div className="text-[10px] text-brand-orange font-bold flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              Linked to {linkedProduct.sku}
            </div>
          )}
        </div>

        {/* Items list */}
        {items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-brand-choco/15 p-8 text-center">
            <Package className="w-10 h-10 text-brand-choco-soft/40 mx-auto mb-2" />
            <p className="text-sm text-brand-choco-soft">
              No items added yet. Add products above to build the quotation.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-choco/8 overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <AnimatePresence initial={false}>
                {items.map((it, idx) => (
                  <ItemRow
                    key={idx}
                    item={it}
                    index={idx}
                    isFirst={idx === 0}
                    onUpdate={(patch) => handleUpdateItem(idx, patch)}
                    onRemove={() => handleRemoveItem(idx)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Live totals */}
        {items.length > 0 && (
          <div className="flex flex-col items-end gap-1.5 py-4 border-t border-brand-choco/8 text-sm">
            <div className="flex justify-between w-64 font-semibold text-brand-choco-soft">
              <span>Sub Total:</span>
              <span>{formatINR(totals.subTotal)}</span>
            </div>
            {totals.totalDiscount > 0 && (
              <div className="flex justify-between w-64 font-semibold text-brand-choco-soft">
                <span>Total Discount:</span>
                <span>−{formatINR(totals.totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between w-64 font-semibold text-brand-choco-soft">
              <span>GST / Tax Amount:</span>
              <span>{formatINR(totals.totalTax)}</span>
            </div>
            <div className="flex justify-between w-64 font-bold text-brand-orange text-lg pt-1.5 border-t border-brand-choco/10">
              <span>Grand Total:</span>
              <span>{formatINR(totals.grandTotal)}</span>
            </div>
          </div>
        )}
      </section>

      {/* ─── Terms & Notes ─── */}
      <section className="space-y-4">
        <SectionHeader
          icon={FileText}
          title="Terms & Notes"
          subtitle="Terms & conditions and any extra notes for the customer"
        />
        <Field label="Terms & Conditions">
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={5}
            className="input-field resize-none font-mono text-xs"
          />
        </Field>
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes for the customer..."
            rows={2}
            className="input-field resize-none"
          />
        </Field>
      </section>

      {/* ─── Actions ─── */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-choco/8 sticky bottom-0 bg-white -mx-6 px-6 pb-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving || downloading || previewing}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={saving || downloading || previewing || items.length === 0}
          className="btn-secondary"
        >
          {previewing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Preview PDF
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={saving || downloading || items.length === 0}
          className="btn-secondary"
        >
          {downloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Building...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download PDF
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSave({ download: true })}
          disabled={saving || downloading || items.length === 0}
          className="btn-primary min-w-48"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              {quotation ? 'Update & Download' : 'Save & Download'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** ---------------- Item Row ---------------- */
function ItemRow({
  item,
  index,
  isFirst,
  onUpdate,
  onRemove,
}: {
  item: QuotationLineItem;
  index: number;
  isFirst: boolean;
  onUpdate: (patch: Partial<QuotationLineItem>) => void;
  onRemove: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'p-3 hover:bg-brand-cream-dark/40 transition',
        !isFirst && 'border-t border-brand-choco/5'
      )}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-8 h-8 rounded-lg bg-brand-orange-100 flex items-center justify-center shrink-0 text-xs font-bold text-brand-orange">
          {index + 1}
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={item.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className="text-sm font-bold bg-transparent border-0 outline-none focus:bg-white focus:px-2 focus:py-1 focus:rounded-lg focus:border focus:border-brand-orange transition min-w-0 flex-1"
            />
            {item.productId && (
              <span
                title={`Linked to ${item.productSku}`}
                className="badge badge-info text-[9px] shrink-0"
              >
                <Link2 className="w-2.5 h-2.5" />
                {item.productSku}
              </span>
            )}
          </div>
          {item.remarks && (
            <p className="text-[10px] text-brand-choco-soft mt-0.5 truncate">
              {item.remarks}
            </p>
          )}
        </div>

        {/* HSN */}
        <input
          type="text"
          value={item.hsn ?? ''}
          onChange={(e) => onUpdate({ hsn: e.target.value })}
          placeholder="HSN"
          className="h-9 w-16 px-2 rounded-lg bg-white border-2 border-brand-choco/8 focus:border-brand-orange outline-none text-xs font-mono text-center shrink-0"
        />

        {/* Qty */}
        <input
          type="number"
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: Number(e.target.value) })}
          min={0}
          className="h-9 w-14 px-2 rounded-lg bg-white border-2 border-brand-choco/8 focus:border-brand-orange outline-none text-sm font-bold text-center shrink-0"
        />
        <span className="text-[10px] font-semibold text-brand-choco-soft w-8 shrink-0">
          {item.unit}
        </span>

        {/* Rate */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-brand-choco-soft">₹</span>
          <input
            type="number"
            value={item.rate}
            onChange={(e) => onUpdate({ rate: Number(e.target.value) })}
            min={0}
            step={0.01}
            className="h-9 w-20 px-2 rounded-lg bg-white border-2 border-brand-choco/8 focus:border-brand-orange outline-none text-sm font-bold text-center"
          />
        </div>

        {/* Discount */}
        <div className="flex items-center gap-0.5 shrink-0" title="Discount %">
          <input
            type="number"
            value={item.discountPercent}
            onChange={(e) =>
              onUpdate({ discountPercent: Number(e.target.value) })
            }
            min={0}
            max={100}
            step={0.01}
            className="h-9 w-12 px-2 rounded-lg bg-white border-2 border-brand-choco/8 focus:border-brand-orange outline-none text-xs text-center"
          />
          <span className="text-xs text-brand-choco-soft">%</span>
        </div>

        {/* GST */}
        <div className="flex items-center gap-0.5 shrink-0" title="GST %">
          <input
            type="number"
            value={item.gstPercent}
            onChange={(e) => onUpdate({ gstPercent: Number(e.target.value) })}
            min={0}
            max={100}
            step={0.01}
            className="h-9 w-12 px-2 rounded-lg bg-brand-orange-50 border-2 border-brand-orange/30 focus:border-brand-orange outline-none text-xs font-bold text-center text-brand-orange"
          />
          <span className="text-xs text-brand-orange font-bold">%</span>
        </div>

        {/* Line total */}
        <div className="text-right shrink-0 w-24">
          <p className="text-[9px] font-bold uppercase text-brand-choco-soft">
            Total
          </p>
          <p className="text-sm font-bold text-brand-orange">
            {formatINR(item.amount)}
          </p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center transition shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

/** ---------------- Helpers ---------------- */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand-orange-100 flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-orange" />
      </div>
      <div>
        <h3 className="font-display font-bold text-base">{title}</h3>
        <p className="text-xs text-brand-choco-soft">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
