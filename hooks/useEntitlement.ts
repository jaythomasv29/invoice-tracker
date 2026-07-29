import { useOrganization } from '@clerk/clerk-expo';
import { planFromOrg, isPaidPlan, invoiceCapForPlan, type Plan } from '../lib/entitlements';
import { useStore } from '../store/useStore';

export interface Entitlement {
  plan: Plan;
  // On a paid plan (Plus or Pro) — the boolean to gate premium features on.
  isPaid: boolean;
  isPlus: boolean;
  // Strictly the top tier. Only use for genuinely Pro-only gating; for "unlocked
  // premium feature" use `isPaid` (Plus qualifies too).
  isPro: boolean;
  invoiceCap: number;
}

function entitlementFor(plan: Plan): Entitlement {
  return {
    plan,
    isPaid: isPaidPlan(plan),
    isPlus: plan === 'plus',
    isPro: plan === 'pro',
    invoiceCap: invoiceCapForPlan(plan),
  };
}

// Reads the current restaurant's plan off Clerk org publicMetadata. Use this for
// all UI gating. The server independently re-checks the plan for the extraction
// cap, so this can't be spoofed into free API usage.
//
// Two client-side overrides take precedence (neither affects the server):
//   - demoMode — the product tour presents the full Pro experience.
//   - debugPlan — the __DEV__ QA tier-switcher, to verify gating at each level.
export function useEntitlement(): Entitlement {
  const { organization } = useOrganization();
  const demoMode = useStore((s) => s.demoMode);
  const debugPlan = useStore((s) => s.debugPlan);

  if (demoMode) return entitlementFor('pro');
  if (debugPlan) return entitlementFor(debugPlan);
  return entitlementFor(planFromOrg(organization));
}
