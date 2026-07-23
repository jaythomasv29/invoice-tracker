# Product Requirements Document
## Sift — AI Invoice & Recipe Cost Intelligence Platform for Independent Restaurants

**Status:** Draft v10
**Author:** James
**Date:** July 22, 2026 — **v10 is a reality-sync pass**, written after a live build/test session rather than as forward planning. It does three things v9 didn't: (1) names the product — **Sift** ("Sift: Invoice & Recipe Bookkeeper," App Store subtitle "Invoices & True Food Cost") — across the codebase, legal docs, and this document; (2) promotes **recipe costing from an explicit non-goal (§8, v9) to a shipped Phase 1 flagship Pro feature** (§5.6/§6.10), which is the single biggest change in this revision; (3) corrects several places where earlier drafts described intended behavior that shipped differently or didn't ship at all — notably **weight-parsing and cross-vendor $/lb comparison (5.4) and AI Insight Briefings (5.5) were both quietly dropped during a shipping-readiness scope-cut pass**, not formally descoped, and delivery reconciliation (6.4) shipped in a simpler form than originally specified. Every section below is marked with its real status as verified against the current codebase (not against prior drafts of this document) — see the inline ✅/🔲/✂️ markers. Real Stripe billing (§4) is now live and was tested end-to-end in test mode this session. v9's home/business audience-split onboarding was drafted here but never implemented — see 6.1. v8 updated the delivery-reconciliation states and auth/backend stack to match implementation decisions made while building the initial client — see 6.4 and 9.

**Status legend used throughout:** ✅ shipped & verified in code · 🟡 shipped partially / simplified from spec · 🔲 not built · ✂️ was built, then removed or disabled during a later pass.

---

## 1. Vision

Every restaurant distributor invoice (Sysco, US Foods, PFG, local produce/meat/seafood vendors) is a small business's single richest, most neglected data source. Today that data dies in a drawer or a shoebox. Multi-unit chains pay $200–500+/location/month for platforms (MarginEdge, Ottimate, xtraCHEF, Restaurant365, Craftable) built for corporate ops teams — tools that assume a bookkeeper, a 4-12 week onboarding, and dozens of locations to justify the cost. Independent, single- and dual-location restaurants — the vast majority of the industry — are priced out and underserved. One review of the space put it bluntly: Craftable is **"too expensive for mom and pops."**

This product is a fast, AI-native invoice scanner built for that neglected majority: sign in with your email, photograph an invoice, and within seconds know not just what you spent — but whether you got a fair price, whether you got everything you paid for, and how your costs compare across your own vendors and to restaurants like yours.

## 2. Problem Statement

- Independent operators scan/photograph invoices for their own records but get **zero intelligence back** — no price tracking, no anomaly detection, no benchmarking.
- Distributor price creep (a few cents per case, repeated across hundreds of SKUs) is one of the largest silent margin killers in restaurants, and it's nearly invisible without line-item history.
- Short deliveries and billed-but-never-received items are a recurring, quietly expensive problem — busy operators forget to check the invoice against what actually came off the truck, and end up paying for product they never got.
- Independents routinely buy the same ingredient from multiple sources (a primary distributor plus Costco/Restaurant Depot runs), with no easy way to see which source is actually cheaper once you account for real weight and yield.
- Existing AP platforms solve some of this for enterprise multi-unit groups but are overkill, overpriced, and slow to onboard for a single-location owner-operator who wants value in their first session, not after a 4-week implementation call.
- No incumbent gives operators visibility into what *other* restaurants are paying for the same SKUs from the same distributors — the single most powerful negotiating lever an independent operator could have.

## 3. Target Users

| Persona | Description | Primary Need |
|---|---|---|
| **Owner-Operator** (primary) | Runs 1-3 locations, wears the GM/purchasing/bookkeeping hats themselves | Fast capture, plain-English cost insight, no accountant required |
| **Kitchen Manager / Sous Chef** | Receives deliveries, does the actual scanning | Dead-simple capture flow, works one-handed at a loading dock; needs to reconcile what arrived vs. what's billed |
| **Bookkeeper / Accountant (external)** | Part-time or contracted, reconciles monthly | Clean CSV/export, vendor totals, no need for a seat in the app |
| **Multi-location Regional Manager** (Phase 2) | Oversees several independent locations under one group | Cross-location comparison, consolidated vendor spend |
| **Home User** (v9) | Tracks personal/household grocery and shopping receipts, not a business | Same price-creep and spend-tracking value, in personal (not "restaurant"/"vendor") framing — a marketing/campaign audience, not a different product |

**v9 note — home/business is a campaign split, not a product split:** the product, data model, and Clerk Organization structure are identical for both audiences (a household is just an "org of one" under the hood, same as a single-location restaurant). The only fork is onboarding copy (6.1) — which lets the business persona and the home persona each be marketed to with their own message ("track your restaurant's vendor spend" vs. "catch your grocery prices creeping up") without splitting engineering effort. Functional divergence (different features, different pricing, different terminology throughout the rest of the app) is an explicit non-goal for this pass — see Open Questions (13) for what would need deciding before going further than onboarding.

**v10 status — 🔲 not built.** The persona-picker screen described above and in 6.1 was never implemented. `app/onboarding/organization.tsx` unconditionally reads "Set up your restaurant" — there is no "My restaurant/business" vs. "My home" branch, no route param, nothing persisted. The home-persona audience split remains a real idea worth doing (nothing about it conflicts with anything shipped since), it just hasn't happened yet. Treat this row of the persona table as aspirational until 6.1 is actually built.

**v9 addendum:** the home persona's actual value is receipt capture, price-creep tracking (5.1), and spend analytics (5.3) — the same wedge, just against grocery/household receipts instead of vendor invoices. Delivery reconciliation (6.4) is a business-context feature by nature (checking a truck delivery against a distributor invoice at a loading dock) and isn't expected to be relevant to most households — a home user isn't reconciling a delivery driver's truck against a grocery receipt the way a kitchen manager reconciles a Sysco delivery. It stays in the product because it's core to the business persona, not because it's meant to apply to both; if usage data ever shows meaningful home-side demand for it, that's a reason to revisit, not an assumption to build in now.

## 4. Business Model

Multi-tenant SaaS. Each restaurant is a tenant/organization; owners invite staff. Pricing is designed to undercut the incumbent floor (~$200-300/location/month) by an order of magnitude for single-location operators, since the AI does the extraction work a human review team does at MarginEdge/Ottimate.

**v10 — ✅ shipped, real billing, tested end-to-end.** The tiers below superseded the "proposed/directional" table from earlier drafts once the product had real feature usage to design around (see `PLAN_STRATEGY.md` for the full tiering rationale). Billing itself runs on **Stripe Checkout + a Stripe billing portal**, fulfilled via a webhook that flips `organization.publicMetadata.plan` in Clerk — Clerk stays the single source of truth the rest of the app reads from, Stripe is purely the payment engine (see `BILLING.md`, and §9 for the architecture). This was exercised live end-to-end on 2026-07-22 in test mode: paywall → Checkout → subscribe → webhook → org flipped to `pro`, confirmed via the Clerk API. Not yet tested: the cancellation webhook path, and the billing-portal "manage subscription" flow (tracked in `SETUP.md`).

| Capability | Free | Pro |
|---|---|---|
| Capture + AI extraction | 10/month | Unlimited |
| Notes on entries | ✓ | ✓ |
| Vendor-grouped storage & history | ✓ | ✓ |
| CSV export | ✓ (not gated) | ✓ |
| Price-creep alerts | 🔒 | ✓ |
| Total spend + trends across vendors | 🔒 | ✓ |
| Spend by category | 🔒 | ✓ |
| Top-spend items (80/20 Pareto) | 🔒 | ✓ |
| Missing-invoice alerts (vendor cadence gap) | 🔒 | ✓ |
| ★ AI recipe costing — true cost per dish | 🔒 | ✓ |

There are two independent upgrade triggers by design — extraction volume is the cost gate (converts heavy scanners fast), the analytics + recipe costing bundle is the insight gate (converts everyone else). Recipe costing (§5.6/§6.10) is positioned as the anchor: it's the one capability competitors charge far more for, and it ties every other Pro feature together (a price-creep alert becomes "chicken parm up 9%," not just a number).

**Price:** currently a **$29/mo placeholder** (`constants/plans.ts`'s `PRO_PRICE_LABEL`, matched by the actual test-mode Stripe price used in testing) — display copy only, doesn't read from Stripe. `PLAN_STRATEGY.md` recommends anchoring higher (~$49/mo) given recipe costing's competitive positioning; this is an open pricing decision, not an engineering task (see §13 and `SETUP.md`).

**Not built / explicitly cut from this pass:** the **Multi-Location** tier from earlier drafts has no implementation and no near-term plan — demoted to Phase 2+ Roadmap (§7). **Native IAP** (StoreKit/Play Billing via e.g. RevenueCat) remains an option if App Store policy ever requires selling the subscription in-app rather than via a web checkout — not needed today since this is a B2B tool and Stripe Checkout in the system browser is compliant as-is.

Revenue expansion path (Phase 2+): anonymized benchmarking as a premium data product, paid integrations (QBO/Toast), vendor marketplace referral fees.

## 5. The Wedge: Vendor Price-Creep Alerts & Spend Intelligence

This is the feature set the whole MVP is built around — and it's where a multi-tenant architecture, a data-fidelity-aware extraction pipeline, and an AI narration layer on top create a moat none of the single-tenant incumbents can easily replicate.

### 5.1 Price-Creep Detection (Phase 1 — every tenant gets this from day one)
- ✅ **Shipped, live, Pro-gated.** Every scanned invoice line item is matched against that restaurant's own item/vendor history and compared **at whatever unit the vendor actually printed** — per case, per lb, per each, per box (see 6.3). This works for every invoice, unconditionally, with zero dependency on weight data and zero user input: a chicken invoice priced only by the case still gets tracked and alerted on by the case, since the case designation itself is a stable, comparable unit from delivery to delivery of the same vendor/item.
- ✂️ **v10 — cut, not shipped.** The weight-normalized price-per-lb half of this section (parsing a structured weight field or pack-size language, then computing a true $/lb figure) was built, then removed during the shipping-readiness scope-cut pass (`parsed_weight`/`weight_source`/`weight_basis`/`normalized_price_per_lb` stripped from the extraction prompt and schema; the DB columns were left in place, nullable and unused, not migrated away). Alerts today compare only at the vendor's native printed unit — never at a normalized per-lb figure. See §5.4 for the larger feature this take-down affects, and §13 for whether it's worth reinstating.
- ✅ **Shipped:** threshold-based alert (>3% vs. the most recent prior invoice from the same vendor with a matching `clean_name` + `unit_of_measure`), inserted as a `price_alerts` row at extraction time. In-app alert feed (Alerts tab) is real; **push notification delivery is not implemented** — alerts currently only surface in-app.
- 🟡 **Trend view — partial.** Home dashboard shows an aggregate spend trend (5.3), not a **per-item/per-vendor line chart** of price history over time as originally specified here. An operator can see an item's *alert history* but not a continuous price line for one SKU.
- 🔲 **Not built:** configurable sensitivity/threshold per restaurant or per category (More → "Alert sensitivity" is a `coming soon` stub — see 6.5).
- Known limitation, mostly accepted deliberately: same-vendor case-price tracking assumes the case size itself doesn't quietly change. This limitation is now permanent for the foreseeable future given the weight-parsing cut above, rather than closable via the optional fallback originally described.

### 5.2 Community Price Index (Phase 2 — the long-term moat)
- **This is the feature no incumbent in the space offers well**, because it requires a multi-tenant data pool, not a single restaurant's history.
- Opt-in, anonymized aggregation: once enough restaurants in a region are scanning invoices from the same distributor, the app can show an operator *"Restaurants of similar size in your area are paying $X-Y for this SKU from Sysco — you're paying $Z."*
- Strictly anonymized and aggregated (no restaurant ever sees another's identity or exact numbers) — this needs real privacy engineering, not just a checkbox, and should be scoped with legal input before launch given competitive-sensitivity concerns among distributors and restaurants alike.
- This single feature is the reason to build multi-tenant from day one even though you're starting with one restaurant (Thaiphoon): the value compounds with every new tenant, and it's very hard for a single-tenant/enterprise-AP tool like MarginEdge to bolt on retroactively.

### 5.3 Spend Analytics Dashboard
- ✅ **Shipped, Pro-gated (free sees a teaser number, see `PLAN_STRATEGY.md`).** Total spend by vendor, week/month trend (home dashboard bar chart), and spend by category (donut chart, `DonutChart` component) — all three real, all reading from actual extracted `invoice_line_items`.
- ✅ **Shipped:** Top-spend items (80/20 Pareto), computed client-side off `clean_name` groupings (`components/dashboard/TopItemsCard.tsx`) — v1 quality per `PLAN_STRATEGY.md`, gets sharper once canonical-item matching (6.3) is more complete.
- ✅ **Shipped, new since v9 — not in any earlier draft of this PRD:** **Missing-invoice alerts** (`hooks/useMissingInvoices.ts`). Per-vendor cadence detection — computes each vendor's typical delivery gap from invoice history (median of the gaps, min. 3 invoices to trust it) and flags a vendor as overdue when the current gap exceeds ~1.6x their usual cadence (plus a minimum slack). This is a different concept from delivery reconciliation (6.4) — it catches "you probably forgot to log an invoice from this vendor," not "this delivery was short."
- 🔲 **Not built:** the COGS-adjacent "spend as % of estimated revenue" view (manual or POS-synced revenue entry) — no revenue input exists anywhere in the app today. Recipe costing (5.6) has effectively superseded the motivation for this — it gives a much sharper per-dish margin number than a blunt spend/revenue ratio ever would.

### 5.4 Cross-Vendor Price Comparison (Phase 1 — promoted from a v2 idea)

**v10 — 🔲 not built, and currently blocked by the 5.1 weight-parsing cut.** Everything below is the original spec, kept for reference since it's a real, still-desirable feature — just not one that exists today. It has **zero implementation**: no per-vendor $/lb comparison view anywhere in the app, no canonical cross-vendor item entity surfaced to the user (the `items` table exists in the schema but `invoice_line_items.item_id` is still always null outside of what recipe costing (5.6) opportunistically backfills). This entire feature depends on a common unit to compare on, which depended on the weight-parsing pipeline that was cut (5.1) — so reviving this needs weight-parsing back first, or a different normalization approach. See §13.

- Once items are canonicalized (6.3), the same "Chicken Breast, Boneless Skinless" entity can carry price points from every vendor it's been bought from — Sysco, US Foods, Restaurant Depot, Costco.
- The dashboard surfaces a direct comparison: *"You're paying $2.85/lb from Sysco vs. $2.40/lb at Restaurant Depot for boneless chicken breast."*
- This needs no other tenants and no cold-start period — it's immediate value from a single restaurant's own multi-vendor buying habits, which makes it a strong candidate to headline the app alongside price-creep alerts rather than waiting for Phase 2.
- Cross-vendor comparison requires a common unit, so it activates automatically only for items where a weight was parseable (structured field or description text, see 6.3) — never through a prompt. An item billed only by the case with no weight signal anywhere (common with catch-weight proteins) still gets full same-vendor price-creep tracking (5.1), just not a cross-vendor $/lb comparison, since there's no common unit to compare on automatically.
- For an item the owner specifically cares about comparing, an **optional** fallback (6.3) — type in the weight, or snap a photo of the case/product label — unlocks the comparison on demand. This is opt-in per item, not a default step in the scanning flow, so the zero-friction default in 5.1/6.3 stays intact for everyone who never needs it.

### 5.5 AI Insight Briefings (Phase 1 — the layer that turns data into a "so what")

**v10 — 🔲 not built.** There is no `app/briefing.tsx`, no briefing-generation code, no scheduled job, anywhere in the current codebase — despite this section's own closing line calling it "arguably the single most demo-able differentiator in the product." Earlier resume-point documentation (`SHIPPING_READINESS.md`) described it as "still hardcoded text," but even that stub no longer exists — it appears to have been removed outright at some point without a corresponding scope decision recorded anywhere. This was never formally descoped the way, say, Multi-Location (§4) was — it just silently isn't there. Flagged as an open question (§13): build it for real, or formally move it to Phase 2 so this document stops overstating what a demo of the app today would show. The spec below is preserved as-is since it's still a good spec, just currently entirely aspirational.

- On a configurable cadence (weekly by default, matching how often most independent restaurants actually take deliveries), Claude synthesizes everything the app already knows for that period — spend totals and trend, price-creep alerts fired, cross-vendor deltas, delivery-reconciliation disputes — into a short, plain-English briefing, instead of leaving the owner to go piece dashboards together themselves.
- Example: *"This week: $2,140 spent across 4 vendors, up 8% vs. last week. Chicken breast from Sysco rose 11% — your second increase this month. You're paying 15% more for tofu at S.J. Distributors than at Ocean Paradise for the same item. 2 items were flagged short this week, $47 total — worth a call to your Sysco rep."*
- Delivered as a push notification plus a persistent digest feed in-app; optionally emailed to the bookkeeper/accountant persona alongside the CSV export (6.7).
- **Critical design constraint:** the briefing is *narrated from* already-computed structured metrics (the same price alerts, spend rollups, and comparison deltas that power 5.1–5.4) — the model is never asked to re-derive numbers from raw invoices on the fly when writing the summary. This keeps the "nothing guessed" principle from Section 10 intact for the one feature most likely to read like a confident, opinionated voice — that voice needs to be trustworthy, not just fluent.
- This is arguably the single most demo-able differentiator in the product *if built* — MarginEdge and Ottimate give an operator dashboards and reports to go read; this would hand them the conclusion, unprompted, on a schedule. None of the platforms surfaced in market research do this. Until it exists, this is a roadmap claim, not a product claim.

### 5.6 AI Recipe Costing (Phase 1 — ✅ shipped; new since v9, the current flagship Pro feature)

**This is the single biggest change in this document.** Earlier drafts (through v9) listed recipe costing as an explicit MVP non-goal (§8) and a deferred Phase 2+ item (§7) — "the feature that turns the product into a MarketMan/Restaurant365 competitor, deliberately deferred." That decision was reversed: recipe costing shipped as Phase 1 and is now the anchor of the Pro tier (`PLAN_STRATEGY.md` calls it "the hero" — it's the one capability competitors charge far more for, and it's the feature that ties every other Pro insight together, turning a price-creep alert into "chicken parm up 9%" instead of just a number).

Full architecture spec: `RECIPE_COSTING.md` (buildable-as-written detail on data model, cost resolution, confidence math, AI draft flow, and phasing). Summary of what's actually live:

- ✅ **Data model:** `recipes` + `recipe_ingredients` tables (self-referential, discriminated by `kind: 'dish' | 'prep'`, though prep items aren't wired into the UI yet — see below), `recipe_cost_history` for trend tracking, a private `recipe-images` storage bucket. All shipped via migrations `20260722100000`–`20260722100002`, deployed and RLS-scoped like every other table.
- ✅ **AI draft flow:** new `draft-recipe` edge function, mirrors `extract-invoice`'s shape (Clerk JWT forwarded, Sonnet 5, forced tool-use against a strict schema, images optional). Given a dish name (and optionally a photo), Claude drafts a starting-point ingredient list with rough quantities and cost shares — explicitly framed to the model and the operator as a *template to adjust*, never a source of truth. Pro-gated server-side before any Claude spend.
- ✅ **Cost resolution:** per-ingredient cost is resolved from the org's own real invoice history (`resolve_item_cost_per_gram` RPC) — a trailing average across the item's recent purchases, pooled across all vendors, normalized to a per-gram basis. Ingredient matching opportunistically backfills `invoice_line_items.item_id` the same way vendor resolution already works (fuzzy-match now, exact-match-and-link later), so cost accuracy improves over time without a blocking backfill project.
- ✅ **Confidence & cost-range model:** every dish shows a cost estimate plus a range, weighted by how much of the dish's cost share is confirmed-and-resolved vs. still an untouched AI guess — nailing down the 3g of garnish barely moves confidence, nailing down the protein (60% of plate cost) moves it a lot.
- ✅ **Screens:** `app/recipes/` stack (list, start-dish, AI draft review with adjustable quantity sliders, dish cost detail with margin %) — pushed from a "Recipes" tab, following the existing detail-screen pattern rather than adding a 6th tab-bar item.
- 🟡 **Phase 1 scope, deliberately limited** (see `RECIPE_COSTING.md` §8 for the full phasing): **dishes only, no prep items yet** (no sauces/stocks/mother-recipes as reusable sub-components — real complexity, correctly deferred); **weight units only** (g/oz/lb) — count/volume units (each, gallon, case) show a "not yet supported" state, since that's what let Phase 1 skip building `item_unit_conversions` entirely and reuse `normalized_price_per_lb`... **except that column's producing logic was cut in the same shipping-readiness pass that removed weight-parsing (§5.1)** — worth flagging as a latent risk: recipe costing's weight-based cost resolution depends on invoice data that the extraction pipeline may no longer be populating as richly as `RECIPE_COSTING.md` assumed when it was written. Verify this doesn't silently degrade cost accuracy as older weight-tagged invoices age out of the trailing-average window (see §13).
- 🔲 **Not yet built (Phase 2+ per `RECIPE_COSTING.md` §8):** prep items, count/volume unit conversions, a nightly live-recalc sweep job, and the price-creep → dish-cost-delta tie-in ("chicken parm cost up 9% this month," surfaced on the dish detail screen).
- **Product decision still open** (`PLAN_STRATEGY.md`, `SETUP.md`): whether Free orgs get a "one free dish" teaser before hitting the paywall, or recipe costing stays fully Pro-gated as it is today (currently: fully gated, zero free sample).

## 6. MVP Feature Set

### 6.1 Onboarding & Auth
- ✅ Email + OTP sign-in (no password required to start) — matches the "60 seconds to value" positioning. **v8 change:** originally scoped as phone + OTP; switched to email during implementation because Clerk gates SMS-based phone auth behind a paid plan, while email verification codes are free-tier. Same friction-free, no-password shape either way.
- **v9 addition — audience split:** immediately after auth, a new "What are you tracking invoices for?" screen asks the user to pick **My restaurant or business** or **My home**, before organization creation. This exists purely so the two audiences (3) can each be marketed and onboarded with language that speaks to them — it does not branch the underlying flow. Both choices land on the same organization-creation screen with only its copy adjusted (restaurant/vendor language vs. household/store language); both create the same kind of Clerk Organization and the same tables/RLS scoping (9). The choice is currently passed as a route param and is not yet persisted anywhere durable (no DB column, no Clerk org metadata) — see Open Questions (13) for whether/how it should be if the two audiences ever need to diverge functionally or be distinguished in analytics.
  - **v10 — 🔲 not built.** `app/onboarding/organization.tsx` has no persona picker; it unconditionally shows "Set up your restaurant." See §3.
- ✅ Create or join an organization. Owner is first user; owner invites staff by email — except:
  - **v10 — 🔲 "Invite staff" is a dead stub.** More screen's "Invite staff" row just shows a `coming soon` toast; there is no working `organization.inviteMember` flow. There is currently no way to get a second person into an org through the app itself (only via the Clerk Dashboard directly).
  - **v10 — 🟡 Roles exist but aren't enforced.** Owner/Manager/Staff roles are real in Clerk and used for tenant scoping, but nothing in the app UI is role-gated — any member can do anything a member can do. Matches the "single-tier roles" launch scope from `SHIPPING_READINESS.md`, but worth naming plainly: role *differentiation* (the bullet below) is not live.
- Roles: **Owner** (full access, billing), **Manager** (scan, view analytics, no billing), **Staff** (scan only). — *aspirational, see above; not enforced today.*

### 6.2 Invoice/Receipt Capture
- ✅ Camera capture or photo-library import (multi-page via "Import from library" picking multiple photos at once). **v10 note:** a cosmetic "Batch" toggle on the scan screen was removed during the shipping-readiness pass — it did nothing functionally; every capture always produced a single-page invoice regardless of its state. Multi-page support survives entirely through the multi-photo library import path.
- 🔲 **Not built:** Email/PDF ingestion (a dedicated forwarding address per organization). No forwarding address, no PDF-parsing path exists anywhere in the codebase.
- 🔲 **Not built:** Bulk backfill onboarding as a distinct flow. An operator *can* manually scan old invoices one at a time to seed history, but there's no dedicated "batch-scan a stack from day one" onboarding step — the cold-start problem for price-creep alerts (needs a prior invoice to compare against) is unmitigated today.
- ✂️ **Offline-first capture queue — cut, explicitly out of scope for this launch.** `SHIPPING_READINESS.md`: "still just connectivity detection, no queue/retry... explicitly out of scope per the 'camera-only capture, no offline queue' launch scope." The scan screen does show a real offline banner (`expo-network`), it just doesn't queue anything for later upload.
- ✂️ **Batch capture mode — removed**, see the multi-page note above.

### 6.3 AI Extraction Pipeline (Claude API)
- ✅ Image(s) → Claude API structured extraction → vendor name **and vendor contact info** (phone, account rep name, account number, if printed), invoice date/number, line items (description, quantity, unit, unit price, extended price), tax, total.
- ✅ **Line item type tagging:** `charge` vs. `credit` — so a return/credit memo for a damaged case or short shipment is never mistaken for a genuine price drop in the price-creep baseline.
- ✅ **Category auto-tagging:** protein/produce/dairy/dry goods/etc. assigned at extraction time so the spend dashboard (5.3) is populated with zero manual tagging effort from the owner.
- ✅ **Native unit-of-measure tracking — always captured, zero user input:** every line item is tracked at whatever unit the vendor actually printed (CS, LB, EA, BX, OZ). This alone powers same-vendor price-creep detection (5.1) unconditionally.
- ✂️ **Automatic weight parsing — built, then cut.** Both the structured-weight-field path and the description-text pack-size parsing (e.g. "PHOENIX JASMINE RICE #50 LBS") were removed from the extraction prompt/schema during the shipping-readiness scope-cut pass, along with the standard-pack-vs-catch-weight distinction and the resulting `normalized_price_per_lb` figure. The DB columns remain (nullable, unused) but nothing populates them for newly extracted invoices. This is the root cause of §5.4 (cross-vendor comparison) having zero implementation today, and a live risk flagged against recipe costing (§5.6).
- ✂️ **Optional weight fallback (manual entry / product-photo capture) — cut** along with the above; the "Add weight to compare vendors" UI block was removed from `app/scan/review.tsx`.
- ✅ **Vendor/item normalization — real, and recently fixed.** Vendor resolution normalizes (lowercase, strip punctuation, collapse whitespace) and checks an `aliases` column before creating a new vendor row, fixing a real duplicate-vendor bug found in production data (OCR whitespace/punctuation drift, e.g. "S. J. Distributors LLC" vs. "S.J. Distributors LLC"). Item-level canonicalization across vendors (the `items` table) exists in the schema but `invoice_line_items.item_id` is still populated only opportunistically, by recipe costing's ingredient-matching flow (5.6) — not by extraction itself.
- ✅ **Low-confidence field flagging:** 2-tap human confirm on flagged fields, real and live.
- ✂️ **Sonnet 5 → Opus 4.8 escalation — built, then cut.** §9 originally specified automatic re-extraction on a stronger model when confidence was low. Extraction is **Sonnet 5 only** now; low-confidence flagging itself is unchanged (still drives the 2-tap confirm UI), only the automatic bigger-model re-try was removed. See §9 for the corrected architecture description.
- 🔲 **Not built:** duplicate invoice detection (same vendor + invoice number). `invoice_number` is captured and stored but never checked against existing invoices.

### 6.4 Delivery Reconciliation — Billed, Not Delivered

**v10 — 🟡 shipped, but substantially simplified from every earlier draft of this spec**, via a migration (`20260721100000_line_item_note_drop_disputes_ui.sql`) whose own comment states the change plainly: *"instead of a three-way received/missing/pending status feeding a separate 'disputes' tracker with dollar amounts, the confirm/save screen now just lets you mark a line item missing and add a free-text note."* What's actually live today:

- ✅ On the scan/review (save) screen, each line item can be toggled **Missing** (binary — there is no separate Received/Pending state machine anymore) with a free-text note attached.
- ✅ A running "Marked missing" dollar total is shown at the bottom of the review screen at save time.
- ✂️ **Not live:** the dedicated "disputes" tracker/table (`delivery_disputes`) — the app stops writing to it; it's unused, not dropped. There is no standalone Disputes screen/route anywhere in the current app (`find app -iname "*dispute*"` returns nothing).
- ✂️ **Not live:** the vendor-rep dispute-message drafting feature, the running per-vendor dispute timeline, and the home-dashboard "Delivery check" ring chart / "Billed, not delivered" tile described below. Vendor contact info (phone, rep name) is still captured at extraction time (6.3) and shown on the vendor detail screen, but nothing currently connects it to a missing-item flag the way this section originally specified.
- **Note on documentation drift:** an earlier resume-point document (`SHIPPING_READINESS.md`) describes a "Disputes screen... grouped by vendor with a per-vendor running dollar total and inline contact card" as freshly built. That work is not present in the current codebase — either it was reverted by the same simplification migration above, or the resume-point doc was written before that migration and never updated after. Treat `SHIPPING_READINESS.md` as stale on this specific point; this PRD reflects what's actually in the repo as of 2026-07-22.

*Original spec preserved below for reference — this is what a future pass would need to rebuild if the fuller reconciliation workflow is still wanted:*

- At the point of scanning (or shortly after), the app prompts the person receiving the delivery to mark each line item as **Received** or **Missing** — a fast, tap-based check against what's actually on the truck/shelf, not a separate paperwork step.
- Items marked Missing generate a standing flag on that invoice and roll up into a running "amount to dispute" total per vendor, so nothing gets forgotten before the next bill.
- Because vendor contact info is captured at extraction time (6.3), a flagged item surfaces the rep's name/phone right alongside it — the app can draft a dispute message, but sending it should be a deliberate, reviewed action by the owner/manager rather than automatic, since it's outbound communication to a business partner.
- The home dashboard surfaces this as two tiles: a "Delivery check" ring chart and a "Billed, not delivered" tile with a running dispute timeline and a link to the full dispute history.

### 6.5 Price-Creep Alerts
- As described in 5.1. ✅ In-app alert feed. 🔲 Push notification delivery not implemented.
- 🔲 Configurable sensitivity per restaurant — More → "Alert sensitivity" is a `coming soon` stub.

### 6.6 Vendor & Spend Dashboard
- ✅ As described in 5.3 (spend by vendor/category/trend, top-spend items, missing-invoice alerts). 🔲 The cross-vendor $/lb comparison view described in 5.4 does not exist.

### 6.7 Export
- ✅ **Shipped, and not Pro-gated** — CSV export of invoices/line items (date, vendor, invoice #, item, qty, unit, prices, category, verification status) via the native share sheet (`lib/csvExport.ts`, `expo-sharing`). Clean enough to hand to a bookkeeper without QBO/Toast integration work. Unlike everything else in §4's Pro column, this is free for every org today — worth a deliberate decision either way (leave it free as a Free-tier value-add, or fold it into Pro) rather than an accident of build order.

### 6.8 Search & History
- ✅ "All Invoices" segmented view (Vendors tab) with client-side search by vendor name or invoice number.
- ✅ Original invoice image viewable after save (signed URL, lazy-fetched, swipeable full-screen viewer) — the "always keep the source image" principle from this section is intact. 🔲 Weight-parsing source is no longer part of what's shown, since weight-parsing itself was cut (6.3).

### 6.9 AI Insight Briefings

**v10 — 🔲 not built.** See 5.5 for the full status note. Nothing in this bullet list exists today.

- As described in 5.5. Configurable cadence (weekly default), delivered via push notification and an in-app digest feed, with an optional email copy for the bookkeeper persona.

### 6.10 AI Recipe Costing (new since v9)

✅ **Shipped, Phase 1.** See §5.6 for the full write-up and `RECIPE_COSTING.md` for the architecture spec — not duplicated here to avoid drift between two copies of the same status. This is the current flagship Pro feature.

### 6.11 Billing & Subscription Management (new since v9)

✅ **Shipped, tested end-to-end 2026-07-22.** Stripe Checkout (subscribe), Stripe billing portal (manage/cancel), and a webhook-driven fulfillment path that flips the Clerk org's plan flag — see §4 and §9 for the architecture, `BILLING.md` for the full setup/ops guide. Not yet tested: the cancellation webhook and the billing-portal UI itself (tracked in `SETUP.md`).

## 7. Phase 2+ Roadmap (explicitly out of MVP scope)

**v10 change:** recipe costing is **removed** from this list — it shipped as Phase 1 (§5.6/§6.10), reversing the deferral decision from every prior draft. Its own *internal* phase 2+ items (below) take its place. Several other items are added here not because they were newly planned, but because build sessions since v9 quietly cut them from what had been in-scope — listing them here makes that an explicit, visible decision rather than a silent gap (see §13 for which of these are open questions vs. settled cuts).

- Community Price Index (5.2) — once tenant volume is meaningful enough for aggregation to be statistically useful and anonymization to be safe. Unchanged from v9, still not started.
- QuickBooks Online / Toast POS integrations. Unchanged, not started.
- Multi-location comparison views and consolidated org-level reporting, including the Multi-Location pricing tier (§4).
- **Recipe costing Phase 2 — prep items:** `component_type='prep'` fully wired (sub-flow screen, batch-yield gating, duplicate-check against existing prep items, confidence propagation). Count/volume unit conversions (`item_unit_conversions`) land alongside this, since prep items are the case that needs them most (sauces, dressings — volume-based).
- **Recipe costing Phase 3 — live-recalc automation + price-creep tie-in:** nightly recompute sweep, `recipe_cost_history` trend sparkline in the UI, and the price-alert → dish-cost-delta join ("chicken parm cost up 9% this month").
- **Recipe costing Phase 4 — stretch:** variance-based (not additive) cost-range math, vendor-specific scenario costing, POS-synced sales-mix food-cost %, AI-suggested menu pricing.
- **Weight-parsing + cross-vendor $/lb comparison (5.1/5.4) — reinstate or formally cut.** Currently in an ambiguous middle state: built once, removed, not re-added, not declared permanently out of scope either. Needs a real decision (§13), not a default-by-inertia outcome.
- **AI Insight Briefings (5.5/6.9) — build for real, or formally move here.** Same ambiguous-middle-state problem as above; currently neither shipped nor declared cut.
- **Delivery reconciliation, fuller version (6.4)** — the dedicated disputes tracker, per-vendor dispute timeline, and vendor-rep dispute-message drafting that existed in spec (and briefly in a build) but isn't in the app today. Revisit if the simplified mark-missing-with-a-note flow proves insufficient in practice.
- Email/PDF ingestion and bulk-backfill onboarding (6.2) — both still-desirable, never-built ideas from the original spec, not touched by any build session since.
- Multi-user "Invite staff" flow, and actually role-gating the app's UI per Owner/Manager/Staff (6.1) — currently a dead stub and an unenforced schema, respectively.
- Vendor price negotiation assistant (AI-drafted "here's what comparable restaurants pay" messages to send to reps) — a natural extension of the delivery-reconciliation dispute drafting in 6.4, once that exists again.
- AP/bill-pay (this is what turns the product into an Ottimate competitor — high liability/compliance surface, deliberately deferred well past MVP).

## 8. Explicit Non-Goals (for MVP)

- Not an inventory management system (no physical counts, no par levels).
- **v10 — no longer a non-goal, reversed:** ~~Not a recipe-costing tool~~ — recipe costing shipped (§5.6) and is now the flagship Pro feature. What remains a genuine non-goal at this phase is the *deeper* recipe-costing surface: prep-item nesting, count/volume units, menu-engineering/sales-mix food-cost %, and AI-suggested pricing — all explicitly phased to Recipe Costing Phase 2–4 (§7), not abandoned, just sequenced.
- Not an accounts-payable/bill-pay platform — no money movement (Stripe billing, §4/§9, is subscription payment for *this app*, not AP for the restaurant's own vendor bills — different thing, not a contradiction of this non-goal).
- Not POS-integrated at launch.
- Not an automatic vendor-messaging system — dispute drafts require human review and send. (Currently moot: dispute drafting itself isn't built, §6.4.)
- These are the biggest scope traps in this category (every competitor above eventually built all of them) — resist expanding until the price-intelligence wedge has real traction. Recipe costing was the one deliberate exception to that discipline, made because it's the feature that ties the whole product together rather than a scope trap adjacent to it.

## 9. Technical Architecture

**v10 — product naming:** the app is **Sift** in code and on the App Store (`app.json`: name/slug/scheme all `sift`, iOS bundle ID `com.sift.app`), not the working title this document was originally drafted under. App Store listing: Name "Sift," Subtitle "Invoices & True Food Cost," full description drafted in `SETUP.md`.

**Client:** React Native via Expo (iOS + Android from one codebase; Expo also gives OTA updates, which matter for a small team iterating fast on a mobile-first product).

**Auth:** Email/OTP via **Clerk** (v8 decision — supersedes the earlier Twilio suggestion, and supersedes phone as the identifier specifically: Clerk gates SMS-based phone auth behind a paid plan, so email verification codes — free-tier — carry the same no-password, 60-second-signup shape without the cost). Clerk's email_code strategy covers the OTP flow directly, and **Clerk Organizations** covers org creation, staff invites, and roles (Owner/Manager/Staff via Clerk's role system) — so tenancy and membership don't need a hand-rolled custom-org implementation. Backend RLS reads the org id directly off the Clerk session token (see Backend below).

**AI Extraction:** Anthropic Claude API, given image (or multi-page PDF) input for structured line-item extraction. Recommend defining a strict JSON schema for the extraction prompt (vendor + vendor contact info, date, invoice #, line items array with unit-of-measure, printed unit price, parsed weight + weight source, type/category, confidence scores per field) so the app can programmatically decide what needs human confirmation vs. what's auto-accepted.

**Model routing — v10 correction, ✂️ escalation tier cut:** earlier drafts specified automatic Sonnet 5 → Opus 4.8 escalation on low-confidence extractions (paragraph below, preserved for history). That escalation was removed during the shipping-readiness scope-cut pass — **extraction is Sonnet 5 only now.** Low-confidence field flagging itself is unchanged and still drives the 2-tap human-confirmation flow (6.3); only the automatic bigger-model re-try was cut. `draft-recipe` (5.6/6.10), the newer AI call added since v9, also uses Sonnet 5 only, same forced-tool-use pattern. Whether Opus escalation is worth reinstating (accuracy-per-dollar on genuinely hard invoices — handwriting, thermal paper, dense non-English formats) is an open question (§13), not a settled non-goal.

*Original spec, preserved for reference:* every invoice is extracted with **Claude Sonnet 5** by default — near-Opus quality, high-resolution vision, and priced for a pipeline running many invoices a day. When that first pass comes back with multiple low-confidence fields, the app automatically re-runs extraction on that invoice with **Claude Opus 4.8** before ever surfacing it to a human — Opus is the strongest available model and the right tool specifically for the hard cases. This gets Opus-level accuracy exactly where it's needed without paying Opus rates on every routine, clean invoice.

**Backend:** Supabase (Postgres), multi-tenant from day one — every table keyed by `organization_id`, strict row-level isolation via RLS. This matters enormously here because (a) multi-tenant SaaS is the goal, and (b) the Community Price Index feature in Phase 2 depends on being able to safely aggregate across tenants, which is much harder to retrofit than to design in from the start.

**v8 change — tenancy ownership:** `organizations` and `users` are **not** local Supabase tables. Clerk Organizations already owns that data (org identity, membership, roles) as the source of truth — duplicating it in Postgres would just be a sync problem. Every domain table below stores `organization_id` as Clerk's org id (text) directly, and RLS policies check it via a Postgres function reading the `org_id` claim off the Clerk-issued JWT (Supabase configured with Clerk as a Third-Party Auth provider — no separate Supabase user record). Implemented in `supabase/migrations/`.

**Data model (as implemented, v10 sync — see `supabase/migrations/` for the authoritative source, 12 migrations as of 2026-07-22):**
- `invoices` (org_id, vendor_id, image_url(s), date, totals, raw AI response, status, extraction_model — **`sonnet_5` only in practice now, the `opus_4_8`/`escalated` path is unused since the escalation cut above**; `source: email_pdf` was never implemented, every invoice today is `camera`/library-import; hard-deletable, unlike line items below)
- `invoice_line_items` (invoice_id, item_id — **still almost always null outside recipe costing's opportunistic backfill (6.3/5.6)**, raw_description, clean_name, qty, unit_of_measure, unit_price, extended_price, line_item_type: charge|credit, category, confidence, low_confidence_fields, **`note` text column (added for the simplified 6.4 flow)**, **`voided_at` — reversible soft-delete, the pattern recipe costing's own delete convention follows (`RECIPE_COSTING.md` §0)**. `parsed_weight`/`weight_source`/`weight_basis`/`normalized_price_per_lb` columns **still exist, nullable, but nothing populates them** since the weight-parsing cut (6.3) — do not assume these are live when reading older PRD sections or `RECIPE_COSTING.md`. `reconciliation_status` as a pending/received/short/missing enum was never actually shipped this way — see 6.4's real, simpler `missing: boolean` + `note` shape instead.)
- `vendors` (org-scoped, canonical name, fuzzy-matched **`aliases`, now actually populated** — fixed a real production duplicate-vendor bug — **contact_name, contact_phone, account_number**, palette `color` assigned via `create_vendor_with_palette_color` RPC)
- `items` (org-scoped canonical item catalog — exists, used by recipe costing's cost resolution (5.6), **not used for cross-vendor comparison since that feature (5.4) was never built**)
- `price_alerts` (org_id, item_id, vendor_id, line_item_id, item_name, previous_price, new_price, detected_at) — real, live, feeds 5.1/6.5.
- `delivery_disputes` — **✂️ orphaned.** Table exists (not dropped), the app no longer writes to it as of the 6.4 simplification migration.
- `insight_briefings` — **🔲 never existed.** No such table was ever created; 5.5/6.9 have no persistence layer because they have no feature built on top of them.
- **New since v9, added by recipe costing (5.6/6.10), see `RECIPE_COSTING.md` §1 for full detail:** `recipes` (org_id, kind: dish|prep, name, ai_draft_raw, draft_model, batch_yield_qty/unit — prep-only, menu_price, cached cost_low/high/estimate, confidence, voided_at), `recipe_ingredients` (recipe_id, component_type: item|prep, item_id/component_prep_id, qty, unit, ai_qty/ai_unit/ai_est_cost_share for drift-from-AI-draft display, confirmed: boolean), `recipe_cost_history` (append-only, one row per recompute, powers the trend sparkline once built), `item_unit_conversions` (Phase 2, not yet created — for count/volume units).

**Storage:** Original invoice images retained indefinitely (source-of-truth for disputes) — plan storage costs accordingly at scale. `recipe-images` bucket (private, org-scoped RLS, same tenant-isolation pattern) added alongside recipe costing.

**Billing architecture (new since v9, §4/§6.11):** Stripe is the payment engine; **Clerk stays the single source of truth** the rest of the app reads from (`organization.publicMetadata.plan`) — nothing in the client grants Pro directly. Flow: paywall → `create-checkout` edge function → Stripe Checkout Session (opened in the system browser via `expo-web-browser`, App Store-friendly for a B2B product since the purchase happens on the web, not via IAP) → Stripe → `stripe-webhook` edge function verifies the signature and flips the Clerk flag (`pro` on `checkout.session.completed`, back to `free` on cancellation) → app re-reads the org on next load. `billing-portal` edge function opens Stripe's hosted billing portal for self-serve manage/cancel. `extract-invoice` and `draft-recipe` both read the plan flag server-side via the Clerk Backend API before spending any Claude budget, so the free cap can't be bypassed by a patched client. Full setup/ops detail: `BILLING.md`.

**Crash reporting (new since v9):** `@sentry/react-native` installed and initialized app-wide behind a new `ErrorBoundary` component — no-ops safely until a real DSN is supplied (`SETUP.md`), so a render crash shows a real recovery screen today even before Sentry delivery is wired up.

## 10. Non-Functional Requirements

- **Accuracy over blind automation:** given this data feeds financial decisions, the low-confidence-field-confirmation flow (6.3) is a core requirement, not a nice-to-have. This is the single biggest lesson from the competitive research — every serious player in this space (MarginEdge, Ottimate) relies on human-assisted review because pure OCR/AI on real-world, often crumpled/handwritten/thermal-paper invoices isn't reliable enough alone yet.
- **Grounded narration, not free generation:** the AI insight briefing (5.5) is only ever allowed to narrate numbers that already exist in computed structured data (price alerts, spend rollups, comparison deltas) — it never has open-ended access to raw invoice data when writing summary text. This is what keeps the product's most opinionated-sounding feature from being its least trustworthy one. **v10 note: moot until 5.5 is actually built** — worth re-applying as a real design constraint if/when it is, not dropping just because the feature is currently absent.
- **Zero data-entry burden by default:** the product never *requires* the user to type in a weight or any other missing field to get the core wedge feature working. Price-creep tracking always works off whatever the vendor actually printed (case, lb, or otherwise, see 6.3). **v10 note:** the second half of this NFR — cross-vendor comparison activating automatically off a parsed weight, with an opt-in manual/photo fallback — describes a feature that no longer exists (5.4, 6.3 weight-parsing cut). What survives fully intact is the first half: nothing in the shipped app today requires the user to type a value the app couldn't otherwise get for itself. Recipe costing (5.6) follows the same discipline — batch yield is the one number the AI is structurally forbidden from guessing (not in its tool schema at all), always operator-entered.
- **Offline resilience:** capture must work with zero signal; sync/process on reconnect.
- **Data isolation:** strict multi-tenant boundaries; this is a financial-data product, treat it with the same care as fintech.
- **Latency:** target invoice-to-extracted-data turnaround in seconds to low minutes, not hours — this is a meaningful differentiator vs. incumbents (some cited at up to 24-48 hours with human review queues).
- **Human-in-the-loop for outbound communication:** vendor dispute drafts (6.4) and any future negotiation messages are always reviewed and manually sent by the owner/manager, never auto-sent. **v10 note: currently moot** — dispute-message drafting itself isn't built (6.4); this constraint applies automatically if/when it is, since there's no outbound-communication surface of any kind in the app today.
- **Privacy for Community Price Index:** requires real anonymization/aggregation design (minimum tenant thresholds before a data point is shown, no reverse-engineering a specific competitor's price) before this feature ships — flag for legal review when scoped.

## 11. Success Metrics

- **Activation:** % of new sign-ups that scan a first invoice within 24 hours (proxy for whether the OTP + capture flow is truly frictionless).
- **Time-to-value:** median time from sign-up to first price-creep alert or dashboard insight. **v10 note:** bulk backfill onboarding, which this metric originally assumed would pull this number down, was never built (6.2) — this metric will read worse than the original spec's design intent until that's addressed.
- **Extraction accuracy:** % of line items requiring human correction (should trend down as normalization/matching improves).
- ~~**Escalation rate:** % of invoices auto-escalated from Sonnet 5 to Opus 4.8~~ — **v10: moot, the escalation tier was cut (§9).** Remove or reinstate alongside the open question in §13.
- ~~**Weight-normalization coverage**~~ — **v10: moot, weight-parsing was cut (§5.1/6.3).** No weight source exists to measure coverage of.
- **Dispute recovery:** $ amount flagged via delivery reconciliation. **v10 note:** the "% resolved/credited" half of this metric assumed the dedicated disputes tracker (6.4) that isn't built — today this can only measure the $ total marked missing at save time, not resolution rate, since there's no persisted dispute lifecycle to track resolution against.
- **Retention:** weekly active scanning rate per organization (invoices are recurring — a healthy restaurant should be scanning multiple times per week).
- **Expansion:** free → paid conversion rate — **now actually measurable**, real billing shipped (§4/§6.11); multi-location tenant growth (Phase 2 signal, unchanged).
- ~~**Briefing engagement**~~ — **v10: moot, AI Insight Briefings were never built (§5.5).** Reinstate this metric if/when §5.5 is actually shipped.
- **New since v9 — recipe costing metrics (5.6):** number of dishes drafted per org; average dish confidence score at first draft vs. after operator review (does the confirm-and-adjust flow actually move the needle, or do operators rubber-stamp — see `RECIPE_COSTING.md` §9's rubber-stamping risk); % of recipe ingredients resolved to a real item match vs. still on the AI's raw cost-share guess.
- **New since v9 — missing-invoice alert accuracy (5.3):** false-positive rate on vendor-cadence flags (a vendor whose ordering pattern is genuinely irregular shouldn't get flagged every cycle) — no telemetry for this exists yet, worth adding before leaning on the feature in marketing.

## 12. Competitive Positioning Summary

**v10 note:** several rows below describe Phase 1 claims that, per the status audit throughout this document, aren't actually true of the shipped product yet (cross-vendor comparison, delivery reconciliation's fuller form, AI briefings). Kept in the table with honest status markers rather than deleted, since they're still the right long-term positioning — just not defensible in a demo today. Recipe costing is the one row that flipped from non-goal to a real, shipped differentiator.

| | MarginEdge / Ottimate / Restaurant365 | Sift |
|---|---|---|
| Price | $200–500+/location/month | Order-of-magnitude lower for single-location ($29/mo placeholder, real Stripe billing live) |
| Onboarding | Weeks, sales call required | Email + OTP, minutes. 🔲 Bulk backfill for instant history not built (6.2) |
| Extraction | AI + human review team (hours-days) | AI-first, lightweight in-app confirmation (seconds-minutes), Sonnet 5 |
| Target | Multi-unit groups, ops/finance teams | Independent owner-operators |
| Cross-vendor price comparison | Not highlighted in market research reviewed | 🔲 Not built — depends on weight-parsing, which was cut (5.4) |
| Delivery/short-shipment reconciliation | Not a focus area in market research reviewed | 🟡 Shipped in simplified form (mark-missing + note, no dispute tracker) (6.4) |
| Cross-restaurant benchmarking | None found in market research | 🔲 Community Price Index (Phase 2) — not started |
| Proactive AI insight briefings | Dashboards/reports the operator must go read | 🔲 Not built (5.5) — spec exists, nothing shipped |
| **AI recipe costing (true cost per dish)** | **Deep — their core value, priced accordingly** | **✅ Shipped Phase 1 (5.6) — the actual current flagship differentiator, not a non-goal** |
| Inventory management / AP-bill-pay | Deep (part of their core value) | Explicit non-goal, unchanged from every prior draft (§8) |

## 13. Open Questions

- What extraction confidence threshold triggers human confirmation vs. auto-accept — needs real testing against sample invoices (ideally Thaiphoon's own, as the first design partner).
- How robust description-text weight parsing (6.3) is across the full variety of vendor formats — pack-size language is nowhere near standardized ("50 LBS," "6X5lbs.," "40#" all appeared across just five sample invoices), so this needs real testing against a larger, messier sample before trusting it to unlock cross-vendor comparison automatically.
- How often owners actually use the optional weight fallback (5.1/6.3) in practice — if usage is near zero, the aggregate-only-invoice gap is effectively permanent for those vendors regardless of the feature existing; if it's high, it's worth watching how it affects perceived friction in an otherwise zero-input flow.
- Accuracy of the product-photo weight-extraction path (6.3) specifically — case/product labels are a different visual domain than invoices (varied fonts, glare, curved surfaces), so this needs its own accuracy testing rather than assuming invoice-extraction accuracy carries over.
- Minimum tenant density required per region/vendor before Community Price Index data is statistically meaningful and safely anonymizable.
- Pricing validation — the tiers above are directional; worth testing willingness-to-pay with a handful of independent operators before finalizing.
- ~~App store review considerations for phone-OTP-only auth (no email fallback)~~ — resolved by the v8 pivot to email-OTP-only; email-based passwordless auth is a well-trodden App/Play Store pattern, so this is no longer a real risk.
- Exact UX for delivery reconciliation — does it happen in the same tap flow as scanning, or as a separate "confirm this delivery" step, so it doesn't slow down a busy receiving moment at the dock.
- Right default cadence for AI insight briefings (5.5) — weekly is the working assumption since it matches typical delivery frequency, but this needs testing against real usage to avoid notification fatigue; may also be worth a lighter-weight monthly rollup alongside the weekly one for owners who want less noise.
- What confidence threshold should trigger the Sonnet 5 → Opus 4.8 escalation (9) — too low and every invoice pays Opus rates for no benefit; too high and genuinely hard invoices never get the stronger pass. This is really the same open question as extraction confidence generally, just applied to model routing specifically, and needs the same real-invoice testing to answer.
- **v9 — home/business audience split (3, 6.1):** whether the audience choice needs to be persisted (Clerk org metadata or a DB column) so it can inform campaign attribution/analytics, or whether route-param-only (today's implementation) is sufficient since it's copy-only. Also open: whether "vendors"/"restaurant" terminology elsewhere in the app (tab labels, dashboard copy, the store's `Vendor` naming) should eventually fork per audience too, or whether that's scope creep past what a campaign-facing onboarding split needs — deliberately not done in this pass. **v10 status: still fully unbuilt**, not just the persistence question — see §3/6.1.

**v10 — new open questions from this reality-sync pass:**

- **Weight-parsing + cross-vendor $/lb comparison (5.1/5.4, 6.3) — reinstate, or formally cut?** This is the highest-priority open question in this revision. It's been sitting in an undecided middle state (built once, quietly removed, never re-added or formally descoped) since the shipping-readiness pass. If cross-vendor comparison is still meant to be a headline Phase 1 feature per §5.4's own framing ("a strong candidate to headline the app alongside price-creep alerts"), it needs to be rebuilt. If the team has decided it's not worth the complexity right now, §7/§8 should say so explicitly instead of this document quietly describing a feature that doesn't exist.
- **AI Insight Briefings (5.5/6.9) — build for real, or formally move to Phase 2?** Same undecided-middle-state problem. This section's own text calls it "arguably the single most demo-able differentiator" — if that's still believed, it's a real gap in the current build. If not, it shouldn't keep reading as an MVP feature in this document.
- **Sonnet 5 → Opus 4.8 escalation (9) — reinstate?** Cut for cost/simplicity during the shipping-readiness pass; the original accuracy rationale (hard invoices — handwriting, thermal paper, dense non-English formats) hasn't been re-evaluated since.
- **Delivery reconciliation's fuller form (6.4) — was the simplification permanent?** The migration that cut the dedicated disputes tracker reads as a deliberate product call ("instead of... the confirm/save screen now just..."), not an accident — but it was made without an accompanying update to this PRD or a recorded decision on whether the richer version (dispute timeline, vendor-message drafting) is truly out of scope or just deferred.
- **Recipe costing pricing/teaser decision (5.6, `PLAN_STRATEGY.md`):** "one free dish" teaser for Free orgs vs. fully Pro-gated (current state) — a real conversion-mechanics decision, not an engineering one.
- **Final Pro price** — $29/mo placeholder (matches what was actually used in Stripe test-mode testing) vs. `PLAN_STRATEGY.md`'s recommended ~$49/mo anchor given recipe costing's competitive position. Tracked operationally in `SETUP.md`.
- **CSV export's tier placement (6.7):** currently free/ungated, seemingly by build-order accident rather than a deliberate tiering call — worth a real decision given everything else data-analytical is Pro.
- **Recipe costing's dependency on cut weight-parsing (5.6):** flagged as a live risk, not just a documentation gap — `RECIPE_COSTING.md`'s cost-resolution design leans on `normalized_price_per_lb`, which nothing populates for newly extracted invoices anymore. Worth verifying this isn't silently degrading recipe cost accuracy as the trailing-average window ages past invoices extracted before the cut.
- **Real offline upload queueing (6.2)** — connectivity detection only today; explicitly deferred at launch per `SHIPPING_READINESS.md`, revisit if field usage (loading docks, walk-in coolers) shows it's actually needed.
- **Multi-user access (6.1)** — "Invite staff" is a dead stub; decide whether a real `organization.inviteMember` flow is needed before broader launch, or whether Owner-only usage is acceptable for the current stage.
