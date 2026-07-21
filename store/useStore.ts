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
  disputeVal: number;
  type: LineItemType;
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
  weekSpend: number;
  invoiceCount: number;
  lastOrder: string;
  contactPhone?: string;
  contactName?: string;
  accountNumber?: string;
}

export interface DayData {
  label: string;
  total: number;
  breakdown: { name: string; amount: number; color: string }[];
}

export interface CategorySpend {
  category: string;
  amount: number;
  color: string;
}

export interface VerificationBreakdown {
  received: number;
  missing: number;
  pending: number;
}

export interface DisputeEntry {
  id: string;
  itemName: string;
  vendorId: string;
  vendorName: string;
  vendorColor: string;
  vendorContactName?: string;
  vendorContactPhone?: string;
  date: string;
  amount: number;
}

interface AppState {
  // Invoice
  currentInvoice: Invoice | null;
  scanStage: 'idle' | 'processing' | 'done';
  todayInvoiceCount: number;

  // Dashboard
  selectedDay: number | null;
  weekTotal: number;
  weekPctChange: number;
  dayData: DayData[];
  categorySpend: CategorySpend[];
  verificationBreakdown: VerificationBreakdown;
  flaggedShortAmount: number;
  flaggedShortCount: number;
  disputedItems: DisputeEntry[];

  // Alerts
  priceAlerts: PriceAlert[];

  // Vendors
  vendors: Vendor[];

  // Toast
  toast: string | null;

  // Actions
  setScanStage: (stage: 'idle' | 'processing' | 'done') => void;
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
  saveCurrentInvoice: (supabase: SupabaseClient, organizationId: string) => Promise<void>;
  fetchTodayInvoiceCount: (supabase: SupabaseClient, organizationId: string) => Promise<void>;
  fetchDeliverySnapshot: (supabase: SupabaseClient, organizationId: string) => Promise<void>;
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

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<AppState>((set, get) => ({
  currentInvoice: null,
  scanStage: 'idle',
  todayInvoiceCount: 0,
  selectedDay: null,
  weekTotal: 0,
  weekPctChange: 0,
  dayData: DAY_LABELS.map((label) => ({ label, total: 0, breakdown: [] })),
  categorySpend: [],
  verificationBreakdown: { received: 0, missing: 0, pending: 0 },
  flaggedShortAmount: 0,
  flaggedShortCount: 0,
  disputedItems: [],
  priceAlerts: [],
  vendors: [],
  toast: null,

  setScanStage: (stage) => set({ scanStage: stage }),
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

  saveCurrentInvoice: async (supabase, organizationId) => {
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
          })
          .eq('id', it.id);
      })
    );
    const lineItemErr = lineItemResults.find((r) => r.error)?.error;
    if (lineItemErr) throw new Error(`Could not save all line items: ${lineItemErr.message}`);

    const missingItems = currentInvoice.lineItems.filter((it) => it.verification === 'missing');
    if (missingItems.length > 0) {
      const { error: disputeErr } = await supabase.from('delivery_disputes').insert(
        missingItems.map((it) => ({
          organization_id: organizationId,
          invoice_id: currentInvoice.id,
          line_item_id: it.id,
          amount: it.ext,
          status: 'open',
        }))
      );
      if (disputeErr) throw new Error(`Could not record delivery disputes: ${disputeErr.message}`);
    }

    set((s) => ({
      currentInvoice: null,
      scanStage: 'idle',
      todayInvoiceCount: s.todayInvoiceCount + 1,
    }));
    get().showToast('Invoice saved');
  },

  fetchTodayInvoiceCount: async (supabase, organizationId) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'saved')
      .gte('created_at', startOfToday.toISOString());

    if (error) return;
    set({ todayInvoiceCount: count ?? 0 });
  },

  fetchDeliverySnapshot: async (supabase, organizationId) => {
    const { data: statusRows, error: statusErr } = await supabase
      .from('invoice_line_items')
      .select('reconciliation_status, invoices!inner(status)')
      .eq('organization_id', organizationId)
      .eq('invoices.status', 'saved');
    if (statusErr) return;

    const breakdown: VerificationBreakdown = { received: 0, missing: 0, pending: 0 };
    for (const row of statusRows ?? []) {
      if (row.reconciliation_status === 'received') breakdown.received++;
      else if (row.reconciliation_status === 'missing' || row.reconciliation_status === 'short') breakdown.missing++;
      else breakdown.pending++;
    }

    const { data: disputeRows, error: disputeErr } = await supabase
      .from('delivery_disputes')
      .select(`
        id, amount,
        invoice_line_items(raw_description, clean_name),
        invoices(invoice_date, vendors(id, name, color, contact_name, contact_phone))
      `)
      .eq('organization_id', organizationId)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false });
    if (disputeErr) return;

    const disputedItems: DisputeEntry[] = (disputeRows ?? []).map((d: any) => {
      const vendor = d.invoices?.vendors;
      return {
        id: d.id,
        itemName: d.invoice_line_items?.clean_name || d.invoice_line_items?.raw_description || 'Unknown item',
        vendorId: vendor?.id ?? 'unknown',
        vendorName: vendor?.name ?? 'Unknown vendor',
        vendorColor: vendor ? (vendor.color || fallbackVendorColor(vendor.id)) : DEFAULT_VENDOR_COLOR,
        vendorContactName: vendor?.contact_name ?? undefined,
        vendorContactPhone: vendor?.contact_phone ?? undefined,
        date: formatDate(d.invoices?.invoice_date),
        amount: Number(d.amount ?? 0),
      };
    });
    const flaggedShortAmount = Math.round(disputedItems.reduce((a, d) => a + d.amount, 0));
    const flaggedShortCount = disputedItems.length;

    set({ verificationBreakdown: breakdown, disputedItems, flaggedShortAmount, flaggedShortCount });
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
      .select('vendor_id, total, invoice_date, created_at, invoice_line_items(category, extended_price)')
      .eq('organization_id', organizationId)
      .eq('status', 'saved');
    if (invoiceErr) return;

    const today = new Date();
    const weekStart = mondayOf(today);
    const weekStartStr = localDateStr(weekStart);
    const weekEndStr = localDateStr(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6));
    const prevWeekStartStr = localDateStr(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7));

    const vendorById = new Map((vendorRows ?? []).map((v: any) => [v.id, v]));
    const vendorStats = new Map<string, { weekSpend: number; invoiceCount: number; lastOrder: string | null }>();
    const dayTotals = DAY_LABELS.map(() => 0);
    const dayBreakdowns = DAY_LABELS.map(() => new Map<string, { amount: number; color: string }>());
    const categoryTotals = new Map<string, number>();
    let weekTotal = 0;
    let prevWeekTotal = 0;

    for (const inv of invoiceRows ?? []) {
      // invoice_date is model-extracted and occasionally missing (or wrong,
      // on a bad OCR read) — created_at is always real, so it's the
      // fallback rather than silently dropping the invoice from every chart.
      const dateStr: string | undefined = inv.invoice_date ?? inv.created_at?.slice(0, 10);
      if (!dateStr) continue;
      const amount = Number(inv.total ?? 0);
      const vendorId = inv.vendor_id as string | null;

      if (vendorId) {
        const entry = vendorStats.get(vendorId) ?? { weekSpend: 0, invoiceCount: 0, lastOrder: null };
        if (!entry.lastOrder || dateStr > entry.lastOrder) entry.lastOrder = dateStr;
        vendorStats.set(vendorId, entry);
      }

      if (dateStr >= weekStartStr && dateStr <= weekEndStr) {
        weekTotal += amount;
        if (vendorId) {
          const entry = vendorStats.get(vendorId)!;
          entry.weekSpend += amount;
          entry.invoiceCount += 1;
        }

        const dow = dayIndexMonFirst(dateStr);
        dayTotals[dow] += amount;
        const vendor = vendorId ? vendorById.get(vendorId) : null;
        const vendorName = vendor?.name ?? 'Unknown vendor';
        const vendorColor = vendor ? (vendor.color || fallbackVendorColor(vendor.id)) : DEFAULT_VENDOR_COLOR;
        const bucket = dayBreakdowns[dow];
        const existing = bucket.get(vendorName);
        if (existing) existing.amount += amount;
        else bucket.set(vendorName, { amount, color: vendorColor });

        for (const li of (inv as any).invoice_line_items ?? []) {
          const cat = (li.category ?? '').toLowerCase() || 'other';
          categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + Number(li.extended_price ?? 0));
        }
      } else if (dateStr >= prevWeekStartStr && dateStr < weekStartStr) {
        prevWeekTotal += amount;
      }
    }

    const dayData: DayData[] = DAY_LABELS.map((label, i) => ({
      label,
      total: Math.round(dayTotals[i] * 100) / 100,
      breakdown: Array.from(dayBreakdowns[i].entries()).map(([name, v]) => ({
        name, amount: Math.round(v.amount * 100) / 100, color: v.color,
      })),
    }));

    const weekPctChange = prevWeekTotal > 0
      ? Math.round(((weekTotal - prevWeekTotal) / prevWeekTotal) * 1000) / 10
      : (weekTotal > 0 ? 100 : 0);

    const vendors: Vendor[] = (vendorRows ?? []).map((v: any) => {
      const stats = vendorStats.get(v.id);
      return {
        id: v.id,
        name: v.name,
        color: v.color || fallbackVendorColor(v.id),
        weekSpend: Math.round((stats?.weekSpend ?? 0) * 100) / 100,
        invoiceCount: stats?.invoiceCount ?? 0,
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

    set({ vendors, weekTotal: Math.round(weekTotal * 100) / 100, weekPctChange, dayData, categorySpend });
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
