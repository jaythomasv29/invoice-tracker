// Home "Your price watch" (Personal Pro): the repeat purchases whose net unit
// price moved most, from saved receipt lines. Pure so the live card
// (components/dashboard/HouseholdInsightsCard.tsx) and the sample household
// (lib/demoData.ts) rank items identically.
import { comparablePrice, type RetailProduct } from '../shared/receiptComparison.ts';

export type PriceWatchRow = {
  invoice_id: string;
  clean_name: string;
  qty: number;
  extended_price: number;
  retail_product: RetailProduct | null;
  invoices: { invoice_date: string | null; created_at: string; vendor_id: string };
};

export type PriceWatchItem = {
  key: string;
  name: string;
  count: number;
  first: number;
  last: number;
  unit: string;
  vendorId: string;
};

export function buildPriceWatch(rows: PriceWatchRow[], limit = 4): PriceWatchItem[] {
  const groups = new Map<string, PriceWatchItem>();
  const seen = new Set<string>();
  const sorted = [...rows].sort((a, b) =>
    (a.invoices.invoice_date ?? a.invoices.created_at).localeCompare(b.invoices.invoice_date ?? b.invoices.created_at),
  );
  for (const row of sorted) {
    const p = comparablePrice(row.retail_product, Number(row.qty), Number(row.extended_price), row.invoices.vendor_id);
    if (!p || seen.has(`${p.key}:${row.invoice_id}`)) continue;
    seen.add(`${p.key}:${row.invoice_id}`);
    const g = groups.get(p.key);
    if (g) {
      g.count++;
      g.last = p.price;
    } else
      groups.set(p.key, {
        key: p.key,
        name: row.clean_name,
        count: 1,
        first: p.price,
        last: p.price,
        unit: p.unit,
        vendorId: row.invoices.vendor_id,
      });
  }
  return [...groups.values()]
    .filter((g) => g.count > 1)
    .sort((a, b) => Math.abs(b.last / b.first - 1) - Math.abs(a.last / a.first - 1))
    .slice(0, limit);
}
