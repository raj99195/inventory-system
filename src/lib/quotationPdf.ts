import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quotation } from '@/types';

const BRAND = {
  orange:     [249, 115, 22]  as [number, number, number],
  orangeLight:[251, 146, 60]  as [number, number, number],
  choco:      [61,  40,  23]  as [number, number, number],
  chocoSoft:  [107, 79,  61]  as [number, number, number],
  cream:      [255, 248, 240] as [number, number, number],
  creamDark:  [245, 235, 220] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
};

const OWN_COMPANY = {
  name:     'STEMMANTRA TECHNOLOGIES PVT LTD',
  address1: 'C-104, Second Floor, Noida Sector-10',
  address2: 'Uttar Pradesh - 201301',
  gstin:    '09ABKCS7831H1ZV',
  email:    'info@stemmantra.com',
};

async function loadImageAsDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror  = reject;
    reader.readAsDataURL(blob);
  });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberToWords(n: number): string {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                 'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
                 'Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const two  = (x: number) => x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '');
  const three = (x: number) => x >= 100 ? ones[Math.floor(x/100)]+' Hundred'+(x%100?' '+two(x%100):'') : two(x);
  const r = Math.floor(n);
  const p = Math.round((n - r) * 100);
  if (!r && !p) return 'Zero';
  let words = '';
  const cr = Math.floor(r/10000000); if (cr) words += two(cr)+' Crore ';
  const lk = Math.floor((r%10000000)/100000); if (lk) words += two(lk)+' Lakh ';
  const th = Math.floor((r%100000)/1000); if (th) words += two(th)+' Thousand ';
  const re = r%1000; if (re) words += three(re);
  words = words.trim();
  return 'Indian Rupees '+words+(p>0?' and '+two(p)+' Paise':'')+' Only';
}

const STATUS_LABEL: Record<string, string> = {
  draft:'DRAFT', sent:'SENT', accepted:'ACCEPTED',
  rejected:'REJECTED', expired:'EXPIRED', converted:'CONVERTED',
};

export async function generateQuotationPdf(quotation: Quotation): Promise<Blob> {
  const doc        = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin     = 15;

  // Top orange band
  doc.setFillColor(...BRAND.orange);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Logo
  let logoLoaded = false;
  try {
    const logoData = await loadImageAsDataURL('/logo.png');
    doc.addImage(logoData, 'PNG', margin, 10, 50, 20);
    logoLoaded = true;
  } catch {
    doc.setFont('helvetica','bold');
    doc.setFontSize(20);
    doc.setTextColor(...BRAND.orange);
    doc.text('STEMmantra', margin, 22);
  }

  // Company info
  const infoY = logoLoaded ? 35 : 30;
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...BRAND.choco);
  doc.text(OWN_COMPANY.name, margin, infoY);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...BRAND.chocoSoft);
  doc.text(OWN_COMPANY.address1, margin, infoY+4);
  doc.text(OWN_COMPANY.address2, margin, infoY+8);
  doc.text(`GSTIN: ${OWN_COMPANY.gstin}`, margin, infoY+12);
  if (OWN_COMPANY.email) doc.text(`Email: ${OWN_COMPANY.email}`, margin, infoY+16);

  // Quotation title + status
  doc.setFont('helvetica','bold'); doc.setFontSize(26); doc.setTextColor(...BRAND.orange);
  doc.text('QUOTATION', pageWidth-margin, 22, { align:'right' });

  if (quotation.status && quotation.status !== 'draft') {
    const statusText = STATUS_LABEL[quotation.status] ?? quotation.status.toUpperCase();
    doc.setFillColor(...BRAND.creamDark);
    doc.roundedRect(pageWidth-margin-30, 26, 30, 6, 1, 1, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...BRAND.choco);
    doc.text(statusText, pageWidth-margin-15, 30, { align:'center' });
  }

  // Meta block (right)
  let metaY = 40;
  const labelX = pageWidth-margin-45;
  const valueX = pageWidth-margin;
  const metaLine = (label: string, value: string) => {
    doc.setFont('helvetica','bold');   doc.setFontSize(9); doc.setTextColor(...BRAND.choco);
    doc.text(label, labelX, metaY);
    doc.setFont('helvetica','normal'); doc.text(value, valueX, metaY, { align:'right' });
    metaY += 5;
  };
  metaLine('Quotation No:', quotation.quotationNumber);
  metaLine('Date:',         formatDate(quotation.quotationDate));
  if (quotation.validUntil) metaLine('Valid Until:', formatDate(quotation.validUntil));

  // Divider
  doc.setDrawColor(...BRAND.orange); doc.setLineWidth(0.5);
  doc.line(margin, 62, pageWidth-margin, 62);

  // Customer block
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...BRAND.chocoSoft);
  doc.text('QUOTATION TO', margin, 69);
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(...BRAND.choco);
  doc.text(quotation.customerName || '—', margin, 76);

  let custY = 82;
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  if (quotation.customerCompany)  { doc.text(quotation.customerCompany, margin, custY); custY+=4; }
  if (quotation.customerAddress)  {
    const lines = doc.splitTextToSize(quotation.customerAddress, 100);
    doc.text(lines, margin, custY); custY += lines.length*4;
  }
  if (quotation.customerGstin)    { doc.text(`GSTIN: ${quotation.customerGstin}`, margin, custY); custY+=4; }
  if (quotation.customerEmail)    { doc.text(`Email: ${quotation.customerEmail}`, margin, custY);  custY+=4; }
  if (quotation.customerPhone)    { doc.text(`Phone: ${quotation.customerPhone}`, margin, custY);  custY+=4; }

  // Line items table
  const tableStartY = Math.max(custY+6, 100);

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Description', 'HSN', 'Qty', 'Rate', 'Disc', 'GST', 'Amount']],
    body: quotation.items.map((item, idx) => [
      String(idx + 1),                                        // ← plain number, no object
      item.description + (item.remarks ? `\n${item.remarks}` : ''),
      item.hsn || '-',
      `${item.quantity} ${item.unit || ''}`.trim(),
      formatMoney(item.rate),
      item.discountPercent > 0 ? `${item.discountPercent}%` : '-',
      `${item.gstPercent}%`,
      formatMoney(item.amount),
    ]),
    theme: 'grid',
    headStyles: {
      fillColor:   BRAND.orange,
      textColor:   BRAND.white,
      fontSize:    9,
      fontStyle:   'bold',
      halign:      'center',
      valign:      'middle',
      cellPadding: 3,
    },
    styles: {
      fontSize:    9,
      cellPadding: 3,
      textColor:   BRAND.choco,
      lineColor:   BRAND.creamDark,
      lineWidth:   0.1,
      overflow:    'linebreak', // ← prevent text overflow issues
    },
    alternateRowStyles: { fillColor: BRAND.cream },
    columnStyles: {
      // 🔧 FIXED: # column widened from 9 → 13mm so "10","11"... don't wrap
      0: { cellWidth: 13, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 17, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 22, halign: 'right'  },
      5: { cellWidth: 13, halign: 'center' },
      6: { cellWidth: 13, halign: 'center' },
      7: { cellWidth: 26, halign: 'right'  },
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      // Footer on every page
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...BRAND.chocoSoft);
      doc.text(`Page ${data.pageNumber}`, pageWidth-margin, pageHeight-8, { align:'right' });
      doc.text(`Quotation ${quotation.quotationNumber} · ${OWN_COMPANY.name}`, margin, pageHeight-8);
      // Orange band on continuation pages
      if (data.pageNumber > 1) {
        doc.setFillColor(...BRAND.orange);
        doc.rect(0, 0, pageWidth, 2, 'F');
      }
    },
  });

  // Totals block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentY = (doc as any).lastAutoTable.finalY + 8;
  const totalsLabelX = pageWidth-margin-55;
  const totalsValueX = pageWidth-margin;

  if (currentY > pageHeight-60) { doc.addPage(); currentY = 20; }

  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(...BRAND.choco);

  doc.text('Sub Total:',   totalsLabelX, currentY);
  doc.text(`Rs. ${formatMoney(quotation.subTotal)}`, totalsValueX, currentY, { align:'right' });
  currentY += 5;

  if (quotation.totalDiscount > 0) {
    doc.text('Total Discount:', totalsLabelX, currentY);
    doc.text(`Rs. ${formatMoney(quotation.totalDiscount)}`, totalsValueX, currentY, { align:'right' });
    currentY += 5;
  }

  doc.text('GST Amount:', totalsLabelX, currentY);
  doc.text(`Rs. ${formatMoney(quotation.totalTax)}`, totalsValueX, currentY, { align:'right' });
  currentY += 3;

  doc.setDrawColor(...BRAND.orange); doc.setLineWidth(0.4);
  doc.line(totalsLabelX, currentY, totalsValueX, currentY);
  currentY += 5;

  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(...BRAND.orange);
  doc.text('Grand Total:', totalsLabelX, currentY);
  doc.text(`Rs. ${formatMoney(quotation.grandTotal)}`, totalsValueX, currentY, { align:'right' });
  currentY += 8;

  // Amount in words
  doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(...BRAND.chocoSoft);
  const wordsLines = doc.splitTextToSize(`In Words: ${numberToWords(quotation.grandTotal)}`, pageWidth-2*margin);
  doc.text(wordsLines, margin, currentY);
  currentY += wordsLines.length*4 + 4;

  const ensureSpace = (need: number) => {
    if (currentY + need > pageHeight-30) { doc.addPage(); currentY = 20; }
  };

  // Terms
  if (quotation.terms) {
    ensureSpace(15);
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...BRAND.chocoSoft);
    doc.text('TERMS & CONDITIONS', margin, currentY); currentY += 5;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...BRAND.choco);
    const tLines = doc.splitTextToSize(quotation.terms, pageWidth-2*margin);
    ensureSpace(tLines.length*4);
    doc.text(tLines, margin, currentY);
    currentY += tLines.length*4 + 6;
  }

  // Notes
  if (quotation.notes) {
    ensureSpace(15);
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...BRAND.chocoSoft);
    doc.text('NOTES', margin, currentY); currentY += 5;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...BRAND.choco);
    const nLines = doc.splitTextToSize(quotation.notes, pageWidth-2*margin);
    ensureSpace(nLines.length*4);
    doc.text(nLines, margin, currentY);
    currentY += nLines.length*4 + 6;
  }

  // Signature
  ensureSpace(30);
  const sigY = Math.max(currentY+10, pageHeight-35);
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...BRAND.choco);
  doc.text('For '+OWN_COMPANY.name, pageWidth-margin, sigY, { align:'right' });
  doc.setDrawColor(...BRAND.chocoSoft); doc.setLineWidth(0.2);
  doc.line(pageWidth-margin-55, sigY+14, pageWidth-margin, sigY+14);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...BRAND.chocoSoft);
  doc.text('Authorised Signatory', pageWidth-margin, sigY+18, { align:'right' });

  return doc.output('blob');
}

export async function downloadQuotationPdf(quotation: Quotation): Promise<void> {
  const blob = await generateQuotationPdf(quotation);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${quotation.quotationNumber}-${(quotation.customerName||'customer').replace(/[^a-z0-9]/gi,'_').slice(0,30)}.pdf`;
  document.body.appendChild(a);
  a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export async function previewQuotationPdf(quotation: Quotation): Promise<void> {
  const blob = await generateQuotationPdf(quotation);
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}