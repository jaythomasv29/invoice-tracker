export type BillingPlan = 'free' | 'plus' | 'pro';
const PRODUCTS: Record<string, BillingPlan> = { sift_plus_monthly: 'plus', sift_pro_monthly: 'pro' };
export function planFromSubscriber(subscriber: any, allowSandbox: boolean, now = Date.now()): BillingPlan {
  const entitlements = subscriber?.entitlements ?? {};
  for (const tier of ['pro', 'plus'] as const) {
    const entitlement = entitlements[tier];
    if (!entitlement || PRODUCTS[entitlement.product_identifier] !== tier) continue;
    const subscription = subscriber?.subscriptions?.[entitlement.product_identifier];
    if (!subscription || subscription.store !== 'app_store') continue;
    if (subscription.is_sandbox && !allowSandbox) continue;
    const end = Math.max(Date.parse(entitlement.expires_date ?? '') || 0,
      Date.parse(subscription.grace_period_expires_date ?? '') || 0);
    if (end > now) return tier;
  }
  return 'free';
}
export function isOrgId(id: unknown): id is string {
  return typeof id === 'string' && /^org_[a-zA-Z0-9]+$/.test(id);
}
