import { useEffect } from 'react';
import { useOrganization } from '@clerk/clerk-expo';
import { identifyOrg, signOutPurchases } from '../lib/purchases';

// Keeps the RevenueCat identity bound to the active Clerk organization. The Pro
// plan is org-scoped, so RevenueCat's App User ID must be the org id — that's
// what the entitlement attaches to and what the revenuecat-webhook keys the
// plan flag on (see IAP_MIGRATION_PLAN.md). No-ops until purchases are
// configured (off iOS / no SDK key). Mount once from the authenticated shell.
export function useRevenueCatSync(): void {
  const { organization } = useOrganization();
  const orgId = organization?.id;

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
}
