import { syncBilling } from '../_shared/billingSync.ts';
import { adminClient } from '../_shared/aiControls.ts';
import { isWorkspaceId } from '../_shared/billingState.ts';
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!secret || req.headers.get('Authorization') !== secret) return new Response('Unauthorized', { status: 401 });
  try {
    const { event } = await req.json();
    if (!event?.id || !event?.type) return new Response('Invalid event', { status: 400 });
    const appId = Deno.env.get('REVENUECAT_APP_ID');
    if (!appId) throw new Error('RevenueCat app verification is not configured');
    if (event.app_id !== appId) return new Response('Unexpected app', { status: 400 });
    if (event.type === 'TEST') return Response.json({ received: true });
    // Events are wake-up signals only. Replay and ordering cannot directly grant/revoke plans.
    const identities = new Set([event.app_user_id, ...(event.aliases ?? []), ...(event.transferred_from ?? []), ...(event.transferred_to ?? [])].filter(isWorkspaceId));
    const workspaces=new Set<string>();
    for(const customer of identities){
      const {data:links,error}=await adminClient().from('workspace_billing_links').select('workspace_id').eq('customer_id',customer);
      if(error)throw error;
      if(links?.length)for(const link of links)workspaces.add(link.workspace_id);
      if(!links?.length||customer.startsWith('org_'))workspaces.add(customer);
    }
    for(const workspace of workspaces)await syncBilling(workspace);
    return Response.json({ received: true });
  } catch {
    console.error('Subscription synchronization failed');
    return new Response('Synchronization failed; retry required', { status: 503 });
  }
});
