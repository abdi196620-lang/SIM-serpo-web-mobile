import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Basecamp, CashLedger, LedgerTransactionType } from '../types/serpo';
import { formatDateShortId, formatNumberId, formatTimeWita } from './serpoLogic';

const PDF_LEDGER_TYPE_LABELS: Record<LedgerTransactionType, string> = {
  TOP_UP: 'Isi Saldo',
  EXPENSE: 'Pengeluaran',
  REFUND: 'Pengembalian',
  ADJUSTMENT: 'Penyesuaian',
};

const PDF_DIRECTION_LABELS: Record<'IN' | 'OUT', string> = {
  IN: 'Masuk',
  OUT: 'Keluar',
};

export interface CashLedgerPdfSummary {
  count: number;
  totalIn: number;
  totalOut: number;
  netAmount: number;
}

export interface CashLedgerPdfRow {
  waktu: string;
  basecamp: string;
  jenisArah: string;
  referensi: string;
  keterangan: string;
  nominalText: string;
  saldoSesudahText: string;
  direction: 'IN' | 'OUT';
}

export function formatPdfRupiah(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = formatNumberId(abs);
  return amount < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function computeCashLedgerExportSummary(
  ledgers: CashLedger[]
): CashLedgerPdfSummary {
  let totalIn = 0;
  let totalOut = 0;
  for (const l of ledgers) {
    if (l.direction === 'IN') {
      totalIn += l.amount;
    } else {
      totalOut += l.amount;
    }
  }
  return {
    count: ledgers.length,
    totalIn,
    totalOut,
    netAmount: totalIn - totalOut,
  };
}

export function buildCashLedgerPdfRows(
  ledgers: CashLedger[],
  basecamps: Basecamp[]
): CashLedgerPdfRow[] {
  const bcMap = new Map(basecamps.map((b) => [b.id, b.name]));
  return ledgers.map((l) => {
    const bcName = bcMap.get(l.basecamp_id) ?? `Basecamp #${l.basecamp_id}`;
    const sign = l.direction === 'IN' ? '+' : '-';
    return {
      waktu: `${formatDateShortId(l.created_at)} · ${formatTimeWita(l.created_at)}`,
      basecamp: bcName,
      jenisArah: `${PDF_LEDGER_TYPE_LABELS[l.transaction_type]} (${PDF_DIRECTION_LABELS[l.direction]})`,
      referensi: l.reference_no,
      keterangan: l.description,
      nominalText: `${sign}${formatNumberId(l.amount)}`,
      saldoSesudahText: formatPdfRupiah(l.balance_after),
      direction: l.direction,
    };
  });
}

export interface DownloadCashLedgerPdfOptions {
  ledgers: CashLedger[];
  basecamps: Basecamp[];
  basecampLabel: string;
  typeLabel: string;
  asOfLabel?: string;
  filename?: string;
}

export function downloadCashLedgerPdf({
  ledgers,
  basecamps,
  basecampLabel,
  typeLabel,
  asOfLabel = '8 Nov 2026, 09.41 WITA',
  filename = 'sim-serpo-buku-kas.pdf',
}: DownloadCashLedgerPdfOptions): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;

  // Brand top bar
  doc.setFillColor(10, 75, 143); // #0A4B8F
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN MUTASI BUKU KAS OPERASIONAL', marginX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('VISDAT TEKNIK UTAMA  |  SIM SERPO BACKOFFICE', marginX, 17.5);
  doc.text(`Per ${asOfLabel}`, pageWidth - marginX, 17.5, { align: 'right' });

  // Filter metadata line
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.text(
    `Basecamp: ${basecampLabel}   |   Jenis Mutasi: ${typeLabel}   |   Total Mutasi: ${ledgers.length}`,
    marginX,
    31
  );

  // Summary KPI cards
  const summary = computeCashLedgerExportSummary(ledgers);
  const cardY = 35;
  const cardW = (pageWidth - marginX * 2 - 8) / 3;
  const cardH = 15;

  const summaryCards = [
    {
      label: 'Total Kas Masuk',
      value: `+${formatPdfRupiah(summary.totalIn)}`,
      color: [4, 120, 87] as [number, number, number],
    },
    {
      label: 'Total Kas Keluar',
      value: `-${formatPdfRupiah(summary.totalOut)}`,
      color: [230, 30, 37] as [number, number, number],
    },
    {
      label: 'Selisih Mutasi Bersih',
      value: formatPdfRupiah(summary.netAmount),
      color: [15, 23, 42] as [number, number, number],
    },
  ];

  summaryCards.forEach((card, idx) => {
    const x = marginX + idx * (cardW + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + 4, cardY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.text(card.value, x + 4, cardY + 11.5);
  });

  const rows = buildCashLedgerPdfRows(ledgers, basecamps);

  autoTable(doc, {
    startY: cardY + cardH + 5,
    margin: { left: marginX, right: marginX, bottom: 16 },
    head: [
      [
        'Waktu',
        'Basecamp',
        'Jenis / Arah',
        'Referensi',
        'Keterangan',
        'Nominal (Rp)',
        'Saldo Sesudah',
      ],
    ],
    body: rows.map((r) => [
      r.waktu,
      r.basecamp,
      r.jenisArah,
      r.referensi,
      r.keterangan,
      r.nominalText,
      r.saldoSesudahText,
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [10, 75, 143],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 40 },
      3: { cellWidth: 32 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 34, halign: 'right' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 5) {
        const row = rows[data.row.index];
        if (row?.direction === 'IN') {
          data.cell.styles.textColor = [4, 120, 87];
        } else {
          data.cell.styles.textColor = [230, 30, 37];
        }
      }
    },
    didDrawPage() {
      const pageCount = doc.getNumberOfPages();
      const currentPage = doc.getCurrentPageInfo().pageNumber;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `SIM Serpo Backoffice · Dokumen dicetak otomatis`,
        marginX,
        pageHeight - 8
      );
      doc.text(
        `Halaman ${currentPage} dari ${pageCount}`,
        pageWidth - marginX,
        pageHeight - 8,
        { align: 'right' }
      );
    },
  });

  doc.save(filename);
}
