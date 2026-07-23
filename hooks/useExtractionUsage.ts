import { useCallback, useEffect, useState } from 'react';
import { useOrganization } from '@clerk/clerk-expo';
import { useSupabase } from '../lib/supabase';
import { FREE_MONTHLY_EXTRACTION_CAP } from '../lib/entitlements';

// This calendar month's extraction count for the org, for the free-tier credit
// meter ("X of 10 left this month"). Counts invoices that reached extraction
// (status scanned/saved) since the 1st — the same definition the edge function
// enforces server-side. Pro orgs can ignore `remaining`.
export function useExtractionUsage() {
  const supabase = useSupabase();
  const { organization } = useOrganization();
  const [used, setUsed] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { count } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .in('status', ['scanned', 'saved'])
      .gte('created_at', monthStart);
    setUsed(count ?? 0);
    setLoading(false);
  }, [supabase, organization?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const cap = FREE_MONTHLY_EXTRACTION_CAP;
  const remaining = used == null ? cap : Math.max(0, cap - used);
  return { used: used ?? 0, cap, remaining, loading, refresh };
}
