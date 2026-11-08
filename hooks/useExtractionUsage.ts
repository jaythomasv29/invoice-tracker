import { useWorkspace } from '../lib/workspaceContext';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useSupabase } from '../lib/supabase';
import { useEntitlement } from './useEntitlement';
import { useStore } from '../store/useStore';
import { demoFixtures } from '../lib/demoData';
import { usageResetLabel } from '../lib/entitlements';

// Every mounted meter re-reads its count when a scan finishes (the scan queue
// calls notifyExtractionUsageChanged), so tab screens that stay mounted —
// Profile's "X of N used" — don't show a stale number until relaunch.
const usageListeners = new Set<() => void>();
export function notifyExtractionUsageChanged() {
  usageListeners.forEach((listener) => listener());
}

// This calendar month's extraction count for the org, against the current tier's
// monthly cap ("X of N left this month"). Counts invoices that reached extraction
// (status scanned/saved) since the 1st — the same definition the edge function
// enforces server-side. Allowances depend on workspace type and plan (shared/workspacePolicy.ts).
export function useExtractionUsage() {
  const supabase = useSupabase();
  const { organization } = useWorkspace();
  const { invoiceCap } = useEntitlement();
  const demoMode = useStore((s) => s.demoMode);
  const demoKind = useStore((s) => s.demoKind);
  const [used, setUsed] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (demoMode) return; // demo usage returned below.
    if (!organization?.id) return;
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data, error } = await supabase
      .from('extraction_usage')
      .select('used')
      .eq('organization_id', organization.id)
      .eq('month_start', monthStart.slice(0, 10))
      .maybeSingle();
    // On a failed query, leave the last known `used` in place rather than
    // falling back to 0 — showing "0 used" on a query error tells a
    // free-tier user they have a full quota when they may actually be at
    // (or over) the cap, inviting a confusing paywall bounce mid-scan.
    if (!error) setUsed(data?.used ?? 0);
    setLoading(false);
  }, [supabase, organization?.id, demoMode]);

  // Refresh whenever the screen regains focus (covers the initial mount too).
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    const listener = () => { void refresh(); };
    usageListeners.add(listener);
    return () => { usageListeners.delete(listener); };
  }, [refresh]);

  if (demoMode) {
    return { ...demoFixtures(demoKind).extractionUsage, loading: false, refresh: async () => {}, resetsOn: usageResetLabel() };
  }
  const cap = invoiceCap;
  const remaining = used == null ? cap : Math.max(0, cap - used);
  return { used: used ?? 0, cap, remaining, loading, refresh, resetsOn: usageResetLabel() };
}
