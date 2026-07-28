import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Invoice } from '../store/useStore';

// Excel/Sheets treats a cell starting with =, +, -, or @ as a formula, even
// inside a CSV — an OCR'd item description that happens to start with one of
// these (a raw "-5% discount" line, say) would otherwise execute as a formula
// when the export is opened. Prefixing with a tab defuses it while staying
// invisible in the rendered cell.
function guardFormulaInjection(str: string): string {
  return /^[=+\-@]/.test(str) ? `\t${str}` : str;
}

function csvField(value: string | number): string {
  const str = guardFormulaInjection(String(value));
  // Quote on comma/quote/newline as before, but also on a bare \r — an
  // unquoted \r (common in OCR'd or Windows-pasted text) reads as its own
  // row break to some CSV parsers even without an accompanying \n.
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildInvoicesCsv(invoices: Invoice[]): string {
  const header = ['Date', 'Vendor', 'Invoice #', 'Item', 'Qty', 'Unit', 'Unit Price', 'Ext Price', 'Category', 'Verification'];
  const rows = invoices.flatMap((inv) =>
    inv.lineItems.map((li) => [
      inv.date, inv.vendorName, inv.invoiceNumber || '—', li.desc, li.qty, li.unit,
      li.unitPrice.toFixed(2), li.ext.toFixed(2), li.category, li.verification,
    ])
  );
  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\n');
}

// Writes to the cache dir (system-reclaimable, fine for a share-once export)
// and hands off to the native share sheet — nothing persisted long-term.
export async function exportInvoicesCsv(invoices: Invoice[]): Promise<void> {
  const csv = buildInvoicesCsv(invoices);
  const file = new File(Paths.cache, `invoices-${Date.now()}.csv`);
  if (file.exists) file.delete();
  file.create();
  // Leading UTF-8 BOM so Excel on Windows (which otherwise assumes the
  // system codepage) renders accented vendor/item names correctly instead of
  // as mojibake — Sheets/Numbers/Excel-on-Mac ignore it harmlessly.
  file.write('﻿' + csv);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export invoices' });
}
