# Polish pass — 2026-07-23

Four Opus subagents audited the app in parallel (UX/screens, Supabase backend/security, client state & business logic, feature opportunities). This is what came out of it: security fixes, correctness fixes, UX polish, and two new shipped features. Everything below was implemented and verified (`tsc --noEmit` clean, `deno check` clean on all edited edge functions, no new lint regressions vs. the pre-existing baseline).

## Security fixes

- **Closed an auth bypass in billing.** `billing-portal` and `create-checkout` derived the caller's `org_id` by locally base64-decoding the Clerk JWT payload with **no signature verification**. Since neither function touched an RLS-scoped query, a forged/unsigned JWT with an arbitrary `org_id` claim could open another org's Stripe billing portal (view payment methods, cancel their subscription) or overwrite another org's `stripe_customer_id`. Fixed by adding a `public.current_org_id()` RPC that reads the same `auth.jwt()` claim RLS already trusts (populated only from a signature-verified token via Supabase's Clerk third-party-auth integration), and calling it through an RLS-scoped client instead of decoding the JWT by hand. *(migration `20260723120000_verified_current_org_id_rpc.sql`, `_shared/clerkAuth.ts`, `billing-portal/index.ts`, `create-checkout/index.ts`)*

- **Closed a free-tier extraction cap race.** The cap was enforced check-then-act (count existing invoices, compare to cap, proceed) — N concurrent requests from an org sitting at cap-1 could all read the same under-cap count and all slip through, each spending a full Sonnet extraction. Replaced with an atomic reserve: a single `UPDATE ... WHERE used < cap` statement, so concurrent callers serialize on the row and only the first `cap - used` succeed. A failed/duplicate extraction releases its reserved slot so the cap still only counts extractions that actually succeed, matching the old behavior. *(migration `20260723130000_atomic_extraction_quota.sql`, `extract-invoice/index.ts`)*

- **Stripe webhook hardening.** Added event ordering/idempotency (tracked via the org's own Clerk metadata — no new table) so a late or retried webhook can't re-grant Pro after a real cancellation already downgraded the org, and can't double-apply on retry. Added a `payment_status` check on `checkout.session.completed` so an async/unpaid checkout session no longer grants Pro before payment actually clears. *(`stripe-webhook/index.ts`)*

- **Stopped leaking upstream API error detail to clients.** `extract-invoice` and `draft-recipe` were forwarding raw Anthropic error response bodies straight into the client-facing error message. Now logged server-side only; the client gets a generic, safe message.

## Correctness fixes

- **Dashboard fetch errors were silently swallowed.** A failed Supabase query in `fetchDashboardSummary`/`fetchPriceAlerts` left the UI showing stale or $0 data with zero indication anything failed — indistinguishable from "no spend yet." Now surfaces a toast. Same fix applied to `useExtractionUsage`, `usePriceAlertCount`, and `useMissingInvoices`, which previously fell back to misleading zero/empty states on query failure.
- **Fixed a UTC/local date bucketing bug.** Undated invoices fell back to `created_at.slice(0, 10)` — the UTC date — while every week/month/year bucket boundary is computed from the device's *local* calendar. An invoice scanned late at night near a month/year boundary could silently land in the wrong bucket. Added `localDateFromTimestamp()` and used it everywhere this fallback happens.
- **Orphaned draft invoices.** A failed extraction (bad photo, transient API error, hit the free cap) left a `pending` invoice row and its uploaded images behind forever — only the duplicate-detection path cleaned up after itself. Now every failure path deletes the abandoned draft.
- **Recipe costing could wildly overweight a single ingredient, or silently show $0.** When only a low-cost-share ingredient resolved to real pricing, the implied dish total was extrapolated by dividing by that tiny share — a $2 garnish tagged at 5% cost-share could imply a $40 dish. Floored the divisor so any single resolved ingredient can amplify the implied total by at most 5x.
- **CSV export hardening.** Added a UTF-8 BOM (so Excel-on-Windows renders accented vendor/item names correctly instead of mojibake), quoting for bare `\r`, and a formula-injection guard (an OCR'd description starting with `=`, `+`, `-`, or `@` no longer executes as a spreadsheet formula on open).
- **`app/scan/review.tsx` blank screen after saving.** `currentInvoice` goes `null` the instant a save succeeds, but the screen's guard returned `null` regardless of whether a save was still wrapping up — a ~900ms blank screen between "Save" and landing back on the dashboard. Now shows a "Invoice saved" confirmation for that window instead.
- **Paywall could get stuck after a successful upgrade**, and the post-checkout polling loop read `organization` off a stale closure that often never reflected the reload — so it usually ran all 5 retries regardless of outcome. Now mirrors `isPro` into a ref the loop can actually observe updating, and auto-dismisses back to the calling screen once the upgrade is confirmed.
- **`app/invoice/[id].tsx`: "View original invoice" failed silently** on a network/signing error — spinner just stopped with no feedback. Added error handling + toast.

## UX polish

- Accessibility labels added to every icon-only button that had none: `BackButton` (shared — fixes ~7 screens at once), scan capture/close/import/torch, `ImageViewerModal` close, paywall close, the tab-bar scan button, and the home screen's alerts bell.
- `ImageViewerModal`'s close button had a hardcoded `top: 56` with no safe-area awareness — now uses the actual inset.
- Currency formatting consistency: several dashboard cards printed raw `.toLocaleString()` on non-integer amounts (`$1,234.5`) instead of rounding first, inconsistent with the rest of the app.
- Price-alert percentages now round for display instead of showing raw multi-decimal values.
- Vendor initials/truncation: two screens computed initials inline instead of using the shared `initialsFor` helper, and the vendor list's name text had no `numberOfLines`, letting a long name wrap and shove the spend pill.
- Fixed a divide-by-zero (`NaN` bar height) in `SpendCard` when a bar has breakdown entries but a zero total.
- Removed a dead, unused `badge` style in the tab bar layout.
- Scan screen: capture and library-import now handle failures (try/catch + toast) instead of risking an unhandled rejection with no feedback, and import now explicitly requests library permission first.

## New features

Both reuse data the app was already collecting — reconciliation flags and line-item price history — that had no dedicated surface before.

- **Delivery-gap money rollup** (`components/dashboard/DeliveryGapCard.tsx`): every line item still flagged missing/short at save time, rolled into a dollar total with a short worklist (vendor, item, amount, date), each row linking to its invoice. This data was being captured on every save and shown only as a pill on the invoice detail page — nothing ever added it up. Now it's a recovery worklist on the home dashboard.
- **Item price-history sheet** (`app/item-history.tsx`): tap a price alert or a Top Item to see that item's unit-price trend over time — a chart plus the raw invoice-by-invoice list. Price alerts previously showed only a single "then vs. now" diff; this shows the actual trend behind it, sourced from data every line item already carried.

## Known follow-ups (not attempted this pass)

- The extraction-cap race fix and delivery-gap/price-history features all need their migrations applied (`supabase db push` or equivalent) and, for the billing-portal/create-checkout fix, a Supabase project with the Clerk third-party-auth integration already configured (already a prerequisite of this app, per existing RLS policies).
- Recipe costing: when *no* ingredient resolves to real pricing at all, the estimate still shows literally `$0.00` (with a "Low confidence" badge) rather than an explicit "not enough data" state. The amplification bug (the more likely/severe case) is fixed; this edge case is cosmetic and left as a follow-up.
- A few lower-severity/cosmetic findings from the audit were not addressed this pass (e.g. `AIInsightCard`/`PriceAlertBanner` showing overlapping content on Home, `EditLineItemModal`/`Toast` pre-existing `setState`-in-effect and ref-during-render lint findings that predate this session and are consistent with a repo-wide pattern, not regressions).
