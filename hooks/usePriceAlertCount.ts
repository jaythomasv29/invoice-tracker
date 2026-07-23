import { useCallback, useEffect, useState } from 'react';
import { useOrganization } from '@clerk/clerk-expo';
import { useSupabase } from '../lib/supabase';

// This calendar month's price-alert count for the org — a cheap count query
// (no rows fetched) used to tease free users on the locked Alerts tab
// ("3 price increases this month"). Pro users read the full list instead via
// the store's fetchPriceAlerts.
export function usePriceAlertCount() {
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { count: c } = await supabase
      .from('price_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .gte('detected_at', monthStart);
    setCount(c ?? 0);
  }, [supabase, organization?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { count: count ?? 0, refresh };
}
