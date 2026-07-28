import { formatDate, categoryColor, categoryLabel } from './invoicePipeline';
import type {
  Vendor, DayData, CategorySpend, TopItem, UploadActivityEntry,
  DeliveryGapEntry, PriceAlert,
} from '../store/useStore';
import type { RecipeListItem } from './recipeCosting';
import type { MissingInvoiceFlag } from '../hooks/useMissingInvoices';
import type { UploadStreak } from '../hooks/useUploadStreak';

// Client-side sample dataset that powers the first-run product tour. This is a
// port of the old demo-screenshot SQL seed (deleted) into app-shape state, so
// the real screens render populated without ever touching Supabase.
//
// Key design point: the store buckets spend against `new Date()` ("this week"
// / "this month"), so the fixture is built RELATIVE TO `now` at demo start —
// a synthetic invoice ledger dated N days back from today, run through a
// compact reducer that mirrors fetchDashboardSummary's bucketing. Hardcoding
// the seed's original June–July 2026 dates would leave the spend cards empty
// on any other calendar date.

// ---- Fixed demo vendors (ids/colors from the original seed) ----------------

const V = {
  cascade: { id: 'demo-v-cascade', name: 'Cascade Foodservice', color: '#5DB075' },
  golden: { id: 'demo-v-golden', name: 'Golden Valley Produce', color: '#5B7FD4' },
  pinnacle: { id: 'demo-v-pinnacle', name: 'Pinnacle Meats', color: '#E09030' },
  harbor: { id: 'demo-v-harbor', name: 'Harbor Seafood Co.', color: '#4AABB8' },
} as const;

type VendorKey = keyof typeof V;

interface DemoLineItem {
  name: string;
  category: string;
  ext: number;
}
interface DemoInvoice {
  id: string;
  vendor: VendorKey;
  daysAgo: number;
  items: DemoLineItem[];
}

// Synthetic ledger: recent first. `daysAgo` is subtracted from `now`, so some
// invoices fall in this week, this month, and the previous month (the latter
// gives the week/month %-change deltas real baselines). Most-recent invoice is
// 1 day ago (not today), matching DEMO_STREAK.loggedToday = false.
const LEDGER: DemoInvoice[] = [
  { id: 'demo-inv-01', vendor: 'pinnacle', daysAgo: 1, items: [{ name: 'Chicken Thigh, boneless', category: 'protein', ext: 94.2 }] },
  { id: 'demo-inv-02', vendor: 'golden', daysAgo: 2, items: [{ name: 'Roma Tomatoes, 25 lb', category: 'produce', ext: 34.5 }, { name: 'Thai basil', category: 'produce', ext: 8.0 }] },
  { id: 'demo-inv-03', vendor: 'cascade', daysAgo: 3, items: [{ name: 'Olive Oil X-Virgin', category: 'dry_goods', ext: 41.2 }, { name: 'Rice noodles', category: 'dry_goods', ext: 22.0 }, { name: 'Coconut milk', category: 'dry_goods', ext: 18.0 }] },
  { id: 'demo-inv-04', vendor: 'harbor', daysAgo: 5, items: [{ name: 'Shrimp 16/20', category: 'seafood', ext: 78.0 }] },
  { id: 'demo-inv-05', vendor: 'pinnacle', daysAgo: 9, items: [{ name: 'Chicken Thigh, boneless', category: 'protein', ext: 88.5 }] },
  { id: 'demo-inv-06', vendor: 'golden', daysAgo: 12, items: [{ name: 'Roma Tomatoes, 25 lb', category: 'produce', ext: 31.0 }, { name: 'Bean sprouts', category: 'produce', ext: 13.5 }] },
  { id: 'demo-inv-07', vendor: 'cascade', daysAgo: 16, items: [{ name: 'Olive Oil X-Virgin', category: 'dry_goods', ext: 38.1 }, { name: 'Rice noodles', category: 'dry_goods', ext: 21.0 }] },
  { id: 'demo-inv-08', vendor: 'harbor', daysAgo: 20, items: [{ name: 'Shrimp 16/20', category: 'seafood', ext: 72.0 }] },
  { id: 'demo-inv-09', vendor: 'pinnacle', daysAgo: 25, items: [{ name: 'Chicken Thigh, boneless', category: 'protein', ext: 80.0 }] },
  { id: 'demo-inv-10', vendor: 'cascade', daysAgo: 31, items: [{ name: 'Olive Oil X-Virgin', category: 'dry_goods', ext: 37.5 }, { name: 'Coconut milk', category: 'dry_goods', ext: 17.0 }] },
  { id: 'demo-inv-11', vendor: 'golden', daysAgo: 35, items: [{ name: 'Roma Tomatoes, 25 lb', category: 'produce', ext: 30.0 }] },
  { id: 'demo-inv-12', vendor: 'harbor', daysAgo: 39, items: [{ name: 'Shrimp 16/20', category: 'seafood', ext: 70.0 }] },
];

// ---- Local date helpers (mirror the private ones in store/useStore.ts) ------

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}
function dayIndexMonFirst(d: Date): number {
  return (d.getDay() + 6) % 7;
}
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
function monthBucketCount(year: number, month: number): number {
  return Math.ceil(daysInMonth(year, month) / 7);
}
function monthBucketIndex(dom: number, bucketCount: number): number {
  return Math.min(Math.floor((dom - 1) / 7), bucketCount - 1);
}
function monthBucketLabel(bucketIndex: number, year: number, month: number): string {
  const dayStart = bucketIndex * 7 + 1;
  const dayEnd = Math.min(dayStart + 6, daysInMonth(year, month));
  return dayStart === dayEnd ? `${dayStart}` : `${dayStart}–${dayEnd}`;
}
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function addSeg(bar: DayData, vId: string, vName: string, vColor: string, amount: number) {
  const seg = bar.breakdown.find((s) => s.vendorId === vId);
  if (seg) seg.amount += amount;
  else bar.breakdown.push({ vendorId: vId, name: vName, amount, color: vColor });
}
function roundBars(bars: DayData[]) {
  for (const bar of bars) {
    bar.total = Math.round(bar.total * 100) / 100;
    for (const seg of bar.breakdown) seg.amount = Math.round(seg.amount * 100) / 100;
  }
}
// ---- Types -----------------------------------------------------------------

export interface DemoDashboard {
  vendors: Vendor[];
  weekTotal: number;
  weekPctChange: number;
  dayData: DayData[];
  monthTotal: number;
  monthPctChange: number;
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

export function buildDemoState(now: Date = new Date()): DemoState {
  const y = now.getFullYear();
  const m = now.getMonth();
  const weekStart = mondayOf(now);
  const weekStartStr = localDateStr(weekStart);
  const prevWeekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7);
  const prevWeekStartStr = localDateStr(prevWeekStart);

  // Resolve each ledger entry to a concrete Date + total.
  const resolved = LEDGER.map((inv) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - inv.daysAgo);
    const total = inv.items.reduce((s, it) => s + it.ext, 0);
    return { ...inv, date, total, vendorInfo: V[inv.vendor] };
  });

  // dayData — 7 bars Mon–Sun for the current week.
  const dayData: DayData[] = DAY_LABELS.map((label) => ({ label, total: 0, breakdown: [] }));
  // monthData — ~7-day buckets for the current month.
  const bucketCount = monthBucketCount(y, m);
  const monthData: DayData[] = Array.from({ length: bucketCount }, (_, i) => ({
    label: monthBucketLabel(i, y, m), total: 0, breakdown: [],
  }));
  // allYearData — single bar for the current year.
  const yearBar: DayData = { label: String(y), total: 0, breakdown: [] };

  let weekTotal = 0;
  let monthTotal = 0;

  for (const inv of resolved) {
    const d = inv.date;
    const v = inv.vendorInfo;
    const dStr = localDateStr(d);

    // Current week
    if (dStr >= weekStartStr && dayIndexMonFirst(d) >= 0) {
      const inThisWeek = d >= weekStart && d < new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
      if (inThisWeek) {
        const bar = dayData[dayIndexMonFirst(d)];
        bar.total += inv.total;
        addSeg(bar, v.id, v.name, v.color, inv.total);
        weekTotal += inv.total;
      }
    }

    // Current month
    if (d.getFullYear() === y && d.getMonth() === m) {
      const bar = monthData[monthBucketIndex(d.getDate(), bucketCount)];
      bar.total += inv.total;
      addSeg(bar, v.id, v.name, v.color, inv.total);
      monthTotal += inv.total;
    }

    // Current year bar
    if (d.getFullYear() === y) {
      yearBar.total += inv.total;
      addSeg(yearBar, v.id, v.name, v.color, inv.total);
    }
  }

  roundBars(dayData);
  roundBars(monthData);
  roundBars([yearBar]);

  // categorySpend — sum extended price by category across the ledger.
  const catMap = new Map<string, number>();
  for (const inv of resolved) {
    for (const it of inv.items) catMap.set(it.category, (catMap.get(it.category) ?? 0) + it.ext);
  }
  const categorySpend: CategorySpend[] = [...catMap.entries()]
    .map(([category, amount]) => ({
      category: categoryLabel(category),
      amount: Math.round(amount * 100) / 100,
      color: categoryColor(category),
    }))
    .sort((a, b) => b.amount - a.amount);

  // topItems — Pareto over item spend across the ledger.
  const itemMap = new Map<string, number>();
  for (const inv of resolved) {
    for (const it of inv.items) itemMap.set(it.name, (itemMap.get(it.name) ?? 0) + it.ext);
  }
  const ranked = [...itemMap.entries()].sort((a, b) => b[1] - a[1]);
  const itemTotal = ranked.reduce((s, [, amt]) => s + amt, 0) || 1;
  let cumulative = 0;
  const topItems: TopItem[] = ranked.slice(0, 6).map(([name, amount]) => {
    const p = (amount / itemTotal) * 100;
    cumulative += p;
    return {
      name,
      amount: Math.round(amount * 100) / 100,
      pct: Math.round(p),
      cumulativePct: Math.round(cumulative),
    };
  });

  // uploadActivity — most recent invoices, with relative upload labels.
  const uploadActivity: UploadActivityEntry[] = [...resolved]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8)
    .map((inv) => {
      const wk = localDateStr(mondayOf(inv.date));
      let periodLabel = 'This week';
      let isBackdated = false;
      if (wk !== weekStartStr) {
        isBackdated = true;
        periodLabel = wk === prevWeekStartStr ? 'Last week' : `${Math.max(2, Math.round((weekStart.getTime() - new Date(wk + 'T00:00:00').getTime()) / (7 * 86400000)))} weeks ago`;
      }
      const uploadedLabel = inv.daysAgo <= 0 ? 'Today' : inv.daysAgo === 1 ? 'Yesterday' : `${inv.daysAgo} days ago`;
      return {
        id: inv.id,
        vendorId: inv.vendorInfo.id,
        vendorName: inv.vendorInfo.name,
        vendorColor: inv.vendorInfo.color,
        amount: Math.round(inv.total * 100) / 100,
        invoiceDateLabel: formatDate(localDateStr(inv.date)),
        uploadedLabel,
        periodLabel,
        isBackdated,
      };
    });

  // Vendors — invoice count + last order from the ledger.
  const vendors: Vendor[] = (Object.keys(V) as VendorKey[]).map((key) => {
    const info = V[key];
    const mine = resolved.filter((r) => r.vendor === key);
    const last = mine.reduce<Date | null>((acc, r) => (!acc || r.date > acc ? r.date : acc), null);
    return {
      id: info.id,
      name: info.name,
      color: info.color,
      invoiceCount: mine.length,
      lastOrder: last ? formatDate(localDateStr(last)) : '',
    };
  });

  // Delivery gap — the one 'missing' line item (Bean sprouts, Golden Valley).
  const gapInv = resolved.find((r) => r.id === 'demo-inv-06')!;
  const deliveryGapItems: DeliveryGapEntry[] = [{
    id: 'demo-gap-01',
    invoiceId: gapInv.id,
    vendorName: V.golden.name,
    itemName: 'Bean sprouts',
    amount: 13.5,
    dateLabel: formatDate(localDateStr(gapInv.date)),
  }];
  const deliveryGapTotal = 13.5;

  // Price alerts — three, dated a few days back relative to now.
  const alertDate = (daysAgo: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const priceAlerts: PriceAlert[] = [
    {
      id: 'demo-alert-01', itemName: 'Chicken Thigh, boneless', vendorId: V.pinnacle.id,
      vendorName: V.pinnacle.name, previousPrice: 1.62, newPrice: 1.94, unit: 'lb',
      pctChange: 19.8, absChange: 0.32, detectedAt: alertDate(3), read: false,
    },
    {
      id: 'demo-alert-02', itemName: 'Olive Oil X-Virgin', vendorId: V.cascade.id,
      vendorName: V.cascade.name, previousPrice: 38.1, newPrice: 41.2, unit: '',
      pctChange: 8.1, absChange: 3.1, detectedAt: alertDate(3), read: true,
    },
    {
      id: 'demo-alert-03', itemName: 'Roma Tomatoes, 25 lb', vendorId: V.golden.id,
      vendorName: V.golden.name, previousPrice: 31.0, newPrice: 34.5, unit: '25lb',
      pctChange: 11.3, absChange: 3.5, detectedAt: alertDate(9), read: true,
    },
  ];

  const recipes: RecipeListItem[] = [
    { id: 'demo-recipe-01', name: 'Pad Thai', costEstimate: 3.12, confidence: 0.85, menuPrice: 12.0 },
    { id: 'demo-recipe-02', name: 'Green Curry Chicken', costEstimate: 4.35, confidence: 0.7, menuPrice: 16.0 },
    { id: 'demo-recipe-03', name: 'Tom Yum Soup', costEstimate: 2.8, confidence: 0.5, menuPrice: 11.0 },
  ];

  return {
    dashboard: {
      vendors,
      weekTotal: Math.round(weekTotal * 100) / 100,
      // Fixed, believable demo deltas — the real period-over-period baselines
      // would swing wildly depending on which weekday "today" is.
      weekPctChange: weekTotal > 0 ? -6.4 : 0,
      dayData,
      monthTotal: Math.round(monthTotal * 100) / 100,
      monthPctChange: -12.1,
      monthData,
      allYearData: [yearBar],
      categorySpend,
      topItems,
      uploadActivity,
      deliveryGapTotal,
      deliveryGapItems,
    },
    priceAlerts,
    recipes,
  };
}

// Convenience for the Recipes tab, which owns its list in local state.
export function buildDemoRecipes(): RecipeListItem[] {
  return buildDemoState().recipes;
}

// ---- Static fixtures for the store-bypassing hooks -------------------------

export const DEMO_STREAK: Omit<UploadStreak, 'loading' | 'refresh'> = {
  streak: 3,
  loggedToday: false,
  longestStreak: 5,
};

export const DEMO_MISSING_FLAGS: MissingInvoiceFlag[] = [{
  vendorId: V.pinnacle.id,
  vendorName: V.pinnacle.name,
  daysSince: 9,
  typicalGapDays: 4,
  cadenceLabel: 'a couple times a week',
}];

export const DEMO_PRICE_ALERT_COUNT = 1;
export const DEMO_EXTRACTION_USAGE = { used: 6, cap: 10, remaining: 4 };
