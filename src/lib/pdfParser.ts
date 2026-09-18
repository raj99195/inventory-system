import * as pdfjsLib from 'pdfjs-dist';

// Use URL constructor — works in Vite without vite-specific ?url import syntax
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ParsedLineItem {
  serialNo: number;
  productName: string;
  sku: string;
  hsn: string;
  quantity: number;
  rate: number;
  discount: number;
  gstPercent: number;
  amount: number;
}

export interface ParsedInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerGstin: string;
  lineItems: ParsedLineItem[];
  totalAmount: number;
  subTotal: number;
  taxAmount: number;
  rawText: string;
}

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

function toLocalISODate(dt: Date): string {
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function extractText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: PositionedItem[] = (
      content.items as Array<{ str: string; transform: number[]; width?: number }>
    )
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width ?? it.str.length * 4,
      }));

    const rows: PositionedItem[][] = [];
    const Y_TOLERANCE = 3;
    for (const it of items) {
      let placed = false;
      for (const row of rows) {
        if (Math.abs(row[0].y - it.y) <= Y_TOLERANCE) {
          row.push(it);
          placed = true;
          break;
        }
      }
      if (!placed) rows.push([it]);
    }
    rows.sort((a, b) => b[0].y - a[0].y);
    for (const row of rows) row.sort((a, b) => a.x - b.x);

    for (const row of rows) {
      let line = '';
      for (let i = 0; i < row.length; i++) {
        const it = row[i];
        if (i === 0) {
          line += it.str;
        } else {
          const prev = row[i - 1];
          const gap = it.x - (prev.x + prev.width);
          const charWidth = Math.max(2, prev.width / Math.max(1, prev.str.length));
          const gapChars = Math.max(1, Math.round(gap / charWidth));
          if (gapChars >= 4) {
            line += ' '.repeat(Math.min(gapChars, 20)) + it.str;
          } else {
            line += ' ' + it.str;
          }
        }
      }
      fullText += line + '\n';
    }
    fullText += '\n';
  }
  return fullText;
}

function extractInvoiceNumber(text: string, lines: string[]): string {
  for (const line of lines) {
    const m = line.match(
      /Invoice\s*(?:No|Number|#)\.?\s*:?\s*([A-Z][A-Z0-9][A-Z0-9\-\/]*)/i
    );
    if (m) {
      const num = m[1].split(/\s+/)[0].trim();
      if (num.length > 2 && /\d/.test(num)) return num;
    }
  }
  const m = text.match(
    /Invoice\s*(?:No|Number|#)\.?\s*:\s*([A-Z0-9][A-Z0-9\-\/]{2,})/i
  );
  return m ? m[1].split(/\s+/)[0].trim() : '';
}

function extractInvoiceDate(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(
      /Invoice\s*Date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    );
    if (m) {
      const parts = m[1].split(/[\/\-]/);
      if (parts.length === 3) {
        const [d, mo, y] = parts.map((p) => parseInt(p, 10));
        const year = y < 100 ? 2000 + y : y;
        const dt = new Date(year, mo - 1, d);
        if (!isNaN(dt.getTime())) return toLocalISODate(dt);
      }
    }
  }
  for (const line of lines) {
    if (/Date/i.test(line)) {
      const m = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
      if (m) {
        const parts = m[1].split(/[\/\-]/);
        const [d, mo, y] = parts.map((p) => parseInt(p, 10));
        const year = y < 100 ? 2000 + y : y;
        const dt = new Date(year, mo - 1, d);
        if (!isNaN(dt.getTime())) return toLocalISODate(dt);
      }
    }
  }
  return toLocalISODate(new Date());
}

function extractCustomerNameAndGstin(
  text: string,
  lines: string[]
): { name: string; gstin: string } {
  let name = '';
  let gstin = '';

  const gstinRegex = /\b(\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z0-9])\b/g;
  const gstins: { value: string; index: number }[] = [];
  let g;
  while ((g = gstinRegex.exec(text)) !== null) {
    gstins.push({ value: g[1], index: g.index });
  }

  const billToIdx = text.search(/Bill\s*To/i);
  if (billToIdx >= 0) {
    const afterBillTo = gstins.filter((gg) => gg.index > billToIdx);
    if (afterBillTo.length > 0) gstin = afterBillTo[0].value;
  }
  if (!gstin && gstins.length >= 2) gstin = gstins[1].value;
  else if (!gstin && gstins.length === 1) gstin = gstins[0].value;

  for (let i = 0; i < lines.length; i++) {
    if (/Bill\s*To/i.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        let candidate = lines[j].trim();
        if (!candidate) continue;
        if (/^(Ship\s*To|Address|GSTIN|India|First\s+Floor|Total|Sub|Grand)/i.test(candidate)) {
          continue;
        }
        const parts = candidate.split(/\s{3,}/);
        candidate = parts[0].trim();
        if (candidate.length < 3 || /^\d/.test(candidate)) continue;
        name = candidate.replace(/\s+/g, ' ').trim();
        break;
      }
      break;
    }
  }

  return { name, gstin };
}

function extractTotalAmount(text: string): { total: number; subTotal: number; tax: number } {
  let total = 0;
  let subTotal = 0;
  let tax = 0;

  const rupeeMatch = text.match(/(?:Grand\s+)?Total\s*₹\s*([\d,]+\.?\d*)/i);
  if (rupeeMatch) {
    const n = parseFloat(rupeeMatch[1].replace(/,/g, ''));
    if (!isNaN(n)) total = n;
  }

  if (!total) {
    const grandMatch = text.match(
      /(?:Grand\s*Total|Amount\s*Payable)\s*[:\-]?\s*₹?\s*([\d,]+\.?\d*)/i
    );
    if (grandMatch) {
      const n = parseFloat(grandMatch[1].replace(/,/g, ''));
      if (!isNaN(n)) total = n;
    }
  }

  if (!total) {
    const totalMatches = [
      ...text.matchAll(/(?:^|\s)Total\s*[:\-₹]?\s*([\d,]+\.?\d{1,2})/gim),
    ];
    if (totalMatches.length > 0) {
      const filtered = totalMatches.filter((m) => {
        const idx = m.index ?? 0;
        const before = text.slice(Math.max(0, idx - 20), idx);
        return !/Sub\s*$/i.test(before);
      });
      const source = filtered.length > 0 ? filtered : totalMatches;
      const last = source[source.length - 1];
      const n = parseFloat(last[1].replace(/,/g, ''));
      if (!isNaN(n)) total = n;
    }
  }

  const subMatch = text.match(/Sub\s*Total\s*[:\-]?\s*₹?\s*([\d,]+\.?\d*)/i);
  if (subMatch) {
    const n = parseFloat(subMatch[1].replace(/,/g, ''));
    if (!isNaN(n)) subTotal = n;
  }

  const taxMatch = text.match(/(?:IGST|CGST|SGST|Tax)[\d\s\(\)%]*\s*([\d,]+\.?\d{1,2})/i);
  if (taxMatch) {
    const n = parseFloat(taxMatch[1].replace(/,/g, ''));
    if (!isNaN(n)) tax = n;
  }

  return { total, subTotal, tax };
}

function extractLineItems(lines: string[]): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];

  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      startIdx < 0 &&
      /Sr\.?\s*No\.?|S\.?\s*No\.?/i.test(line) &&
      /(Item|Description)/i.test(line) &&
      /(Qty|Rate|Amount)/i.test(line)
    ) {
      startIdx = i + 1;
      continue;
    }
    if (startIdx > 0 && (/Sub\s*Total/i.test(line) || /Total\s*In\s*Words/i.test(line))) {
      endIdx = i;
      break;
    }
  }

  if (startIdx < 0) {
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*1\s+[A-Za-z]/.test(lines[i]) && /\d+\.\d+/.test(lines[i])) {
        startIdx = i;
        break;
      }
    }
  }

  if (startIdx < 0) return items;

  const zohoRegex =
    /^\s*(\d{1,3})\s+(.+?)\s+(\d{4,10})\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*%?\s+(\d+)\s*%?\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*$/;

  const simpleRegex =
    /^\s*(\d{1,3})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*$/;

  const isNoise = (s: string) =>
    !s ||
    /^(pcs|nos|kg|gm|ltr|ml|mtr|set|pair|box|units?)$/i.test(s) ||
    /^[\d,\.\s%₹\-]+$/.test(s) ||
    /^(HSN|Code|Qty|Rate|Amount|Sr|IGST|CGST|SGST|Item|Description|Discount)/i.test(s);

  const isRepeatedHeader = (s: string) =>
    /Sr\.?\s*No\.?/i.test(s) && /Item/i.test(s) && /(Qty|Rate|Amount)/i.test(s);

  let currentItem: ParsedLineItem | null = null;

  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (isRepeatedHeader(line)) continue;

    let m = line.match(zohoRegex);
    if (m) {
      if (currentItem) items.push(currentItem);
      currentItem = {
        serialNo: parseInt(m[1], 10),
        productName: m[2].trim(),
        sku: '',
        hsn: m[3] ?? '',
        quantity: parseFloat(m[4].replace(/,/g, '')) || 0,
        rate: parseFloat(m[5].replace(/,/g, '')) || 0,
        discount: parseFloat(m[6].replace(/,/g, '')) || 0,
        gstPercent: parseInt(m[7], 10) || 0,
        amount: parseFloat(m[9].replace(/,/g, '')) || 0,
      };
      continue;
    }

    m = line.match(simpleRegex);
    if (m) {
      const qty = parseFloat(m[3].replace(/,/g, ''));
      const rate = parseFloat(m[4].replace(/,/g, ''));
      const amt = parseFloat(m[5].replace(/,/g, ''));
      if (qty > 0 && rate > 0 && amt > 0) {
        const expected = qty * rate;
        if (Math.abs(expected - amt) / expected < 0.6) {
          if (currentItem) items.push(currentItem);
          currentItem = {
            serialNo: parseInt(m[1], 10),
            productName: m[2].trim(),
            sku: '',
            hsn: '',
            quantity: qty,
            rate,
            discount: 0,
            gstPercent: 0,
            amount: amt,
          };
          continue;
        }
      }
    }

    if (currentItem) {
      const trimmed = line.trim();
      if (isNoise(trimmed)) continue;
      const cleaned = trimmed
        .replace(/\s+(pcs|nos|kg|gm|ltr|ml|mtr|set|pair|box)\s*$/i, '')
        .replace(/\s+[\d,\.]+\s*%?\s*$/, '')
        .trim();
      if (cleaned && cleaned.length > 2 && cleaned.length < 200) {
        currentItem.productName += ' ' + cleaned;
      }
    }
  }

  if (currentItem) items.push(currentItem);
  return items;
}

export async function parseZohoInvoice(file: File): Promise<ParsedInvoice> {
  const rawText = await extractText(file);
  const lines = rawText.split('\n');

  const invoiceNumber = extractInvoiceNumber(rawText, lines);
  const invoiceDate = extractInvoiceDate(lines);
  const { name: customerName, gstin: customerGstin } = extractCustomerNameAndGstin(
    rawText,
    lines
  );
  const { total: totalAmount, subTotal, tax: taxAmount } = extractTotalAmount(rawText);
  const lineItems = extractLineItems(lines);

  return {
    invoiceNumber,
    invoiceDate,
    customerName,
    customerGstin,
    lineItems,
    totalAmount,
    subTotal,
    taxAmount,
    rawText,
  };
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}
