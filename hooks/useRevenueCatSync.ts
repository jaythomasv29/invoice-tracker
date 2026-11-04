import { useEffect, useRef } from 'react';
import { useOrganization } from '@clerk/clerk-expo';
import { AppState } from 'react-native';
import { useSupabase } from '../lib/supabase';
import { syncSubscription } from '../lib/subscriptionSync';
import { identifyOrg, signOutPurchases } from '../lib/purchases';

// Keeps the RevenueCat identity bound to the active Clerk organization. The Pro
// plan is org-scoped, so RevenueCat's App User ID must be the org id — that's
// what the entitlement attaches to and what the revenuecat-webhook keys the
// plan flag on (see IAP_MIGRATION_PLAN.md). No-ops until purchases are
// configured (off iOS / no SDK key). Mount once from the authenticated shell.
export function useRevenueCatSync(): void {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const supabase = useSupabase();
  const currentOrg = useRef(organization);
  currentOrg.current = organization;

  useEffect(() => {
    if (orgId) {
      identifyOrg(orgId).catch(() => {
        // Best-effort — a failed logIn shouldn't break the app shell. The next
        // purchase attempt will surface any real problem.
      });
    } else {
      signOutPurchases().catch(() => {});
    }
  }, [orgId]);

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
