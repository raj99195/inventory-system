import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quotation } from '@/types';

// STEMmantra brand palette (RGB)
const BRAND = {
  orange: [249, 115, 22] as [number, number, number],
  orangeLight: [251, 146, 60] as [number, number, number],
  choco: [61, 40, 23] as [number, number, number],
  chocoSoft: [107, 79, 61] as [number, number, number],
  cream: [255, 248, 240] as [number, number, number],
  creamDark: [245, 235, 220] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

// Stemmantra company info — CHANGE this if company details ever change
const OWN_COMPANY = {
  name: 'STEMMANTRA TECHNOLOGIES PVT LTD',
  address1: 'C-104, Second Floor, Noida Sector-10',
  address2: 'Uttar Pradesh - 201301',
  gstin: '09ABKCS7831H1ZV',
  email: 'info@stemmantra.com',
  phone: '',
  website: '',
};

/**
 * Load an image file (e.g. /logo.png) as a base64 data URL so it can be
 * embedded in the PDF via doc.addImage.
 */
async function loadImageAsDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numberToWords(n: number): string {
  // Simple Indian-style rupees to words (approximation)
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  function twoDigits(x: number): string {
    if (x < 20) return ones[x];
    return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
  }

  function threeDigits(x: number): string {
    if (x >= 100) {
      return ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + twoDigits(x % 100) : '');
    }
    return twoDigits(x);
  }

  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Zero';

  let words = '';
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;

  if (crore) words += twoDigits(crore) + ' Crore ';
  if (lakh) words += twoDigits(lakh) + ' Lakh ';
  if (thousand) words += twoDigits(thousand) + ' Thousand ';
  if (rest) words += threeDigits(rest);
  words = words.trim();

  let result = 'Indian Rupees ' + words + ' Only';
  if (paise > 0) {
    result = 'Indian Rupees ' + words + ' and ' + twoDigits(paise) + ' Paise Only';
  }
  return result;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'DRAFT',
  sent: 'SENT',
  accepted: 'ACCEPTED',
  rejected: 'REJECTED',
  expired: 'EXPIRED',
  converted: 'CONVERTED',
};

/**
 * Generates a professional Stemmantra-branded quotation PDF.
 * Returns a Blob (can be downloaded or opened in a new tab).
 */
export async function generateQuotationPdf(quotation: Quotation): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ─── TOP ORANGE BAND ───────────────────────────────────────────
  doc.setFillColor(...BRAND.orange);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // ─── LOGO (top-left) ───────────────────────────────────────────
  let logoLoaded = false;
  try {
    const logoData = await loadImageAsDataURL('/logo.png');
    doc.addImage(logoData, 'PNG', margin, 10, 50, 20);
    logoLoaded = true;
  } catch {
    // Fallback: text logo if /logo.png fails to load
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...BRAND.orange);
    doc.text('STEMmantra', margin, 22);
  }

  // Company info block (below logo)
  const infoY = logoLoaded ? 35 : 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.choco);
  doc.text(OWN_COMPANY.name, margin, infoY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.chocoSoft);
  doc.text(OWN_COMPANY.address1, margin, infoY + 4);
  doc.text(OWN_COMPANY.address2, margin, infoY + 8);
  doc.text(`GSTIN: ${OWN_COMPANY.gstin}`, margin, infoY + 12);
  if (OWN_COMPANY.email) doc.text(`Email: ${OWN_COMPANY.email}`, margin, infoY + 16);

  // ─── QUOTATION TITLE (top-right) ───────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...BRAND.orange);
  doc.text('QUOTATION', pageWidth - margin, 22, { align: 'right' });

  // Status badge
  if (quotation.status && quotation.status !== 'draft') {
    const statusText = STATUS_LABEL[quotation.status] ?? quotation.status.toUpperCase();
    doc.setFillColor(...BRAND.creamDark);
    doc.roundedRect(pageWidth - margin - 30, 26, 30, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.choco);
    doc.text(statusText, pageWidth - margin - 15, 30, { align: 'center' });
  }

  // Meta block (right side)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.choco);

  let metaY = 40;
  const labelX = pageWidth - margin - 45;
  const valueX = pageWidth - margin;

  doc.setFont('helvetica', 'bold');
  doc.text('Quotation No:', labelX, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(quotation.quotationNumber, valueX, metaY, { align: 'right' });
  metaY += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', labelX, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(quotation.quotationDate), valueX, metaY, { align: 'right' });
  metaY += 5;

  if (quotation.validUntil) {
    doc.setFont('helvetica', 'bold');
    doc.text('Valid Until:', labelX, metaY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(quotation.validUntil), valueX, metaY, { align: 'right' });
    metaY += 5;
  }

  // ─── DIVIDER ───────────────────────────────────────────────────
  doc.setDrawColor(...BRAND.orange);
  doc.setLineWidth(0.5);
  doc.line(margin, 62, pageWidth - margin, 62);

  // ─── CUSTOMER BLOCK ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.chocoSoft);
  doc.text('QUOTATION TO', margin, 69);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.choco);
  doc.text(quotation.customerName || '—', margin, 76);

  let custY = 82;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (quotation.customerCompany) {
    doc.text(quotation.customerCompany, margin, custY);
    custY += 4;
  }
  if (quotation.customerAddress) {
    const addrLines = doc.splitTextToSize(quotation.customerAddress, 100);
    doc.text(addrLines, margin, custY);
    custY += addrLines.length * 4;
  }
  if (quotation.customerGstin) {
    doc.text(`GSTIN: ${quotation.customerGstin}`, margin, custY);
    custY += 4;
  }
  if (quotation.customerEmail) {
    doc.text(`Email: ${quotation.customerEmail}`, margin, custY);
    custY += 4;
  }
  if (quotation.customerPhone) {
    doc.text(`Phone: ${quotation.customerPhone}`, margin, custY);
    custY += 4;
  }

  // ─── LINE ITEMS TABLE ──────────────────────────────────────────
  const tableStartY = Math.max(custY + 6, 100);

  autoTable(doc, {
    startY: tableStartY,
    head: [
      [
        '#',
        'Description',
        'HSN',
        'Qty',
        'Rate',
        'Disc',
        'GST',
        'Amount',
      ],
    ],
    body: quotation.items.map((item, idx) => {
      const descText =
        item.description + (item.remarks ? `\n${item.remarks}` : '');
      return [
        String(idx + 1),
        descText,
        item.hsn || '-',
        `${item.quantity} ${item.unit || ''}`.trim(),
        formatMoney(item.rate),
        item.discountPercent > 0 ? `${item.discountPercent}%` : '-',
        `${item.gstPercent}%`,
        formatMoney(item.amount),
      ];
    }),
    theme: 'grid',
    headStyles: {
      fillColor: BRAND.orange,
      textColor: BRAND.white,
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      cellPadding: 3,
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: BRAND.choco,
      lineColor: BRAND.creamDark,
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: BRAND.cream },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      // Draw a small footer on every page
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...BRAND.chocoSoft);
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: 'right' }
      );
      doc.text(
        `Quotation ${quotation.quotationNumber} · ${OWN_COMPANY.name}`,
        margin,
        pageHeight - 8
      );
      // Repeat orange band on top of continuation pages
      if (data.pageNumber > 1) {
        doc.setFillColor(...BRAND.orange);
        doc.rect(0, 0, pageWidth, 2, 'F');
      }
    },
  });

  // ─── TOTALS BLOCK (right-aligned) ─────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const totalsLabelX = pageWidth - margin - 55;
  const totalsValueX = pageWidth - margin;

  // Ensure we have room; if not, add a page
  let currentY = finalY;
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BRAND.choco);

  doc.text('Sub Total:', totalsLabelX, currentY);
  doc.text(`Rs. ${formatMoney(quotation.subTotal)}`, totalsValueX, currentY, {
    align: 'right',
  });
  currentY += 5;

  if (quotation.totalDiscount > 0) {
    doc.text('Total Discount:', totalsLabelX, currentY);
    doc.text(
      `Rs. ${formatMoney(quotation.totalDiscount)}`,
      totalsValueX,
      currentY,
      { align: 'right' }
    );
    currentY += 5;
  }

  doc.text('GST Amount:', totalsLabelX, currentY);
  doc.text(`Rs. ${formatMoney(quotation.totalTax)}`, totalsValueX, currentY, {
    align: 'right',
  });
  currentY += 3;

  // Grand total divider
  doc.setDrawColor(...BRAND.orange);
  doc.setLineWidth(0.4);
  doc.line(totalsLabelX, currentY, totalsValueX, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.orange);
  doc.text('Grand Total:', totalsLabelX, currentY);
  doc.text(`Rs. ${formatMoney(quotation.grandTotal)}`, totalsValueX, currentY, {
    align: 'right',
  });
  currentY += 8;

  // Amount in words
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.chocoSoft);
  const wordsLines = doc.splitTextToSize(
    `In Words: ${numberToWords(quotation.grandTotal)}`,
    pageWidth - 2 * margin
  );
  doc.text(wordsLines, margin, currentY);
  currentY += wordsLines.length * 4 + 4;

  // ─── TERMS & CONDITIONS ───────────────────────────────────────
  const ensureSpace = (need: number) => {
    if (currentY + need > pageHeight - 30) {
      doc.addPage();
      currentY = 20;
    }
  };

  if (quotation.terms) {
    ensureSpace(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.chocoSoft);
    doc.text('TERMS & CONDITIONS', margin, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.choco);
    const termsLines = doc.splitTextToSize(quotation.terms, pageWidth - 2 * margin);
    ensureSpace(termsLines.length * 4);
    doc.text(termsLines, margin, currentY);
    currentY += termsLines.length * 4 + 6;
  }

  // ─── NOTES ─────────────────────────────────────────────────────
  if (quotation.notes) {
    ensureSpace(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.chocoSoft);
    doc.text('NOTES', margin, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.choco);
    const noteLines = doc.splitTextToSize(quotation.notes, pageWidth - 2 * margin);
    ensureSpace(noteLines.length * 4);
    doc.text(noteLines, margin, currentY);
    currentY += noteLines.length * 4 + 6;
  }

  // ─── SIGNATURE BLOCK ──────────────────────────────────────────
  ensureSpace(30);
  const sigY = Math.max(currentY + 10, pageHeight - 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.choco);
  doc.text('For ' + OWN_COMPANY.name, pageWidth - margin, sigY, {
    align: 'right',
  });

  // Signature line
  doc.setDrawColor(...BRAND.chocoSoft);
  doc.setLineWidth(0.2);
  doc.line(pageWidth - margin - 55, sigY + 14, pageWidth - margin, sigY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.chocoSoft);
  doc.text('Authorised Signatory', pageWidth - margin, sigY + 18, {
    align: 'right',
  });

  return doc.output('blob');
}

/**
 * Trigger a browser download of the quotation PDF.
 */
export async function downloadQuotationPdf(quotation: Quotation): Promise<void> {
  const blob = await generateQuotationPdf(quotation);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${quotation.quotationNumber}-${(quotation.customerName || 'customer')
    .replace(/[^a-z0-9]/gi, '_')
    .slice(0, 30)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Open the quotation PDF in a new browser tab (for preview).
 */
export async function previewQuotationPdf(quotation: Quotation): Promise<void> {
  const blob = await generateQuotationPdf(quotation);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Note: don't revoke immediately — the new tab needs the URL
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
