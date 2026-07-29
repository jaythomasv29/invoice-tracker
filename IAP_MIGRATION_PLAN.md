# IAP Migration Plan — Stripe web checkout → RevenueCat (Apple In-App Purchase)

**Why:** The Pro subscription unlocks in-app digital features (unlimited extraction, price
alerts, recipe costing, analytics). Apple **Guideline 3.1.1** requires digital-content
unlocks to use In-App Purchase — sending users to Stripe web checkout
(`lib/billing.ts` → `WebBrowser.openBrowserAsync`) is a hard rejection. This plan moves iOS
purchasing to **RevenueCat over StoreKit**, and (per decision) retires the Stripe path
entirely — RevenueCat everywhere, single source of truth.

**Guiding constraint:** Change as little as possible. The app's entitlement *read model* —
`organization.publicMetadata.plan === 'pro'` — stays exactly as-is. RevenueCat only replaces
(a) the purchase trigger on the client and (b) the fulfillment webhook that writes the plan flag.

---

## PROGRESS (2026-07-28)

**Done in code / infra:**
- ✅ `react-native-purchases@10.5.0` installed (no Expo config plugin exists/needed for v10 —
  it autolinks via prebuild; nothing to add to `app.json`).
- ✅ Client fully wired: `lib/purchases.ts` wrapper, `configurePurchases()` in `_layout.tsx`,
  `useRevenueCatSync` in `(tabs)/_layout.tsx`, `paywall.tsx` + `more.tsx` using
  purchasePro/restorePro/manageSubscription; paywall has a **monthly/annual selector**
  (annual default + "Save X%" badge), shows real store prices + 3.1.2 disclosure + Restore +
  legal links. `lib/billing.ts` deleted. `tsc` clean.
- ✅ **`revenuecat-webhook` DEPLOYED** to project `mfabuswvobhatxacikmc` with `--no-verify-jwt`.
  URL: `https://mfabuswvobhatxacikmc.functions.supabase.co/revenuecat-webhook`
  Secret `REVENUECAT_WEBHOOK_AUTH` is set. Smoke-tested: 401 without auth, 200 on a signed TEST event.

**Blocked on the user (external accounts):** RevenueCat signup → set `EXPO_PUBLIC_REVENUECAT_IOS_KEY`;
create entitlement `pro` / product `sift_pro_monthly` / offering `default`; paste the webhook URL +
auth secret into RevenueCat → Integrations → Webhooks; App Store Connect subscription product; Apple
Developer enrollment; EAS dev build to test; then Phase 5 Stripe teardown.

---

## What stays UNCHANGED (the win)

- `lib/entitlements.ts` — `planFromOrg`, `FREE_MONTHLY_EXTRACTION_CAP`, the typed errors.
- `hooks/useEntitlement.ts` — still reads `organization.publicMetadata.plan`.
- `supabase/functions/extract-invoice/index.ts` — `getOrgPlan()` still reads the Clerk org
  flag server-side. **No change to the server enforcement path.**
- `constants/plans.ts` feature table — same, except the price *label* (see Phase 4).
- The paywall's "poll Clerk org until `isPro` flips" UX (`app/paywall.tsx`) — same idea,
  the poll just observes the RevenueCat webhook's write instead of Stripe's.

## What gets REPLACED

| Today (Stripe) | Becomes (RevenueCat) |
|---|---|
| `lib/billing.ts` `startProCheckout` (web checkout) | `Purchases.purchasePackage()` in a new `lib/purchases.ts` |
| `lib/billing.ts` `openBillingPortal` (Stripe portal) | `Purchases.showManageSubscriptions()` (native App Store sheet) |
| `supabase/functions/stripe-webhook` | new `supabase/functions/revenuecat-webhook` |
| `create-checkout`, `billing-portal` edge functions | deleted |
| Stripe secrets | RevenueCat secrets |
| `PRO_PRICE_LABEL` hardcoded `$29/mo` | localized `package.product.priceString` from the store |

---

## Key design decision: App User ID = Clerk **org** id

The plan is **org-scoped** (a restaurant subscribes, not an individual). So set RevenueCat's
App User ID to the **Clerk organization id**:

```ts
await Purchases.logIn(organization.id);
```

The `pro` entitlement then attaches to the org id, and any member querying that org id sees
Pro. The webhook writes the flag onto that same org in Clerk.

⚠️ **Nuance to accept, not solve now:** Apple IAP purchases are tied to the buyer's **Apple
ID**, but our entitlement is **org-wide**. With App User ID = org id, the first person to buy
unlocks the whole org (good). But *restoring* that purchase on a fresh install only works for
the Apple ID that bought it — a second staff member on a new device can't "restore" a
subscription they didn't buy on their Apple ID. This matches today's reality (Owner-only usage;
"Invite staff" is still a stub per `SHIPPING_READINESS.md`), so it's fine for v1. Document it in
the paywall copy ("one subscription per restaurant, managed by the owner's Apple ID"). Revisit
if/when multi-seat staff accounts ship.

---

## Phase 0 — Accounts & product setup (human, no code)

1. **Apple Developer Program** enrolled (blocks everything downstream).
2. **App Store Connect** → create the app record (bundle `com.sift.app`) → **Subscriptions**:
   - Create one subscription group (e.g. "Sift") containing **both paid tiers**.
   - Create **two** auto-renewable subscription products (monthly only at launch — annual deferred):
     `sift_plus_monthly` (Plus, $8.99/mo) and `sift_pro_monthly` (Pro, $24.99/mo).
   - Set each price, localized display name/description, and add the required review screenshot.
   - Generate an **In-App Purchase Key** (App Store Connect → Users and Access → Integrations)
     for RevenueCat's server-side validation.
3. **RevenueCat** → create a project → add the iOS app (bundle id + the IAP key above):
   - **Entitlements:** `plus` and `pro` (each product attaches to its own entitlement).
   - **Products:** `sift_plus_monthly` → `plus`; `sift_pro_monthly` → `pro`.
   - **Offering:** `default`, containing both packages (the client matches them by product id —
     see `getTierPackages` / `PAID_TIERS` in `lib/purchases.ts`).
   - Grab the **public SDK key** (`appl_...`) for the client and set up the webhook (Phase 3).

   > **Tiers & caps (enforced):** Free = 10 invoices/mo (no premium features), Plus = 300
   > invoices/mo + all features, Pro = 500 invoices/mo + all features. Plus and Pro share the
   > same feature set and differ only by invoice volume. Caps live in `PLAN_INVOICE_CAPS`
   > (`lib/entitlements.ts` + a synced copy in `extract-invoice`). Annual products and Free's
   > "2 recipe previews" are deferred.

## Phase 1 — SDK install + native config

RevenueCat needs a **dev/prod build** (not Expo Go). Use `react-native-purchases` (keep the
existing custom paywall UI — no need for `react-native-purchases-ui`).

```bash
npx expo install react-native-purchases
```

- Add the config plugin to `app.json` `plugins` (RevenueCat ships one; verify it supports
  Expo SDK 57 / RN 0.86 / new architecture before pinning a version — this stack is bleeding
  edge, so check the RevenueCat changelog / test a dev build early).
- Add the public SDK key as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` in `.env` / `.env.example`
  (public keys are safe to ship, same class as the Clerk publishable / Supabase anon key).
- Rebuild the dev client: `eas build --profile development --platform ios`.

## Phase 2 — Client wiring

**Init (once, at startup):** in `app/_layout.tsx` (alongside Sentry init or in an effect under
`ClerkProvider`):

```ts
Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY! });
```

**Identity lifecycle:** tie the RevenueCat identity to the Clerk org. Where the app already
resolves `organization` (e.g. a small hook used from `(tabs)/_layout.tsx`):

```ts
useEffect(() => {
  if (organization?.id) Purchases.logIn(organization.id);
  else Purchases.logOut(); // signed out / no org
}, [organization?.id]);
```

**New `lib/purchases.ts`** (replaces `lib/billing.ts`):

```ts
// getOfferings() -> current offering's monthly package (for price + purchase)
// purchasePro(pkg) -> Purchases.purchasePackage(pkg); returns customerInfo
// restore() -> Purchases.restorePurchases()
// manageSubscription() -> Purchases.showManageSubscriptions()
// isProFromCustomerInfo(info) -> !!info.entitlements.active['pro']
```

**Paywall (`app/paywall.tsx`):**
- Replace `startProCheckout(...)` with `purchasePro(monthlyPackage)`.
- On success, RevenueCat's `customerInfo` reports `pro` active **immediately** — flip the UI
  optimistically, but **keep the existing Clerk-org poll loop**, because the *server* gate
  (`extract-invoice`) reads the Clerk flag, which the webhook (Phase 3) writes with a few
  seconds' latency. The poll is what bridges that gap; it already exists, just point it at the
  same `isPro` signal.
- Handle the user-cancelled case quietly (`e.userCancelled` / `PURCHASES_ERROR_CODE.
  PURCHASE_CANCELLED_ERROR`) — no error alert.

## Phase 3 — Fulfillment: `revenuecat-webhook` edge function

New function, modeled almost exactly on `stripe-webhook/index.ts` (reuse its idempotency +
ordering guard and the `_shared/clerkAuth.ts` `updateOrgMetadata`/`getOrganization` helpers).

- Deploy with `verify_jwt = false` (RevenueCat sends no user token).
- Auth = the `Authorization: Bearer <shared-secret>` header RevenueCat sends; verify against
  a new secret `REVENUECAT_WEBHOOK_AUTH` (`npx supabase secrets set REVENUECAT_WEBHOOK_AUTH=...`).
- Point the RevenueCat webhook at
  `https://<project-ref>.functions.supabase.co/revenuecat-webhook`.
- The event's `app_user_id` **is the Clerk org id** (Phase 1 decision). Map RevenueCat event
  types to the plan flag:
  - `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE` (still entitled) → `plan: 'pro'`
  - `CANCELLATION` (still entitled until expiry — do **not** downgrade yet), `EXPIRATION` → downgrade to `'free'` on `EXPIRATION`
  - `BILLING_ISSUE` → grace window (keep `'pro'`, same spirit as Stripe's `past_due`)
- Write via the same call the Stripe webhook uses:
  `updateOrgMetadata(orgId, { public_metadata: { plan } })`, carrying a
  `revenuecat_last_event_id` idempotency stamp in `private_metadata`.
- Return 500 on a failed Clerk write so RevenueCat retries.

Net effect: `organization.publicMetadata.plan` remains authoritative and every existing reader
(client + `extract-invoice`) keeps working with zero changes.

## Phase 4 — Apple paywall compliance (Guideline 3.1.2)

Apple requires, on the purchase screen:
- **Real localized price + billing period** — replace `PRO_PRICE_LABEL` in `constants/plans.ts`
  with `monthlyPackage.product.priceString` (and show "/month"). Remove the
  "Prices shown are placeholders" footnote.
- **Auto-renewal disclosure** text (renews automatically, charged to Apple ID, cancel in
  Settings ≥24h before period end).
- **Functional Terms (EULA) + Privacy Policy links** near the button — you now have these
  (`EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_POLICY_URL`, filled this session). Apple
  accepts the standard Apple EULA if you don't host your own. (Live URLs will be
  `https://siftcosts.com/privacy` and `/terms` once the site deploys.)
- **Restore Purchases** button — required. Add to the paywall and/or More → subscription row.

## Phase 5 — Retire Stripe

Since this is RevenueCat-everywhere and pre-launch (no live subscribers to migrate):
- Delete `supabase/functions/{create-checkout,billing-portal,stripe-webhook}` and
  `supabase/functions/_shared/stripe.ts`.
- Remove Stripe secrets: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
  (`APP_RETURN_URL` too, unless the marketing site still uses it).
- Delete `lib/billing.ts` once `lib/purchases.ts` replaces its two call sites (`paywall.tsx`,
  and the More-screen "manage subscription" row).
- Leave the harmless `stripe_*` fields already written into some orgs' Clerk `private_metadata`;
  they're inert. Update `BILLING.md`, `PAYWALL.md`, and `CLAUDE.md`'s Plans/entitlements section
  to describe RevenueCat instead of Stripe.

## Phase 6 — Testing

- **Local:** add a StoreKit configuration file (`.storekit`) so you can exercise
  purchase/restore in the iOS Simulator without sandbox.
- **Device sandbox:** create a Sandbox Apple ID (App Store Connect → Sandbox Testers), sign in
  under Settings → Developer, and run the RevenueCat "Sandbox" environment end-to-end:
  purchase → confirm `pro` active in the SDK → confirm the webhook flipped
  `publicMetadata.plan` in Clerk → confirm `extract-invoice` now allows unlimited extraction.
- Verify **restore** and **cancel** (via `showManageSubscriptions`) flip state correctly both
  in-app and after the webhook lands.

---

## Sequencing / dependencies

```
Phase 0 (accounts) ─┬─> Phase 1 (SDK/build) ─> Phase 2 (client) ─┐
                    └─> Phase 3 (webhook) ───────────────────────┴─> Phase 6 (test) ─> Phase 4/5 polish+cleanup
```

Phase 0 is the long pole (Apple enrollment + product review can take days). Phases 1–3 can be
coded against the RevenueCat dashboard as soon as the project exists, before the App Store
product is fully approved (use the StoreKit config file to test).

## Open questions to confirm before coding

1. ✅ **RESOLVED:** monthly **and** annual (`sift_pro_monthly` + `sift_pro_annual`). Client
   supports both with an annual-default selector + auto "Save X%" badge. Still set the **actual
   prices** in App Store Connect — the `$29/mo` / `$290/yr` in `constants/plans.ts` are just
   pre-load placeholders; the paywall shows the real store price once RevenueCat returns it.
2. **Free trial / intro offer?** (RevenueCat + App Store Connect support intro pricing; affects
   the offering config and the disclosure text. The paywall's disclosure text would need a trial
   clause if you add one.)
3. Confirm nobody has a live Stripe Pro subscription that needs grandfathering (assumed none —
   pre-launch).

---

*Next concrete step (on request): scaffold `lib/purchases.ts` and the `revenuecat-webhook`
edge function skeleton — pure code that compiles now, with `TODO` markers where the RevenueCat
project keys / product ids plug in.*
