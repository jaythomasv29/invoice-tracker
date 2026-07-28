// Stripe → Clerk fulfillment. Stripe calls this on subscription lifecycle
// events; we verify the signature and flip the org's plan flag accordingly.
// This is the source of truth for entitlement — the client only ever *reads*
// the plan, it never grants it.
//
// Deployed with verify_jwt = false (Stripe sends no user token); the Stripe
// signature is the auth. Requires secrets:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CLERK_SECRET_KEY
// Point a Stripe webhook endpoint at:
//   https://<project-ref>.functions.supabase.co/stripe-webhook
// subscribed to: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted.

import { getStripe } from '../_shared/stripe.ts';
import { updateOrgMetadata, getOrganization } from '../_shared/clerkAuth.ts';

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

// Subscription statuses that should keep the org on Pro (past_due gives a grace
// window rather than an instant downgrade).
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

// Stripe delivers webhooks at-least-once and does NOT guarantee order — a
// retried or delayed event can arrive after a newer one already changed the
// org's plan (e.g. a late "subscription.updated: active" retry landing after
// the real "subscription.deleted" already downgraded the org back to free).
// Applying it blindly would silently re-grant Pro. We track the last applied
// event's id + unix timestamp in the org's own Clerk private_metadata (no new
// table needed) and only apply an event that's both new (different id) and
// not older than what's already applied.
async function shouldApply(orgId: string, event: { id: string; created: number }): Promise<boolean> {
  try {
    const org = await getOrganization(orgId);
    const lastId = org.private_metadata?.stripe_last_event_id;
    const lastCreated = org.private_metadata?.stripe_last_event_created;
    if (lastId === event.id) return false; // exact duplicate delivery
    if (typeof lastCreated === 'number' && event.created < lastCreated) return false; // stale/out-of-order
    return true;
  } catch {
    // Can't confirm ordering — fail open rather than silently dropping what
    // might be a real cancellation/downgrade.
    return true;
  }
}

function eventStampMetadata(event: { id: string; created: number }) {
  return { stripe_last_event_id: event.id, stripe_last_event_created: event.created };
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  if (!sig || !WEBHOOK_SECRET) {
    return new Response('Missing signature or webhook secret', { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripe();

  let event;
  try {
    // constructEventAsync (not constructEvent) — required in Deno, which uses
    // the async Web Crypto API for the HMAC check.
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Signature verification failed: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as any;
        const orgId = s.client_reference_id as string | null;
        // For async payment methods, a completed Checkout session can still
        // have an unpaid session (payment_status: 'unpaid') — the actual
        // grant happens once customer.subscription.updated reports the
        // subscription active. Granting Pro here regardless would let a
        // not-yet-paid session unlock the product for free in the meantime.
        const paid = s.payment_status === 'paid' || s.payment_status === 'no_payment_required';
        if (orgId && paid && (await shouldApply(orgId, event))) {
          await updateOrgMetadata(orgId, {
            public_metadata: { plan: 'pro' },
            private_metadata: {
              stripe_customer_id: s.customer,
              stripe_subscription_id: s.subscription,
              ...eventStampMetadata(event),
            },
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const orgId = sub.metadata?.org_id as string | undefined;
        if (orgId && (await shouldApply(orgId, event))) {
          const active = ACTIVE_STATUSES.includes(sub.status);
          await updateOrgMetadata(orgId, {
            public_metadata: { plan: active ? 'pro' : 'free' },
            private_metadata: {
              stripe_customer_id: sub.customer,
              stripe_subscription_id: sub.id,
              ...eventStampMetadata(event),
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const orgId = sub.metadata?.org_id as string | undefined;
        if (orgId && (await shouldApply(orgId, event))) {
          await updateOrgMetadata(orgId, {
            public_metadata: { plan: 'free' },
            private_metadata: eventStampMetadata(event),
          });
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    // 500 tells Stripe to retry (metadata write failed, transient Clerk error…).
    return new Response(`Handler error: ${(err as Error).message}`, { status: 500 });
  }
});
