import { adminClient } from './aiControls.ts';
import { getOrganization, updateOrgMetadata } from './clerkAuth.ts';
import { isWorkspaceId, planFromSubscriber } from './billingState.ts';
export async function syncBilling(orgId: string) {
  if (!isWorkspaceId(orgId)) throw new Error('Invalid restaurant identity');
  const apiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!apiKey)
    throw new Error('Subscription synchronization is not configured');
  const db = adminClient();
  const { data: lock, error } = await db.rpc('claim_billing_sync', {
    p_org: orgId,
  });
  if (error || !lock)
    throw new Error('Subscription synchronization is busy. Please retry.');
  try {
    await getOrganization(orgId); // reject deleted/nonexistent restaurant identities
    const { data: link, error: linkError } = await db
      .from('workspace_billing_links')
      .select('customer_id')
      .eq('workspace_id', orgId)
      .maybeSingle();
    if (linkError) throw new Error('Could not resolve purchase identity');
    const customerId = link?.customer_id ?? orgId;
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(customerId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error(
        'Could not verify subscription with the App Store. Please retry.',
      );
    const body = await response.json();
    const sandboxOrgs = (Deno.env.get('REVENUECAT_SANDBOX_ORGS') ?? '')
      .split(',')
      .map((x) => x.trim());
    const plan = planFromSubscriber(
      body.subscriber,
      sandboxOrgs.includes(orgId) || sandboxOrgs.includes(customerId),
      Date.now(),
      orgId.startsWith('pws_') ? 'personal' : 'business',
    );
    await updateOrgMetadata(orgId, {
      public_metadata: { plan },
      private_metadata: {
        billing_provider: 'apple',
        billing_synced_at: new Date().toISOString(),
      },
    });
    return plan;
  } finally {
    await db.rpc('release_billing_sync', { p_org: orgId, p_token: lock });
  }
}
