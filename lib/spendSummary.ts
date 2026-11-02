export type SpendInvoice = {
  id: string;
  vendor_id: string | null;
  total: number | string | null;
  invoice_date: string | null;
  created_at: string;
};
export type SummaryPeriod = "day" | "week" | "month";
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function invoiceSpendDate(invoice: SpendInvoice): string {
  return invoice.invoice_date || localDay(new Date(invoice.created_at));
}
export function summarizeSpend(
  invoices: SpendInvoice[],
  period: SummaryPeriod,
  offset: number,
  now = new Date(),
) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let end: Date;
  if (period === "month") {
    start.setDate(1);
    start.setMonth(start.getMonth() + offset);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  } else if (period === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  } else {
    start.setDate(start.getDate() + offset);
    end = new Date(start);
  }
  const from = localDay(start),
    to = localDay(end);
  const unique = [...new Map(invoices.map((x) => [x.id, x])).values()];
  const rows = unique.filter((x) => {
    const day = invoiceSpendDate(x);
    return day >= from && day <= to;
  });
  const vendors = new Map<string, number>();
  for (const row of rows) {
    const id = row.vendor_id ?? "unknown";
    vendors.set(id, (vendors.get(id) ?? 0) + Number(row.total ?? 0));
  }
  return {
    start,
    end,
    total: rows.reduce((sum, x) => sum + Number(x.total ?? 0), 0),
    count: rows.length,
    vendors: [...vendors].sort((a, b) => b[1] - a[1]),
    fallbackCount: rows.filter((x) => !x.invoice_date).length,
    allTotal: unique.reduce((sum, x) => sum + Number(x.total ?? 0), 0),
    allCount: unique.length,
  };
}
