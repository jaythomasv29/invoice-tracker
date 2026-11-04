export type SubscriptionEntitlement = {
  isActive: boolean; willRenew: boolean; expirationDate: string | null;
  billingIssueDetectedAt?: string | null; isSandbox?: boolean;
};
export function subscriptionStatusText(e: SubscriptionEntitlement | null, now = Date.now(), tier = 'Pro'): string {
  if (!e) return 'No active Apple subscription';
  const end = e.expirationDate ? Date.parse(e.expirationDate) : NaN;
  const date = Number.isFinite(end) ? new Date(end).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : null;
  if (!e.isActive) return date && end <= now ? `${tier} ended ${date}` : `No active ${tier} subscription`;
  if (e.billingIssueDetectedAt) return 'Billing issue — check Apple subscription settings for your access and payment status';
  if (Number.isFinite(end) && end <= now) return 'Subscription status is updating — check Apple subscription settings';
  if (!e.willRenew) return date ? `Auto-renewal off · ${tier} access until ${date}` : 'Auto-renewal off · check Apple for your access end date';
  return date ? `Renews ${date}` : 'Active · check Apple subscription settings for renewal details';
}
