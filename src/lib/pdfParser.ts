import * as pdfjsLib from 'pdfjs-dist';

// Use URL constructor — works in Vite without vite-specific ?url import syntax
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// ============================================================================
// 🏢 OWN COMPANY IDENTIFIERS — used to auto-detect Sale vs Purchase
// ============================================================================
const OWN_COMPANY = {
  gstins: ['09ABKCS7831H1ZV'],
  nameKeywords: [
    'stemmantra',
    'stem mantra',
    'stemmantra technologies',
    'stemmantra technologies pvt ltd',
    'stemmantra technologies private limited',
  ],
};

export interface ParsedLineItem {
  serialNo: number;
  productName: string;
  sku: string;
  hsn: string;
  quantity: number;
  rate: number;
  discount: number;
  gstPercent: number;
  taxAmount: number;
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
  detectedDirection: 'in' | 'out';
  directionReason: string;
  rawText: string;
}

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

interface GstinRef {
  value: string;
  index: number;
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
      /Invoice\s*(?:No|Number|Bill\s*No|#)\.?\s*:?\s*([A-Z0-9][A-Z0-9\-\/]{2,})/i
    );
    if (m) {
      const num = m[1].split(/\s+/)[0].trim();
      if (num.length > 2) return num;
    }
  }
  const m = text.match(
    /Invoice\s*(?:No|Number|Bill\s*No|#)\.?\s*:\s*([A-Z0-9][A-Z0-9\-\/]{2,})/i
  );
  return m ? m[1].split(/\s+/)[0].trim() : '';
}

function extractInvoiceDate(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(
      /(?:Invoice\s*Date|Bill\s*Date|Dated)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
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

function collectGstins(text: string): GstinRef[] {
  const gstinRegex = /\b(\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z0-9])\b/g;
  const gstins: GstinRef[] = [];
  let g;
  while ((g = gstinRegex.exec(text)) !== null) {
    gstins.push({ value: g[1], index: g.index });
  }
  return gstins;
}

function detectDirection(text: string): {
  direction: 'in' | 'out';
  reason: string;
  separatorIdx: number;
} {
  const hasOwn = (chunk: string): boolean => {
    const lower = chunk.toLowerCase();
    return (
      OWN_COMPANY.gstins.some((gs) => chunk.includes(gs)) ||
      OWN_COMPANY.nameKeywords.some((k) => lower.includes(k))
    );
  };

  const separatorMatch = text.match(
    /(Bill\s*To|Billed\s*To|Party\s*Details|Buyer|Consignee|Ship\s*To)/i
  );

  const separatorIdx =
    separatorMatch && separatorMatch.index !== undefined ? separatorMatch.index : -1;

  if (separatorIdx >= 0) {
    const topSection = text.slice(0, separatorIdx);
    const bottomSection = text.slice(separatorIdx);

    const inTop = hasOwn(topSection);
    const inBottom = hasOwn(bottomSection);

    if (inTop && !inBottom) {
      return {
        direction: 'out',
        reason: 'Stemmantra is the seller — this is a Sale',
        separatorIdx,
      };
    }
    if (inBottom && !inTop) {
      return {
        direction: 'in',
        reason: 'Stemmantra is the buyer — this is a Purchase',
        separatorIdx,
      };
    }
    if (inTop && inBottom) {
      return {
        direction: 'out',
        reason: 'Stemmantra appears as both seller & buyer — defaulting to Sale',
        separatorIdx,
      };
    }
  } else {
    const topPortion = text.slice(0, Math.floor(text.length * 0.4));
    if (hasOwn(topPortion)) {
      return { direction: 'out', reason: 'Stemmantra appears as seller', separatorIdx };
    }
  }

  return {
    direction: 'in',
    reason: 'Stemmantra not detected as seller — assuming this is a Purchase',
    separatorIdx,
  };
}

function extractCustomerNameAndGstin(
  text: string,
  lines: string[],
  direction: 'in' | 'out',
  separatorIdx: number,
  gstins: GstinRef[]
): { name: string; gstin: string } {
  if (direction === 'in') {
    return extractSeller(text, lines, separatorIdx, gstins);
  }
  return extractBuyer(lines, gstins, separatorIdx);
}

function extractSeller(
  _text: string,
  lines: string[],
  separatorIdx: number,
  gstins: GstinRef[]
): { name: string; gstin: string } {
  let gstin = '';
  if (separatorIdx > 0) {
    const beforeSep = gstins.filter((g) => g.index < separatorIdx);
    const nonOwn = beforeSep.find((g) => !OWN_COMPANY.gstins.includes(g.value));
    gstin = nonOwn?.value ?? beforeSep[0]?.value ?? '';
  }
  if (!gstin) {
    const nonOwn = gstins.find((g) => !OWN_COMPANY.gstins.includes(g.value));
    gstin = nonOwn?.value ?? gstins[0]?.value ?? '';
  }

  const topLines = lines.slice(0, 25);
  let name = '';

  const skipPatterns: RegExp[] = [
    /^(Customer\s+Copy|Original|Duplicate|Copy|INVOICE|TAX\s+INVOICE|PROFORMA)/i,
    /^(GSTIN|UDYAM|CIN|PAN)\b/i,
    /^(Tel|Phone|Fax|Mobile|Email|E-?mail|Website|Online\s+Store|Contact)/i,
    /^(Invoice\s+No|Dated|Place\s+of\s+Supply|Reverse\s+Charge|GR\/RR|Transport|Vehicle|Station|E-?Way|Payment\s+Mode|Collected\s+By|Due\s+Date|IRN|Ack)/i,
    /^(Billed\s+to|Shipped\s+to|Bill\s+To|Ship\s+To|Party\s+Details|Buyer|Consignee|Receiver|RECEIVER)/i,
    /^(Redg|Registered|Address|Regd)\b/i,
  ];

  for (const line of topLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (skipPatterns.some((p) => p.test(trimmed))) continue;
    if (/\b\d{6}\b/.test(trimmed)) continue;
    if (/^\d/.test(trimmed)) continue;
    if (OWN_COMPANY.nameKeywords.some((k) => trimmed.toLowerCase().includes(k))) continue;
    if (!/[a-zA-Z]{3,}/.test(trimmed)) continue;
    if (trimmed.length < 3 || trimmed.length > 100) continue;

    const firstPart = trimmed.split(/\s{2,}/)[0].trim();
    if (firstPart.length < 3) continue;

    name = firstPart.replace(/\s+/g, ' ').trim();
    break;
  }

  return { name, gstin };
}

function extractBuyer(
  lines: string[],
  gstins: GstinRef[],
  separatorIdx: number
): { name: string; gstin: string } {
  let gstin = '';
  if (separatorIdx >= 0) {
    const afterSep = gstins.filter((g) => g.index > separatorIdx);
    const nonOwn = afterSep.find((g) => !OWN_COMPANY.gstins.includes(g.value));
    gstin = nonOwn?.value ?? afterSep[0]?.value ?? '';
  }
  if (!gstin) {
    const nonOwn = gstins.find((g) => !OWN_COMPANY.gstins.includes(g.value));
    gstin = nonOwn?.value ?? gstins[0]?.value ?? '';
  }

  let name = '';
  for (let i = 0; i < lines.length; i++) {
    if (/(Bill\s*To|Billed\s*To|Party\s*Details|Buyer|Consignee)/i.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        let candidate = lines[j].trim();
        if (!candidate) continue;
        if (
          /^(Ship\s*To|Shipped\s*to|Address|GSTIN|India|First\s+Floor|Second\s+Floor|Ground\s+Floor|Total|Sub|Grand|Invoice|Dated|Village|Tehsil|C[-\s]?\d)/i.test(
            candidate
          )
        ) {
          continue;
        }
        if (/\b\d{6}\b/.test(candidate)) continue;
        if (/^\d/.test(candidate)) continue;
        const parts = candidate.split(/\s{2,}/);
        candidate = parts[0].trim();
        if (candidate.length < 3) continue;
        if (OWN_COMPANY.nameKeywords.some((k) => candidate.toLowerCase().includes(k))) {
          continue;
        }
        name = candidate.replace(/\s+/g, ' ').trim();
        break;
      }
      break;
    }
  }

  return { name, gstin };
}

// 🚀 FIXED: grand total no longer picks up "Sub Total" by mistake
function extractTotalAmount(
  text: string,
  lines: string[],
  lineItems: ParsedLineItem[]
): { total: number; subTotal: number; tax: number } {
  let total = 0;
  let subTotal = 0;
  let tax = 0;

  // 1. GRAND TOTAL — explicit markers first (Bonus & nGeniusLab use "Grand Total")
  for (let i = 0; i < lines.length; i++) {
    if (/(Grand\s*Total|Amount\s*Payable|Net\s*Amount)/i.test(lines[i])) {
      const block = (lines[i] + ' ' + (lines[i + 1] || '')).replace(/,/g, '');
      const nums = block.match(/\d+\.\d{1,2}/g);
      if (nums && nums.length > 0) {
        const vals = nums.map((n) => parseFloat(n));
        total = Math.max(...vals);
      }
      break;
    }
  }

  // 2. 🚀 FALLBACK: any "Total <number>" — but SKIP any preceded by "Sub"
  //    Takes the LAST valid occurrence (real grand total is near the bottom).
  //    Fixes SM26-27074 style where "Sub Total 39,078.20" was hijacking the grand total.
  if (!total) {
    const totalMatches = [
      ...text.matchAll(/\bTotal\s*[:\-₹]?\s*([\d,]+\.\d{1,2})/gi),
    ];
    const nonSub = totalMatches.filter((m) => {
      const idx = m.index ?? 0;
      const before = text.slice(Math.max(0, idx - 5), idx);
      return !/Sub\s*$/i.test(before);
    });
    const source = nonSub.length > 0 ? nonSub : totalMatches;
    if (source.length > 0) {
      const last = source[source.length - 1];
      const n = parseFloat(last[1].replace(/,/g, ''));
      if (!isNaN(n)) total = n;
    }
  }

  // 3. SUB TOTAL
  const subMatch = text.match(/Sub\s*Total\s*[:\-]?\s*₹?\s*([\d,]+\.?\d*)/i);
  if (subMatch) {
    const n = parseFloat(subMatch[1].replace(/,/g, ''));
    if (!isNaN(n)) subTotal = n;
  }

  // 4. TAX AMOUNT — bottom-up scan for summary line
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || /Taxable/i.test(line)) continue;
    if (/^(HSN|SAC|Sr|Sl|S\.?N)/i.test(line) && /Total\s+Tax/i.test(line)) continue;

    const taxMatchRegex =
      /(?:IGST|CGST|SGST|Total\s+Tax|Tax\s+Amount|Add\s*:\s*IGST|GST\s+Amount).*?([\d,]+\.\d{1,2})$/i;
    const match = line.match(taxMatchRegex);

    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (val > 0 && ![5, 9, 12, 18, 28].includes(val)) {
        tax = val;
        break;
      }
    }
  }

  // 5. FALLBACK: sum per-item taxAmount when summary line missing (Bonus Electronics)
  if (!tax && lineItems.length > 0) {
    const perItemSum = lineItems.reduce((s, i) => s + (i.taxAmount || 0), 0);
    if (perItemSum > 0) {
      tax = parseFloat(perItemSum.toFixed(2));
    }
  }

  // 6. FALLBACK: derive missing subTotal or tax from the other + total
  if (!subTotal && total && tax) {
    subTotal = parseFloat((total - tax).toFixed(2));
  } else if (!tax && total && subTotal) {
    tax = parseFloat((total - subTotal).toFixed(2));
  }

  // 7. 🛡️ SANITY: if subTotal + tax significantly greater than total, total was wrong
  //    Recalculate total = subTotal + tax (small rounding within 1 rupee ignored)
  if (subTotal && tax && total) {
    const expected = subTotal + tax;
    if (Math.abs(expected - total) > 1 && expected > total) {
      total = parseFloat(expected.toFixed(2));
    }
  }

  return { total, subTotal, tax };
}

function extractLineItems(lines: string[]): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];

  let startIdx = 0;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      /(Item|Description|Product|Particulars|Goods)/i.test(line) &&
      /(Qty|Quantity|Rate|Price|Amount)/i.test(line)
    ) {
      startIdx = i + 1;
      break;
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    if (
      /^\s*(Sub\s*Total|Grand\s*Total|Total\s*In\s*Words|Add\s*:\s*IGST|Rupees\s+[A-Za-z]+.*\bOnly\b|Amount\s*Payable\s*[:₹])/i.test(
        lines[i]
      )
    ) {
      endIdx = i;
      break;
    }
  }

  const isNoise = (s: string): boolean => {
    if (!s) return true;
    if (/^(pcs|nos|kg|gm|ltr|ml|mtr|set|pair|box|units?\.?)$/i.test(s)) return true;
    if (/^[\d,\.\s%₹\-\(\)`]+$/.test(s)) return true;

    if (
      /^(HSN|SAC|Code|Qty|Quantity|Rate|Price|Amount|Total|Sr\.?\s*No|Sr\.?|Sl\.?|S\.?N\.?|IGST|CGST|SGST|Item|Description|Discount|Particulars|Goods|Tax\s+Rate|Taxable)/i.test(
        s
      )
    )
      return true;

    if (/Totals?\s*c\/o/i.test(s)) return true;
    if (/\bb\/[dc]\b/i.test(s)) return true;

    const footerPatterns: RegExp[] = [
      /^(Customer\s+Copy|Original|Duplicate|Copy)/i,
      /^(INVOICE|TAX\s+INVOICE|PROFORMA)$/i,
      /^Tel\.?\s*[:.]?/i,
      /^(Phone|Fax|Mobile|Email|E-?mail|Website|Online\s+Store|Contact\s+us)/i,
      /^GSTIN\s*[:.\-\/]?/i,
      /^(UDYAM|CIN|PAN)\s*[:.\-]/i,
      /^Invoice\s+No/i,
      /^Dated?\s*[:.]?/i,
      /^Due\s+Date/i,
      /^Place\s+of\s+Supply/i,
      /^Reverse\s+Charge/i,
      /^GR\/RR/i,
      /^Transport\s*[:.]?/i,
      /^Vehicle\s+No/i,
      /^Station\s*[:.]?/i,
      /^E-?Way\s+Bill/i,
      /^Payment\s+Mode/i,
      /^Collected\s+By/i,
      /^(Billed?\s+to|Shipped?\s+to|Bill\s+To|Ship\s+To)/i,
      /^Party\s+Details/i,
      /^(Buyer|Consignee|RECEIVER)/i,
      /^IRN\s*:/i,
      /^Ack\.?\s*(No|Date)/i,
      /^Message\s*$/i,
      /^Thank\s+you/i,
      /^No\s+Warranty/i,
      /^Bank\s+(Details|Name)/i,
      /^A\s*\/\s*c\s*No/i,
      /^IFSc?\s+code/i,
      /^Branch\s+Address/i,
      /^Account\s+(Name|No)/i,
      /^Terms\s*&?\s*Conditions?/i,
      /^E\.?\s*&\s*O\.?E/i,
      /^Interest\s*@/i,
      /^Subject\s+to/i,
      /^Goods\s+once\s+sold/i,
      /^Cheque\s+dishonoured/i,
      /^All\s+disputes/i,
      /^For\s+[A-Z][a-zA-Z\s]+$/i,
      /^Authorised\s+Signatory/i,
      /^E-?Invoice\s+QR/i,
      /^Receiver'?s?\s+Signature/i,
      /^Scan\s+the\s+QR/i,
      /^Notes\s*$/i,
      /^Redg\.?\s+Office/i,
      /^Manufactures?/i,
      /^Rupees\s+[A-Za-z]/i,
      /^Total\s+In\s+Words/i,
      /^Add\s*:\s*IGST/i,
      /^Less\s*:\s*Rounded/i,
      /^Rounding\s*[:.\-]?/i,
      /^Sub\s+Total/i,
      /^Grand\s+Total/i,
    ];
    if (footerPatterns.some((p) => p.test(s))) return true;

    if (/\b\d{6}\b/.test(s) && !/\d+\.\d{2}/.test(s)) return true;

    if (OWN_COMPANY.nameKeywords.some((k) => s.toLowerCase().includes(k))) {
      if (!/\d+\.\d{2}/.test(s)) return true;
    }

    return false;
  };

  let currentItem: ParsedLineItem | null = null;
  let noiseStreak = 0;
  const NOISE_RESET_THRESHOLD = 3;

  const emptyItem = (): ParsedLineItem => ({
    serialNo: 0,
    productName: '',
    sku: '',
    hsn: '',
    quantity: 0,
    rate: 0,
    discount: 0,
    gstPercent: 0,
    taxAmount: 0,
    amount: 0,
  });

  const pushCurrent = () => {
    if (currentItem) {
      items.push(currentItem);
      currentItem = null;
    }
  };

  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i].trim();

    if (!line || isNoise(line)) {
      noiseStreak++;
      if (noiseStreak >= NOISE_RESET_THRESHOLD) {
        pushCurrent();
      }
      continue;
    }
    noiseStreak = 0;

    const zohoMatch = line.match(
      /^\s*(\d{1,3})\s+(.+?)\s+(\d{3,10})\s+([\d,]+\.?\d*)\s*(?:pcs|nos|kg|gm|ltr|ml|mtr|set|pair|box|units?)?\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*%?\s+(\d{1,2})\s*%?\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*$/i
    );
    if (zohoMatch) {
      pushCurrent();
      currentItem = {
        ...emptyItem(),
        serialNo: parseInt(zohoMatch[1], 10),
        productName: zohoMatch[2].trim(),
        hsn: zohoMatch[3] ?? '',
        quantity: parseFloat(zohoMatch[4].replace(/,/g, '')) || 0,
        rate: parseFloat(zohoMatch[5].replace(/,/g, '')) || 0,
        discount: parseFloat(zohoMatch[6].replace(/,/g, '')) || 0,
        gstPercent: parseInt(zohoMatch[7], 10) || 0,
        taxAmount: parseFloat(zohoMatch[8].replace(/,/g, '')) || 0,
        amount: parseFloat(zohoMatch[9].replace(/,/g, '')) || 0,
      };
      continue;
    }

    const zohoNoDiscountMatch = line.match(
      /^\s*(\d{1,3})\s+(.+?)\s+(\d{3,10})\s+([\d,]+\.?\d*)\s*(?:pcs|nos|kg|gm|ltr|ml|mtr|set|pair|box|units?)?\s+([\d,]+\.?\d*)\s+(\d{1,2})\s*%?\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*$/i
    );
    if (zohoNoDiscountMatch) {
      pushCurrent();
      currentItem = {
        ...emptyItem(),
        serialNo: parseInt(zohoNoDiscountMatch[1], 10),
        productName: zohoNoDiscountMatch[2].trim(),
        hsn: zohoNoDiscountMatch[3] ?? '',
        quantity: parseFloat(zohoNoDiscountMatch[4].replace(/,/g, '')) || 0,
        rate: parseFloat(zohoNoDiscountMatch[5].replace(/,/g, '')) || 0,
        gstPercent: parseInt(zohoNoDiscountMatch[6], 10) || 0,
        taxAmount: parseFloat(zohoNoDiscountMatch[7].replace(/,/g, '')) || 0,
        amount: parseFloat(zohoNoDiscountMatch[8].replace(/,/g, '')) || 0,
      };
      continue;
    }

    const bonusMatch = line.match(
      /^\s*(\d{1,3})\.?\s+(.+?)\s+(\d{4,10})\s+([\d,]+\.?\d*)\s*(?:pcs\.?|nos\.?|kg|gm|ltr|ml|mtr|set|pair|box|units?\.?)?\s+([\d,]+\.?\d*)\s+(\d{1,2}(?:\.\d{1,2})?)\s*%?\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*$/i
    );
    if (bonusMatch) {
      pushCurrent();
      currentItem = {
        ...emptyItem(),
        serialNo: parseInt(bonusMatch[1], 10),
        productName: bonusMatch[2].trim(),
        hsn: bonusMatch[3] ?? '',
        quantity: parseFloat(bonusMatch[4].replace(/,/g, '')) || 0,
        rate: parseFloat(bonusMatch[5].replace(/,/g, '')) || 0,
        gstPercent: parseInt(bonusMatch[6], 10) || 0,
        taxAmount: parseFloat(bonusMatch[7].replace(/,/g, '')) || 0,
        amount: parseFloat(bonusMatch[8].replace(/,/g, '')) || 0,
      };
      continue;
    }

    const onGeniusRegex =
      /^\s*(\d{1,3})\.\s+(.+?)\s+(\d{4,8})?\s*([\d,]+\.?\d*)\s*(?:Pcs\.?|Nos\.?|Units?)\s*([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*$/i;
    const onGeniusMatch = line.match(onGeniusRegex);
    if (onGeniusMatch) {
      const qty = parseFloat(onGeniusMatch[4].replace(/,/g, ''));
      const rate = parseFloat(onGeniusMatch[5].replace(/,/g, ''));
      const amt = parseFloat(onGeniusMatch[6].replace(/,/g, ''));
      if (qty > 0 && rate > 0 && amt > 0) {
        pushCurrent();
        currentItem = {
          ...emptyItem(),
          serialNo: parseInt(onGeniusMatch[1], 10),
          productName: onGeniusMatch[2].trim(),
          hsn: onGeniusMatch[3] ?? '',
          quantity: qty,
          rate,
          amount: amt,
        };
        continue;
      }
    }

    const threeNumMatch = line.match(
      /^(?:(\d{1,3})[\.\s]+)?(.+?)\s+([\d,]+\.?\d*)\s*(?:pcs|nos|kg|gm|ltr|units?)?\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/i
    );
    if (threeNumMatch) {
      const qty = parseFloat(threeNumMatch[3].replace(/,/g, ''));
      const rate = parseFloat(threeNumMatch[4].replace(/,/g, ''));
      const amt = parseFloat(threeNumMatch[5].replace(/,/g, ''));
      if (qty > 0 && rate > 0 && amt > 0) {
        pushCurrent();
        currentItem = {
          ...emptyItem(),
          serialNo: threeNumMatch[1] ? parseInt(threeNumMatch[1], 10) : items.length + 1,
          productName: threeNumMatch[2].trim(),
          quantity: qty,
          rate,
          amount: amt,
        };
        continue;
      }
    }

    if (currentItem) {
      const cleaned = line
        .replace(/\s+(pcs|nos|kg|gm|ltr|ml|mtr|set|pair|box)\s*$/i, '')
        .trim();
      if (
        cleaned.length > 2 &&
        cleaned.length < 60 &&
        !/^\d+$/.test(cleaned) &&
        !/^(Total|Sub|Add|Less|Grand|Rupees|Amount|IGST|CGST|SGST)/i.test(cleaned) &&
        !/\bthank\s+you|purchase|business|warranty|guarantee|jurisdiction|interest\b/i.test(
          cleaned
        )
      ) {
        currentItem.productName += ' ' + cleaned;
      }
    }
  }

  pushCurrent();
  return items;
}

export async function parseZohoInvoice(file: File): Promise<ParsedInvoice> {
  const rawText = await extractText(file);
  const lines = rawText.split('\n');

  const invoiceNumber = extractInvoiceNumber(rawText, lines);
  const invoiceDate = extractInvoiceDate(lines);

  const { direction: detectedDirection, reason: directionReason, separatorIdx } =
    detectDirection(rawText);

  const gstins = collectGstins(rawText);

  const { name: customerName, gstin: customerGstin } = extractCustomerNameAndGstin(
    rawText,
    lines,
    detectedDirection,
    separatorIdx,
    gstins
  );

  const lineItems = extractLineItems(lines);

  const { total: totalAmount, subTotal, tax: taxAmount } = extractTotalAmount(
    rawText,
    lines,
    lineItems
  );

  return {
    invoiceNumber,
    invoiceDate,
    customerName,
    customerGstin,
    lineItems,
    totalAmount,
    subTotal,
    taxAmount,
    detectedDirection,
    directionReason,
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