import { useOrganization } from '@clerk/clerk-expo';
import { planFromOrg, type Plan } from '../lib/entitlements';

// Reads the current restaurant's plan off Clerk org publicMetadata. Use this
// for all UI gating (`isPro`). The server independently re-checks the plan for
// the extraction cap, so this can't be spoofed into free API usage.
export function useEntitlement(): { plan: Plan; isPro: boolean } {
  const { organization } = useOrganization();
  const plan = planFromOrg(organization);
  return { plan, isPro: plan === 'pro' };
}
