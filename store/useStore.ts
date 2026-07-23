import { create } from 'zustand';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatDate, fallbackVendorColor, categoryColor, categoryLabel } from '../lib/invoicePipeline';

export type VerificationStatus = 'pending' | 'received' | 'missing';
export type LineItemType = 'charge' | 'credit';

export interface LineItem {
  id: string;
  desc: string;
  // Verbatim as printed on the invoice — kept for provenance/audit even
  // though `desc` (the sanitized clean_name) is what's shown as the title.
  // Undefined when they're identical, so the UI can skip a redundant line.
  rawDesc?: string;
  qty: number;
  unit: string;
  unitPrice: number;
  ext: number;
  category: string;
  catColor: string;
  needsConfirm: boolean;
  confirmNote?: string;
  confirmed: boolean;
  expanded: boolean;
  verification: VerificationStatus;
  // Free-text comment entered on the confirm/save screen — the only
  // reconciliation trail now that the dispute tracker is gone.
  note?: string;
  type: LineItemType;
  // Reversible delete — voided items stay visible (greyed out, restorable)
  // but drop out of the invoice's subtotal/total and category spend.
  voided: boolean;
}

export interface Invoice {
  id: string;
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  date: string;
  // Raw ISO (yyyy-mm-dd) backing `date` — null when extraction found no
  // date. Editable in the review screen; `date` is re-derived from it.
  dateIso: string | null;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'scanned' | 'saved';
  pages: number;
  imageUris?: string[];
  // Derived from lineItems — powers the "missing item(s)" / "note" pills on
  // invoice list rows without every list needing its own line-item scan.
  hasMissingItems: boolean;
  hasNote: boolean;
}

export interface PriceAlert {
  id: string;
  itemName: string;
  vendorName: string;
  previousPrice: number;
  newPrice: number;
  unit: string;
  pctChange: number;
  absChange: number;
  detectedAt: string;
  read: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  color: string;
  // All-time count of saved invoices from this vendor — period-scoped
  // spend is derived on demand via vendorAmountFromBars instead.
  invoiceCount: number;
  lastOrder: string;
  contactPhone?: string;
  contactName?: string;
  accountNumber?: string;
}

export interface DayData {
  label: string;
  total: number;
  breakdown: { vendorId: string | null; name: string; amount: number; color: string }[];
}

export interface CategorySpend {
  category: string;
  amount: number;
  color: string;
}

export interface TopItem {
  name: string;
  amount: number;        // all-time spend on this item
  pct: number;           // share of total item spend (0-100)
  cumulativePct: number; // running cumulative share, for the 80/20 line
}

export type SpendPeriod = 'week' | 'month' | 'year' | 'all';

export interface UploadActivityEntry {
  id: string;
  vendorId: string | null;
  vendorName: string;
  vendorColor: string;
  amount: number;
  invoiceDateLabel: string;
  uploadedLabel: string;
  periodLabel: string;
  // True when the invoice's date falls outside the current calendar week —
  // i.e. it was uploaded now but landed in a past (or future) week's totals
  // instead of "This week's spend", which is otherwise invisible there.
  isBackdated: boolean;
}

interface AppState {
  // Invoice
  currentInvoice: Invoice | null;
  scanStage: 'idle' | 'processing' | 'done';

  // Dashboard
  spendView: SpendPeriod;
  yearsBack: number;
  selectedDay: number | null;
  weekTotal: number;
  weekPctChange: number;
  dayData: DayData[];
  monthTotal: number;
  monthPctChange: number;
  monthData: DayData[];
  // One bar per calendar year that has any invoice activity (plus the
  // current year even if empty), oldest first — the "year"/"all time"
  // views slice or sum this rather than each needing their own fetch.
  allYearData: DayData[];
  categorySpend: CategorySpend[];
  topItems: TopItem[];
  uploadActivity: UploadActivityEntry[];

  // Alerts
  priceAlerts: PriceAlert[];

  // Vendors
  vendors: Vendor[];

  // Toast
  toast: string | null;

  // Actions
  setScanStage: (stage: 'idle' | 'processing' | 'done') => void;
  setSpendView: (view: SpendPeriod) => void;
  setYearsBack: (n: number) => void;
  selectDay: (i: number | null) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  markAlertRead: (supabase: SupabaseClient, id: string) => void;

  // Invoice review actions
  setCurrentInvoice: (invoice: Invoice | null) => void;
  setCurrentInvoiceDate: (isoDate: string) => void;
  confirmItem: (itemId: string) => void;
  toggleItemExpand: (itemId: string) => void;
  setVerification: (itemId: string, status: VerificationStatus) => void;
  setItemNote: (itemId: string, note: string) => void;
  saveCurrentInvoice: (supabase: SupabaseClient) => Promise<void>;
  fetchDashboardSummary: (supabase: SupabaseClient, organizationId: string) => Promise<void>;
  fetchPriceAlerts: (supabase: SupabaseClient, organizationId: string) => Promise<void>;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_VENDOR_COLOR = '#9696A8';

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

// 0 = Mon .. 6 = Sun, matching DAY_LABELS.
function dayIndexMonFirst(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Buckets a month into ~7-day chunks (day 1-7, 8-14, ...) rather than
// calendar weeks, so every bucket stays inside the selected month instead
// of bleeding into the adjacent one at the start/end.
function monthBucketCount(year: number, month: number): number {
  return Math.ceil(daysInMonth(year, month) / 7);
}

function monthBucketIndex(dateStr: string, bucketCount: number): number {
  const dayOfMonth = Number(dateStr.slice(8, 10));
  return Math.min(Math.floor((dayOfMonth - 1) / 7), bucketCount - 1);
}

function monthBucketLabel(bucketIndex: number, year: number, month: number): string {
  const dayStart = bucketIndex * 7 + 1;
  const dayEnd = Math.min(dayStart + 6, daysInMonth(year, month));
  return dayStart === dayEnd ? `${dayStart}` : `${dayStart}–${dayEnd}`;
}

function startOfWeekStr(dateStr: string): string {
  return localDateStr(mondayOf(new Date(`${dateStr}T00:00:00`)));
}

function periodLabelFor(dateStr: string, currentWeekStartStr: string): { label: string; isBackdated: boolean } {
  const wkStart = startOfWeekStr(dateStr);
  if (wkStart === currentWeekStartStr) return { label: 'This week', isBackdated: false };

  const diffDays = Math.round(
    (new Date(`${currentWeekStartStr}T00:00:00`).getTime() - new Date(`${wkStart}T00:00:00`).getTime()) / 86400000
  );
  const diffWeeks = Math.round(diffDays / 7);
  if (diffWeeks < 0) return { label: 'Scheduled ahead', isBackdated: true };
  if (diffWeeks === 1) return { label: 'Last week', isBackdated: true };
  if (diffWeeks <= 8) return { label: `${diffWeeks} weeks ago`, isBackdated: true };

  const d = new Date(`${wkStart}T00:00:00`);
  return { label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), isBackdated: true };
}

function vendorDisplay(vendorId: string | null, vendorById: Map<string, any>): { name: string; color: string } {
  const vendor = vendorId ? vendorById.get(vendorId) : null;
  return {
    name: vendor?.name ?? 'Unknown vendor',
    color: vendor ? (vendor.color || fallbackVendorColor(vendor.id)) : DEFAULT_VENDOR_COLOR,
  };
}

// Derives a single vendor's total within a period from the same
// per-bucket breakdown data the aggregate chart already renders, so
// per-vendor spend (Home's vendor list, the Vendors-page pills) doesn't
// need its own fetch or its own per-vendor bucketing pass.
export function vendorAmountFromBars(barData: DayData[], vendorId: string): number {
  let sum = 0;
  for (const bar of barData) {
    for (const seg of bar.breakdown) {
      if (seg.vendorId === vendorId) sum += seg.amount;
    }
  }
  return Math.round(sum * 100) / 100;
}

function relativeUploadLabel(createdAtIso: string | null | undefined): string {
  if (!createdAtIso) return '';
  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime())) return '';

  const diffMin = Math.floor((Date.now() - created.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<AppState>((set, get) => ({
  currentInvoice: null,
  scanStage: 'idle',
  selectedDay: null,
  spendView: 'month',
  yearsBack: 1,
  weekTotal: 0,
  weekPctChange: 0,
  dayData: DAY_LABELS.map((label) => ({ label, total: 0, breakdown: [] })),
  monthTotal: 0,
  monthPctChange: 0,
  monthData: [],
  allYearData: [],
  categorySpend: [],
  topItems: [],
  uploadActivity: [],
  priceAlerts: [],
  vendors: [],
  toast: null,

  setScanStage: (stage) => set({ scanStage: stage }),
  setSpendView: (view) => set({ spendView: view, selectedDay: null }),
  setYearsBack: (n) => set({ yearsBack: Math.max(1, n), selectedDay: null }),
  selectDay: (i) => set((s) => ({ selectedDay: s.selectedDay === i ? null : i })),

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 2200);
  },
  clearToast: () => set({ toast: null }),
  markAlertRead: (supabase, id) => {
    set((s) => ({ priceAlerts: s.priceAlerts.map((a) => a.id === id ? { ...a, read: true } : a) }));
    supabase.from('price_alerts').update({ read: true }).eq('id', id).then();
  },

  setCurrentInvoice: (invoice) => set({ currentInvoice: invoice }),

  setCurrentInvoiceDate: (isoDate) => set((s) => ({
    currentInvoice: s.currentInvoice ? {
      ...s.currentInvoice,
      dateIso: isoDate,
      date: formatDate(isoDate),
    } : null,
  })),

  confirmItem: (itemId) => set((s) => ({
    currentInvoice: s.currentInvoice ? {
      ...s.currentInvoice,
      lineItems: s.currentInvoice.lineItems.map((it) =>
        it.id === itemId ? { ...it, confirmed: true, expanded: false } : it
      ),
    } : null,
  })),

  toggleItemExpand: (itemId) => set((s) => ({
    currentInvoice: s.currentInvoice ? {
      ...s.currentInvoice,
      lineItems: s.currentInvoice.lineItems.map((it) =>
        it.id === itemId ? { ...it, expanded: !it.expanded } : it
      ),
    } : null,
  })),

  setVerification: (itemId, status) => set((s) => ({
    currentInvoice: s.currentInvoice ? {
      ...s.currentInvoice,
      lineItems: s.currentInvoice.lineItems.map((it) =>
        it.id === itemId ? { ...it, verification: it.verification === status ? 'pending' : status } : it
      ),
    } : null,
  })),

  setItemNote: (itemId, note) => set((s) => ({
    currentInvoice: s.currentInvoice ? {
      ...s.currentInvoice,
      lineItems: s.currentInvoice.lineItems.map((it) =>
        it.id === itemId ? { ...it, note: note || undefined } : it
      ),
    } : null,
  })),

  saveCurrentInvoice: async (supabase) => {
    const { currentInvoice } = get();
    if (!currentInvoice) return;

    const { error: invoiceErr } = await supabase
      .from('invoices')
      .update({ status: 'saved', invoice_date: currentInvoice.dateIso })
      .eq('id', currentInvoice.id);
    if (invoiceErr) throw new Error(`Could not save invoice: ${invoiceErr.message}`);

    const lineItemResults = await Promise.all(
      currentInvoice.lineItems.map((it) => {
        const reconciliation_status = it.verification;
        return supabase
          .from('invoice_line_items')
          .update({
            reconciliation_status,
            confirmed: it.confirmed,
            note: it.note ?? null,
          })
          .eq('id', it.id);
      })
    );
    const lineItemErr = lineItemResults.find((r) => r.error)?.error;
    if (lineItemErr) throw new Error(`Could not save all line items: ${lineItemErr.message}`);

    set({ currentInvoice: null, scanStage: 'idle' });
    get().showToast('Invoice saved');
  },

  // Powers both the Vendors tab and the home dashboard's spend card/bar
  // chart — computed from the same saved-invoices fetch so wiring both up
  // doesn't mean two near-identical queries.
  fetchDashboardSummary: async (supabase, organizationId) => {
    const { data: vendorRows, error: vendorErr } = await supabase
      .from('vendors')
      .select('id, name, color, contact_name, contact_phone, account_number')
      .eq('organization_id', organizationId);
    if (vendorErr) return;

    const { data: invoiceRows, error: invoiceErr } = await supabase
      .from('invoices')
      .select('id, vendor_id, total, invoice_date, created_at, invoice_line_items(clean_name, category, extended_price, line_item_type, voided_at)')
      .eq('organization_id', organizationId)
      .eq('status', 'saved')
      .order('created_at', { ascending: false });
    if (invoiceErr) return;

    const today = new Date();
    const weekStart = mondayOf(today);
    const weekStartStr = localDateStr(weekStart);
    const weekEndStr = localDateStr(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6));
    const prevWeekStartStr = localDateStr(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7));

    const monthYear = today.getFullYear();
    const monthIdx = today.getMonth();
    const monthStartStr = localDateStr(new Date(monthYear, monthIdx, 1));
    const monthEndStr = localDateStr(new Date(monthYear, monthIdx + 1, 0));
    const prevMonthYear = monthIdx === 0 ? monthYear - 1 : monthYear;
    const prevMonthIdx = monthIdx === 0 ? 11 : monthIdx - 1;
    const prevMonthStartStr = localDateStr(new Date(prevMonthYear, prevMonthIdx, 1));
    const prevMonthEndStr = localDateStr(new Date(prevMonthYear, prevMonthIdx + 1, 0));
    const bucketCount = monthBucketCount(monthYear, monthIdx);

    const vendorById = new Map((vendorRows ?? []).map((v: any) => [v.id, v]));
    const vendorStats = new Map<string, { totalInvoiceCount: number; lastOrder: string | null }>();
    const dayTotals = DAY_LABELS.map(() => 0);
    const dayBreakdowns = DAY_LABELS.map(() => new Map<string, { vendorId: string | null; name: string; amount: number; color: string }>());
    const monthBucketTotals = Array.from({ length: bucketCount }, () => 0);
    const monthBucketBreakdowns = Array.from({ length: bucketCount }, () => new Map<string, { vendorId: string | null; name: string; amount: number; color: string }>());
    const categoryTotals = new Map<string, number>();
    // All-time spend per item (keyed by clean_name) for the top-spend/Pareto view.
    const itemTotals = new Map<string, number>();
    // Total spend per calendar year, across every invoice regardless of
    // date — backs the year-stepper/all-time view without a re-fetch.
    const yearlyTotals = new Map<number, number>();
    const yearlyBreakdowns = new Map<number, Map<string, { vendorId: string | null; name: string; amount: number; color: string }>>();
    let weekTotal = 0;
    let prevWeekTotal = 0;
    let monthTotal = 0;
    let prevMonthTotal = 0;

    for (const inv of invoiceRows ?? []) {
      // invoice_date is model-extracted and occasionally missing (or wrong,
      // on a bad OCR read) — created_at is always real, so it's the
      // fallback rather than silently dropping the invoice from every chart.
      const dateStr: string | undefined = inv.invoice_date ?? inv.created_at?.slice(0, 10);
      if (!dateStr) continue;
      const amount = Number(inv.total ?? 0);
      const vendorId = inv.vendor_id as string | null;
      // Un-keyed rows would otherwise collide under a shared 'unknown' bucket.
      const breakdownKey = vendorId ?? '__unknown__';

      if (vendorId) {
        const entry = vendorStats.get(vendorId) ?? { totalInvoiceCount: 0, lastOrder: null };
        if (!entry.lastOrder || dateStr > entry.lastOrder) entry.lastOrder = dateStr;
        entry.totalInvoiceCount += 1;
        vendorStats.set(vendorId, entry);
      }

      const { name: vendorName, color: vendorColor } = vendorDisplay(vendorId, vendorById);

      // All-time per-item spend (by clean_name) for the top-spend / 80-20
      // Pareto view — charges only, voided items excluded. Runs for every
      // invoice regardless of period, unlike the week-scoped category totals.
      for (const li of (inv as any).invoice_line_items ?? []) {
        if (li.voided_at || li.line_item_type === 'credit') continue;
        const itemName = (li.clean_name ?? '').trim() || 'Unnamed item';
        itemTotals.set(itemName, (itemTotals.get(itemName) ?? 0) + Number(li.extended_price ?? 0));
      }

      if (dateStr >= weekStartStr && dateStr <= weekEndStr) {
        weekTotal += amount;

        const dow = dayIndexMonFirst(dateStr);
        dayTotals[dow] += amount;
        const bucket = dayBreakdowns[dow];
        const existing = bucket.get(breakdownKey);
        if (existing) existing.amount += amount;
        else bucket.set(breakdownKey, { vendorId, name: vendorName, amount, color: vendorColor });

        for (const li of (inv as any).invoice_line_items ?? []) {
          if (li.voided_at) continue;
          const cat = (li.category ?? '').toLowerCase() || 'other';
          categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + Number(li.extended_price ?? 0));
        }
      } else if (dateStr >= prevWeekStartStr && dateStr < weekStartStr) {
        prevWeekTotal += amount;
      }

      // Month bucketing runs independently of the week check above — a date
      // can be in the current month without being in the current week.
      if (dateStr >= monthStartStr && dateStr <= monthEndStr) {
        monthTotal += amount;
        const bIdx = monthBucketIndex(dateStr, bucketCount);
        monthBucketTotals[bIdx] += amount;
        const bucket = monthBucketBreakdowns[bIdx];
        const existing = bucket.get(breakdownKey);
        if (existing) existing.amount += amount;
        else bucket.set(breakdownKey, { vendorId, name: vendorName, amount, color: vendorColor });
      } else if (dateStr >= prevMonthStartStr && dateStr <= prevMonthEndStr) {
        prevMonthTotal += amount;
      }

      const invYear = Number(dateStr.slice(0, 4));
      yearlyTotals.set(invYear, (yearlyTotals.get(invYear) ?? 0) + amount);
      const yearBucket = yearlyBreakdowns.get(invYear) ?? new Map<string, { vendorId: string | null; name: string; amount: number; color: string }>();
      const yearExisting = yearBucket.get(breakdownKey);
      if (yearExisting) yearExisting.amount += amount;
      else yearBucket.set(breakdownKey, { vendorId, name: vendorName, amount, color: vendorColor });
      yearlyBreakdowns.set(invYear, yearBucket);
    }

    const dayData: DayData[] = DAY_LABELS.map((label, i) => ({
      label,
      total: Math.round(dayTotals[i] * 100) / 100,
      breakdown: Array.from(dayBreakdowns[i].values()).map((v) => ({
        vendorId: v.vendorId, name: v.name, amount: Math.round(v.amount * 100) / 100, color: v.color,
      })),
    }));

    const weekPctChange = prevWeekTotal > 0
      ? Math.round(((weekTotal - prevWeekTotal) / prevWeekTotal) * 1000) / 10
      : (weekTotal > 0 ? 100 : 0);

    const monthData: DayData[] = monthBucketTotals.map((total, i) => ({
      label: monthBucketLabel(i, monthYear, monthIdx),
      total: Math.round(total * 100) / 100,
      breakdown: Array.from(monthBucketBreakdowns[i].values()).map((v) => ({
        vendorId: v.vendorId, name: v.name, amount: Math.round(v.amount * 100) / 100, color: v.color,
      })),
    }));

    // Always include the current year, even with no invoices yet, so the
    // year/all-time view always has at least one bar to show.
    if (!yearlyTotals.has(monthYear)) yearlyTotals.set(monthYear, 0);
    const allYearData: DayData[] = Array.from(yearlyTotals.keys())
      .sort((a, b) => a - b)
      .map((y) => ({
        label: String(y),
        total: Math.round((yearlyTotals.get(y) ?? 0) * 100) / 100,
        breakdown: Array.from((yearlyBreakdowns.get(y) ?? new Map()).values()).map((v: any) => ({
          vendorId: v.vendorId, name: v.name, amount: Math.round(v.amount * 100) / 100, color: v.color,
        })),
      }));

    const monthPctChange = prevMonthTotal > 0
      ? Math.round(((monthTotal - prevMonthTotal) / prevMonthTotal) * 1000) / 10
      : (monthTotal > 0 ? 100 : 0);

    const vendors: Vendor[] = (vendorRows ?? []).map((v: any) => {
      const stats = vendorStats.get(v.id);
      return {
        id: v.id,
        name: v.name,
        color: v.color || fallbackVendorColor(v.id),
        invoiceCount: stats?.totalInvoiceCount ?? 0,
        lastOrder: stats?.lastOrder ? formatDate(stats.lastOrder) : '—',
        contactName: v.contact_name ?? undefined,
        contactPhone: v.contact_phone ?? undefined,
        accountNumber: v.account_number ?? undefined,
      };
    });

    const categorySpend: CategorySpend[] = Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category: categoryLabel(category),
        amount: Math.round(amount * 100) / 100,
        color: categoryColor(category),
      }))
      .sort((a, b) => b.amount - a.amount);

    // invoiceRows is already ordered by created_at desc, so the most
    // recently uploaded invoices — regardless of what week they're dated —
    // are simply the first N rows.
    const uploadActivity: UploadActivityEntry[] = (invoiceRows ?? []).slice(0, 8).map((inv: any) => {
      const dateStr: string | undefined = inv.invoice_date ?? inv.created_at?.slice(0, 10);
      const { name: vendorName, color: vendorColor } = vendorDisplay(inv.vendor_id ?? null, vendorById);
      const { label: periodLabel, isBackdated } = dateStr
        ? periodLabelFor(dateStr, weekStartStr)
        : { label: 'Undated', isBackdated: false };

      return {
        id: inv.id,
        vendorId: inv.vendor_id ?? null,
        vendorName,
        vendorColor,
        amount: Math.round(Number(inv.total ?? 0) * 100) / 100,
        invoiceDateLabel: dateStr ? formatDate(dateStr) : 'No date',
        uploadedLabel: relativeUploadLabel(inv.created_at),
        periodLabel,
        isBackdated,
      };
    });

    // Top-spend items (Pareto): items ranked by all-time spend, each with its
    // share of total and the running cumulative share, so the UI can draw the
    // 80/20 line. Capped to the top 20.
    const itemRanked = Array.from(itemTotals.entries())
      .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const itemGrandTotal = itemRanked.reduce((s, x) => s + x.amount, 0);
    let cumulative = 0;
    const topItems: TopItem[] = itemRanked.slice(0, 20).map((x) => {
      const pct = itemGrandTotal > 0 ? (x.amount / itemGrandTotal) * 100 : 0;
      cumulative += pct;
      return {
        name: x.name,
        amount: x.amount,
        pct: Math.round(pct * 10) / 10,
        cumulativePct: Math.round(cumulative * 10) / 10,
      };
    });

    set({
      vendors,
      weekTotal: Math.round(weekTotal * 100) / 100, weekPctChange, dayData,
      monthTotal: Math.round(monthTotal * 100) / 100, monthPctChange, monthData,
      allYearData,
      categorySpend, uploadActivity, topItems,
    });
  },

  fetchPriceAlerts: async (supabase, organizationId) => {
    const { data, error } = await supabase
      .from('price_alerts')
      .select('id, item_name, previous_price, new_price, unit, pct_change, read, detected_at, vendors(name)')
      .eq('organization_id', organizationId)
      .order('detected_at', { ascending: false });
    if (error) return;

    const priceAlerts: PriceAlert[] = (data ?? []).map((row: any) => ({
      id: row.id,
      itemName: row.item_name,
      vendorName: row.vendors?.name ?? 'Unknown vendor',
      previousPrice: Number(row.previous_price),
      newPrice: Number(row.new_price),
      unit: row.unit ?? '',
      pctChange: Number(row.pct_change),
      absChange: Math.round((Number(row.new_price) - Number(row.previous_price)) * 100) / 100,
      detectedAt: new Date(row.detected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      read: row.read ?? false,
    }));

    set({ priceAlerts });
  },
}));
