import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Invoice } from '../store/useStore';

function csvField(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
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
  file.write(csv);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export invoices' });
}
