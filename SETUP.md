# Setup checklist

Things only you can do (account creation, dashboard config, secrets) —
nothing here can be provisioned by Claude. Check items off as you go; this
file stays in the repo so it doesn't get lost in chat history.

## Clerk (auth)

- [x] Create an app at clerk.com (`app_3GcUYfuOsQtxCikxoZjRVj6TMvr`)
- [ ] Authentication → enable **Email address** as an identifier, verification strategy **email code** (v8 pivot — SMS/phone auth needs a paid Clerk plan; email code is free-tier)
- [ ] Turn off password (email OTP only, no password fallback)
- [ ] Organizations → enable (needed for the restaurant/org model)
- [x] Copy the **publishable key** → `.env` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [x] Copy the **secret key** → `.env` as `CLERK_SECRET_KEY` (stashed for later — not used by the client; will move to a Supabase Edge Function secret if/when we need server-side Clerk Backend API calls)
- [ ] User & Authentication → **Account portal / restrictions** → enable **"Allow users to delete their own account"**. Required for the in-app "Delete account" flow (More screen) — Apple rejects apps that support account creation but not in-app account deletion (Guideline 5.1.1(v)). Without this toggle, `user.delete()` will fail with a Clerk error surfaced via toast.

## Supabase (backend)

- [x] Create a project at supabase.com (**"invoice tracker"**, ref `mfabuswvobhatxacikmc`)
- [x] Clerk as a Third-Party Auth provider — done via `supabase/config.toml`'s `[auth.third_party.clerk]` block (`domain` decoded from the publishable key) + `supabase config push`, not the dashboard UI. Confirmed applied (`supabase config push` reports "Remote Auth config is up to date").
- [x] Copy the **project URL** → `.env` as `EXPO_PUBLIC_SUPABASE_URL`
- [x] Copy the **anon key** → `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [x] Link the local project: `supabase link --project-ref mfabuswvobhatxacikmc`
- [x] Push the schema: `supabase db push` — applied, all 7 tables + RLS policies live on the remote project (confirmed via `supabase migration list`)

## Anthropic (OCR extraction)

- [x] Create an API key at console.anthropic.com
- [x] Add it as a **Supabase Edge Function secret** (moved from `.env`, where it doesn't belong, to `supabase secrets set` — Edge Functions can't see the app's local `.env`)
- [x] Deploy the function: `supabase functions deploy extract-invoice` — live, `status: ACTIVE`, `verify_jwt: true`

## Stripe (billing / Pro subscriptions)

The app-side code is done and deployed — `create-checkout`, `billing-portal`,
`stripe-webhook` are all `ACTIVE` in Supabase, and `app/paywall.tsx` already
calls `startProCheckout` (no longer the "coming soon" stub `BILLING.md`
describes). What's missing is entirely Stripe-account setup: none of
`STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` /
`APP_RETURN_URL` are set as Supabase secrets yet (checked via
`supabase secrets list` — only `ANTHROPIC_API_KEY` and `CLERK_SECRET_KEY` are
there), so checkout will currently fail with "STRIPE_PRICE_ID is not set" the
moment someone taps Upgrade. Full walkthrough: `BILLING.md`.

- [x] Create the **"Pro"** product in Stripe (test mode first) with a recurring monthly price; copy the price ID (`price_...`) — 2026-07-22
- [x] `npx supabase secrets set STRIPE_SECRET_KEY=sk_test_...` — 2026-07-22
- [x] `npx supabase secrets set STRIPE_PRICE_ID=price_1TwAPyKS46fiMii9VghGba2D` — 2026-07-22
- [x] `npx supabase secrets set APP_RETURN_URL=https://example.com/billing-return` — 2026-07-22. Explicitly set to the same placeholder it would've defaulted to; fine for test-mode checkout, but replace with a real page you host before going live (App Store reviewers/testers will land on `example.com` after paying otherwise)
- [x] Register the webhook endpoint in Stripe Dashboard → Developers → Webhooks: `https://mfabuswvobhatxacikmc.functions.supabase.co/stripe-webhook`, sending `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` — 2026-07-22
- [x] Copy that endpoint's signing secret → `npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...` — 2026-07-22. All four secrets confirmed via `supabase secrets list`: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `APP_RETURN_URL`, `STRIPE_WEBHOOK_SECRET`
- [x] Test end-to-end with card `4242 4242 4242 4242` — 2026-07-22. Ran it live in the iOS Simulator (Expo Go): paywall → Stripe Checkout (test mode, $29.00/mo) → subscribed. Verified via Clerk API afterward: `Thaiphoon Restaurant` org's `publicMetadata.plan` is now `"pro"`, and `privateMetadata` has real `stripe_customer_id`/`stripe_subscription_id` — proves the full chain (checkout → Stripe → `stripe-webhook` → Clerk) works end to end.
- [ ] Before real launch: switch to live-mode Stripe keys + a live-mode price ID + a live-mode webhook endpoint/secret (don't mix test and live). Live secrets replace the test ones above via the same `supabase secrets set` commands.

### Follow-up testing (optional, not launch blockers)

- [ ] Test the **billing portal** flow (More → Manage subscription → `billing-portal` function → Stripe portal). Untested so far — only checkout/webhook were exercised. Should work now that `Thaiphoon Restaurant`'s `privateMetadata` has a real `stripe_customer_id` (`cus_Uw2p6f4R0Q3wwC`) from the 2026-07-22 test subscription.
- [ ] Test the **cancellation path**: cancel that test subscription (Stripe Dashboard → Customers → `cus_Uw2p6f4R0Q3wwC`, or via the portal above) and confirm the `customer.subscription.deleted` webhook flips the org's `publicMetadata.plan` back to `free`. Only `checkout.session.completed` has been proven so far.
- [ ] Clean up test data when done: the 2026-07-22 test run left a live **test-mode** subscription (`sub_1TwAnrKS46fiMii9uvBcg5Px`) on `Thaiphoon Restaurant` — harmless (test mode, no real charge) but cancel it in the Stripe test Dashboard once the two items above are checked, so the org isn't stuck "Pro" from stale test data.

### Pricing/product decisions still open (yours to make, see `PLAN_STRATEGY.md`)

- [ ] Confirm the price: `constants/plans.ts`'s `PRO_PRICE_LABEL` is a hardcoded placeholder (`$29/mo`) — it's display copy only and doesn't read from Stripe, so update it by hand once you set the real Stripe price (`PLAN_STRATEGY.md` suggests anchoring higher, e.g. $49/mo, given recipe costing as the flagship)
- [ ] Decide whether recipe costing gets a "one free dish" teaser for Free orgs, or stays fully Pro-gated as it is today (`supabase/functions/draft-recipe/index.ts` currently hard-blocks non-Pro orgs with no free sample)
- [ ] Decide whether to keep the free extraction cap at 10/month or lower it

## Sentry (crash reporting)

- [ ] Create an account/project at sentry.io (React Native platform)
- [ ] Copy the **DSN** → `.env` as `EXPO_PUBLIC_SENTRY_DSN`

## Local env file

- [x] `.env` populated with Clerk + Supabase keys
- [x] `.env` is gitignored — verified not tracked by git

## Legal pages (required before App Store submission)

- [ ] Fill in the placeholders in `legal/privacy-policy.html` and `legal/terms-of-service.html` — the `[FILL IN DATE BEFORE PUBLISHING]` and `[FILL IN CONTACT EMAIL]` markers in each file. Have a human (ideally with legal review, even if brief) confirm the drafted content is accurate for your actual data practices before publishing.
- [ ] Host both files somewhere public — easiest is GitHub Pages: enable Pages on this repo (Settings → Pages → deploy from `main` branch, `/legal` or root), or paste the content into a Notion page shared publicly, or host on any static site.
- [ ] Put the resulting URLs in `.env` as `EXPO_PUBLIC_PRIVACY_POLICY_URL` and `EXPO_PUBLIC_TERMS_URL`. Until these are set, the sign-in screen's legal links and More → Privacy & data silently no-op instead of opening a dead link — so nothing breaks, but submission needs them filled in.
- [ ] Apple also requires the Privacy Policy URL entered directly in App Store Connect (App Privacy section) — same URL, separate field.

## Apple (later — App Store release phase)

- [ ] Apple Developer Program enrollment ($99/yr), if not already done
- [x] `eas.json` created (`build` profiles for development/preview/production + a `submit` stanza) — the `submit.production.ios` block's `appleId`/`ascAppId`/`appleTeamId` are left blank since those come from your own Apple Developer account
- [ ] Fill in `eas.json`'s `submit.production.ios` fields once enrolled (App Store Connect app-specific ID, Apple ID, team ID)
- [x] App renamed to **Sift** in code (`app.json` display name/slug/scheme/bundle ID `com.sift.app`, `package.json`, sign-in/More screens, legal docs) — 2026-07-22
- [ ] App Store Connect listing — Apple's **Name** field caps at 30 characters, so the full "Sift: An Invoice and Recipe Bookkeeper for True Food Cost" phrase doesn't fit in one field. Suggested split (paste in at submission time):
  - **Name** (30 char max): `Sift`
  - **Subtitle** (30 char max): `Invoices & True Food Cost` (26 chars)
  - **Description** (4000 char max) — draft below, ready to paste and tweak:
    > Sift turns your restaurant's supplier invoices into decisions.
    >
    > Snap a photo of any invoice and Sift extracts the vendor, line items, and prices in seconds — no manual entry. Every invoice you scan builds a running history of what you're really paying, vendor by vendor, item by item.
    >
    > Then Sift tells you what that history means:
    > • Price-creep alerts — know the moment a vendor raises a price, item by item
    > • Spend trends — see where your money is actually going, month over month
    > • AI recipe costing — turn your recipes into their true plate cost, automatically priced from what you actually paid your vendors, and kept live as prices change
    >
    > Built for independent restaurant operators who don't have a back-office team to do this by hand. Scan invoices in seconds during receiving, catch cost creep before it eats your margin, and know exactly what your pad thai — or your burger, or today's special — actually costs to make.
    >
    > FEATURES
    >
    > - Camera-based invoice capture with AI extraction (vendor, line items, prices)
    > - Vendor-grouped invoice history and search
    > - Price-creep alerts on every item, every vendor
    > - Spend trends and category breakdowns
    > - AI-assisted recipe costing — true cost per dish, tied to real invoice prices
    > - CSV export for your bookkeeper or accountant
    > - Multi-user organizations, so your whole team can capture invoices
    >
    > Sift is invoice bookkeeping and recipe costing in one place — built to answer the question every operator asks: are we actually making money on this dish?
- [ ] Run `eas login` and `eas build --platform ios` once ready to produce a real build

---

Once Clerk + Supabase are wired up, tell me and we can smoke-test real
sign-in end-to-end together.
