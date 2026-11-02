# Sift: App Store launch assessment and plan

> Execution update: the assessment below is the original baseline, not the current deployment status. See [release status](docs/RELEASE_STATUS.md), [phone tests](docs/PHONE_TEST_CHECKLIST.md) and [pricing decision](docs/PRICING_DECISION.md). The selected launch scope is Free + Pro, $19.99/month with 150 Pro scans and 25 AI recipe draft attempts; production services and privacy/billing/deletion controls have since been configured and tested. Physical-phone, StoreKit and final App Store gates remain.

Assessment date: November 1, 2026 (America/Los_Angeles). Repository: `InvoiceIntelligenceApp`, HEAD `d1783ed`.

## Launch decision

**Hold public submission. Proceed toward a production-configured TestFlight beta after the critical fixes below.** Sift has a substantial implemented product, but its production configuration, subscription fulfillment, privacy controls, and cost enforcement need work before accepting paying customers.

This assessment covers source, migrations, local configuration, existing QA scripts, local type/lint checks, and current Apple guidance. It does not establish deployed database state, Apple/RevenueCat dashboard configuration, real-device behavior, or extraction accuracy. Existing shipping documents contain historical claims that need fresh release evidence. No production services, accounts, or app code were changed during this assessment.

## Product and launch scope

Sift is an iPhone-first restaurant purchasing tool: photograph/import supplier invoices, review extracted line items, retain searchable invoice history, identify price increases, understand spend, and cost dishes from purchasing history. Expo/React Native supplies the client; Clerk handles email OTP and organizations; Supabase holds organization-scoped data and private images; Anthropic processes invoices and recipe drafts; RevenueCat connects Apple subscriptions to Clerk plan metadata; Sentry handles errors.

The strongest launch story is **“See supplier price changes before they eat your restaurant’s margin.”** Scanning enables that outcome; generic AI bookkeeping is a less specific position. Alerts require repeat purchases, so onboarding should explain why a second invoice from the same supplier is useful. Avoid treating every price increase as an overcharge or promising guaranteed savings.

Recommended initial market assumption: US, English, independent restaurant owners, one restaurant subscription per purchasing owner, iPhone. Confirm territory and ownership policy before product setup. Keep current Free/Plus/Pro architecture to limit scope, subject to cost validation; do not add annual billing, accounting integrations, PDF ingestion, multi-location billing, team billing, or new notification promises for v1. Camera capture and photo import are implemented; do not advertise unsupported import formats or offline extraction.

Recipe costing can remain only if Plus access, invoice matching, estimate labeling, and cost controls pass beta. Otherwise remove its launch promises and entry points together and ship it later. Never display an AI market estimate as a verified invoice-derived cost.

## Evidence and prioritized work

P0 means required before external beta handles real customer data or purchases. P1 means required before public submission. Findings describe repository evidence unless stated otherwise.

| ID | Priority | Finding and evidence | Required result / acceptance evidence |
| --- | --- | --- | --- |
| L01 | P0 | `eas.json` production uses a Clerk `pk_test_` key and the same backend endpoint as development/preview. | Configure production Clerk, matching Supabase third-party auth issuer, server Clerk key, and isolated test identities. Document whether the existing backend is production or migrate it. Fresh production email OTP → organization → RLS query → scan succeeds. Add a production config check rejecting test auth and missing services. |
| L02 | P0 | The quota migration grants authenticated clients direct insert/update on `extraction_usage`; clients can call `release_extraction_slot()` repeatedly and supply arbitrary `p_cap` to `reserve_extraction_slot(int)`. Org RLS protects other restaurants but does not make usage trustworthy. | Restrict mutation/reservation/release to a trusted server path. Derive caps from verified server entitlement; bind reservations to invoice/request IDs; release once. Test counter tampering, arbitrary caps, repeated release, concurrent requests at cap, and replay. Verify grants against the deployed database. |
| L03 | P0 | No explicit Anthropic data-sharing consent flow found in scan or recipe UI. Camera/photo permissions are separate. | Before either AI upload, disclose the recipient, data, and purpose; obtain affirmative permission; record version/time; support decline and withdrawal. Gate both client flows and server invocation on consent. Verify decline sends no image to Anthropic. Apple requires disclosure and explicit permission for third-party AI sharing. [Guidelines §5.1.2](https://developer.apple.com/app-store/review/guidelines/) |
| L04 | P0 | `constants/plans.ts` promises recipe costing to Plus and Pro; `draft-recipe/index.ts` only accepts `plan === 'pro'`. | Match the intended shared paid feature set in the server, UI, marketing, and review notes. A real Plus purchase must successfully draft a recipe; Free must remain denied. |
| L05 | P0 | RevenueCat fulfillment is implemented but dashboard hookup is unverified. Webhook defaults unknown products to Pro, ignores environment separation, applies events using a non-atomic read/write ordering guard, and treats product changes as immediate grants. | Validate known app/store/product/environment and approved org IDs; handle transfer aliases and anonymous identities; durably deduplicate and serialize by org; reconcile authoritative active entitlements before updating Clerk. Test delayed and simultaneous events, deferred downgrade, expiration with another active entitlement, refunds, billing recovery, and transfers. Configure sandbox/review org isolation without breaking TestFlight purchases. [RevenueCat event flows](https://www.revenuecat.com/docs/integrations/webhooks/event-flows) |
| L06 | P0 | `useRevenueCatSync` swallows login failures; paywall can purchase before identity binding finishes. Entitlements depend on a webhook and short Clerk polling; upgrade polling checks only `isPaid`, not the purchased tier. | Require confirmed current-org purchase identity; show a retryable synchronization state; wait for the exact tier/cap; reconcile server-side when webhook delivery is delayed. Prove initial purchase, Plus→Pro upgrade, restore, sign-out/sign-in, and device change on a real device. |
| L07 | P0 | `draft-recipe` has a plan check but no apparent AI quota/rate reservation. Invoice calls lack an obvious per-invoice execution lock. | Add server limits for recipe drafts, photo count/size, request frequency and retries; prevent concurrent duplicate processing and partial line-item replacement. Verify extraction retry cannot multiply rows, consume repeated paid work, or corrupt a saved invoice. |
| L08 | P1 | `https://siftcosts.com/privacy` and `/terms` returned HTTP 404, `DEPLOYMENT_NOT_FOUND`, during this audit. | Restore hosting and validate GET requests from outside the development machine. Provide working privacy, terms, and support URLs, and verify the support mailbox receives messages. |
| L09 | P1 | `more.tsx` deletes only the Clerk user. Organization records/images remain; organization deletion in policy requires email. `deleteInvoice` deletes a DB row without removing Storage files. | Implement a documented member/owner/last-owner deletion policy. Remove applicable personal data and orphaned organizations/images with an authenticated, retryable server workflow; preserve legitimate shared business records only with clear rules. Explain that deleting the account does not cancel an Apple subscription and provide subscription management. Test actual database, Storage, auth, and processor outcomes. [Apple account deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/) |
| L10 | P1 | Local and website terms still say there is no paid tier. Privacy policy omits RevenueCat/purchase handling and recipe processing and has ambiguous AI training language. | Reconcile policy and terms with actual processors, subscription billing, recipe photos, retention, deletion, and verified provider data terms. Keep published and repository versions synchronized. Do not promise training exclusions or diagnostic redaction without evidence. |
| L11 | P1 | Zustand stores org data globally; sign-out does not visibly reset it, and fetch completion only checks demo mode, not current identity. | Clear account/org state on identity changes and cancel or reject stale responses. Test A→sign out→B and org switches with slow/erroring network; no previous restaurant data may flash or overwrite the current store. This is a source-level risk requiring runtime reproduction. |
| L12 | P1 | `useExtractionUsage` counts remaining invoice rows, while enforcement uses a separate reservation ledger. Deleting invoices/retries can make these disagree. | Read usage from the authoritative ledger with the same period boundary. Document calendar-month versus subscription-renewal reset. Test deletion, duplicates, failed extraction, month rollover, upgrade and downgrade. |
| L13 | P1 | Paywall falls back to hardcoded USD prices and an actionable purchase button when offerings fail. | Show actual localized StoreKit price, renewal period and terms; make unavailable offerings an explicit retry state. Verify renewal/cancellation disclosures and both legal links. Test slow/offline offerings, cancellation, pending purchase and restore errors. |
| L14 | P1 | TypeScript passes, but lint fails: **38 errors, 8 warnings**. Many concern React Compiler hooks/refs and Reanimated patterns; these are not proof of 38 runtime bugs. No unit/integration suite or repository CI was found; Maestro scripts mostly capture screenshots and assume existing state. | Triage actual defects versus configuration/library compatibility; establish intentional lint rules without blanket suppression. Add repeatable checks and focused tests for billing, quotas, RLS, consent, deletion, and scan integrity. Make key Maestro journeys independent and assert outcomes. |
| L15 | P1 | Local Xcode is **16.4**. Native `ios/` is ignored/untracked, including a locally generated release script and privacy manifest. | Build reproducibly from tracked Expo config with a supported EAS image or updated local Xcode. Any required native customizations must come from tracked config plugins. Confirm final archive SDK, permissions, privacy manifest aggregation, signing and symbols. Current upload minimum is Xcode 26/iOS 26 SDK. [Apple requirement](https://developer.apple.com/news/upcoming-requirements/?id=04282026a) |

The orphaned Stripe functions are not, by themselves, proof of an App Review violation: no current mobile callers were found. Inventory deployed endpoints/subscribers; disable obsolete entitlement writers or define reconciliation precedence so Stripe cannot overwrite Apple plans. Remove stale documentation once the supported billing path is established.

## Commercial readiness

Current client placeholders are Free: 10 scans/month, Plus: $8.99 for 300, Pro: $24.99 for 500. Actual App Store prices are unverified. Both paid tiers promise the same features, with different invoice volume.

The Plus allowance is the larger economic risk. With an illustrative 15% store deduction, $8.99 yields about $7.64, or **2.55 cents per allowed invoice** at full use; Pro yields about $21.24, or **4.25 cents**. At a 30% deduction those fall to **2.10** and **3.50 cents**. These are sensitivity calculations before taxes, refunds, RevenueCat, hosting, storage, support, recipe AI, and extraction retries; they are not verified payout rates. Confirm applicable Apple terms and Small Business eligibility. [Apple program agreement](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/)

Before locking prices, measure at least 100 permitted representative invoices, including multi-page, dense, faint, duplicate and failing scans. Record actual billed model usage for fingerprinting plus extraction, storage and retry overhead; separately measure recipe drafts. Verify the configured Anthropic model IDs against the live account rather than assuming source constants work. Set account spending alerts and emergency AI controls. Require positive contribution at realistic heavy use and a documented worst-case monthly exposure; raise price or lower limits if needed. Show any revised limits consistently across app, server, subscriptions and website.

## Delivery sequence and owners

Suggested staffing: one mobile/backend engineer with founder/product ownership; QA can be a named tester rather than another full-time role. Estimates are planning ranges, not commitments. Account setup and review timing may dominate. Use gates rather than a promised launch date.

| Phase | Indicative effort | Owner | Deliverable and exit gate |
| --- | --- | --- | --- |
| 1. Production foundation | 2–4 working days | Engineering + founder | L01–L04 and initial L07 controls; agree restaurant ownership, launch territory, feature matrix and spending limits. No external real-data beta until these pass. |
| 2. Payment and privacy completion | 4–7 working days | Engineering | L05–L13; functional website/legal pages; sandbox products and webhook reconciliation; successful billing/deletion evidence. |
| 3. Release candidate | 2–4 working days | Engineering + QA | L14–L15; reproducible production archive accepted by App Store Connect; complete test matrix; App Store assets and review access ready. |
| 4. Restaurant beta | 7–14 calendar days | Founder + QA | 5–10 operators across 3–5 restaurants, at least two deliveries from key suppliers; accuracy, value and cost reports. Fix failures and repeat affected journeys. External TestFlight availability depends on beta review. |
| 5. Submission and release | Variable Apple review time | Founder | Submit v1 and subscriptions together, respond to review, then release manually after final smoke checks. |

A reasonable working envelope is roughly **4–6 weeks**, contingent on access and results. Do not promise a calendar launch before the production archive, working purchases and beta gates are complete. Work on listing drafts and account paperwork while engineering fixes proceed.

## Release verification matrix

Maintain a release evidence record with build number, git SHA, backend migration/function versions, device/OS, test account type, result and defects. TypeScript excludes Supabase functions, so its success does not validate the backend.

| Area | Required scenarios |
| --- | --- |
| Authentication | New/returning email OTP, invalid/expired code, resend, organization creation/selection, session expiry, logout, account deletion and interrupted onboarding. Explain to reviewers why shared cloud invoice history requires an account. Email-only authentication does not by itself require adding social sign-in. |
| Tenant safety | Two real test organizations; cross-org row IDs, image paths, RPCs and forged/missing tokens denied; client store cleared on sign-out/switch and stale requests discarded. Check every table and Storage bucket. |
| Scan/save | Physical camera and photo import; one/many pages; denied/limited permissions; rotation/large images; duplicate exact/rephotographed invoices; override; low-confidence edits; save; totals; image history; deletion; timeout/offline recovery; double tap and process death. |
| Data correctness | Labeled invoices from multiple suppliers; quantities, units, credits, tax, discounts, catch weight and date boundaries; confirmed totals consistent in detail/export/dashboard. Price comparison must not confuse pack-size/unit changes with genuine increases. |
| Plans/quotas | Free/Plus/Pro, last available scan, cap reached, simultaneous requests, client tampering, replay, failed reservation release, month reset, deletion and real server enforcement. No debug overrides as acceptance evidence. |
| StoreKit | Both products, cancellation, pending/failed purchase, renewal, grace/recovery, upgrade, deferred downgrade, expiration, refund/revocation, restore on fresh install/device, org identity race, purchase ownership conflict, webhook outage/replay and reconciliation. |
| Recipes | Plus and Pro allowed as advertised; Free denied server-side; real-price matches and AI placeholders visibly distinct; unit/yield changes, missing prices, partial drafts, repeated calls and bounded costs. |
| Privacy/support | AI consent decline/withdrawal, policy links, owner/member/last-member deletion, image cleanup, subscription reminder, support response, diagnostic payload scrub check. |
| Devices/usability | Smallest supported iPhone and current large iPhone, minimum supported OS and current OS; cold launch, background/resume, large text, VoiceOver, reduced motion, keyboard, long names, long invoices and large history. Do not claim untested accessibility support. |

Suggested internal gates (product targets, not Apple mandates): no open crash, data-loss, tenant-leak, purchase or deletion blockers; all critical journeys pass; at least 50 end-to-end real scans across beta restaurants with ≥95% processing success excluding user cancellation; all saved totals reconcile or visibly require correction; no known false paid activation/revocation; measured cost envelope approved. Treat small-sample percentages as directional, not proof of production reliability. Record field-level extraction/correction rates before setting public accuracy claims.

## App Store Connect package

Founder owns account-only inputs: active developer membership, seller/business identity, contracts, banking/tax, app record and bundle ID `com.siftcosts.app`, signing access, desired storefronts, pricing, and App Review contact. None were inspected in this audit. If expanding to EU storefronts, complete the applicable trader disclosures before enabling availability.

Engineering/founder checklist:

- Create/verify monthly products `sift_plus_monthly` and `sift_pro_monthly` in one appropriate subscription group; rank tiers and configure upgrade/downgrade behavior. Match RevenueCat `plus`/`pro` entitlements and the offering to those products. Review purchase ownership and restore transfer policy before enabling multi-org use.
- Supply subscription localization and review screenshots; submit the first subscriptions with the app version. [Apple submission instructions](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/)
- Complete current age-rating questionnaire, category (recommended primary: Business), copyright, support URL, privacy policy, EULA/terms, export-compliance declaration, content rights and distribution options. Recheck encryption declaration against actual shipped behavior rather than relying only on the existing flag.
- Audit privacy answers for email, user/org identifiers, invoice/dish photos and user content, purchase history, diagnostic/device information, and any financial information actually collected. Declare linkage and purpose from the full data map, including SDK behavior. The empty local collected-data manifest is not evidence that the app collects no data; manifests and App Store privacy labels serve different roles. [Apple privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Inspect the final archive's aggregated privacy manifests/required-reason APIs and permissions. Remove unused microphone/Face ID/local-network permission configuration when appropriate through tracked Expo config. Confirm dev tooling and QA switches are absent from the release experience.
- Use current required screenshot sizes from App Store Connect for supported iPhone classes; do not reuse website images without checking resolution and current UI. [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- Prepare stable reviewer access that does not require a human to forward an email code. Use an approved, documented reviewer authentication method or suitable demo access with full reviewable functionality; do not publish universal production OTP bypasses. Test reviewer access on the submitted build. Include sample invoices with permission to share.
- Provide review notes covering account necessity, organization subscription ownership, consent location, scan→review→save, repeat-invoice alerts, Plus/Pro products, restore/manage subscription and Profile→Delete account. Explain external processors. Keep backend services available throughout review.
- Configure a manual release. Recheck current Apple requirements at actual submission, particularly if launch slips into 2027.

## Listing draft and screenshot story

Working name: **Sift: Restaurant Invoice Scan** (29 characters; availability/trademark clearance unverified). Subtitle: **Track food costs & price hikes** (30 characters). Use the customer-facing Sift brand consistently; InvoiceIntelligenceApp is the project name.

Promotional copy draft: “Turn supplier invoices into clear food costs. Scan, review, and save your purchases, then spot price changes and understand where your restaurant’s money goes.”

Description opening draft: “Sift helps independent restaurant owners keep supplier invoices organized and understand purchasing costs. Photograph or import invoice images, review the extracted details, and keep vendor history in one place. Paid plans add price-change alerts, spending insights, and recipe costing.” Only retain the recipe sentence if verified for both paid tiers.

Explain Free's current monthly limit, paid volume limits, renewal terms, cloud processing, and that AI results need review. Avoid “catch every overcharge,” guaranteed savings, “any invoice,” “exact recipe cost,” or accounting/tax accuracy claims. Draft keyword themes: restaurant, invoice, food cost, supplier, vendor, price changes, recipe costing. Research actual search performance after launch; no demand or competitor-ranking study was performed here.

Recommended six screenshots, using synthetic or authorized redacted restaurant data:

1. “See where your food spend goes” — dashboard and vendor breakdown.
2. “Turn invoice photos into line items” — photo and extracted review.
3. “Spot supplier price changes” — a verified same-unit comparison.
4. “Find every saved invoice” — vendor history and original image.
5. “Cost dishes from your purchases” — clearly distinguish matched costs and estimates; omit if deferred.
6. “Keep your records moving” — CSV export and the relevant free/paid context.

Screenshots must reflect the shipping experience and disclose paid-only features. A short preview video is optional and should not delay submission.

## Launch operations and first 30 days

Before release, restore the marketing website and test support. Keep waitlist messaging during beta; replace it with the real App Store link only once available. Prepare onboarding guidance, refund/subscription directions, and a scan troubleshooting page. Recruit beta operators through existing restaurant contacts; do not spend heavily on acquisition until activation and cost are understood.

Release manually to the agreed initial storefront. For a first release, plan a controlled audience/marketing rollout rather than relying on Apple's phased-update mechanism. Verify fresh install, production sign-in, scan/save, purchase/entitlement and legal links immediately. Monitor errors, extraction latency/failure, webhook backlog and costs closely for the first 72 hours. Prepare a forward-fix build path; installed iOS binaries cannot simply be rolled back. Backend rollback must preserve schema compatibility and paid access. An AI kill switch should clearly explain temporary unavailability while retaining existing invoice history.

Track a minimal privacy-reviewed funnel: first open → authentication → organization → consent → first saved invoice → repeat supplier invoice → alert viewed → paywall → purchase verified. Also track first-week repeat use, correction rate, time to first saved invoice, restore failures, deletion failures, support volume and per-active-org variable cost. Avoid invoice contents, photos, supplier account numbers or sensitive line-item data in analytics. Sentry supplies crash visibility, not a complete activation funnel.

Recommended beta activation target: at least 70% of recruited operators save a real invoice within 24 hours of assisted onboarding, with a median first-save time under five minutes. Set paid conversion and retention targets after observing the beta cohort; do not invent a revenue forecast from the codebase. Review day 7/14/30 cohorts, interview non-activators, and prioritize failed scans and confusing alerts before adding features.

## Immediate next actions

1. Confirm production identity/backend ownership and the initial owner/storefront model.
2. Close client-writable quota enforcement and bound all AI spending.
3. Add AI consent and align Plus recipe access.
4. Complete authoritative subscription reconciliation and identity binding.
5. Restore legal/support hosting, finish deletion semantics, and produce a reproducible release build.

The release owner should maintain one evidence checklist here rather than treating the older `SHIPPING_READINESS.md` or IAP migration notes as current proof of readiness.
