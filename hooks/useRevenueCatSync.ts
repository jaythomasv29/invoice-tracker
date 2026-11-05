import { useWorkspace } from '../lib/workspaceContext';
import { useEffect, useRef } from 'react';

import { AppState } from 'react-native';
import { useSupabase } from '../lib/supabase';
import { syncSubscription } from '../lib/subscriptionSync';
import { identifyOrg, signOutPurchases } from '../lib/purchases';

// Keep one verified billing-owner identity across Personal and Business.
// Mode-specific entitlements are reconciled independently by the server.
export function useRevenueCatSync(): void {
  const { organization } = useWorkspace();
  const orgId = organization?.id;
  const supabase = useSupabase();
  const currentOrg = useRef(organization);
  currentOrg.current = organization;

  useEffect(() => {
    if (orgId) {
      identifyOrg(organization!.billingCustomerId).catch(() => {
        // Best-effort — a failed logIn shouldn't break the app shell. The next
        // purchase attempt will surface any real problem.
      });
    } else {
      signOutPurchases().catch(() => {});
    }
  }, [orgId, organization?.billingCustomerId]);

  // Refresh authoritative access on cold launch and return from Apple settings.
  // Cancellation alone does not revoke access; the server checks paid-through expiry.
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    const refresh = async () => {
      if (!orgId || pending) return;
      pending = true;
      try {
        await syncSubscription(supabase);
        if (!cancelled && currentOrg.current?.id === orgId) await currentOrg.current.reload();
      } catch { /* retain cached state while offline; the server still enforces access */ }
      finally { pending = false; }
    };
    void refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { cancelled = true; listener.remove(); };
  }, [orgId, supabase]);
}
