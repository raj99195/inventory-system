import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Package, FileText, AlertCircle, Loader2,
  Search, Link2, Download, Eye, User, Hash, Calendar,
  Building2, Mail, Phone, Lock, TrendingUp, EyeOff,
  FileSpreadsheet, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { z } from 'zod';
import type { Quotation, QuotationLineItem, Product } from '@/types';
import { useProducts } from '@/hooks/useProducts';
import { createQuotation, updateQuotation, generateQuotationNumber } from '@/hooks/useQuotations';
import { downloadQuotationPdf, previewQuotationPdf } from '@/lib/quotationPdf';
import { cn, formatINR } from '@/lib/utils';

const UNIT_OPTIONS = ['pcs','nos','box','set','pair','m','cm','kg','g','litre','ml'];

const DEFAULT_TERMS = `1. Payment: 50% advance, balance on delivery.
2. Delivery: Within 7-10 working days from confirmation.
3. Prices are subject to change without prior notice.
4. GST as applicable.
5. Any dispute is subject to Delhi jurisdiction only.`;

const schema = z.object({
  quotationNumber: z.string().min(1,'Quotation number required'),
  quotationDate:   z.string().min(1,'Date required'),
  validUntil:      z.string().min(1,'Validity required'),
  customerName:    z.string().min(2,'Customer name required'),
});

interface ExcelRow {
  name: string; quantity: number; rate: number;
  matchedProduct?: Product; matchType: 'exact'|'partial'|'none'; selected: boolean;
}

// ─── Props ───────────────────────────────────────────────────
interface Props {
  quotation:     Quotation | null;
  onClose:       () => void;
  initialItems?: QuotationLineItem[];   // Pre-loaded from page-level Excel import
}

export default function QuotationForm({ quotation, onClose, initialItems }: Props) {
  const { products } = useProducts();

  // Header
  const [quotationNumber, setQuotationNumber] = useState(quotation?.quotationNumber ?? '');
  const [quotationDate,   setQuotationDate]   = useState(quotation?.quotationDate   ?? new Date().toISOString().slice(0,10));
  const [validUntil,      setValidUntil]      = useState(quotation?.validUntil      ?? new Date(Date.now()+30*86400000).toISOString().slice(0,10));
  const [status,          setStatus]          = useState<Quotation['status']>(quotation?.status ?? 'draft');

  // Customer
  const [customerName,    setCustomerName]    = useState(quotation?.customerName    ?? '');
  const [customerCompany, setCustomerCompany] = useState(quotation?.customerCompany ?? '');
  const [customerAddress, setCustomerAddress] = useState(quotation?.customerAddress ?? '');
  const [customerGstin,   setCustomerGstin]   = useState(quotation?.customerGstin   ?? '');
  const [customerEmail,   setCustomerEmail]   = useState(quotation?.customerEmail   ?? '');
  const [customerPhone,   setCustomerPhone]   = useState(quotation?.customerPhone   ?? '');

  // Items — initialItems used only on new quotations
  const [items, setItems] = useState<QuotationLineItem[]>(
    quotation?.items ?? initialItems ?? []
  );

  // Internal margin
  const [marginPercent,     setMarginPercent]     = useState<number>(quotation?.marginPercent ?? 0);
  const [internalNotes,     setInternalNotes]     = useState<string>(quotation?.internalNotes ?? '');
  const [showInternalPanel, setShowInternalPanel] = useState(!!quotation?.marginPercent || !!quotation?.internalNotes);

  // Terms / notes
  const [terms, setTerms] = useState(quotation?.terms ?? DEFAULT_TERMS);
  const [notes, setNotes] = useState(quotation?.notes ?? '');

  // Manual entry
  const [newDesc,     setNewDesc]     = useState('');
  const [newHsn,      setNewHsn]      = useState('');
  const [newQty,      setNewQty]      = useState<number>(1);
  const [newUnit,     setNewUnit]     = useState('pcs');
  const [newRate,     setNewRate]     = useState<number>(0);
  const [newDiscount, setNewDiscount] = useState<number>(0);
  const [newGst,      setNewGst]      = useState<number>(18);
  const [newRemarks,  setNewRemarks]  = useState('');
  const [linked,      setLinked]      = useState<Product|null>(null);
  const [showSug,     setShowSug]     = useState(false);
  const sugRef = useRef<HTMLDivElement>(null);

  // Excel import (inline panel)
  const excelInputRef                       = useRef<HTMLInputElement>(null);
  const [excelRows,      setExcelRows]      = useState<ExcelRow[]>([]);
  const [excelPanel,     setExcelPanel]     = useState(false);
  const [excelFile,      setExcelFile]      = useState('');
  const [excelLoading,   setExcelLoading]   = useState(false);
  const [pickerIdx,      setPickerIdx]      = useState<number|null>(null);
  const [pickerSearch,   setPickerSearch]   = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  const [errors,      setErrors]      = useState<Record<string,string>>({});
  const [saving,      setSaving]      = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewing,  setPreviewing]  = useState(false);

  // Auto-generate quotation number
  useEffect(() => {
    if (!quotation && !quotationNumber) {
      generateQuotationNumber()
        .then(setQuotationNumber)
        .catch(() => setQuotationNumber(`Q-${new Date().getFullYear()}-0001`));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sugRef.current    && !sugRef.current.contains(e.target as Node))    setShowSug(false);
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerIdx(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Product suggestions for manual entry
  const suggestions = useMemo(() => {
    if (!newDesc) return [];
    const q = newDesc.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0,6);
  }, [products, newDesc]);

  // Products for picker dropdown in Excel panel
  const pickerProducts = useMemo(() => {
    if (!pickerSearch) return products.filter(p => p.status==='active').slice(0,8);
    const q = pickerSearch.toLowerCase();
    return products.filter(p =>
      p.status==='active' &&
      (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    ).slice(0,10);
  }, [products, pickerSearch]);

  // ─── Totals ───────────────────────────────────────────────────
  const totals = useMemo(() => {
    let sub=0, disc=0, tax=0, grand=0;
    items.forEach(it => {
      const base  = it.quantity * it.rate;
      const d     = base * (it.discountPercent||0) / 100;
      const after = base - d;
      const t     = after * (it.gstPercent||0) / 100;
      sub += base; disc += d; tax += t; grand += after+t;
    });
    return { subTotal:r2(sub), totalDiscount:r2(disc), totalTax:r2(tax), grandTotal:r2(grand) };
  }, [items]);

  const internalStats = useMemo(() => {
    const net = totals.subTotal - totals.totalDiscount;
    const m   = marginPercent || 0;
    if (m<=0||net<=0) return { net, cost:0, profit:0, pct:0 };
    const cost   = r2(net/(1+m/100));
    const profit = r2(net-cost);
    return { net, cost, profit, pct: r2((profit/net)*100) };
  }, [totals, marginPercent]);

  // ─── Product matching ─────────────────────────────────────────
  const matchProduct = (name: string) => {
    const q = name.toLowerCase().trim();
    const exact   = products.find(p => p.name.toLowerCase().trim()===q);
    if (exact) return { product: exact, type: 'exact' as const };
    const partial = products.find(p => {
      const pn = p.name.toLowerCase().trim();
      return pn.includes(q) || q.includes(pn);
    });
    if (partial) return { product: partial, type: 'partial' as const };
    return { product: undefined, type: 'none' as const };
  };

  // ─── Excel parse (inline panel) ───────────────────────────────
  const handleExcelFile = async (file: File) => {
    setExcelLoading(true); setExcelFile(file.name);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string,unknown>>(ws, { defval:null, raw:true });
      if (!rows.length) { toast.error('Sheet is empty'); return; }

      const keys    = Object.keys(rows[0]);
      const findCol = (...kws: string[]) => keys.find(k => kws.some(kw => k.toLowerCase().replace(/[\s\n\/]/g,'').includes(kw))) ?? null;
      const nameCol = findCol('component','name','article','description','item');
      const qtyCol  = findCol('total','quantity','qty','suggestedqty');
      const rateCol = findCol('priceunit','price','rate','unitprice');

      if (!nameCol) { toast.error('Cannot detect name column. Headers: '+keys.join(', ')); return; }

      const parsed: ExcelRow[] = [];
      for (const row of rows) {
        const name = String(row[nameCol]||'').trim();
        if (!name || /^(sr|s\.n|sl)/i.test(name)) continue;
        const qty  = qtyCol  ? parseFloat(String(row[qtyCol] ??'1'))||1 : 1;
        const rate0 = rateCol ? parseFloat(String(row[rateCol]??'0'))||0 : 0;
        const { product, type } = matchProduct(name);
        parsed.push({ name, quantity:qty, rate:product?.sellingPrice??rate0, matchedProduct:product, matchType:type, selected:true });
      }

      if (!parsed.length) { toast.error('No valid rows found'); return; }
      setExcelRows(parsed); setExcelPanel(true);
      toast.success(`${parsed.length} items · ${parsed.filter(r=>r.matchType!=='none').length} matched`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Parse failed');
    } finally { setExcelLoading(false); }
  };

  const updateExcelRow      = (idx: number, patch: Partial<ExcelRow>) =>
    setExcelRows(p => p.map((r,i) => i===idx ? {...r,...patch} : r));

  const assignProduct       = (idx: number, product: Product) => {
    updateExcelRow(idx, { matchedProduct:product, matchType:'exact', rate:product.sellingPrice });
    setPickerIdx(null); setPickerSearch('');
  };

  const clearProduct        = (idx: number) =>
    updateExcelRow(idx, { matchedProduct:undefined, matchType:'none' });

  const toggleRow           = (idx: number) =>
    updateExcelRow(idx, { selected: !excelRows[idx].selected });
  const toggleAll           = (v: boolean) =>
    setExcelRows(p => p.map(r => ({...r, selected:v})));
  const selectedCount       = excelRows.filter(r => r.selected).length;

  const addExcelItems = () => {
    const sel = excelRows.filter(r => r.selected);
    if (!sel.length) { toast.error('Select at least one item'); return; }
    const newItems: QuotationLineItem[] = sel.map(r => {
      const p=r.matchedProduct, gst=p?.gstPercent??18, rate=r.rate;
      return {
        description: r.name, hsn: p?.sku||undefined,
        quantity: r.quantity, unit: p?.unit??'pcs', rate,
        discountPercent: 0, gstPercent: gst,
        amount: r2(r.quantity*rate*(1+gst/100)),
        productId: p?.id, productSku: p?.sku,
      };
    });
    setItems(prev => [...prev, ...newItems]);
    setExcelRows([]); setExcelPanel(false); setExcelFile('');
    toast.success(`${newItems.length} items added`);
  };

  // ─── Manual item add ──────────────────────────────────────────
  const handleSelectProduct = (p: Product) => {
    setNewDesc(p.name); setNewUnit(p.unit); setNewRate(p.sellingPrice);
    setNewGst(p.gstPercent); setLinked(p); setShowSug(false);
  };

  const handleAddItem = () => {
    const desc = newDesc.trim();
    if (!desc)    { toast.error('Description required'); return; }
    if (newQty<=0){ toast.error('Qty must be > 0');     return; }
    const base  = newQty * newRate;
    const after = base * (1-(newDiscount||0)/100);
    const amount = r2(after*(1+(newGst||0)/100));
    setItems(prev => [...prev, {
      description:desc, hsn:newHsn.trim()||undefined, quantity:newQty, unit:newUnit,
      rate:newRate, discountPercent:newDiscount||0, gstPercent:newGst||0, amount,
      remarks:newRemarks.trim()||undefined,
      ...(linked && { productId:linked.id, productSku:linked.sku }),
    }]);
    setNewDesc(''); setNewHsn(''); setNewQty(1); setNewUnit('pcs');
    setNewRate(0); setNewDiscount(0); setNewGst(18); setNewRemarks(''); setLinked(null);
  };

  const handleUpdateItem = (idx: number, patch: Partial<QuotationLineItem>) => {
    setItems(prev => {
      const u=[...prev], m={...u[idx],...patch};
      const after = m.quantity*m.rate*(1-(m.discountPercent||0)/100);
      m.amount = r2(after*(1+(m.gstPercent||0)/100));
      u[idx]=m; return u;
    });
  };
  const handleRemoveItem = (idx: number) => setItems(p => p.filter((_,i)=>i!==idx));

  // ─── Save ─────────────────────────────────────────────────────
  const validate = () => {
    const res = schema.safeParse({ quotationNumber, quotationDate, validUntil, customerName });
    if (!res.success) {
      const fe: Record<string,string>={};
      res.error.issues.forEach(i => { fe[i.path[0] as string]=i.message; });
      setErrors(fe); toast.error('Fix errors'); return false;
    }
    if (!items.length) { toast.error('Add at least one item'); return false; }
    setErrors({}); return true;
  };

  const buildPayload = () => ({
    quotationNumber:quotationNumber.trim(), quotationDate, validUntil, status,
    customerName:customerName.trim(),
    customerCompany:customerCompany.trim()||undefined, customerAddress:customerAddress.trim()||undefined,
    customerGstin:customerGstin.trim()||undefined,     customerEmail:customerEmail.trim()||undefined,
    customerPhone:customerPhone.trim()||undefined,
    items, itemCount:items.length,
    subTotal:totals.subTotal, totalDiscount:totals.totalDiscount,
    totalTax:totals.totalTax, grandTotal:totals.grandTotal,
    marginPercent:marginPercent||0,
    internalNotes:internalNotes.trim()||undefined,
    terms:terms.trim()||undefined, notes:notes.trim()||undefined,
  });

  const handleSave = async (opts?: { download?: boolean }) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (quotation) {
        await updateQuotation(quotation.id, payload, {
          quotationNumber:quotation.quotationNumber, customerName:quotation.customerName, grandTotal:quotation.grandTotal,
        });
      } else {
        await createQuotation(payload as Omit<Quotation,'id'|'createdAt'|'updatedAt'|'createdBy'>);
      }
      toast.success(quotation ? 'Updated' : 'Created');
      if (opts?.download) {
        await downloadQuotationPdf({ id:quotation?.id??'temp', ...payload, createdBy:'' } as unknown as Quotation);
      }
      onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDownload = async () => {
    if (!validate()) return;
    setDownloading(true);
    try { await downloadQuotationPdf({ id:'temp', ...buildPayload(), createdBy:'' } as unknown as Quotation); toast.success('Downloaded'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'PDF failed'); }
    finally { setDownloading(false); }
  };

  const handlePreview = async () => {
    if (!validate()) return;
    setPreviewing(true);
    try { await previewQuotationPdf({ id:'temp', ...buildPayload(), createdBy:'' } as unknown as Quotation); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Preview failed'); }
    finally { setPreviewing(false); }
  };

  return (
    <div className="p-6 space-y-6">

      {/* ─── Header ─── */}
      <section className="space-y-4">
        <SH icon={FileText} title="Quotation Details" sub="Auto-generated number, date and validity" />
        {/* If pre-loaded from Excel, show a notice */}
        {!quotation && initialItems && initialItems.length>0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-300 text-green-900 text-xs font-semibold">
            <FileSpreadsheet className="w-3.5 h-3.5 text-green-700 shrink-0"/>
            {initialItems.length} items pre-loaded from Excel import — review and fill customer details below.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Quotation No." error={errors.quotationNumber} required>
            <div className="relative"><Hash className="abs-icon"/><input type="text" value={quotationNumber} onChange={e=>setQuotationNumber(e.target.value)} className="input-field pl-9 font-mono"/></div>
          </Field>
          <Field label="Date" error={errors.quotationDate} required>
            <div className="relative"><Calendar className="abs-icon"/><input type="date" value={quotationDate} onChange={e=>setQuotationDate(e.target.value)} className="input-field pl-9"/></div>
          </Field>
          <Field label="Valid Until" error={errors.validUntil} required>
            <div className="relative"><Calendar className="abs-icon"/><input type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)} className="input-field pl-9"/></div>
          </Field>
          <Field label="Status">
            <select value={status} onChange={e=>setStatus(e.target.value as Quotation['status'])} className="input-field">
              {['draft','sent','accepted','rejected','expired','converted'].map(s=>(
                <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* ─── Customer ─── */}
      <section className="space-y-4">
        <SH icon={User} title="Customer Details" sub="Who is this quotation for?" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Customer Name" error={errors.customerName} required>
            <input type="text" value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="e.g. Rajesh Kumar" className="input-field"/>
          </Field>
          <Field label="Company Name">
            <div className="relative"><Building2 className="abs-icon"/><input type="text" value={customerCompany} onChange={e=>setCustomerCompany(e.target.value)} placeholder="e.g. ABC Enterprises" className="input-field pl-9"/></div>
          </Field>
        </div>
        <Field label="Address">
          <textarea value={customerAddress} onChange={e=>setCustomerAddress(e.target.value)} placeholder="Street, City, State, PIN" rows={2} className="input-field resize-none"/>
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="GSTIN">
            <input type="text" value={customerGstin} onChange={e=>setCustomerGstin(e.target.value.toUpperCase())} placeholder="09ABCDE1234F1Z5" className="input-field font-mono uppercase"/>
          </Field>
          <Field label="Email">
            <div className="relative"><Mail className="abs-icon"/><input type="email" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)} placeholder="customer@example.com" className="input-field pl-9"/></div>
          </Field>
          <Field label="Phone">
            <div className="relative"><Phone className="abs-icon"/><input type="tel" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="+91 98765 43210" className="input-field pl-9"/></div>
          </Field>
        </div>
      </section>

      {/* ─── Line Items ─── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SH icon={Package} title="Line Items" sub="Add manually, search products, or import from Excel" />
          <div>
            <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e=>{ const f=e.target.files?.[0]; if(f) handleExcelFile(f); e.target.value=''; }}/>
            <button type="button" onClick={()=>excelInputRef.current?.click()} disabled={excelLoading}
              className="btn-secondary gap-2 text-sm">
              {excelLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileSpreadsheet className="w-4 h-4 text-green-700"/>}
              Import Excel
            </button>
          </div>
        </div>

        {/* Excel Preview Panel */}
        <AnimatePresence>
          {excelPanel && excelRows.length>0 && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
              className="rounded-2xl border-2 border-green-400 bg-green-50/40 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-green-100/60 border-b border-green-200">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-green-800"/>
                  <div>
                    <p className="font-bold text-green-900 text-sm">{excelFile}</p>
                    <div className="flex items-center gap-2 text-[10px] mt-0.5">
                      <span className="px-1.5 py-0.5 rounded-full bg-green-200 text-green-900 font-bold">✓ {excelRows.filter(r=>r.matchType==='exact').length} exact</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-yellow-200 text-yellow-900 font-bold">≈ {excelRows.filter(r=>r.matchType==='partial').length} partial</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">? {excelRows.filter(r=>r.matchType==='none').length} unmatched</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={()=>toggleAll(true)} className="text-xs font-bold text-green-800 hover:underline">All</button>
                  <button type="button" onClick={()=>toggleAll(false)} className="text-xs font-bold text-green-800 hover:underline">None</button>
                  <button type="button" onClick={()=>{setExcelPanel(false);setExcelRows([]);}} className="text-xs text-red-600 font-bold hover:underline">Discard</button>
                </div>
              </div>

              {/* Column labels */}
              <div className="grid grid-cols-[24px_1fr_140px_60px_88px] gap-2 px-4 py-1.5 bg-green-100/30 border-b border-green-100 text-[10px] font-bold uppercase text-green-900">
                <span/><span>Component</span><span>Product Match</span><span className="text-center">Qty</span><span className="text-right">Rate</span>
              </div>

              {/* Rows */}
              <div className="max-h-80 overflow-y-auto divide-y divide-green-100" ref={pickerRef}>
                {excelRows.map((row, idx) => (
                  <div key={idx} className={cn(
                    'grid grid-cols-[24px_1fr_140px_60px_88px] gap-2 px-4 py-2.5 items-center transition',
                    row.selected ? 'bg-white hover:bg-green-50/30' : 'bg-green-50/20 opacity-50'
                  )}>
                    {/* Checkbox */}
                    <input type="checkbox" checked={row.selected} onChange={()=>toggleRow(idx)} className="w-4 h-4 accent-brand-orange"/>

                    {/* Name */}
                    <p className="text-sm font-semibold truncate" title={row.name}>{row.name}</p>

                    {/* Product picker */}
                    <div className="relative">
                      {row.matchedProduct ? (
                        <div
                          className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer group',
                            row.matchType==='exact' ? 'bg-green-100 border-green-300 text-green-900' : 'bg-yellow-100 border-yellow-300 text-yellow-900'
                          )}
                          onClick={()=>{ setPickerIdx(pickerIdx===idx?null:idx); setPickerSearch(''); }}
                        >
                          <Link2 className="w-3 h-3 shrink-0"/>
                          <span className="truncate flex-1">{row.matchedProduct.name}</span>
                          <button type="button" onClick={e=>{e.stopPropagation();clearProduct(idx);}} className="opacity-0 group-hover:opacity-100 transition text-red-500 shrink-0">
                            <X className="w-3 h-3"/>
                          </button>
                        </div>
                      ) : (
                        <button type="button"
                          onClick={()=>{ setPickerIdx(pickerIdx===idx?null:idx); setPickerSearch(''); }}
                          className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border border-dashed border-red-300 bg-red-50 text-red-700 hover:bg-red-100 transition">
                          <Search className="w-3 h-3 shrink-0"/><span>Assign product</span>
                        </button>
                      )}

                      {/* Picker dropdown */}
                      <AnimatePresence>
                        {pickerIdx===idx && (
                          <motion.div initial={{opacity:0,y:-4,scale:0.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-4,scale:0.97}}
                            className="absolute z-30 top-full left-0 mt-1 w-72 bg-white border border-brand-choco/12 rounded-xl shadow-xl overflow-hidden"
                          >
                            <div className="p-2 border-b border-brand-choco/8">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-choco-soft"/>
                                <input autoFocus type="text" value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)}
                                  placeholder="Search products..." className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-brand-cream-dark text-sm outline-none"/>
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {pickerProducts.length===0
                                ? <p className="text-xs text-brand-choco-soft text-center py-3">No products found</p>
                                : pickerProducts.map(p=>(
                                  <button key={p.id} type="button" onClick={()=>assignProduct(idx, p)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-brand-cream-dark transition border-b border-brand-choco/5 last:border-0">
                                    <Package className="w-3.5 h-3.5 text-brand-orange shrink-0"/>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold truncate">{p.name}</p>
                                      <p className="text-[10px] text-brand-choco-soft">{p.sku} · ₹{p.sellingPrice} · {p.gstPercent}% GST</p>
                                    </div>
                                  </button>
                                ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Qty */}
                    <input type="number" value={row.quantity} min={1} onChange={e=>updateExcelRow(idx,{quantity:Number(e.target.value)||1})}
                      className="w-full px-2 py-1.5 rounded-lg bg-white border border-brand-choco/15 text-sm font-bold text-center outline-none focus:border-brand-orange"/>

                    {/* Rate */}
                    <div className="flex items-center gap-0.5 justify-end">
                      <span className="text-[10px] text-brand-choco-soft">₹</span>
                      <input type="number" value={row.rate} min={0} step={0.01} onChange={e=>updateExcelRow(idx,{rate:parseFloat(e.target.value)||0})}
                        className="w-16 px-1.5 py-1.5 rounded-lg bg-white border border-brand-choco/15 text-sm font-bold text-right outline-none focus:border-brand-orange"/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 bg-green-100/60 border-t border-green-200">
                <p className="text-xs text-green-900 font-semibold">
                  {selectedCount} of {excelRows.length} selected
                  {excelRows.filter(r=>r.selected&&r.matchType==='none').length>0 && (
                    <span className="text-orange-700 ml-2">· {excelRows.filter(r=>r.selected&&r.matchType==='none').length} unmatched (rate=0)</span>
                  )}
                </p>
                <button type="button" onClick={addExcelItems} disabled={selectedCount===0} className="btn-primary text-sm disabled:opacity-60">
                  <Plus className="w-4 h-4"/>Add {selectedCount} Items
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual entry */}
        <div className="p-4 rounded-2xl bg-brand-cream-dark/50 border border-brand-choco/8 space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12 md:col-span-5 relative" ref={sugRef}>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">Description / Search Product</label>
              <div className="relative">
                <Search className="abs-icon pointer-events-none"/>
                <input type="text" value={newDesc}
                  onChange={e=>{setNewDesc(e.target.value);setShowSug(true);if(linked&&e.target.value!==linked.name)setLinked(null);}}
                  placeholder="Type name or search..." className="input-field pl-9"/>
              </div>
              <AnimatePresence>
                {showSug&&suggestions.length>0 && (
                  <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                    className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-brand-choco/12 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto"
                  >
                    {suggestions.map(p=>(
                      <button key={p.id} type="button" onClick={()=>handleSelectProduct(p)}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-brand-cream-dark/70 border-b border-brand-choco/5 last:border-b-0 transition">
                        <Package className="w-4 h-4 text-brand-orange shrink-0"/>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{p.name}</p>
                          <p className="text-[10px] text-brand-choco-soft">{p.sku} · ₹{p.sellingPrice} · {p.gstPercent}% GST</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">HSN</label>
              <input type="text" value={newHsn} onChange={e=>setNewHsn(e.target.value)} placeholder="e.g. 8523" className="input-field"/>
            </div>
            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">Qty</label>
              <input type="number" value={newQty} onChange={e=>setNewQty(Number(e.target.value))} min={1} className="input-field text-center"/>
            </div>
            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">Unit</label>
              <select value={newUnit} onChange={e=>setNewUnit(e.target.value)} className="input-field">
                {UNIT_OPTIONS.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="col-span-12 md:col-span-1 flex items-end">
              <button type="button" onClick={handleAddItem} className="btn-primary w-full h-10 !px-0"><Plus className="w-4 h-4"/></button>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4 md:col-span-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">Rate (₹)</label>
              <input type="number" value={newRate} onChange={e=>setNewRate(Number(e.target.value))} min={0} step={0.01} className="input-field"/>
            </div>
            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">Discount %</label>
              <input type="number" value={newDiscount} onChange={e=>setNewDiscount(Number(e.target.value))} min={0} max={100} step={0.01} className="input-field"/>
            </div>
            <div className="col-span-4 md:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">GST %</label>
              <input type="number" value={newGst} onChange={e=>setNewGst(Number(e.target.value))} min={0} max={100} step={0.01} className="input-field"/>
            </div>
            <div className="col-span-12 md:col-span-5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-choco-soft mb-1">Remarks</label>
              <input type="text" value={newRemarks} onChange={e=>setNewRemarks(e.target.value)} placeholder="Color, model..." className="input-field"/>
            </div>
          </div>
          {linked && (
            <div className="text-[10px] text-brand-orange font-bold flex items-center gap-1">
              <Link2 className="w-3 h-3"/>Linked to {linked.sku}
            </div>
          )}
        </div>

        {/* Items list */}
        {items.length===0 ? (
          <div className="rounded-2xl border-2 border-dashed border-brand-choco/15 p-8 text-center">
            <Package className="w-10 h-10 text-brand-choco-soft/40 mx-auto mb-2"/>
            <p className="text-sm text-brand-choco-soft">
              No items yet — add manually or{' '}
              <button type="button" onClick={()=>excelInputRef.current?.click()} className="text-brand-orange font-bold hover:underline">import Excel</button>
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-choco/8 overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <AnimatePresence initial={false}>
                {items.map((it,idx)=>(
                  <ItemRow key={idx} item={it} index={idx} isFirst={idx===0}
                    onUpdate={p=>handleUpdateItem(idx,p)} onRemove={()=>handleRemoveItem(idx)}/>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Totals */}
        {items.length>0 && (
          <div className="flex flex-col items-end gap-1.5 py-4 border-t border-brand-choco/8 text-sm">
            <Row64 label="Sub Total:" value={formatINR(totals.subTotal)}/>
            {totals.totalDiscount>0 && <Row64 label="Total Discount:" value={`−${formatINR(totals.totalDiscount)}`}/>}
            <Row64 label="GST Amount:" value={formatINR(totals.totalTax)}/>
            <div className="flex justify-between w-64 font-bold text-brand-orange text-lg pt-1.5 border-t border-brand-choco/10">
              <span>Grand Total:</span><span>{formatINR(totals.grandTotal)}</span>
            </div>
          </div>
        )}
      </section>

      {/* ─── Internal Margin ─── */}
      {items.length>0 && (
        <section>
          <div className="rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/40 overflow-hidden">
            <button type="button" onClick={()=>setShowInternalPanel(v=>!v)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-purple-100/40 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-200 flex items-center justify-center"><Lock className="w-5 h-5 text-purple-800"/></div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-base text-purple-900">Internal Margin</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[10px] font-bold uppercase tracking-wider">
                      <EyeOff className="w-2.5 h-2.5"/>Not on PDF
                    </span>
                  </div>
                  <p className="text-xs text-purple-800/80">Profitability tracking — never shown to customer</p>
                </div>
              </div>
              {showInternalPanel ? <ChevronUp className="w-4 h-4 text-purple-700"/> : <ChevronDown className="w-4 h-4 text-purple-700"/>}
            </button>

            <AnimatePresence>
              {showInternalPanel && (
                <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
                  className="border-t border-purple-200 overflow-hidden">
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-purple-800 mb-1.5">Margin % (Markup on Cost)</label>
                        <div className="relative max-w-44">
                          <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-700"/>
                          <input type="number" value={marginPercent} onChange={e=>setMarginPercent(Math.max(0,Number(e.target.value)||0))}
                            min={0} max={1000} step={0.01} placeholder="e.g. 30"
                            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border-2 border-purple-300 focus:border-purple-600 outline-none font-bold text-purple-900"/>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-700 font-bold text-sm">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-purple-800 mb-1.5">Internal Notes</label>
                        <input type="text" value={internalNotes} onChange={e=>setInternalNotes(e.target.value)}
                          placeholder="Supplier info, negotiated cost..."
                          className="w-full px-3 py-2 rounded-xl bg-white border-2 border-purple-300 focus:border-purple-600 outline-none text-sm"/>
                      </div>
                    </div>
                    {marginPercent>0&&internalStats.net>0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Stat label="Selling (Net)" value={formatINR(internalStats.net)}    hint="After discount, before GST"/>
                        <Stat label="Est. Cost"     value={formatINR(internalStats.cost)}   hint="Back-calculated"/>
                        <Stat label="Est. Profit"   value={formatINR(internalStats.profit)} hint="Selling − Cost" hi/>
                        <Stat label="Profit Margin" value={`${internalStats.pct}%`}         hint="Profit / Selling"/>
                      </div>
                    ) : <p className="text-xs text-purple-800/70 italic">Enter a margin % to see estimates.</p>}
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-purple-100/60 text-xs text-purple-900">
                      <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                      <p><b>Confidential:</b> Never included in customer PDF.</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* ─── Terms ─── */}
      <section className="space-y-4">
        <SH icon={FileText} title="Terms & Notes" sub="For the customer" />
        <Field label="Terms & Conditions">
          <textarea value={terms} onChange={e=>setTerms(e.target.value)} rows={5} className="input-field resize-none font-mono text-xs"/>
        </Field>
        <Field label="Notes (optional)">
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Additional notes..." rows={2} className="input-field resize-none"/>
        </Field>
      </section>

      {/* ─── Actions ─── */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-choco/8 sticky bottom-0 bg-white -mx-6 px-6 pb-2">
        <button type="button" onClick={onClose} disabled={saving||downloading||previewing} className="btn-secondary">Cancel</button>
        <button type="button" onClick={handlePreview} disabled={saving||downloading||previewing||!items.length} className="btn-secondary">
          {previewing ? <><Loader2 className="w-4 h-4 animate-spin"/>Loading...</> : <><Eye className="w-4 h-4"/>Preview PDF</>}
        </button>
        <button type="button" onClick={handleDownload} disabled={saving||downloading||!items.length} className="btn-secondary">
          {downloading ? <><Loader2 className="w-4 h-4 animate-spin"/>Building...</> : <><Download className="w-4 h-4"/>Download PDF</>}
        </button>
        <button type="button" onClick={()=>handleSave({download:true})} disabled={saving||downloading||!items.length} className="btn-primary min-w-48">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving...</> : <><Download className="w-4 h-4"/>{quotation?'Update & Download':'Save & Download'}</>}
        </button>
      </div>
    </div>
  );
}

// ─── Item Row ─────────────────────────────────────────────────
function ItemRow({ item, index, isFirst, onUpdate, onRemove }: {
  item:QuotationLineItem; index:number; isFirst:boolean;
  onUpdate:(p:Partial<QuotationLineItem>)=>void; onRemove:()=>void;
}) {
  return (
    <motion.div layout initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
      className={cn('p-3 hover:bg-brand-cream-dark/40 transition',!isFirst&&'border-t border-brand-choco/5')}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-8 h-8 rounded-lg bg-brand-orange-100 flex items-center justify-center shrink-0 text-xs font-bold text-brand-orange">{index+1}</div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <input type="text" value={item.description} onChange={e=>onUpdate({description:e.target.value})}
              className="text-sm font-bold bg-transparent border-0 outline-none focus:bg-white focus:px-2 focus:py-1 focus:rounded-lg focus:border focus:border-brand-orange transition min-w-0 flex-1"/>
            {item.productId && <span className="badge badge-info text-[9px] shrink-0"><Link2 className="w-2.5 h-2.5"/>{item.productSku}</span>}
          </div>
          {item.remarks && <p className="text-[10px] text-brand-choco-soft mt-0.5 truncate">{item.remarks}</p>}
        </div>
        <input type="text" value={item.hsn??''} onChange={e=>onUpdate({hsn:e.target.value})} placeholder="HSN"
          className="h-9 w-16 px-2 rounded-lg bg-white border-2 border-brand-choco/8 focus:border-brand-orange outline-none text-xs font-mono text-center shrink-0"/>
        <input type="number" value={item.quantity} onChange={e=>onUpdate({quantity:Number(e.target.value)})} min={0}
          className="h-9 w-14 px-2 rounded-lg bg-white border-2 border-brand-choco/8 focus:border-brand-orange outline-none text-sm font-bold text-center shrink-0"/>
        <span className="text-[10px] font-semibold text-brand-choco-soft w-8 shrink-0">{item.unit}</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-brand-choco-soft">₹</span>
          <input type="number" value={item.rate} onChange={e=>onUpdate({rate:Number(e.target.value)})} min={0} step={0.01}
            className="h-9 w-20 px-2 rounded-lg bg-white border-2 border-brand-choco/8 focus:border-brand-orange outline-none text-sm font-bold text-center"/>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" title="Disc%">
          <input type="number" value={item.discountPercent} onChange={e=>onUpdate({discountPercent:Number(e.target.value)})} min={0} max={100} step={0.01}
            className="h-9 w-12 px-2 rounded-lg bg-white border-2 border-brand-choco/8 focus:border-brand-orange outline-none text-xs text-center"/>
          <span className="text-xs text-brand-choco-soft">%</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" title="GST%">
          <input type="number" value={item.gstPercent} onChange={e=>onUpdate({gstPercent:Number(e.target.value)})} min={0} max={100} step={0.01}
            className="h-9 w-12 px-2 rounded-lg bg-brand-orange-50 border-2 border-brand-orange/30 focus:border-brand-orange outline-none text-xs font-bold text-center text-brand-orange"/>
          <span className="text-xs text-brand-orange font-bold">%</span>
        </div>
        <div className="text-right shrink-0 w-24">
          <p className="text-[9px] font-bold uppercase text-brand-choco-soft">Total</p>
          <p className="text-sm font-bold text-brand-orange">{formatINR(item.amount)}</p>
        </div>
        <button type="button" onClick={onRemove} className="w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center transition shrink-0">
          <Trash2 className="w-4 h-4"/>
        </button>
      </div>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────
function SH({ icon:Icon, title, sub }: { icon:React.ComponentType<{className?:string}>; title:string; sub:string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand-orange-100 flex items-center justify-center"><Icon className="w-5 h-5 text-brand-orange"/></div>
      <div><h3 className="font-display font-bold text-base">{title}</h3><p className="text-xs text-brand-choco-soft">{sub}</p></div>
    </div>
  );
}
function Field({ label, error, required, children }: { label:string; error?:string; required?:boolean; children:React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-brand-choco-soft mb-1.5">
        {label}{required&&<span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error&&<p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{error}</p>}
    </div>
  );
}
function Row64({ label, value }: { label:string; value:string }) {
  return (
    <div className="flex justify-between w-64 font-semibold text-brand-choco-soft">
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
function Stat({ label, value, hint, hi }: { label:string; value:string; hint:string; hi?:boolean }) {
  return (
    <div className={cn('p-3 rounded-xl border-2', hi?'bg-purple-200/60 border-purple-400':'bg-white border-purple-200')}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-purple-800">{label}</p>
      <p className={cn('font-display font-bold text-base mt-0.5', hi?'text-purple-900':'text-purple-800')}>{value}</p>
      <p className="text-[9px] text-purple-700/70 mt-0.5">{hint}</p>
    </div>
  );
}
function r2(n: number): number { return Math.round(n*100)/100; }