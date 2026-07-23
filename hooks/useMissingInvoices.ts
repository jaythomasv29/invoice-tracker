import { useCallback, useEffect, useState } from 'react';
import { useOrganization } from '@clerk/clerk-expo';
import { useSupabase } from '../lib/supabase';

export interface MissingInvoiceFlag {
  vendorId: string;
  vendorName: string;
  daysSince: number;      // days since this vendor's most recent invoice
  typicalGapDays: number; // their usual cadence (median gap), rounded
  cadenceLabel: string;   // human cadence, e.g. "about weekly"
}

// Minimum invoices needed to trust a vendor's cadence.
const MIN_HISTORY = 3;
// Flag when the current gap exceeds the usual cadence by this factor…
const LATE_FACTOR = 1.6;
// …but always allow at least this many extra days of slack (so a daily vendor
// isn't flagged the moment they're a few hours late).
const MIN_SLACK_DAYS = 3;

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function cadenceLabel(gapDays: number): string {
  if (gapDays <= 2) return 'most days';
  if (gapDays <= 4) return 'a couple times a week';
  if (gapDays <= 10) return 'about weekly';
  if (gapDays <= 18) return 'every couple weeks';
  return 'about monthly';
}

function dayNumber(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 86400000);
}

// Detects vendors who invoice on a regular cadence but have gone quiet longer
// than usual — i.e. "you probably forgot to log an invoice." This is a
// cadence-gap check, distinct from delivery reconciliation. Pro feature.
export function useMissingInvoices(enabled = true) {
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const [flags, setFlags] = useState<MissingInvoiceFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled || !organization?.id) return;
    setLoading(true);

    const { data } = await supabase
      .from('invoices')
      .select('vendor_id, invoice_date, created_at, vendors(name)')
      .eq('organization_id', organization.id)
      .eq('status', 'saved')
      .not('vendor_id', 'is', null)
      .order('created_at', { ascending: true });

    const byVendor = new Map<string, { name: string; days: number[] }>();
    for (const row of (data ?? []) as any[]) {
      const dateStr: string | undefined = row.invoice_date ?? row.created_at?.slice(0, 10);
      if (!row.vendor_id || !dateStr) continue;
      const entry = byVendor.get(row.vendor_id) ?? { name: row.vendors?.name ?? 'A vendor', days: [] as number[] };
      entry.days.push(dayNumber(dateStr));
      byVendor.set(row.vendor_id, entry);
    }

    const today = dayNumber(new Date().toISOString());
    const result: MissingInvoiceFlag[] = [];

    for (const [vendorId, { name, days }] of byVendor) {
      if (days.length < MIN_HISTORY) continue; // not enough to know a cadence
      const sorted = [...new Set(days)].sort((a, b) => a - b);
      if (sorted.length < MIN_HISTORY) continue;

      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);
      const typicalGap = median(gaps);
      if (typicalGap <= 0) continue;

      const daysSince = today - sorted[sorted.length - 1];
      const threshold = Math.max(typicalGap * LATE_FACTOR, typicalGap + MIN_SLACK_DAYS);
      if (daysSince > threshold) {
        result.push({
          vendorId,
          vendorName: name,
          daysSince,
          typicalGapDays: Math.round(typicalGap),
          cadenceLabel: cadenceLabel(typicalGap),
        });
      }
    }

    // Most-overdue first.
    result.sort((a, b) => b.daysSince - a.daysSince);
    setFlags(result);
    setLoading(false);
  }, [enabled, supabase, organization?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { flags, loading, refresh };
}
