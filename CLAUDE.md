# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Sift: An Invoice and Recipe Bookkeeper for True Food Cost** — an Expo / React Native (iOS-first) app that lets restaurant operators photograph food-distributor invoices (Sysco, US Foods, PFG, local produce/meat/seafood vendors) and get structured line-item data, cross-invoice price-creep alerts, spend analytics, and AI recipe costing. The app bundle is the repo root; `website/` is a **separate, self-contained Next.js marketing/waitlist site** (has its own `package.json`, `CLAUDE.md`, and `node_modules` — treat it as a distinct project).

## Commands

```bash
npm start              # expo start (Metro dev server)
npm run ios            # expo start --ios
npm run android        # expo start --android
npm run lint           # expo lint (ESLint, eslint-config-expo flat)
# There is no typecheck script; run `npx tsc --noEmit` if you need one.
# There is no test suite.
```

Supabase backend (remote project is already linked; run from repo root):

```bash
npx supabase db push                              # apply migrations in supabase/migrations
npx supabase functions deploy <name>              # deploy one Edge Function (extract-invoice, draft-recipe, create-checkout, billing-portal, stripe-webhook)
npx supabase secrets set KEY=value                # server-only secrets (see below)
npx supabase secrets list
```

Builds: `eas build --platform ios` (see `eas.json`; `appVersionSource: remote`).

## Environment / secrets — the critical split

- **Client bundle** (`.env`, `EXPO_PUBLIC_` prefix, safe to ship): `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, optional `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`. See `.env.example`.
- **Server only** (Supabase Edge Function secrets, NEVER `EXPO_PUBLIC_`, set via `supabase secrets set`): `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, and the Stripe set (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `APP_RETURN_URL`). A Clerk _secret_ key or Supabase _service_role_ key must never go behind `EXPO_PUBLIC_`.

## Architecture

### Auth + data access (the load-bearing part)

- **Clerk** owns auth. Clerk **Organizations = restaurants** — a user must belong to an org to use the app. `app/index.tsx` and `app/(tabs)/_layout.tsx` gate routing: a session with `session.currentTask` (e.g. `choose-organization`) → `/onboarding/organization`; signed-out → `/(auth)`; signed-in without org → onboarding; else `/(tabs)`.
- **Supabase** is the database, but there is **no Supabase-side user record and no JWT template**. Clerk is configured as a Third-Party Auth provider; Supabase validates the Clerk session token directly. Get a client via `useSupabase()` (`lib/supabase.ts`) — it must be called under `<ClerkProvider>`. Note the deliberate `getTokenRef` pattern there: `getToken` changes identity every render, so the client is memoized on `[]` and reads the latest token through a ref to avoid an infinite render loop with `useFocusEffect`.
- **RLS is scoped by organization.** Policies read the active org id off the Clerk token via `private.current_org_id()` — Clerk nests it as `o.id`, not a flat `org_id` claim. Every table carries `organization_id`; queries filter on it explicitly _and_ RLS enforces it. Migrations in `supabase/migrations` are the source of truth for the schema (no committed schema dump).

### Invoice extraction pipeline

This is the core flow. Read `supabase/functions/extract-invoice/index.ts` and `lib/invoicePipeline.ts` together.

1. Client captures photo(s) → uploads to the private `invoice-images` Storage bucket at `{orgId}/{invoiceId}/{n}.jpg` → creates a draft `invoices` row (`status: 'pending'`).
2. Client invokes the `extract-invoice` Edge Function with the invoice id. The function runs entirely under the caller's forwarded Clerk JWT (RLS, no service-role bypass).
3. Server-side, in order: **plan gate** (atomic `reserve_extraction_slot` RPC enforces the free monthly cap before any Claude spend) → **duplicate detection** (layer 1: exact SHA-256 image-hash overlap, free; layer 2: a cheap Haiku fingerprint of header fields to catch the same paper invoice re-photographed) → **extraction** with **Claude Sonnet** via a strict tool-call schema → vendor resolve/create (normalized-name + `aliases` match, palette color via `create_vendor_with_palette_color` RPC) → write line items → flip invoice to `status: 'scanned'` → `detectPriceCreep`.
4. Client loads the scanned invoice into the review screen (`app/scan/review.tsx`), user confirms low-confidence fields / reconciles missing items, then `saveCurrentInvoice` flips it to `status: 'saved'`.

Invoice `status` lifecycle: `pending` → `scanned` → `saved`. Analytics and history only count `saved`.

Typed errors cross the client/server boundary as HTTP codes decoded in `extractInvoice()`: **402 `FREE_LIMIT_REACHED`** → `ExtractionLimitError` → open paywall; **409 `DUPLICATE_INVOICE_DETECTED`** → `DuplicateInvoiceError` → "view existing / continue anyway" UI (`skipDuplicateCheck` forces through). Both defined in `lib/entitlements.ts`.

**Model IDs** (`claude-sonnet-5`, `claude-haiku-4-5-20251001`) and the extraction prompt live in the Edge Function. `PLAN_INVOICE_CAPS` (the per-tier monthly caps) is duplicated in both `lib/entitlements.ts` and `extract-invoice/index.ts`, and the vendor color palette in both `lib/invoicePipeline.ts` and the function — these are **hand-synced across the RN bundle and Deno runtime**; change both together.

### Plans / entitlements

**Three tiers** (monthly only at launch; annual deferred): `free` / `plus` / `pro`, held on the **Clerk org** at `organization.publicMetadata.plan` (unrecognized → `free`). The single source of truth is `lib/entitlements.ts`: `planFromOrg`, `PLAN_INVOICE_CAPS` (`free:10, plus:300, pro:500` — every tier is capped now), `isPaidPlan`. Read client-side via `useEntitlement()` → `{ plan, isPaid, isPlus, isPro, invoiceCap }`; **gate premium features on `isPaid`** (Plus and Pro share the full feature set and differ only by invoice volume), reserve `isPro` for genuinely Pro-only gating. `useExtractionUsage` derives the meter from `invoiceCap`. Server enforcement in `extract-invoice` re-reads the plan via the Clerk Backend API and reserves against the tier's cap (has its own synced `PLAN_INVOICE_CAPS` copy — change both together). Feature matrix + price labels in `constants/plans.ts`.

**QA tier-switcher:** a `__DEV__`-only section in `more.tsx` sets `useStore().debugPlan`, which `useEntitlement` honors — lets you walk every gated surface at Free/Plus/Pro without a purchase (client-side only; the server still enforces the real plan). `demoMode` similarly forces `pro`.

**Billing is mid-migration Stripe → Apple IAP (RevenueCat)** — Stripe web checkout is an App Store Guideline 3.1.1 blocker. The entitlement *read model* above is unchanged throughout: everything reads `publicMetadata.plan`, and the `revenuecat-webhook` writes it (App User ID = Clerk org id; entitlement/product → tier). Full plan in `IAP_MIGRATION_PLAN.md`.
- **Client: RevenueCat, wired.** `react-native-purchases` (v10) installed. `lib/purchases.ts` (wrapper; iOS-only, no-ops until `EXPO_PUBLIC_REVENUECAT_IOS_KEY` is set; `PAID_TIERS` maps tier→entitlement→product), `configurePurchases()` in `app/_layout.tsx`, `useRevenueCatSync` (binds identity to the org) in `(tabs)/_layout.tsx`, and `app/paywall.tsx` (Plus/Pro selector) / `more.tsx` call `purchaseTier` / `restorePurchases` / `manageSubscription`. Needs a dev build (not Expo Go). The old `lib/billing.ts` is deleted.
- **Server: `supabase/functions/revenuecat-webhook/`** writes the plan flag on RevenueCat events (auth via `REVENUECAT_WEBHOOK_AUTH` secret). **Deployed** at `https://mfabuswvobhatxacikmc.functions.supabase.co/revenuecat-webhook` (`--no-verify-jwt`); secret set; smoke-tested. Still needs the RevenueCat dashboard pointed at it.
- **Stripe leftovers (Phase 5 cleanup, still present):** the `create-checkout` / `billing-portal` / `stripe-webhook` Edge Functions + their secrets are orphaned (no client caller) but not yet removed. See `BILLING.md`, `PAYWALL.md`, `PLAN_STRATEGY.md`.

### State

Single Zustand store, `store/useStore.ts`. It holds the current-invoice review draft plus **all dashboard analytics**, which are computed client-side in `fetchDashboardSummary` from one `saved`-invoices fetch (week/month/year spend buckets, per-vendor and per-category breakdowns, top-item 80/20 Pareto, delivery-gap worklist) — this avoids many near-identical queries. `Invoice`/`LineItem` types (the app-shape) live here; `lib/invoicePipeline.ts` maps DB rows → these shapes (`mapInvoice`/`mapLineItem`). Per-screen data not in the store is fetched via hooks in `hooks/`.

### Demo mode

A first-run product tour (`components/tour/`, `lib/demoData.ts`, `lib/tourFlag.ts`). When `demoMode` is true the store is seeded with client-side fixtures and **every real fetch early-returns** (checked via `get().demoMode`, including a re-check after `await` so an in-flight fetch can't clobber the fixture). See the `project_demo_mode_tour` memory.

### Routing / UI

`expo-router` with typed routes (`app/`). `app/_layout.tsx` is the root: Sentry init at module scope, Clerk provider, font loading with a branded `<LoadingScreen/>` during hydration, error boundary. Tabs: Home, Recipes, Scan (center action → `/scan`), Invoices (`vendors.tsx`), Profile (`more.tsx`); Alerts is not a tab (it's the Home-header bell, kept routable via `href: null`). Design system: `constants/Colors.ts`, Manrope font, light-mode-only (`userInterfaceStyle: light`).

### Recipe costing

`lib/recipeCosting.ts` + the `draft-recipe` Edge Function. Phase 1 = dishes with weight-based ingredient costing, resolving ingredient cost from the org's own invoice price history. Pro feature. See `RECIPE_COSTING.md`.

## Conventions worth knowing

- **`clean_name` vs `raw_description`**: extraction produces a sanitized display name (`clean_name`, item/SKU/mark codes and bilingual noise stripped) alongside the verbatim text. `clean_name` is what the UI titles and what price comparison / item-history matching keys on (`.eq`, not `.ilike`, since raw text can contain `%`/`_`).
- **Line items are soft-deleted** (`voided_at` stamp), not removed; voided items stay visible but drop out of totals and flags. Invoices are hard-deleted (cascades via FK).
- **Dates**: `invoice_date` is model-extracted and may be missing/wrong; code falls back to `created_at` converted to a **local** date via `localDateFromTimestamp` (never a UTC `.slice(0,10)`, which misfiles late-night scans near a day/week/month boundary).
- The `@/*` path alias maps to the repo root (`tsconfig.json`). `strict` TypeScript is on. `supabase/functions` is excluded from the app tsconfig (it's Deno).

## Reference docs in the repo

`PRD-Invoice-Scanner-App.md` (product spec — sections 6.3/9 cover the pipeline), `SETUP.md` (backend setup + deploy checklist with what's already been run), `SHIPPING_READINESS.md`, `CHANGES.md`, `BILLING.md`, `PAYWALL.md`, `PLAN_STRATEGY.md`, `RECIPE_COSTING.md`.
