// RevenueCat → Clerk fulfillment. RevenueCat calls this on subscription
// lifecycle events; we verify the shared-secret header and flip the org's plan
// flag accordingly. This is the source of truth for entitlement — the client
// only ever *reads* the plan (organization.publicMetadata.plan), it never
// grants it. Directly replaces stripe-webhook (see IAP_MIGRATION_PLAN.md).
//
// Deploy with verify_jwt = false (RevenueCat sends no Clerk user token):
//   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
// Requires secrets:
//   CLERK_SECRET_KEY          (already set — reused from the extract-invoice/Stripe path)
//   REVENUECAT_WEBHOOK_AUTH   (the exact Authorization header value you set in the
//                              RevenueCat dashboard webhook config)
//     npx supabase secrets set REVENUECAT_WEBHOOK_AUTH=<random-string>
// Point the RevenueCat webhook (Project → Integrations → Webhooks) at:
//   https://<project-ref>.functions.supabase.co/revenuecat-webhook
//
// KEY MAPPING: RevenueCat's `app_user_id` IS the Clerk org id, because the
// client calls Purchases.logIn(organization.id) (lib/purchases.ts). So the
// event's app_user_id is exactly what updateOrgMetadata expects.

import { updateOrgMetadata, getOrganization } from '../_shared/clerkAuth.ts';

const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');

// RevenueCat event types → what they mean for the org's plan flag.
//   grant   → set 'pro'
//   revoke  → set 'free'
//   ignore  → don't touch the flag (e.g. CANCELLATION: the user turned off
//             auto-renew but is still entitled until EXPIRATION fires later).
// BILLING_ISSUE is treated as a grace window (keep 'pro'), mirroring the Stripe
// webhook's handling of 'past_due'.
type Action = 'grant' | 'revoke' | 'ignore';

// Which paid tier a grant event maps to. Prefer the entitlement ids on the
// event; fall back to the product id (our ids embed the tier word, e.g.
// `sift_plus_monthly`). Defaults to 'pro' if it can't tell, so a paying
// customer is never under-provisioned. Keep tiers in sync with the app.
function tierFromEvent(event: any): 'plus' | 'pro' {
  const ents: string[] = event.entitlement_ids ?? (event.entitlement_id ? [event.entitlement_id] : []);
  if (ents.includes('pro')) return 'pro';
  if (ents.includes('plus')) return 'plus';
  const pid: string = event.product_id ?? event.new_product_id ?? '';
  if (pid.includes('pro')) return 'pro';
  if (pid.includes('plus')) return 'plus';
  return 'pro';
}

function actionForEvent(type: string): Action {
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'NON_RENEWING_PURCHASE':
    case 'BILLING_ISSUE': // grace — keep Pro
      return 'grant';
    case 'EXPIRATION':
      return 'revoke';
    case 'CANCELLATION': // still entitled until expiry; wait for EXPIRATION
    case 'TRANSFER':      // handled separately below (two app_user_ids)
    case 'TEST':
    default:
      return 'ignore';
  }
}

// RevenueCat delivers webhooks at-least-once and without ordering guarantees —
// a retried/delayed event can arrive after a newer one already changed the
// org's plan. Track the last applied event id + timestamp in the org's own
// Clerk private_metadata (no new table needed) and only apply an event that's
// both new and not older than what's already applied. Same guard the Stripe
// webhook uses.
async function shouldApply(orgId: string, id: string, timestampMs: number): Promise<boolean> {
  try {
    const org = await getOrganization(orgId);
    const lastId = org.private_metadata?.revenuecat_last_event_id;
    const lastTs = org.private_metadata?.revenuecat_last_event_ts;
    if (lastId === id) return false; // exact duplicate delivery
    if (typeof lastTs === 'number' && timestampMs < lastTs) return false; // stale/out-of-order
    return true;
  } catch {
    // Can't confirm ordering — fail open rather than dropping what might be a
    // real cancellation/expiration.
    return true;
  }
}

function stamp(id: string, timestampMs: number) {
  return { revenuecat_last_event_id: id, revenuecat_last_event_ts: timestampMs };
}

Deno.serve(async (req) => {
  // Auth: RevenueCat sends the fixed Authorization header value you configured.
  const auth = req.headers.get('Authorization');
  if (!WEBHOOK_AUTH || auth !== WEBHOOK_AUTH) {
    return new Response('Unauthorized', { status: 401 });
  }

  let event: any;
  try {
    const body = await req.json();
    event = body?.event;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!event?.type || !event?.id) {
    return new Response('Missing event', { status: 400 });
  }

  try {
    // --- TRANSFER: entitlement moved between app_user_ids (e.g. org re-key).
    // Revoke the old id, grant the new one. Rare; handle before the generic path.
    if (event.type === 'TRANSFER') {
      const from: string[] = event.transferred_from ?? [];
      const to: string[] = event.transferred_to ?? [];
      const ts = Number(event.event_timestamp_ms ?? Date.now());
      for (const orgId of from) {
        if (await shouldApply(orgId, event.id, ts)) {
          await updateOrgMetadata(orgId, {
            public_metadata: { plan: 'free' },
            private_metadata: stamp(event.id, ts),
          });
        }
      }
      for (const orgId of to) {
        if (await shouldApply(orgId, event.id, ts)) {
          await updateOrgMetadata(orgId, {
            public_metadata: { plan: tierFromEvent(event) },
            private_metadata: stamp(event.id, ts),
          });
        }
      }
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const action = actionForEvent(event.type);
    // app_user_id is the Clerk org id (see header). Skip anonymous ids just in
    // case a purchase happened before identifyOrg() ran.
    const orgId: string | undefined = event.app_user_id;
    const ts = Number(event.event_timestamp_ms ?? Date.now());

    if (action !== 'ignore' && orgId && !orgId.startsWith('$RCAnonymousID:')) {
      const plan = action === 'grant' ? tierFromEvent(event) : 'free';
      if (await shouldApply(orgId, event.id, ts)) {
        await updateOrgMetadata(orgId, {
          public_metadata: { plan },
          private_metadata: stamp(event.id, ts),
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    // 500 tells RevenueCat to retry (transient Clerk error, metadata write failed…).
    return new Response(`Handler error: ${(err as Error).message}`, { status: 500 });
  }
});
