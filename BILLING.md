# Billing (Stripe subscriptions)

Real Pro checkout is implemented with Stripe Checkout in the browser. The plan
flag still lives on the Clerk organization (`publicMetadata.plan`); Stripe is
the payment + subscription engine, and the `stripe-webhook` function is the
single fulfillment path that flips the flag. Nothing in the app grants Pro
directly — the webhook is the source of truth. (This is App Store-friendly for
a B2B product because the purchase happens on the web, not via in-app
purchase.)

## Architecture

1. Paywall "Upgrade" → app calls the `create-checkout` edge function
   (`lib/billing.ts` → `startProCheckout`) → gets a Stripe Checkout Session URL
   → opens it in the system browser (`expo-web-browser`).
2. User pays on Stripe's hosted page.
3. Stripe sends events to the `stripe-webhook` edge function → it verifies the
   signature and sets the org's `publicMetadata.plan` to `pro` (or `free` on
   cancel), and stores `stripe_customer_id` / `stripe_subscription_id` in the
   org's `privateMetadata`.
4. Back in the app, the paywall reloads the Clerk org and picks up the new
   plan.
5. Pro users can "Manage subscription" (More tab) → `billing-portal` edge
   function → Stripe billing portal (update card / cancel).

> Note: `app/paywall.tsx`'s "Upgrade" button currently still shows a
> placeholder "Coming soon" alert rather than calling `startProCheckout`. The
> checkout/webhook/portal functions described here (`lib/billing.ts`,
> `supabase/functions/create-checkout`, `supabase/functions/stripe-webhook`,
> `supabase/functions/billing-portal`) are implemented and ready — wiring the
> paywall's button to `startProCheckout` is the remaining integration step.

## Setup

### 1. Create the product & price in Stripe (test mode first)

- Stripe Dashboard → Product catalog → add a product **"Pro"** with a
  **recurring** monthly price.
- Copy the **price ID** (starts with `price_...`) — this is `STRIPE_PRICE_ID`.

### 2. Set the edge-function secrets

All of these are server-side only — **never** prefix with `EXPO_PUBLIC_`.

| Secret | Value | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` / `sk_live_...` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | From step 4 below, after creating the endpoint |
| `STRIPE_PRICE_ID` | `price_...` | The recurring price from step 1 |
| `CLERK_SECRET_KEY` | `sk_...` | Clerk backend key; also required by `extract-invoice`'s plan gate |
| `APP_RETURN_URL` | e.g. `https://yourdomain.com/billing-return` | Optional; where Stripe returns to after checkout — a simple page you host. Defaults to a placeholder if unset |

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
npx supabase secrets set STRIPE_PRICE_ID=price_xxx
npx supabase secrets set CLERK_SECRET_KEY=sk_test_xxx
npx supabase secrets set APP_RETURN_URL=https://yourdomain.com/billing-return
# STRIPE_WEBHOOK_SECRET is set in step 4 after creating the endpoint
```

### 3. Deploy the functions

```bash
npx supabase functions deploy create-checkout
npx supabase functions deploy billing-portal
npx supabase functions deploy stripe-webhook
```

`verify_jwt` is already set to `false` for all three in `supabase/config.toml`
— `create-checkout` / `billing-portal` validate the Clerk token themselves;
`stripe-webhook` authenticates via the Stripe signature.

### 4. Register the Stripe webhook

- Stripe Dashboard → Developers → Webhooks → **Add endpoint**.
- URL: `https://<your-project-ref>.functions.supabase.co/stripe-webhook`
  (this project's ref is `mfabuswvobhatxacikmc`).
- Events to send:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Copy the endpoint's **Signing secret** (`whsec_...`):

```bash
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

Then redeploy `stripe-webhook`.

### 5. Test (Stripe test mode)

1. Use test card `4242 4242 4242 4242`, any future expiry, any CVC.
2. After paying, confirm the webhook fired (Stripe Dashboard → Webhooks → the
   endpoint → recent deliveries show `200`) and the org's
   `publicMetadata.plan` is now `pro` (Clerk Dashboard → the org → Metadata).
3. Reopen the app; Pro features should be unlocked.
4. Optional: use the local Stripe CLI (`stripe listen --forward-to ...` /
   `stripe trigger`) if you want to test webhooks without real checkouts.

## Go-live checklist

- Switch to live-mode Stripe keys.
- Use a live-mode price ID.
- Create a live-mode webhook endpoint & secret.
- Keep test and live secrets separate (don't mix a live key with a test price,
  or vice versa).

## Troubleshooting

- **Webhook returns 400 "signature verification failed"** — wrong or missing
  `STRIPE_WEBHOOK_SECRET`, or the endpoint's secret doesn't match the deployed
  function.
- **Plan not updating after payment** — check the webhook delivery succeeded
  in the Stripe Dashboard, and that `CLERK_SECRET_KEY` is set (the webhook
  writes to Clerk).
- **"No active subscription found" from the portal** — that org never
  completed checkout (no `stripe_customer_id` in `privateMetadata`).
- **Checkout URL fails to generate** — `STRIPE_PRICE_ID` is unset, or it's
  from the wrong mode (e.g. a test-mode price used with a live-mode key, or
  vice versa).
