import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const colors = {
  ink: rgb(0.16, 0.23, 0.31),
  muted: rgb(0.48, 0.55, 0.62),
  line: rgb(0.86, 0.89, 0.91),
  grid: rgb(0.61, 0.75, 0.74),
  pale: rgb(0.96, 0.97, 0.98),
  paleTeal: rgb(0.91, 0.96, 0.95),
  teal: rgb(0.09, 0.49, 0.47),
  white: rgb(1, 1, 1),
};

const pdfText = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[^\x20-\xff]/g, '?');
const dateText = (value) => value ? value.split('-').reverse().join('/') : '-';
const moneyText = (value) => `KES ${Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function wrapText(value, font, size, maxWidth) {
  const words = pdfText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      continue;
    }
    let part = '';
    for (const character of word) {
      if (part && font.widthOfTextAtSize(part + character, size) > maxWidth) {
        lines.push(part);
        part = character;
      } else {
        part += character;
      }
    }
    line = part;
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
}

export async function createInvoicePdf(invoice) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageSize = [595.28, 841.89];
  const margin = 48;
  const contentWidth = pageSize[0] - margin * 2;
  let page;
  let top;

  const text = (value, x, yTop, font = regular, size = 10, color = colors.ink) => {
    const clean = pdfText(value);
    page.drawText(clean, { x, y: pageSize[1] - yTop - size, font, size, color });
  };
  const rightText = (value, right, yTop, font = regular, size = 10, color = colors.ink) => {
    const clean = pdfText(value);
    text(clean, right - font.widthOfTextAtSize(clean, size), yTop, font, size, color);
  };
  const line = (x1, x2, yTop, color = colors.line, thickness = 1) => {
    page.drawLine({ start: { x: x1, y: pageSize[1] - yTop }, end: { x: x2, y: pageSize[1] - yTop }, color, thickness });
  };
  const verticalLine = (x, yTop, yBottom, color = colors.line, thickness = 0.8) => {
    page.drawLine({ start: { x, y: pageSize[1] - yTop }, end: { x, y: pageSize[1] - yBottom }, color, thickness });
  };
  const rectangle = (x, yTop, width, height, color) => {
    page.drawRectangle({ x, y: pageSize[1] - yTop - height, width, height, color });
  };
  const wrapped = (value, x, yTop, width, font = regular, size = 9, lineHeight = 12, color = colors.ink) => {
    const lines = wrapText(value, font, size, width);
    lines.forEach((item, index) => text(item, x, yTop + index * lineHeight, font, size, color));
    return yTop + lines.length * lineHeight;
  };
  const addPage = (continued = false) => {
    page = document.addPage(pageSize);
    top = margin;
    if (continued) {
      text(`INVOICE ${invoice.invoiceNumber} - CONTINUED`, margin, top, bold, 10);
      top += 20;
      line(margin, pageSize[0] - margin, top);
      top += 16;
    }
  };
  const drawTableHeader = () => {
    const rowHeight = 25;
    const columnLines = [margin, margin + 230, 340, 438, pageSize[0] - margin];
    rectangle(margin, top, contentWidth, rowHeight, colors.paleTeal);
    text('Description', margin + 8, top + 8, bold, 8, colors.muted);
    rightText('Quantity', 330, top + 8, bold, 8, colors.muted);
    rightText('Unit price', 433, top + 8, bold, 8, colors.muted);
    rightText('Amount', pageSize[0] - margin - 8, top + 8, bold, 8, colors.muted);
    line(margin, pageSize[0] - margin, top, colors.grid, 0.8);
    line(margin, pageSize[0] - margin, top + rowHeight, colors.teal, 1.6);
    columnLines.forEach(x => verticalLine(x, top, top + rowHeight, colors.grid, 1));
    top += rowHeight;
  };

  addPage();
  rectangle(margin, top, contentWidth, 3, colors.teal);
  top += 18;
  text('Hisense', margin, top, bold, 18, colors.teal);
  rightText('INVOICE', pageSize[0] - margin, top - 1, bold, 22, colors.teal);
  top += 24;
  text('Under Googa Electronics Limited', margin, top, bold, 9);
  rightText(invoice.invoiceNumber, pageSize[0] - margin, top, bold, 10);
  top += 14;
  text('Funzi Road Industrial Area, Nairobi', margin, top, regular, 9, colors.muted);
  top += 13;
  text('+25470011311', margin, top, regular, 9, colors.muted);
  top += 14;
  line(margin, pageSize[0] - margin, top, colors.teal, 1.5);
  top += 18;

  const detailsTop = top;
  text('BILL TO', margin, top, bold, 8, colors.muted);
  text('INVOICE DETAILS', margin + 280, top, bold, 8, colors.muted);
  top += 14;
  let clientBottom = wrapped(invoice.clientName, margin, top, 250, bold, 10, 13);
  clientBottom = Math.max(clientBottom, wrapped(invoice.clientContact, margin, clientBottom, 250, regular, 9, 12));
  if (invoice.clientEmail) clientBottom = Math.max(clientBottom, wrapped(invoice.clientEmail, margin, clientBottom, 250, regular, 9, 12, colors.muted));
  clientBottom = Math.max(clientBottom, wrapped(invoice.billingAddress, margin, clientBottom, 250, regular, 9, 12, colors.muted));
  let invoiceBottom = top;
  const invoiceDetails = [
    `Invoice date: ${dateText(invoice.invoiceDate)}`,
    ...(invoice.dueDate ? [`Due date: ${dateText(invoice.dueDate)}`] : []),
    `Currency: ${invoice.currency || 'KES'}`,
  ];
  invoiceDetails.forEach((detail) => {
    text(detail, margin + 280, invoiceBottom, regular, 9);
    invoiceBottom += 14;
  });
  top = Math.max(clientBottom, invoiceBottom);
  top = Math.max(top, detailsTop) + 18;

  const tableBottom = pageSize[1] - margin;
  if (top + 25 > tableBottom) {
    addPage(true);
  }
  drawTableHeader();
  for (const item of invoice.lineItems || []) {
    const descriptionLines = wrapText(item.description, regular, 9, 205);
    const rowHeight = Math.max(28, descriptionLines.length * 12 + 12);
    if (top + rowHeight > tableBottom) {
      addPage(true);
      drawTableHeader();
    }
    const rowTop = top;
    descriptionLines.forEach((description, index) => text(description, margin + 8, top + 7 + index * 12, regular, 9));
    rightText(String(item.quantity), 330, top + 8, regular, 9);
    rightText(moneyText(item.unitPrice), 433, top + 8, regular, 9);
    const amount = Math.round(Number(item.quantity) * Number(item.unitPrice) * 100) / 100;
    rightText(moneyText(amount), pageSize[0] - margin - 8, top + 8, regular, 9);
    top += rowHeight;
    line(margin, pageSize[0] - margin, top, colors.grid, 0.9);
    verticalLine(margin, rowTop, top, colors.grid, 0.9);
    verticalLine(pageSize[0] - margin, rowTop, top, colors.grid, 0.9);
  }

  if (top + 185 > tableBottom) addPage(true);
  const totalsX = pageSize[0] - margin - 220;
  top += 12;
  const subtotal = Number(invoice.subtotal || 0);
  const tax = Number(invoice.taxAmount || 0);
  const totalRows = [
    ['Subtotal', moneyText(subtotal)],
    [`VAT (${Number(invoice.taxRate || 0)}%)`, moneyText(tax)],
  ];
  totalRows.forEach(([label, amount]) => {
    text(label, totalsX, top, regular, 9, colors.muted);
    rightText(amount, pageSize[0] - margin - 8, top, bold, 9);
    top += 17;
  });
  rectangle(totalsX - 8, top - 2, 220, 25, colors.pale);
  text('Total', totalsX, top + 5, bold, 10);
  rightText(moneyText(invoice.total), pageSize[0] - margin - 8, top + 5, bold, 10, colors.teal);
  top += 37;

  const termsLines = wrapText(invoice.paymentTerms, regular, 9, contentWidth);
  const paymentDetails = [
    ...(invoice.bankName ? [`Bank: ${invoice.bankName}`] : []),
    ...(invoice.payBillNumber ? [`PayBill: ${invoice.payBillNumber}`] : []),
    ...(invoice.accountNumber ? [`Account: ${invoice.accountNumber}`] : []),
  ];
  const paymentDetailsHeight = paymentDetails.length ? 32 + paymentDetails.length * 12 : 0;
  const confirmationHeight = 108;
  if (top + 32 + termsLines.length * 12 + paymentDetailsHeight + confirmationHeight > tableBottom) addPage(true);
  text('PAYMENT TERMS', margin, top, bold, 8, colors.muted);
  top += 14;
  top = wrapped(invoice.paymentTerms, margin, top, contentWidth, regular, 9, 12);
  top += 18;
  if (paymentDetails.length) {
    text('PAYMENT DETAILS', margin, top, bold, 8, colors.muted);
    top += 14;
    paymentDetails.forEach(detail => {
      text(detail, margin, top, regular, 9);
      top += 12;
    });
    top += 6;
  }
  text('CONFIRMATION', margin, top, bold, 8, colors.muted);
  top += 13;
  const boxGap = 18;
  const boxWidth = (contentWidth - boxGap) / 2;
  const boxTop = top;
  const boxHeight = 76;
  rectangle(margin, boxTop, boxWidth, boxHeight, colors.white);
  page.drawRectangle({ x: margin, y: pageSize[1] - boxTop - boxHeight, width: boxWidth, height: boxHeight, borderColor: colors.line, borderWidth: 1 });
  rectangle(margin + boxWidth + boxGap, boxTop, boxWidth, boxHeight, colors.white);
  page.drawRectangle({ x: margin + boxWidth + boxGap, y: pageSize[1] - boxTop - boxHeight, width: boxWidth, height: boxHeight, borderColor: colors.line, borderWidth: 1 });
  text('Authorized signature', margin + 9, boxTop + 9, regular, 8, colors.muted);
  line(margin + 9, margin + boxWidth - 9, boxTop + 55, colors.muted, 0.7);
  text('Name / Date', margin + 9, boxTop + 60, regular, 7, colors.muted);
  text('Company rubber stamp', margin + boxWidth + boxGap + 9, boxTop + 9, regular, 8, colors.muted);
  top += boxHeight + 20;
  if (top < tableBottom) {
    const footer = 'Thank you for your business.';
    text(footer, (pageSize[0] - regular.widthOfTextAtSize(footer, 8)) / 2, top, regular, 8, colors.muted);
  }

  document.getPages().forEach((currentPage, index, pages) => {
    const label = `Page ${index + 1} of ${pages.length}`;
    currentPage.drawText(label, { x: pageSize[0] - margin - regular.widthOfTextAtSize(label, 7), y: 22, font: regular, size: 7, color: colors.muted });
  });

  return document.save();
}

export async function downloadInvoicePdf(invoice) {
  const bytes = await createInvoicePdf(invoice);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = pdfText(invoice.invoiceNumber).replace(/[^a-z0-9._-]/gi, '-');
  link.href = url;
  link.download = `${filename || 'invoice'}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
