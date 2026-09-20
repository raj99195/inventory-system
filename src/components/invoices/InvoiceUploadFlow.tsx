import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Package,
  Search,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  IndianRupee,
  Calendar,
  Hash,
  User,
  Building2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parseZohoInvoice, type ParsedInvoice } from '@/lib/pdfParser';
import {
  createPendingInvoice,
  processInvoice,
  checkDuplicate,
} from '@/hooks/useInvoices';
import { useProducts } from '@/hooks/useProducts';
import type { Invoice, InvoiceLineItem, Product } from '@/types';
import { cn, formatINR } from '@/lib/utils';

interface Props {
  onClose: () => void;
}

type Step = 'upload' | 'verify' | 'success';

interface VerifiedItem extends InvoiceLineItem {
  matchedProductId?: string;
  matchStatus: 'auto' | 'manual' | 'none';
  editing?: boolean;
}

export default function InvoiceUploadFlow({ onClose }: Props) {
  const { products } = useProducts();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null);
  const [duplicate, setDuplicate] = useState<Invoice | null>(null);

  // Editable fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [subTotal, setSubTotal] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);

  const [items, setItems] = useState<VerifiedItem[]>([]);
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [directionReason, setDirectionReason] = useState<string>('');
  const [directionOverridden, setDirectionOverridden] = useState(false);
  const [processing, setProcessing] = useState(false);

  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  const autoMatch = (name: string): Product | undefined => {
    const q = name.toLowerCase().trim();
    let match = products.find(
      (p) => p.name.toLowerCase() === q || p.sku.toLowerCase() === q
    );
    if (match) return match;
    match = products.find(
      (p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase())
    );
    return match;
  };

  const handleFile = async (f: File) => {
    if (f.type !== 'application/pdf' && !f.name.endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('PDF too large (max 5MB)');
      return;
    }

    setFile(f);
    setParsing(true);
    try {
      const result = await parseZohoInvoice(f);

      // Check duplicate
      if (result.invoiceNumber) {
        const dup = await checkDuplicate(result.invoiceNumber);
        setDuplicate(dup);
      }

      // Auto-match items
      const verifiedItems: VerifiedItem[] = result.lineItems.map((li) => {
        const matched = autoMatch(li.productName);
        return {
          ...li,
          matchedProductId: matched?.id,
          matchStatus: matched ? 'auto' : 'none',
        };
      });

      setParsed(result);
      setInvoiceNumber(result.invoiceNumber);
      setInvoiceDate(result.invoiceDate);
      setCustomerName(result.customerName ?? '');
      setCustomerGstin(result.customerGstin ?? '');
      setTotalAmount(result.totalAmount);
      setSubTotal(result.subTotal);
      setTaxAmount(result.taxAmount);

      // 🎯 Auto-set direction from detection
      setDirection(result.detectedDirection);
      setDirectionReason(result.directionReason);
      setDirectionOverridden(false);

      setItems(verifiedItems);
      setStep('verify');

      if (result.lineItems.length === 0) {
        toast.error('Could not extract line items. Please add manually.', {
          duration: 5000,
        });
      } else {
        const dirLabel = result.detectedDirection === 'in' ? 'Purchase' : 'Sale';
        toast.success(
          `Extracted ${result.lineItems.length} items · Detected as ${dirLabel}`,
          { duration: 4000 }
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF parsing failed');
    } finally {
      setParsing(false);
    }
  };

  const handleDirectionChange = (newDir: 'in' | 'out') => {
    setDirection(newDir);
    if (parsed && newDir !== parsed.detectedDirection) {
      setDirectionOverridden(true);
    } else {
      setDirectionOverridden(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<VerifiedItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addBlankItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productName: '',
        quantity: 1,
        rate: 0,
        amount: 0,
        matchStatus: 'none',
        editing: true,
      },
    ]);
  };

  const matchedCount = items.filter((i) => i.matchedProductId).length;
  const unmatchedCount = items.length - matchedCount;

  const handleConfirm = async () => {
    if (!invoiceNumber) return toast.error('Invoice number required');
    if (items.length === 0) return toast.error('No line items');
    if (matchedCount === 0)
      return toast.error('Match at least one product to continue');

    if (duplicate) {
      const confirm = window.confirm(
        `Invoice ${invoiceNumber} already processed on ${new Date(
          duplicate.uploadedAt?.toDate?.() ?? Date.now()
        ).toLocaleDateString()}. Process again anyway?`
      );
      if (!confirm) return;
    }

    setProcessing(true);
    try {
      // Save invoice first
      const invoiceId = await createPendingInvoice({
        invoiceNumber,
        invoiceDate,
        customerName,
        customerGstin,
        totalAmount,
        lineItems: items.map((it) => ({
          productName: it.productName,
          sku: it.sku,
          matchedProductId: it.matchedProductId,
          quantity: it.quantity,
          rate: it.rate,
          discount: it.discount,
          gstPercent: it.gstPercent,
          amount: it.amount,
        })),
        rawText: parsed?.rawText,
      });

      // Now process stock updates
      const dummyInvoice: Invoice = {
        id: invoiceId,
        invoiceNumber,
        invoiceDate,
        customerName,
        totalAmount,
        lineItems: items.map((it) => ({
          productName: it.productName,
          matchedProductId: it.matchedProductId,
          quantity: it.quantity,
          rate: it.rate,
          amount: it.amount,
        })),
        status: 'pending-verification',
        uploadedAt: null as unknown as Invoice['uploadedAt'],
        uploadedBy: '',
      };
      await processInvoice(dummyInvoice, direction, productMap);
      setStep('success');
      toast.success('Invoice processed & stock updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {(['upload', 'verify', 'success'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                step === s
                  ? 'bg-brand-orange text-white'
                  : ['upload', 'verify', 'success'].indexOf(step) > i
                  ? 'bg-pastel-green text-green-800'
                  : 'bg-brand-cream-dark text-brand-choco-soft'
              )}
            >
              {['upload', 'verify', 'success'].indexOf(step) > i ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                i + 1
              )}
            </div>
            <div className="text-xs font-bold capitalize hidden sm:block">{s}</div>
            {i < 2 && (
              <div
                className={cn(
                  'flex-1 h-0.5 rounded-full',
                  ['upload', 'verify', 'success'].indexOf(step) > i
                    ? 'bg-pastel-green-deep'
                    : 'bg-brand-cream-dark'
                )}
              />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-brand-orange/30 rounded-3xl p-12 text-center bg-brand-cream-dark/30 hover:bg-brand-cream-dark/60 transition">
                {parsing ? (
                  <>
                    <Loader2 className="w-14 h-14 text-brand-orange mx-auto mb-4 animate-spin" />
                    <p className="font-bold text-lg">Parsing PDF...</p>
                    <p className="text-sm text-brand-choco-soft mt-1">
                      Extracting invoice data & detecting direction
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-orange-light to-brand-orange flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <Upload className="w-10 h-10 text-white" />
                    </div>
                    <p className="font-display text-2xl font-bold">
                      Upload Invoice PDF
                    </p>
                    <p className="text-brand-choco-soft mt-2">
                      Click here or drop your PDF file
                    </p>
                    <p className="text-xs text-brand-choco-soft mt-4">
                      Max 5MB · Auto-detects Sale vs Purchase · Products auto-matched
                    </p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={parsing}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>

            <div className="mt-6 p-4 rounded-2xl bg-pastel-blue border border-pastel-blue-deep/30">
              <div className="flex gap-3">
                <Sparkles className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-blue-900">How it works</p>
                  <ol className="text-blue-800 mt-1 space-y-0.5 list-decimal list-inside">
                    <li>Upload PDF — data extracted automatically</li>
                    <li>System detects Sale/Purchase from seller/buyer info</li>
                    <li>Review extracted fields & match to your products</li>
                    <li>Confirm — stock updates atomically with full audit</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={onClose} className="btn-secondary">
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Verify */}
        {step === 'verify' && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-5"
          >
            {duplicate && (
              <div className="p-4 rounded-2xl bg-pastel-pink border border-pastel-pink-deep/40 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-red-900">Duplicate Invoice</p>
                  <p className="text-red-800 mt-0.5">
                    Invoice <strong>{invoiceNumber}</strong> was already processed.
                    Processing again will apply stock changes twice.
                  </p>
                </div>
              </div>
            )}

            {/* 🎯 AUTO-DETECTION BANNER */}
            {directionReason && (
              <div
                className={cn(
                  'p-4 rounded-2xl border-2 flex items-start gap-3',
                  directionOverridden
                    ? 'bg-pastel-peach/50 border-pastel-peach-deep/40'
                    : direction === 'in'
                    ? 'bg-pastel-green/50 border-pastel-green-deep/40'
                    : 'bg-pastel-blue/50 border-pastel-blue-deep/40'
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    directionOverridden
                      ? 'bg-orange-100'
                      : direction === 'in'
                      ? 'bg-green-100'
                      : 'bg-blue-100'
                  )}
                >
                  <Target
                    className={cn(
                      'w-5 h-5',
                      directionOverridden
                        ? 'text-orange-700'
                        : direction === 'in'
                        ? 'text-green-700'
                        : 'text-blue-700'
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">
                    {directionOverridden ? (
                      <>
                        Manually set to:{' '}
                        <span className="text-brand-orange">
                          {direction === 'in' ? 'Purchase (Stock In)' : 'Sale (Stock Out)'}
                        </span>
                      </>
                    ) : (
                      <>
                        Auto-detected:{' '}
                        <span
                          className={
                            direction === 'in' ? 'text-green-800' : 'text-blue-800'
                          }
                        >
                          {direction === 'in' ? 'Purchase (Stock In)' : 'Sale (Stock Out)'}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-brand-choco-soft mt-0.5">
                    {directionOverridden
                      ? `Auto-detection said: ${direction === 'in' ? 'Sale' : 'Purchase'} · You changed it manually`
                      : directionReason}
                  </p>
                </div>
              </div>
            )}

            {file && (
              <div className="p-3 rounded-2xl bg-brand-cream-dark/50 flex items-center gap-3 text-sm">
                <FileText className="w-4 h-4 text-brand-orange" />
                <span className="font-semibold flex-1 truncate">{file.name}</span>
                <span className="text-xs text-brand-choco-soft">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )}

            {/* Header fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow icon={Hash} label="Invoice Number" required>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="input-field"
                />
              </FieldRow>
              <FieldRow icon={Calendar} label="Invoice Date">
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="input-field"
                />
              </FieldRow>
              <FieldRow icon={User} label="Customer Name">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="input-field"
                />
              </FieldRow>
              <FieldRow icon={Building2} label="Customer GSTIN">
                <input
                  type="text"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value)}
                  className="input-field"
                />
              </FieldRow>
              <FieldRow icon={IndianRupee} label="Total Amount">
                <input
                  type="number"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(+e.target.value)}
                  className="input-field"
                />
              </FieldRow>
              <FieldRow label="Stock Direction">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDirectionChange('out')}
                    className={cn(
                      'py-2.5 rounded-2xl text-xs font-bold uppercase transition-all inline-flex items-center justify-center gap-2',
                      direction === 'out'
                        ? 'bg-pastel-blue text-blue-800'
                        : 'bg-brand-cream-dark text-brand-choco-soft'
                    )}
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                    Stock Out (Sale)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectionChange('in')}
                    className={cn(
                      'py-2.5 rounded-2xl text-xs font-bold uppercase transition-all inline-flex items-center justify-center gap-2',
                      direction === 'in'
                        ? 'bg-pastel-green text-green-800'
                        : 'bg-brand-cream-dark text-brand-choco-soft'
                    )}
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    Stock In (Purchase)
                  </button>
                </div>
              </FieldRow>
            </div>

            {/* Match summary */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 h-2 rounded-full bg-brand-cream-dark overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pastel-green-deep to-green-500 transition-all"
                  style={{
                    width: `${items.length ? (matchedCount / items.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-sm font-bold">
                {matchedCount} of {items.length} matched
              </p>
              {unmatchedCount > 0 && (
                <span className="badge badge-warning">
                  {unmatchedCount} unmatched
                </span>
              )}
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-choco-soft">
                  Line Items
                </p>
                <button
                  type="button"
                  onClick={addBlankItem}
                  className="text-xs font-bold text-brand-orange hover:underline"
                >
                  + Add line item
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-brand-cream-dark/50 text-center">
                    <p className="text-sm text-brand-choco-soft">
                      No line items extracted. Click "Add line item" to add manually.
                    </p>
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <LineItemRow
                      key={idx}
                      item={item}
                      products={products}
                      onUpdate={(patch) => updateItem(idx, patch)}
                      onRemove={() => removeItem(idx)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 🚀 SUMMARY BLOCK (Sub Total, GST, Grand Total) */}
            {items.length > 0 && (
              <div className="flex flex-col items-end gap-1.5 py-4 border-t border-brand-choco/8 text-sm mt-4">
                <div className="flex justify-between w-56 font-semibold text-brand-choco-soft">
                  <span>Sub Total:</span>
                  <span>{formatINR(subTotal)}</span>
                </div>
                <div className="flex justify-between w-56 font-semibold text-brand-choco-soft">
                  <span>GST / Tax Amount:</span>
                  <span>{formatINR(taxAmount)}</span>
                </div>
                <div className="flex justify-between w-56 font-bold text-brand-orange text-lg pt-1.5 border-t border-brand-choco/10">
                  <span>Grand Total:</span>
                  <span>{formatINR(totalAmount)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-brand-choco/8 sticky bottom-0 bg-white -mx-6 px-6 pb-2">
              <button
                onClick={() => {
                  setStep('upload');
                  setParsed(null);
                  setItems([]);
                }}
                disabled={processing}
                className="btn-secondary"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={processing || matchedCount === 0}
                className="btn-primary flex-1 disabled:opacity-60"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Confirm & Update Stock
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Success */}
        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className="w-24 h-24 rounded-3xl bg-pastel-green flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle2 className="w-14 h-14 text-green-700" />
            </motion.div>
            <h2 className="font-display text-3xl font-bold">Invoice Processed!</h2>
            <p className="text-brand-choco-soft mt-2">
              Invoice <strong>{invoiceNumber}</strong> was verified and stock levels
              were {direction === 'in' ? 'increased' : 'decreased'} for{' '}
              {matchedCount} product{matchedCount > 1 ? 's' : ''}.
            </p>
            <button onClick={onClose} className="btn-primary mt-6">
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FieldRow({
  icon: Icon,
  label,
  required,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold mb-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-brand-choco-soft" />}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function LineItemRow({
  item,
  products,
  onUpdate,
  onRemove,
}: {
  item: VerifiedItem;
  products: Product[];
  onUpdate: (patch: Partial<VerifiedItem>) => void;
  onRemove: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const matched = item.matchedProductId
    ? products.find((p) => p.id === item.matchedProductId)
    : null;

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    if (!q) return products.filter((p) => p.status === 'active').slice(0, 10);
    return products
      .filter(
        (p) =>
          p.status === 'active' &&
          (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [products, productSearch]);

  return (
    <div
      className={cn(
        'p-3 rounded-2xl border-2 transition-all',
        item.matchedProductId
          ? 'bg-pastel-green/40 border-pastel-green-deep/40'
          : 'bg-pastel-pink/40 border-pastel-pink-deep/40'
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-[2fr_60px_100px_100px_auto] gap-2 items-center">
        {/* Product name + match */}
        <div className="min-w-0">
          <input
            type="text"
            value={item.productName}
            onChange={(e) =>
              onUpdate({
                productName: e.target.value,
                matchStatus: 'none',
                matchedProductId: undefined,
              })
            }
            className="w-full px-3 py-1.5 rounded-lg bg-white text-sm font-semibold border border-transparent focus:border-brand-orange outline-none"
            placeholder="Product name"
          />
          {matched ? (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-green-800">
              <CheckCircle2 className="w-3 h-3" />
              <span className="font-semibold truncate">
                → {matched.sku} · {matched.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  onUpdate({ matchedProductId: undefined, matchStatus: 'none' });
                  setSearching(true);
                }}
                className="text-brand-choco-soft hover:text-brand-orange ml-1"
              >
                change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearching(!searching)}
              className="mt-1 text-xs font-bold text-red-700 hover:underline flex items-center gap-1"
            >
              <Search className="w-3 h-3" />
              {searching ? 'Cancel' : 'Match product'}
            </button>
          )}
        </div>

        <input
          type="number"
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: +e.target.value })}
          className="w-full px-2 py-1.5 rounded-lg bg-white text-sm text-center border border-transparent focus:border-brand-orange outline-none"
          placeholder="Qty"
        />
        <input
          type="number"
          step="0.01"
          value={item.rate}
          onChange={(e) => onUpdate({ rate: +e.target.value })}
          className="w-full px-2 py-1.5 rounded-lg bg-white text-sm text-right border border-transparent focus:border-brand-orange outline-none"
          placeholder="Rate"
        />
        <input
          type="number"
          step="0.01"
          value={item.amount}
          onChange={(e) => onUpdate({ amount: +e.target.value })}
          className="w-full px-2 py-1.5 rounded-lg bg-white text-sm text-right font-bold border border-transparent focus:border-brand-orange outline-none"
          placeholder="Amount"
        />
        <button
          type="button"
          onClick={onRemove}
          className="w-8 h-8 rounded-lg bg-white hover:bg-red-100 text-red-600 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Product picker */}
      {searching && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-2 bg-white rounded-xl p-2 border border-brand-choco/8"
        >
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-choco-soft" />
            <input
              autoFocus
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-brand-cream-dark text-sm outline-none"
              placeholder="Search products..."
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredProducts.length === 0 ? (
              <p className="text-xs text-brand-choco-soft text-center py-2">
                No products found
              </p>
            ) : (
              filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onUpdate({
                      matchedProductId: p.id,
                      matchStatus: 'manual',
                    });
                    setSearching(false);
                    setProductSearch('');
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-brand-cream-dark text-left transition"
                >
                  <Package className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-brand-orange">{p.sku}</p>
                  </div>
                  <p className="text-xs text-brand-choco-soft">
                    Stock: {p.currentStock}
                  </p>
                </button>
              ))
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}