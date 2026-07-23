// Opens a Stripe billing-portal session for the org's existing subscription,
// so the org admin can update payment methods, change plans, or cancel.

import { corsHeaders } from '../_shared/cors.ts';
import { getStripe } from '../_shared/stripe.ts';
import { getOrgId, getOrganization } from '../_shared/clerkAuth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const orgId = getOrgId(authHeader);
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'No organization in session' }), {
        status: 401,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const org = await getOrganization(orgId);
    const customerId = org.private_metadata?.stripe_customer_id;
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'No active subscription found' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: Deno.env.get('APP_RETURN_URL') ?? 'https://example.com/billing-return',
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
