// Starts a Stripe Checkout session for the org's Pro subscription. Reuses the
// org's existing Stripe customer (stashed in Clerk private_metadata) if one
// exists, otherwise creates one and persists its id for next time.

import { corsHeaders } from '../_shared/cors.ts';
import { getStripe } from '../_shared/stripe.ts';
import { getOrgId, getUserId, getOrganization, getUserPrimaryEmail, updateOrgMetadata } from '../_shared/clerkAuth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email: bodyEmail } = await req.json().catch(() => ({}));

    const authHeader = req.headers.get('Authorization');
    const orgId = getOrgId(authHeader);
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'No organization in session' }), {
        status: 401,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const org = await getOrganization(orgId);
    const email = bodyEmail ?? (await getUserPrimaryEmail(getUserId(authHeader) ?? '')) ?? undefined;

    const stripe = getStripe();

    // Reuse the org's Stripe customer if one already exists; otherwise create
    // one and persist its id so future checkouts/portal sessions reuse it.
    let customerId: string = org.private_metadata?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        email,
        metadata: { org_id: orgId },
      });
      await updateOrgMetadata(orgId, { private_metadata: { stripe_customer_id: customer.id } });
      customerId = customer.id;
    }

    const priceId = Deno.env.get('STRIPE_PRICE_ID');
    if (!priceId) throw new Error('STRIPE_PRICE_ID is not set');
    const returnUrl = Deno.env.get('APP_RETURN_URL') ?? 'https://example.com/billing-return';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}?status=success`,
      cancel_url: `${returnUrl}?status=cancel`,
      client_reference_id: orgId,
      subscription_data: { metadata: { org_id: orgId } },
      allow_promotion_codes: true,
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
