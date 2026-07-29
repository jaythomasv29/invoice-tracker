import { useCallback, useEffect, useState } from 'react';
import { useOrganization } from '@clerk/clerk-expo';
import { useSupabase } from '../lib/supabase';
import { useEntitlement } from './useEntitlement';
import { useStore } from '../store/useStore';
import { DEMO_EXTRACTION_USAGE } from '../lib/demoData';

// This calendar month's extraction count for the org, against the current tier's
// monthly cap ("X of N left this month"). Counts invoices that reached extraction
// (status scanned/saved) since the 1st — the same definition the edge function
// enforces server-side. Every tier is capped now (Free 10, Plus 300, Pro 500).
export function useExtractionUsage() {
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const { invoiceCap } = useEntitlement();
  const demoMode = useStore((s) => s.demoMode);
  const [used, setUsed] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (demoMode) return; // demo usage returned below.
    if (!organization?.id) return;
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { count, error } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .in('status', ['scanned', 'saved'])
      .gte('created_at', monthStart);
    // On a failed query, leave the last known `used` in place rather than
    // falling back to 0 — showing "0 used" on a query error tells a
    // free-tier user they have a full quota when they may actually be at
    // (or over) the cap, inviting a confusing paywall bounce mid-scan.
    if (!error) setUsed(count ?? 0);
    setLoading(false);
  }, [supabase, organization?.id, demoMode]);

  useEffect(() => { refresh(); }, [refresh]);

  if (demoMode) {
    return { ...DEMO_EXTRACTION_USAGE, loading: false, refresh: async () => {} };
  }
  const cap = invoiceCap;
  const remaining = used == null ? cap : Math.max(0, cap - used);
  return { used: used ?? 0, cap, remaining, loading, refresh };
}
