import { useCallback, useEffect, useState } from 'react';
import { useOrganization } from '@clerk/clerk-expo';
import { useSupabase } from '../lib/supabase';
import { localDateFromTimestamp } from '../lib/invoicePipeline';
import { useStore } from '../store/useStore';
import { DEMO_STREAK } from '../lib/demoData';

export interface UploadStreak {
  streak: number; // consecutive local days ending today (or yesterday if today not yet logged)
  loggedToday: boolean; // ≥1 upload whose local created_at day is today
  longestStreak: number; // personal best within the fetched window
  loading: boolean;
  refresh: () => Promise<void>;
}

// How far back we look for the streak. Bounds the row count (a heavy org
// uploading several invoices/day is still only a few thousand single-column
// rows a year). Tradeoff: a current streak or personal best longer than this
// would be clipped at the window edge — effectively never hit for a
// daily-upload restaurant. Drop the `.gte` below to make it exact.
const STREAK_WINDOW_DAYS = 365;

// A local yyyy-mm-dd string -> an integer day index. Parsing the already-local
// date string as UTC midnight gives a stable, timezone-independent index; the
// same basis is used for `localToday` so the two are directly comparable.
function dayNum(localDateStr: string): number {
  return Math.floor(Date.parse(localDateStr + 'T00:00:00Z') / 86_400_000);
}

// Today's LOCAL calendar day as the same integer index basis as `dayNum`.
function localToday(): number {
  const n = new Date();
  return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86_400_000);
}

// Daily upload streak for the org, derived from `invoices.created_at`. Mirrors
// the `useExtractionUsage` / `useMissingInvoices` pattern (useSupabase +
// useOrganization + a useCallback refresh). Uses `created_at` (the true upload
// time), never `invoice_date` (backdated/nullable), and buckets by LOCAL day
// via `localDateFromTimestamp` so a late-night scan counts for the right day.
export function useUploadStreak(): UploadStreak {
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const demoMode = useStore((s) => s.demoMode);
  const [streak, setStreak] = useState(0);
  const [loggedToday, setLoggedToday] = useState(false);
  const [longestStreak, setLongestStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (demoMode) return; // demo values are returned below, don't query.
    if (!organization?.id) return;
    setLoading(true);
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - STREAK_WINDOW_DAYS);
    const { data, error } = await supabase
      .from('invoices')
      .select('created_at')
      .eq('organization_id', organization.id)
      .in('status', ['scanned', 'saved'])
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: false });

    // On a failed query, leave the last known streak in place rather than
    // zeroing it — flashing "streak lost" on a transient error would be a
    // demoralizing lie. Same convention as useExtractionUsage.
    if (error) {
      setLoading(false);
      return;
    }

    // Collapse to distinct local days — multiple uploads the same day count once.
    const days = new Set<number>();
    for (const row of (data ?? []) as { created_at: string }[]) {
      const local = localDateFromTimestamp(row.created_at);
      if (local) days.add(dayNum(local));
    }

    const today = localToday();
    const isLoggedToday = days.has(today);

    // Current streak: anchor at today if logged, else yesterday — so the number
    // holds through the whole of today and only the "at risk" styling changes
    // until an upload lands.
    let current = 0;
    let cursor = isLoggedToday ? today : today - 1;
    while (days.has(cursor)) {
      current++;
      cursor--;
    }

    // Personal best = longest run of consecutive day indices in the window.
    const sorted = [...days].sort((a, b) => a - b);
    let longest = 0;
    let run = 0;
    let prev: number | null = null;
    for (const d of sorted) {
      run = prev !== null && d === prev + 1 ? run + 1 : 1;
      if (run > longest) longest = run;
      prev = d;
    }
    longest = Math.max(longest, current);

    setStreak(current);
    setLoggedToday(isLoggedToday);
    setLongestStreak(longest);
    setLoading(false);
  }, [supabase, organization?.id, demoMode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (demoMode) return { ...DEMO_STREAK, loading: false, refresh: async () => {} };
  return { streak, loggedToday, longestStreak, loading, refresh };
}
