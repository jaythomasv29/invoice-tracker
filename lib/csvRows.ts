import type { Invoice } from '../store/useStore';

// Excel/Sheets treats a cell starting with =, +, -, or @ as a formula, even
// inside a CSV — an OCR'd item description that happens to start with one of
// these (a raw "-5% discount" line, say) would otherwise execute as a formula
// when the export is opened. Prefixing with a tab defuses it while staying
// invisible in the rendered cell.
// Only text is guarded: a real number (a negative credit amount) must stay a
// number, or the tab turns it into text and SUM() silently skips it.
function guardFormulaInjection(str: string): string {
  return /^[=+\-@]/.test(str) ? `\t${str}` : str;
}

function csvField(value: string | number): string {
  const str = typeof value === 'number' ? String(value) : guardFormulaInjection(value);
  // Quote on comma/quote/newline as before, but also on a bare \r — an
  // unquoted \r (common in OCR'd or Windows-pasted text) reads as its own
  // row break to some CSV parsers even without an accompanying \n.
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const round = (n: number, dp: number) => (Number.isFinite(n) ? Math.round(n * 10 ** dp) / 10 ** dp : '');

// ISO dates sort and import correctly everywhere; undated invoices fall back
// to the upload day so no row lands without a date.
function isoDate(inv: Invoice): string {
  if (inv.dateIso) return inv.dateIso;
  if (inv.uploadedAt) {
    const d = new Date(inv.uploadedAt);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return '';
}

export function buildInvoicesCsv(invoices: Invoice[], opts: { personal?: boolean } = {}): string {
  const header = ['Date', opts.personal ? 'Store' : 'Vendor', opts.personal ? 'Receipt #' : 'Invoice #', 'Item', 'Qty', 'Unit',
    'Unit Price', 'Ext Price', 'Type', 'Category', 'Delivery', 'Credit', 'Note'];
  const rows = invoices.flatMap((inv) =>
    inv.lineItems
      // Removed lines don't count toward the invoice total, so they don't export.
      .filter((li) => !li.voided)
      .map((li) => [
        isoDate(inv), inv.vendorName, inv.invoiceNumber || '', li.desc, round(li.qty, 3), li.unit,
        // Unit prices keep 4 decimals (produce and per-lb prices under $1).
        round(li.unitPrice, 4), round(li.ext, 2), li.type === 'credit' || li.ext < 0 ? 'credit' : 'charge',
        li.category, li.verification === 'missing' ? 'missing' : li.verification === 'received' ? 'received' : '',
        li.creditStatus ?? '', li.note ?? '',
      ])
  );
  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\n');
}

