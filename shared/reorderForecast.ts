import type { PurchaseObservation } from "./measurement.ts";
export type ReorderForecast = {
  orderCount: number;
  datedOrderCount: number;
  lastDate: string | null;
  lastQuantity: number | null;
  unit: string | null;
  medianDays: number | null;
  window: { from: string; to: string } | null;
  status:
    | "building"
    | "irregular"
    | "quantity_changed"
    | "identity_uncertain"
    | "upcoming"
    | "review"
    | "stale";
  evidenceDates: string[];
};
const DAY = 86400000;
function day(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const n = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value
    ? n
    : null;
}
const median = (values: number[]) => {
  const a = [...values].sort((a, b) => a - b);
  const i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
};
const iso = (n: number) => new Date(n).toISOString().slice(0, 10);
/** Today on the device's calendar. `toISOString()` is UTC, which treats a
 * late-evening purchase as "future" in the Americas. */
const localToday = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Purchase cadence is a stock-check cue, never an inventory or consumption forecast.
 * Same vendor/description/unit identity is enforced by the history RPC. Missing dates,
 * future dates, duplicate rows and same-day invoices cannot create extra intervals.
 */
export function forecastReorder(
  rows: PurchaseObservation[],
  asOf = localToday(),
): ReorderForecast {
  const today = day(asOf);
  if (today === null) throw new Error("Invalid forecast date");
  const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
  const orders = new Map<
    string,
    { date: number; qty: number; known: boolean; unit: string | null }
  >();
  for (const r of unique) {
    const d = day(r.invoices.invoice_date),
      qty = Number(r.qty);
    if (
      d === null ||
      d > today ||
      !r.invoices.id ||
      r.qty == null ||
      !Number.isFinite(qty) ||
      qty <= 0 ||
      Number(r.extended_price) <= 0
    )
      continue;
    const key = r.invoices.id;
    const old = orders.get(key);
    orders.set(key, {
      date: d,
      qty: (old?.qty ?? 0) + qty,
      known: old?.known !== false,
      unit: r.unit_of_measure,
    });
  }
  const list = [...orders.values()].sort((a, b) => a.date - b.date);
  const dates = [...new Set(list.map((r) => r.date))];
  const recent = dates.slice(-7);
  const last = list.at(-1);
  const lastQuantity = last
    ? list
        .filter((o) => o.date === last.date)
        .reduce((sum, o) => sum + o.qty, 0)
    : null;
  const result: ReorderForecast = {
    orderCount: orders.size,
    datedOrderCount: dates.length,
    lastDate: last ? iso(last.date) : null,
    lastQuantity,
    unit: last?.unit ?? null,
    medianDays: null,
    window: null,
    status: "building",
    evidenceDates: recent.map(iso),
  };
  if (recent.length < 4) return result;
  if (
    unique.some(
      (r) => r.retail_product && r.retail_product.identity_confident !== true,
    )
  )
    return { ...result, status: "identity_uncertain" };
  const gaps = recent.slice(1).map((d, i) => (d - recent[i]) / DAY),
    typical = median(gaps);
  if (
    typical < 1 ||
    Math.max(...gaps) > typical * 2 ||
    Math.min(...gaps) < typical * 0.5
  )
    return { ...result, status: "irregular", medianDays: typical };
  // Group quantities by date so split invoices do not masquerade as smaller orders.
  const amounts = recent.map((d) =>
    list.filter((o) => o.date === d).reduce((n, o) => n + o.qty, 0),
  );
  const prior = median(amounts.slice(0, -1));
  if (amounts.at(-1)! >= prior * 1.5 || amounts.at(-1)! <= prior * 0.5)
    return { ...result, status: "quantity_changed", medianDays: typical };
  const deviation = median(gaps.map((g) => Math.abs(g - typical)));
  const radius = Math.max(1, Math.ceil(deviation * 2));
  const lastDay = recent.at(-1)!;
  // A long absence is not evidence the customer must buy; suppress stale timing.
  if ((today - lastDay) / DAY > typical * 3)
    return { ...result, status: "stale", medianDays: typical };
  const from = lastDay + Math.max(1, Math.floor(typical - radius)) * DAY,
    to = lastDay + Math.ceil(typical + radius) * DAY;
  return {
    ...result,
    lastQuantity: amounts.at(-1)!,
    medianDays: typical,
    window: { from: iso(from), to: iso(to) },
    status: today >= from ? "review" : "upcoming",
  };
}
export const FORECAST_REASONS = {
  building:
    "At least four dated purchases with usable quantities are needed for a timing pattern.",
  irregular:
    "Your purchase intervals vary too much for a dependable timing window.",
  quantity_changed:
    "Your latest order size changed substantially. Check stock before using the old rhythm.",
  identity_uncertain:
    "Product identity needs clearer evidence before a timing pattern can be used.",
  upcoming: "Your recent buying rhythm suggests an upcoming stock check.",
  review: "You are in or past your usual buying window. Check what is on hand.",
  stale:
    "This history is older than several usual buying cycles. Confirm the product is still in use.",
} as const;
export type InsightAction =
  "build_history" | "check_stock" | "plan_stock_check" | "review_pattern";
export function allowedInsightAction(f: ReorderForecast): InsightAction {
  return f.status === "building"
    ? "build_history"
    : f.status === "review"
      ? "check_stock"
      : f.status === "upcoming"
        ? "plan_stock_check"
        : "review_pattern";
}
