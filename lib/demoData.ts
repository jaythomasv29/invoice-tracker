import type { SpendInvoice } from './spendSummary';
import { formatDate, categoryColor, categoryLabel } from './invoicePipeline';
import { normalizePurchase } from '../shared/measurement';
import { invoiceCapForPlan } from './entitlements';
import type {
  Vendor, DayData, CategorySpend, TopItem, UploadActivityEntry,
  DeliveryGapEntry, PriceAlert, Invoice, LineItem,
} from '../store/useStore';
import type { RecipeListItem } from './recipeCosting';
import type { MissingInvoiceFlag } from '../hooks/useMissingInvoices';
import type { UploadStreak } from '../hooks/useUploadStreak';
import {
  buildDemoLedger, localIso, DEMO_VENDORS, DEMO_VENDOR_KEYS,
  type DemoLedger, type DemoLedgerInvoice,
} from './demoLedger';

export { DEMO_RESTAURANT_NAME } from './demoLedger';

// Client-side sample dataset that powers the first-run product tour (and the
// App Store / website captures). The ledger itself — a fictional restaurant's
// ~9 weeks of invoices, price-creep alerts and recipes — lives in
// lib/demoLedger.ts; this file maps it into app-shape state so the real
// screens render populated without ever touching Supabase.
//
// Key design point: the store buckets spend against `new Date()` ("this week"
// / "this month"), so the ledger is dated RELATIVE TO `now` at demo start and
// run through a reducer that mirrors fetchDashboardSummary's bucketing
// (week-scoped categories, all-time Pareto, prior-period % changes).

// ---- Local date helpers (mirror the private ones in store/useStore.ts) ------

function mondayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
}
function isoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
function monthBucketLabel(i: number, year: number, month: number): string {
  const start = i * 7 + 1;
  const end = Math.min(start + 6, daysInMonth(year, month));
  return start === end ? `${start}` : `${start}–${end}`;
}
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);

function addTo(bar: DayData, inv: DemoLedgerInvoice) {
  bar.total += inv.total;
  const seg = bar.breakdown.find((s) => s.vendorId === inv.vendorId);
  if (seg) seg.amount += inv.total;
  else bar.breakdown.push({ vendorId: inv.vendorId, name: inv.vendorName, amount: inv.total, color: inv.vendorColor });
}
function roundBars(bars: DayData[]) {
  for (const bar of bars) {
    bar.total = r2(bar.total);
    for (const seg of bar.breakdown) seg.amount = r2(seg.amount);
  }
}

function periodLabel(dateIso: string, weekStart: Date): { label: string; isBackdated: boolean } {
  const weeks = Math.round((weekStart.getTime() - mondayOf(isoDate(dateIso)).getTime()) / (7 * 86400000));
  if (weeks === 0) return { label: 'This week', isBackdated: false };
  if (weeks === 1) return { label: 'Last week', isBackdated: true };
  return { label: `${weeks} weeks ago`, isBackdated: true };
}
function uploadedLabel(createdAt: string, now: Date): string {
  const min = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---- Types -----------------------------------------------------------------

export interface DemoDashboard {
  spendInvoices: SpendInvoice[];
  vendors: Vendor[];
  weekTotal: number;
  weekPctChange: number | null;
  dayData: DayData[];
  monthTotal: number;
  monthPctChange: number | null;
  monthData: DayData[];
  allYearData: DayData[];
  categorySpend: CategorySpend[];
  topItems: TopItem[];
  uploadActivity: UploadActivityEntry[];
  deliveryGapTotal: number;
  deliveryGapItems: DeliveryGapEntry[];
}

export interface DemoState {
  dashboard: DemoDashboard;
  priceAlerts: PriceAlert[];
  recipes: RecipeListItem[];
}

// ---- Builder ---------------------------------------------------------------

export function buildDemoState(now: Date = new Date(), ledger: DemoLedger = buildDemoLedger(now)): DemoState {
  const { invoices } = ledger;
  const y = now.getFullYear();
  const m = now.getMonth();
  const weekStart = mondayOf(now);
  const weekStartIso = localIso(weekStart);
  const weekEndIso = localIso(new Date(y, m, now.getDate() - ((now.getDay() + 6) % 7) + 6));
  const prevWeekStartIso = localIso(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7));
  const monthStartIso = localIso(new Date(y, m, 1));
  const monthEndIso = localIso(new Date(y, m + 1, 0));
  const prevMonthStartIso = localIso(new Date(y, m - 1, 1));
  const prevMonthEndIso = localIso(new Date(y, m, 0));
  // Same-point-of-period comparison, matching fetchDashboardSummary.
  const prevWeekCutIso = localIso(new Date(y, m, now.getDate() - 7));
  const prevMonthCutIso = localIso(new Date(y, m - 1, Math.min(now.getDate(), daysInMonth(y, m - 1))));

  const dayData: DayData[] = DAY_LABELS.map((label) => ({ label, total: 0, breakdown: [] }));
  const bucketCount = Math.ceil(daysInMonth(y, m) / 7);
  const monthData: DayData[] = Array.from({ length: bucketCount }, (_, i) => ({ label: monthBucketLabel(i, y, m), total: 0, breakdown: [] }));
  const yearBars = new Map<number, DayData>([[y, { label: String(y), total: 0, breakdown: [] }]]);
  const catMap = new Map<string, number>();
  const itemMap = new Map<string, number>();
  const deliveryGapItems: DeliveryGapEntry[] = [];
  let weekTotal = 0, prevWeekTotal = 0, monthTotal = 0, prevMonthTotal = 0, deliveryGapTotal = 0;

  for (const inv of invoices) {
    const d = inv.dateIso;
    if (d >= weekStartIso && d <= weekEndIso) {
      weekTotal += inv.total;
      addTo(dayData[(isoDate(d).getDay() + 6) % 7], inv);
      // Category spend is week-scoped, like fetchDashboardSummary.
      for (const l of inv.lines) catMap.set(l.category, (catMap.get(l.category) ?? 0) + l.ext);
    } else if (d >= prevWeekStartIso && d < weekStartIso && d <= prevWeekCutIso) prevWeekTotal += inv.total;

    if (d >= monthStartIso && d <= monthEndIso) {
      monthTotal += inv.total;
      addTo(monthData[Math.min(Math.floor((isoDate(d).getDate() - 1) / 7), bucketCount - 1)], inv);
    } else if (d >= prevMonthStartIso && d <= prevMonthEndIso && d <= prevMonthCutIso) prevMonthTotal += inv.total;

    const year = Number(d.slice(0, 4));
    if (!yearBars.has(year)) yearBars.set(year, { label: String(year), total: 0, breakdown: [] });
    addTo(yearBars.get(year)!, inv);

    for (const [i, l] of inv.lines.entries()) {
      itemMap.set(l.name, (itemMap.get(l.name) ?? 0) + l.ext);
      if (l.missing) {
        deliveryGapTotal += l.ext;
        deliveryGapItems.push({ id: `${inv.id}-item-${i}`, invoiceId: inv.id, vendorName: inv.vendorName, itemName: l.name, amount: l.ext, dateLabel: formatDate(d) });
      }
    }
  }
  const allYearData = [...yearBars.entries()].sort((a, b) => a[0] - b[0]).map(([, bar]) => bar);
  roundBars(dayData);
  roundBars(monthData);
  roundBars(allYearData);

  const categorySpend: CategorySpend[] = [...catMap.entries()]
    .map(([category, amount]) => ({ category: categoryLabel(category), amount: r2(amount), color: categoryColor(category) }))
    .sort((a, b) => b.amount - a.amount);

  // Top-spend items (Pareto) — all-time, top 20, like fetchDashboardSummary.
  const ranked = [...itemMap.entries()].map(([name, amount]) => ({ name, amount: r2(amount) })).sort((a, b) => b.amount - a.amount);
  const itemTotal = ranked.reduce((s, x) => s + x.amount, 0) || 1;
  let cumulative = 0;
  const topItems: TopItem[] = ranked.slice(0, 20).map((x) => {
    const p = (x.amount / itemTotal) * 100;
    cumulative += p;
    return { name: x.name, amount: x.amount, pct: Math.round(p * 10) / 10, cumulativePct: Math.round(cumulative * 10) / 10 };
  });

  // Ledger is already newest-upload first.
  const uploadActivity: UploadActivityEntry[] = invoices.slice(0, 8).map((inv) => ({
    id: inv.id,
    vendorId: inv.vendorId,
    vendorName: inv.vendorName,
    vendorColor: inv.vendorColor,
    amount: inv.total,
    invoiceDateLabel: formatDate(inv.dateIso),
    uploadedLabel: uploadedLabel(inv.createdAt, now),
    ...(({ label, isBackdated }) => ({ periodLabel: label, isBackdated }))(periodLabel(inv.dateIso, weekStart)),
  }));

  const vendors: Vendor[] = DEMO_VENDOR_KEYS.map((key) => {
    const v = DEMO_VENDORS[key];
    const mine = invoices.filter((i) => i.vendor === key);
    const last = mine.reduce<string>((acc, i) => (i.dateIso > acc ? i.dateIso : acc), '');
    return { id: v.id, name: v.name, color: v.color, invoiceCount: mine.length, lastOrder: last ? formatDate(last) : '—' };
  });

  const priceAlerts: PriceAlert[] = ledger.alerts.map((a) => ({ ...a }));

  return {
    dashboard: {
      spendInvoices: invoices.map((inv) => ({ id: inv.id, vendor_id: inv.vendorId, total: inv.total, invoice_date: inv.dateIso, created_at: inv.createdAt })),
      vendors,
      weekTotal: r2(weekTotal),
      weekPctChange: pct(weekTotal, prevWeekTotal),
      dayData,
      monthTotal: r2(monthTotal),
      monthPctChange: pct(monthTotal, prevMonthTotal),
      monthData,
      allYearData,
      categorySpend,
      topItems,
      uploadActivity,
      deliveryGapTotal: r2(deliveryGapTotal),
      deliveryGapItems: deliveryGapItems.slice(0, 25), // ledger is newest first
    },
    priceAlerts,
    recipes: ledger.recipes.map((r) => ({ ...r })),
  };
}

// Convenience for the Recipes tab, which owns its list in local state.
export function buildDemoRecipes(): RecipeListItem[] {
  return buildDemoLedger().recipes.map((r) => ({ ...r }));
}

// ---- Invoices (library, invoice detail, vendor pages, product carousel) ----

function toInvoice(inv: DemoLedgerInvoice): Invoice {
  const lineItems: LineItem[] = inv.lines.map((l, i) => ({
    id: `${inv.id}-item-${i}`,
    desc: l.name,
    rawDesc: l.raw,
    normalizedCost: normalizePurchase({
      id: `${inv.id}-item-${i}`, raw_description: l.raw, clean_name: l.name, qty: l.qty,
      unit_of_measure: l.unit, unit_price: l.unitPrice, extended_price: l.ext,
      invoices: { id: inv.id, vendor_id: inv.vendorId, invoice_date: inv.dateIso, created_at: inv.createdAt },
    }),
    qty: l.qty,
    unit: l.unit,
    unitPrice: l.unitPrice,
    ext: l.ext,
    category: categoryLabel(l.category),
    catColor: categoryColor(l.category),
    needsConfirm: false,
    confirmed: true,
    expanded: false,
    verification: l.missing ? 'missing' : 'received',
    type: 'charge',
    voided: false,
  }));
  return {
    id: inv.id, vendorId: inv.vendorId, vendorName: inv.vendorName,
    invoiceNumber: inv.invoiceNumber, date: formatDate(inv.dateIso), dateIso: inv.dateIso,
    uploadedAt: inv.createdAt,
    subtotal: inv.subtotal, tax: inv.tax, total: inv.total, status: 'saved', pages: 1,
    hasMissingItems: lineItems.some((l) => l.verification === 'missing'), hasNote: false,
    lineItems,
  };
}

// The tour's invoice library uses the same fictional ledger as the dashboard
// (newest upload first).
export function buildDemoInvoices(now = new Date()): Invoice[] {
  return buildDemoLedger(now).invoices.map(toInvoice);
}

// The invoice shown on the review screen in captures: the latest Cascade
// Foodservice delivery (18 lines, includes the fryer-oil increase), freshly
// scanned — nothing confirmed yet, one handwritten quantity flagged for a
// quick check. Its content is date-independent and is exactly what
// launch-assets/brand/demo-invoice.svg prints (scripts/capture/render-demo-invoice.mjs).
export function buildDemoReviewInvoice(now = new Date()): Invoice {
  const inv = buildDemoLedger(now).invoices.find((i) => i.vendor === 'cascade' && i.k === 0)!;
  const base = toInvoice(inv);
  return {
    ...base,
    status: 'scanned',
    lineItems: base.lineItems.map((l) => ({
      ...l,
      verification: 'pending',
      confirmed: false,
      ...(l.desc.startsWith('French Fries')
        ? { needsConfirm: true, confirmNote: 'Uncertain: qty — please confirm' }
        : {}),
    })),
  };
}

// ---- Fixtures for the store-bypassing hooks --------------------------------
// Derived from the same ledger at module load (the tour runs within a session,
// so a fixed `now` here is fine).

const LOADED = new Date();
const LOADED_LEDGER = buildDemoLedger(LOADED);

function streakFrom(ledger: DemoLedger, now: Date): Omit<UploadStreak, 'loading' | 'refresh'> {
  const day = (iso: string) => Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000);
  const days = new Set(ledger.invoices.map((i) => day(localIso(new Date(i.createdAt)))));
  const today = day(localIso(now));
  const loggedToday = days.has(today);
  let streak = 0;
  for (let d = loggedToday ? today : today - 1; days.has(d); d--) streak++;
  let longest = 0, run = 0, prev = NaN;
  for (const d of [...days].sort((a, b) => a - b)) { run = d === prev + 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = d; }
  return { streak, loggedToday, longestStreak: longest };
}

export const DEMO_STREAK: Omit<UploadStreak, 'loading' | 'refresh'> = streakFrom(LOADED_LEDGER, LOADED);

// Harbor Seafood invoices about weekly, but its last two deliveries were never
// scanned — the "you probably forgot to log an invoice" flag.
export const DEMO_MISSING_FLAGS: MissingInvoiceFlag[] = (() => {
  const harbor = LOADED_LEDGER.invoices.filter((i) => i.vendor === 'harbor');
  const last = harbor.reduce((acc, i) => (i.dateIso > acc ? i.dateIso : acc), '');
  const today = new Date(LOADED.getFullYear(), LOADED.getMonth(), LOADED.getDate());
  return last ? [{
    vendorId: DEMO_VENDORS.harbor.id,
    vendorName: DEMO_VENDORS.harbor.name,
    daysSince: Math.round((today.getTime() - isoDate(last).getTime()) / 86400000),
    typicalGapDays: 7,
    cadenceLabel: 'about weekly',
  }] : [];
})();

// Increases whose delivery falls in this calendar month (usePriceAlertCount).
export const DEMO_PRICE_ALERT_COUNT = LOADED_LEDGER.alerts
  .filter((a) => a.priceDate >= localIso(new Date(LOADED.getFullYear(), LOADED.getMonth(), 1))).length;

// The tour presents Pro (useEntitlement), so the meter is against Pro's cap.
export const DEMO_EXTRACTION_USAGE = (() => {
  const monthStart = new Date(LOADED.getFullYear(), LOADED.getMonth(), 1).getTime();
  const used = LOADED_LEDGER.invoices.filter((i) => new Date(i.createdAt).getTime() >= monthStart).length;
  const cap = invoiceCapForPlan('pro');
  return { used, cap, remaining: cap - used };
})();
