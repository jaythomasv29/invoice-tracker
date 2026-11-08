import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Invoice } from '../store/useStore';

import { buildInvoicesCsv } from './csvRows';
export { buildInvoicesCsv } from './csvRows';

// Writes to the cache dir (system-reclaimable, fine for a share-once export)
// and hands off to the native share sheet — nothing persisted long-term.
export async function exportInvoicesCsv(invoices: Invoice[], opts: { personal?: boolean } = {}): Promise<void> {
  const csv = buildInvoicesCsv(invoices, opts);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const file = new File(Paths.cache, `sift-${opts.personal ? 'receipts' : 'invoices'}-${stamp}.csv`);
  if (file.exists) file.delete();
  file.create();
  // Leading UTF-8 BOM so Excel on Windows (which otherwise assumes the
  // system codepage) renders accented vendor/item names correctly instead of
  // as mojibake — Sheets/Numbers/Excel-on-Mac ignore it harmlessly.
  file.write('﻿' + csv);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: opts.personal ? 'Export receipts' : 'Export invoices' });
}
