# Free / Pro plans & paywall

Two-tier model. **Free** vs **Pro** (renamed from "Plus"). The plan lives on the
Clerk **organization** (each restaurant), so one upgrade covers the whole team.

| Feature                        | Free       | Pro       | Status |
| ------------------------------ | ---------- | --------- | ------ |
| Capture + extraction           | 10 / month | Unlimited | live   |
| Notes on entries               | ✓          | ✓         | live   |
| Vendor-grouped storage/history | ✓          | ✓         | live   |
| Price-creep alerts             | —          | ✓         | live   |
| Total spend + trends           | —          | ✓         | live   |
| Spend by category              | —          | ✓         | soon   |
| Top-spend items (80/20)        | —          | ✓         | soon   |
| Missing-invoice alerts         | —          | ✓         | soon   |
| ★ AI recipe costing            | —          | ✓         | roadmap |

Extraction volume is the **cost gate**; the analytics + recipe costing are the
**feature gates** — two independent reasons to upgrade. See
[PLAN_STRATEGY.md](./PLAN_STRATEGY.md) for the full tiering rationale, conversion
mechanics, and pricing, and [RECIPE_COSTING.md](./RECIPE_COSTING.md) for the
flagship feature's architecture.

## How the plan flag works

- Source of truth: `organization.publicMetadata.plan` in Clerk. `'pro'` unlocks
  everything; anything else (or unset) is treated as **free**.
- Client reads it via `hooks/useEntitlement.ts` (`isPro`) for all UI gating.
- The `extract-invoice` edge function reads it **server-side** via the Clerk
  Backend API (`getOrgPlan`), so the extraction cap can't be bypassed by a
  patched client. It also skips price-creep detection for free orgs.

## Enabling Pro for an org (until billing is wired up)

Billing/checkout is intentionally stubbed in this build (the paywall's "Upgrade"
button shows a "coming soon" alert). To turn an org Pro today:

1. Clerk dashboard → **Organizations** → pick the org → **Metadata** → **Public**.
2. Set: `{ "plan": "pro" }` → save.

The change is authoritative immediately (server re-reads it per extraction) and
appears in the app on next load. Remove it (or set `"free"`) to downgrade.

## Required server secret

The edge function needs a Clerk **secret** key to read org metadata:

```bash
npx supabase secrets set CLERK_SECRET_KEY=sk_live_or_test_xxx
```

ok I ran npx supabase secrets set CLERK*SECRET_KEY=sk_test*...

If it's unset, `getOrgPlan` fails safe to **free** — extraction still works up to
the monthly cap, but no org is recognized as Pro. Never put a Clerk secret key
behind `EXPO_PUBLIC_`.

## The free extraction cap

- `10 / calendar month`, resets on the 1st (UTC). Counts invoices that reached
  extraction (`status` in `scanned`/`saved`) since the 1st.
- Defined in **two** places that must stay in sync:
  - `lib/entitlements.ts` → `FREE_MONTHLY_EXTRACTION_CAP` (RN bundle)
  - `supabase/functions/extract-invoice/index.ts` → `FREE_MONTHLY_EXTRACTION_CAP` (Deno)
- Over the cap, the function returns HTTP **402** `{ code: 'FREE_LIMIT_REACHED' }`;
  the client maps that to `ExtractionLimitError` and opens the paywall. The scan
  screen also pre-checks the meter to avoid a wasted upload.

## Wiring real billing later

Real Stripe Checkout billing is implemented (`supabase/functions/create-checkout`,
`supabase/functions/stripe-webhook`, `supabase/functions/billing-portal`, and
`lib/billing.ts`) — the paywall's "Upgrade" button calls `startProCheckout`, and
the webhook sets the org's `publicMetadata.plan` to `'pro'` on successful
checkout, so entitlement gating on this page keeps working unchanged. Pro users
can manage/cancel from More → Manage subscription (Stripe billing portal). See
[BILLING.md](./BILLING.md) for the full setup guide (Stripe product/price,
secrets, webhook registration, and testing).

Native IAP (StoreKit / Play Billing, e.g. via RevenueCat) remains an option if
you need to sell the subscription _inside_ the iOS/Android app per store
policy — its fulfillment step would set the same `publicMetadata.plan` flag
via its own webhook.
