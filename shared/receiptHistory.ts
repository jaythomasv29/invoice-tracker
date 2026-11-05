import { comparablePrice, type RetailProduct } from './receiptComparison.ts';
export interface RetailHistoryRow {
  qty: number;
  extended_price: number;
  retail_product: RetailProduct | null;
  invoices: {
    id: string;
    invoice_date: string | null;
    created_at: string;
    vendor_id: string;
    vendors?: { name?: string | null };
  };
}
export function retailHistorySeries(rows: RetailHistoryRow[], key?: string) {
  const comparable = rows
    .map((row) => ({
      row,
      price: comparablePrice(
        row.retail_product,
        Number(row.qty),
        Number(row.extended_price),
        row.invoices.vendor_id,
      ),
    }))
    .filter((entry) => !!entry.price)
    .sort((a, b) =>
      (a.row.invoices.invoice_date ?? a.row.invoices.created_at).localeCompare(
        b.row.invoices.invoice_date ?? b.row.invoices.created_at,
      ),
    );
  const selected = key ?? comparable.at(-1)?.price?.key;
  return comparable
    .filter((entry) => entry.price!.key === selected)
    .map(({ row, price }) => ({
      invoiceId: row.invoices.id,
      dateIso: row.invoices.invoice_date,
      createdAt: row.invoices.created_at,
      vendorName: row.invoices.vendors?.name ?? 'Unknown store',
      unitPrice: price!.price,
      unit: price!.unit,
    }));
}
