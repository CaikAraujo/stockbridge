'use client';

import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// Layout A4 — 4 etiquetas por linha
const PAGE_W = 210; // mm
const PAGE_H = 297; // mm
const MARGIN = 8; // mm
const COLS = 4;
const LABEL_W = (PAGE_W - MARGIN * 2) / COLS; // ~48.5mm
const LABEL_H = 42; // mm
const QR_SIZE = 28; // mm
const BORDER_CLR = 210; // cinza claro

export async function generateQRLabelsPDF(
  articles: { sku: string; name: string }[],
  appUrl: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let col = 0;
  let row = 0;

  for (const article of articles) {
    const url = `${appUrl}/scan/${encodeURIComponent(article.sku)}`;
    const qrData = await QRCode.toDataURL(url, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    const x = MARGIN + col * LABEL_W;
    const y = MARGIN + row * LABEL_H;

    // Borda
    doc.setDrawColor(BORDER_CLR);
    doc.setLineWidth(0.2);
    doc.rect(x, y, LABEL_W, LABEL_H);

    // QR centralizado
    const qrX = x + (LABEL_W - QR_SIZE) / 2;
    doc.addImage(qrData, 'PNG', qrX, y + 2, QR_SIZE, QR_SIZE);

    // Nome (truncado se necessário)
    const maxChars = 22;
    const name =
      article.name.length > maxChars ? `${article.name.slice(0, maxChars)}…` : article.name;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(name, x + LABEL_W / 2, y + QR_SIZE + 6, { align: 'center' });

    // SKU
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(article.sku, x + LABEL_W / 2, y + QR_SIZE + 10, { align: 'center' });

    col++;
    if (col >= COLS) {
      col = 0;
      row++;
      if (y + LABEL_H * 2 > PAGE_H - MARGIN && articles.indexOf(article) < articles.length - 1) {
        doc.addPage();
        row = 0;
      }
    }
  }

  doc.save('etiquetas-stockbridge.pdf');
}
