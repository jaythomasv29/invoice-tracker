import { useOrganization } from '@clerk/clerk-expo';
import { planFromOrg, type Plan } from '../lib/entitlements';
import { useStore } from '../store/useStore';

// Reads the current restaurant's plan off Clerk org publicMetadata. Use this
// for all UI gating (`isPro`). The server independently re-checks the plan for
// the extraction cap, so this can't be spoofed into free API usage.
export function useEntitlement(): { plan: Plan; isPro: boolean } {
  const { organization } = useOrganization();
  const demoMode = useStore((s) => s.demoMode);
  // The product tour presents the full Pro experience so gated cards (spend
  // trends, price alerts, recipe costing) render populated.
  if (demoMode) return { plan: 'pro', isPro: true };
  const plan = planFromOrg(organization);
  return { plan, isPro: plan === 'pro' };
}
