import { useCallback, useEffect, useState } from 'react';
import { useOrganization } from '@clerk/clerk-expo';
import { useSupabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { DEMO_PRICE_ALERT_COUNT } from '../lib/demoData';

// This calendar month's price-alert count for the org — a cheap count query
// (no rows fetched) used to tease free users on the locked Alerts tab
// ("3 price increases this month"). Pro users read the full list instead via
// the store's fetchPriceAlerts.
export function usePriceAlertCount() {
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const demoMode = useStore((s) => s.demoMode);
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (demoMode) return; // demo count returned below.
    if (!organization?.id) return;
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { count: c, error } = await supabase
      .from('price_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .gte('detected_at', monthStart);
    // Keep the last known count on a failed query instead of dropping to 0 —
    // this feeds an upgrade-teaser badge, and "0 alerts" reads as "nothing to
    // see here" rather than "we couldn't check."
    if (!error) setCount(c ?? 0);
  }, [supabase, organization?.id, demoMode]);

  useEffect(() => { refresh(); }, [refresh]);

  if (demoMode) return { count: DEMO_PRICE_ALERT_COUNT, refresh: async () => {} };
  return { count: count ?? 0, refresh };
}
