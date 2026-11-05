/** Shared by the native app and Edge Functions; server enforces every allowance. */
export type AccountType = 'personal' | 'business';
export type Plan = 'free' | 'plus' | 'pro';
export const WORKSPACE_PLANS = {
  personal: {
    free: { scans: 5, recipes: 0 },
    pro: { scans: 40, recipes: 0 },
    monthlyUsd: 4.99,
    product: 'sift_personal_pro_monthly',
    entitlement: 'personal_pro',
  },
  business: {
    free: { scans: 10, recipes: 0 },
    pro: { scans: 100, recipes: 10 },
    monthlyUsd: 9.99,
    product: 'sift_pro_monthly',
    entitlement: 'pro',
  },
} as const;
export function accountTypeForId(id: string | null | undefined): AccountType {
  return id?.startsWith('pws_') ? 'personal' : 'business';
}
export function scanCap(plan: Plan, type: AccountType = 'business'): number {
  if (plan === 'plus' && type === 'business') return 300; // retired product, preserve existing purchases
  return WORKSPACE_PLANS[type][plan === 'free' ? 'free' : 'pro'].scans;
}
export function recipeCap(plan: Plan, type: AccountType): number {
  return type === 'business' && plan !== 'free' ? 10 : 0;
}
