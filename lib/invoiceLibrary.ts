import { localDay } from './spendSummary.ts';

type LibraryInvoice = {
  status: string;
  dateIso: string | null;
  uploadedAt?: string;
  vendorName: string;
  invoiceNumber: string;
};

/** A Home period contains the same saved invoices as its spending summary. */
export function filterInvoiceLibrary<T extends LibraryInvoice>(
  invoices: T[], search: string, from?: string, to?: string,
): T[] {
  const hasRange = !!from && !!to
    && /^\d{4}-\d{2}-\d{2}$/.test(from)
    && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  const query = search.trim().toLowerCase();
  return invoices.filter(invoice => {
    if (hasRange) {
      const upload = new Date(invoice.uploadedAt ?? '');
      const day = invoice.dateIso || (Number.isFinite(upload.getTime()) ? localDay(upload) : null);
      if (invoice.status !== 'saved' || !day || day < from || day > to) return false;
    }
    return !query || invoice.vendorName.toLowerCase().includes(query)
      || invoice.invoiceNumber.toLowerCase().includes(query);
  });
}
