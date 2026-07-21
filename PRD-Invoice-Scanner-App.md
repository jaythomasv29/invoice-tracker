# Product Requirements Document
## AI Invoice & Receipt Intelligence Platform for Independent Restaurants

**Status:** Draft v9
**Author:** James
**Date:** July 19, 2026 (v9 adds a home/business audience split to onboarding — see 3 and 6.1 — so the same product can be campaigned to two distinct audiences separately; v8 updated the delivery-reconciliation states and auth/backend stack to match implementation decisions made while building the initial client — see 6.4 and 9)

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

**v9 addendum:** the home persona's actual value is receipt capture, price-creep tracking (5.1), and spend analytics (5.3) — the same wedge, just against grocery/household receipts instead of vendor invoices. Delivery reconciliation (6.4) is a business-context feature by nature (checking a truck delivery against a distributor invoice at a loading dock) and isn't expected to be relevant to most households — a home user isn't reconciling a delivery driver's truck against a grocery receipt the way a kitchen manager reconciles a Sysco delivery. It stays in the product because it's core to the business persona, not because it's meant to apply to both; if usage data ever shows meaningful home-side demand for it, that's a reason to revisit, not an assumption to build in now.

## 4. Business Model

Multi-tenant SaaS. Each restaurant is a tenant/organization; owners invite staff. Pricing is designed to undercut the incumbent floor (~$200-300/location/month) by an order of magnitude for single-location operators, since the AI does the extraction work a human review team does at MarginEdge/Ottimate.

**Proposed tiers** (directional — validate with pricing research before launch):
- **Free / Starter** — 1 location, limited invoices/month, core scanning + spend dashboard. Growth-loop bait: this is what makes "sign up with your email in 60 seconds" credible.
- **Pro** — single location, unlimited invoices, price-creep alerts, cross-vendor comparison, delivery reconciliation, AI insight briefings, full analytics, CSV export. Priced for what a mom-and-pop can justify (a fraction of MarginEdge's per-location fee).
- **Multi-Location** — per-location pricing, cross-location comparison, role-based permissions, consolidated exports.

Revenue expansion path (Phase 2+): anonymized benchmarking as a premium data product, paid integrations (QBO/Toast), vendor marketplace referral fees.

## 5. The Wedge: Vendor Price-Creep Alerts & Spend Intelligence

This is the feature set the whole MVP is built around — and it's where a multi-tenant architecture, a data-fidelity-aware extraction pipeline, and an AI narration layer on top create a moat none of the single-tenant incumbents can easily replicate.

### 5.1 Price-Creep Detection (Phase 1 — every tenant gets this from day one)
- Every scanned invoice line item is matched against that restaurant's own item/vendor history and compared **at whatever unit the vendor actually printed** — per case, per lb, per each, per box (see 6.3). This works for every invoice, unconditionally, with zero dependency on weight data and zero user input: a chicken invoice priced only by the case still gets tracked and alerted on by the case, since the case designation itself is a stable, comparable unit from delivery to delivery of the same vendor/item.
- When a weight can be parsed automatically from the invoice — a structured weight field, or pack-size language embedded in the item description itself (see 6.3) — the alert additionally computes a true price-per-lb, which is more precise but never required to fire an alert.
- When a normalized unit price moves beyond a threshold (e.g., >5% or a configurable $ amount) vs. the last 3 deliveries of the same SKU from the same vendor, the app surfaces a push notification and an in-app alert: *"Chicken breast from Sysco is up $4.10/case (11%) since your last order"* (case-level) or *"...up $0.31/lb (11%)..."* when a weight-normalized figure is available.
- Trend view per item/vendor over time (line chart), so a slow creep — not just a single spike — is visible.
- Known limitation, mostly accepted deliberately: same-vendor case-price tracking assumes the case size itself doesn't quietly change. Where pack-size is visible in the item description (6.3), a change in that text between deliveries is a free, automatic signal worth surfacing as its own flag. Where a vendor gives no per-item weight or pack-size indication at all — only an aggregate order weight — this can be closed on a per-item basis via the optional weight fallback (6.3) for whichever items the owner actually wants tighter tracking on, without forcing that step on everyone by default.

### 5.2 Community Price Index (Phase 2 — the long-term moat)
- **This is the feature no incumbent in the space offers well**, because it requires a multi-tenant data pool, not a single restaurant's history.
- Opt-in, anonymized aggregation: once enough restaurants in a region are scanning invoices from the same distributor, the app can show an operator *"Restaurants of similar size in your area are paying $X-Y for this SKU from Sysco — you're paying $Z."*
- Strictly anonymized and aggregated (no restaurant ever sees another's identity or exact numbers) — this needs real privacy engineering, not just a checkbox, and should be scoped with legal input before launch given competitive-sensitivity concerns among distributors and restaurants alike.
- This single feature is the reason to build multi-tenant from day one even though you're starting with one restaurant (Thaiphoon): the value compounds with every new tenant, and it's very hard for a single-tenant/enterprise-AP tool like MarginEdge to bolt on retroactively.

### 5.3 Spend Analytics Dashboard
- Total spend by vendor, by category (protein/produce/dry goods/etc.), by week/month.
- % of spend concentrated in top vendors (negotiating leverage indicator).
- Simple COGS-adjacent view: spend as a rough % of estimated revenue (manually entered or POS-synced later) — not a full inventory/recipe costing system, that's an explicit non-goal for MVP (see Section 8).

### 5.4 Cross-Vendor Price Comparison (Phase 1 — promoted from a v2 idea)
- Once items are canonicalized (6.3), the same "Chicken Breast, Boneless Skinless" entity can carry price points from every vendor it's been bought from — Sysco, US Foods, Restaurant Depot, Costco.
- The dashboard surfaces a direct comparison: *"You're paying $2.85/lb from Sysco vs. $2.40/lb at Restaurant Depot for boneless chicken breast."*
- This needs no other tenants and no cold-start period — it's immediate value from a single restaurant's own multi-vendor buying habits, which makes it a strong candidate to headline the app alongside price-creep alerts rather than waiting for Phase 2.
- Cross-vendor comparison requires a common unit, so it activates automatically only for items where a weight was parseable (structured field or description text, see 6.3) — never through a prompt. An item billed only by the case with no weight signal anywhere (common with catch-weight proteins) still gets full same-vendor price-creep tracking (5.1), just not a cross-vendor $/lb comparison, since there's no common unit to compare on automatically.
- For an item the owner specifically cares about comparing, an **optional** fallback (6.3) — type in the weight, or snap a photo of the case/product label — unlocks the comparison on demand. This is opt-in per item, not a default step in the scanning flow, so the zero-friction default in 5.1/6.3 stays intact for everyone who never needs it.

### 5.5 AI Insight Briefings (Phase 1 — the layer that turns data into a "so what")
- On a configurable cadence (weekly by default, matching how often most independent restaurants actually take deliveries), Claude synthesizes everything the app already knows for that period — spend totals and trend, price-creep alerts fired, cross-vendor deltas, delivery-reconciliation disputes — into a short, plain-English briefing, instead of leaving the owner to go piece dashboards together themselves.
- Example: *"This week: $2,140 spent across 4 vendors, up 8% vs. last week. Chicken breast from Sysco rose 11% — your second increase this month. You're paying 15% more for tofu at S.J. Distributors than at Ocean Paradise for the same item. 2 items were flagged short this week, $47 total — worth a call to your Sysco rep."*
- Delivered as a push notification plus a persistent digest feed in-app; optionally emailed to the bookkeeper/accountant persona alongside the CSV export (6.7).
- **Critical design constraint:** the briefing is *narrated from* already-computed structured metrics (the same price alerts, spend rollups, and comparison deltas that power 5.1–5.4) — the model is never asked to re-derive numbers from raw invoices on the fly when writing the summary. This keeps the "nothing guessed" principle from Section 10 intact for the one feature most likely to read like a confident, opinionated voice — that voice needs to be trustworthy, not just fluent.
- This is arguably the single most demo-able differentiator in the product: MarginEdge and Ottimate give an operator dashboards and reports to go read; this hands them the conclusion, unprompted, on a schedule. None of the platforms surfaced in market research do this.

## 6. MVP Feature Set

### 6.1 Onboarding & Auth
- Email + OTP sign-in (no password required to start) — matches the "60 seconds to value" positioning. **v8 change:** originally scoped as phone + OTP; switched to email during implementation because Clerk gates SMS-based phone auth behind a paid plan, while email verification codes are free-tier. Same friction-free, no-password shape either way.
- **v9 addition — audience split:** immediately after auth, a new "What are you tracking invoices for?" screen asks the user to pick **My restaurant or business** or **My home**, before organization creation. This exists purely so the two audiences (3) can each be marketed and onboarded with language that speaks to them — it does not branch the underlying flow. Both choices land on the same organization-creation screen with only its copy adjusted (restaurant/vendor language vs. household/store language); both create the same kind of Clerk Organization and the same tables/RLS scoping (9). The choice is currently passed as a route param and is not yet persisted anywhere durable (no DB column, no Clerk org metadata) — see Open Questions (13) for whether/how it should be if the two audiences ever need to diverge functionally or be distinguished in analytics.
- Create or join an organization (restaurant, or household under the home framing). Owner is first user; owner invites staff/family by email.
- Roles: **Owner** (full access, billing), **Manager** (scan, view analytics, no billing), **Staff** (scan only).

### 6.2 Invoice/Receipt Capture
- Camera capture (multi-page support — distributor invoices are often 2-4 pages) or photo library import.
- **Email/PDF ingestion:** a dedicated forwarding address per organization (e.g., `yourrestaurant@invoices.appname.com`) so invoices that arrive as emailed PDFs — increasingly common, and the norm for several competitor platforms — feed the same extraction pipeline as a photographed invoice, without requiring anyone to print and re-scan.
- **Bulk backfill onboarding:** a new organization can batch-scan a stack of old invoices from a drawer/filing cabinet on day one to seed price history immediately. This directly solves the cold-start problem for price-creep alerts (which otherwise need 2-3 prior deliveries of an item before they can fire) and is the difference between "value in the first session" and "value in three weeks."
- Offline-first capture queue: photos taken with no signal (common in walk-in coolers/loading docks) queue locally and upload/process when connectivity returns.
- Batch capture mode for multiple invoices in one delivery session.

### 6.3 AI Extraction Pipeline (Claude API)
- Image(s)/PDF → Claude API structured extraction → vendor name **and vendor contact info** (phone, account rep name, account number, if printed), invoice date/number, line items (description, quantity, unit, unit price, extended price), tax, total.
- **Line item type tagging:** `charge` vs. `credit` — so a return/credit memo for a damaged case or short shipment is never mistaken for a genuine price drop in the price-creep baseline.
- **Category auto-tagging:** protein/produce/dairy/dry goods/etc. assigned at extraction time so the spend dashboard (5.3) is populated with zero manual tagging effort from the owner.
- **Native unit-of-measure tracking — always captured, zero user input:** every line item is tracked at whatever unit the vendor actually printed (CS, LB, EA, BX, OZ). This alone powers same-vendor price-creep detection (5.1) unconditionally — no weight, confirmation, or manual entry is ever required to get the core wedge feature working.
- **Automatic weight parsing (never a prompt):** the extraction pass also attempts to derive a per-item weight two ways — (1) a structured weight field when the invoice has one, or (2) pattern-matching pack-size language embedded directly in the item description itself (e.g. "PHOENIX JASMINE RICE #50 LBS," "6X5lbs. PEANUT," "CHICKEN BRST BNLS SKLS 40#"). This is parsing, not estimating — it's reading a real number that's actually printed on the invoice, just unstructured, so it doesn't compromise the "nothing guessed" principle in Section 10. When successful, it unlocks a normalized $/lb figure that powers cross-vendor comparison (5.4). When no weight signal exists anywhere on the invoice for an item — common with catch-weight proteins billed only by the case — the item simply stays at native-unit tracking with no cross-vendor comparison; the app never asks the user to fill the gap.
- **Standard-pack vs. catch-weight distinction:** once a weight is parsed from a standard-pack item's description (a 50 lb bag of rice, a 6x5lb case of peanuts), that figure can be reused for future deliveries of the same item/vendor without re-parsing, since the pack size is fixed by definition. Catch-weight items (fresh meat/seafood, where actual case weight legitimately varies) need a fresh parse or structured field every delivery. If a standard-pack item's description text changes between deliveries, that's a free, automatic signal — surfaced as a flag — that the pack size itself may have changed.
- **Optional weight fallback, opt-in only:** for an item with no parseable weight, the item detail screen offers two ways to unlock cross-vendor comparison for it specifically — (1) type in the weight directly, or (2) snap or upload a photo of the product/case label, which runs through the same Claude vision pipeline used for invoices to read the weight off the label. Both are real, human-sourced or label-sourced numbers, not a guess, so neither compromises the "nothing guessed" principle in Section 10. Neither is ever presented as a required step in the default scan flow — they exist for the subset of items an owner actively wants tighter comparison on, not as a blocking gate on getting value from the app.
- Vendor/item normalization layer: fuzzy-matches extracted item descriptions against the restaurant's known item catalog **across vendors** (distributor invoices are notoriously inconsistent in naming — "CHICKEN BRST BNLS SKLS 40#" needs to resolve to the same canonical item as Costco's "CHKN BRST BNLS" every time) so price history and cross-vendor comparison are actually comparable.
- Low-confidence field flagging: rather than silently guessing on smudged/handwritten totals, the app flags specific fields for a 2-tap human confirm — this is the accuracy technique every incumbent (MarginEdge, Ottimate) relies on human review for; doing it as a lightweight in-app confirmation instead of a back-office team is a real differentiator.
- Duplicate invoice detection (same vendor + invoice number).

### 6.4 Delivery Reconciliation — Billed, Not Delivered
- At the point of scanning (or shortly after), the app prompts the person receiving the delivery to mark each line item as **Received** or **Missing** — a fast, tap-based check against what's actually on the truck/shelf, not a separate paperwork step.
- **v8 change:** the original three-state model (Received / Short / Missing) was collapsed to two during client implementation — a partial delivery and a total no-show turned out to prompt the same next action (call the vendor rep, dispute the line), so the extra state added a decision without adding a distinct outcome. A line item not yet checked is **Pending** by default. The underlying schema (9) still carries a `short` value for a future split if usage data shows the distinction is worth restoring — it's just not surfaced in the UI today.
- Items marked Missing generate a standing flag on that invoice and roll up into a running "amount to dispute" total per vendor, so nothing gets forgotten before the next bill.
- Because vendor contact info is captured at extraction time (6.3), a flagged item surfaces the rep's name/phone right alongside it — the app can draft a dispute message, but sending it should be a deliberate, reviewed action by the owner/manager rather than automatic, since it's outbound communication to a business partner.
- This is a distinct workflow from credit memos (6.3): reconciliation catches the problem *before* a credit is issued; credit-memo tagging handles it *after* the vendor has already corrected it on a later invoice.
- The home dashboard surfaces this as two tiles: a "Delivery check" ring chart (share of invoiced items verified against delivery, broken down by Received/Missing/Pending) and a "Billed, not delivered" tile with a running dispute timeline (vendor, date, item) and a link to the full dispute history — both shipped in the initial client build ahead of the backend.

### 6.5 Price-Creep Alerts
- As described in 5.1. Push notification + in-app alert feed.
- Configurable sensitivity per restaurant (some ingredients are naturally volatile — e.g., produce, seafood, eggs — and shouldn't fire alerts on normal commodity swings; the model/logic should distinguish volatile categories from stable ones).

### 6.6 Vendor & Spend Dashboard
- As described in 5.3, plus the cross-vendor comparison view described in 5.4.

### 6.7 Export
- CSV export of invoices/line items by date range, vendor, or category — MVP's only "integration," by design, per your direction. Clean enough to hand to a bookkeeper without QBO/Toast integration work.

### 6.8 Search & History
- Search past invoices by vendor, item, date, amount.
- View original invoice image alongside extracted data, including weight-parsing source and reconciliation status — always keep the source image (trust matters when a number is disputed with a vendor).

### 6.9 AI Insight Briefings
- As described in 5.5. Configurable cadence (weekly default), delivered via push notification and an in-app digest feed, with an optional email copy for the bookkeeper persona.

## 7. Phase 2+ Roadmap (explicitly out of MVP scope)

- Community Price Index (5.2) — once tenant volume is meaningful enough for aggregation to be statistically useful and anonymization to be safe.
- QuickBooks Online / Toast POS integrations.
- Multi-location comparison views and consolidated org-level reporting.
- Recipe costing / theoretical vs. actual COGS (this is what turns the product into a MarketMan/Restaurant365 competitor — big scope, deliberately deferred).
- Vendor price negotiation assistant (AI-drafted "here's what comparable restaurants pay" messages to send to reps) — a natural extension of the delivery-reconciliation dispute drafting in 6.4.
- AP/bill-pay (this is what turns the product into an Ottimate competitor — high liability/compliance surface, deliberately deferred well past MVP).

## 8. Explicit Non-Goals (for MVP)

- Not an inventory management system (no physical counts, no par levels).
- Not a recipe-costing tool.
- Not an accounts-payable/bill-pay platform — no money movement.
- Not POS-integrated at launch.
- Not an automatic vendor-messaging system — dispute drafts require human review and send.
- These are the biggest scope traps in this category (every competitor above eventually built all of them) — resist expanding until the price-intelligence wedge has real traction.

## 9. Technical Architecture

**Client:** React Native via Expo (iOS + Android from one codebase; Expo also gives OTA updates, which matter for a small team iterating fast on a mobile-first product).

**Auth:** Email/OTP via **Clerk** (v8 decision — supersedes the earlier Twilio suggestion, and supersedes phone as the identifier specifically: Clerk gates SMS-based phone auth behind a paid plan, so email verification codes — free-tier — carry the same no-password, 60-second-signup shape without the cost). Clerk's email_code strategy covers the OTP flow directly, and **Clerk Organizations** covers org creation, staff invites, and roles (Owner/Manager/Staff via Clerk's role system) — so tenancy and membership don't need a hand-rolled custom-org implementation. Backend RLS reads the org id directly off the Clerk session token (see Backend below).

**AI Extraction:** Anthropic Claude API, given image (or multi-page PDF) input for structured line-item extraction. Recommend defining a strict JSON schema for the extraction prompt (vendor + vendor contact info, date, invoice #, line items array with unit-of-measure, printed unit price, parsed weight + weight source, type/category, confidence scores per field) so the app can programmatically decide what needs human confirmation vs. what's auto-accepted.

**Tiered model routing:** every invoice is extracted with **Claude Sonnet 5** by default — near-Opus quality, high-resolution vision, and priced for a pipeline running many invoices a day. When that first pass comes back with multiple low-confidence fields (the same signal that drives the 2-tap human-confirmation flow in 6.3), the app automatically re-runs extraction on that invoice with **Claude Opus 4.8** before ever surfacing it to a human — Opus is the strongest available model and the right tool specifically for the hard cases (handwriting, crumpled or thermal-paper invoices, dense non-English vendor formats like the Chinese-character produce invoices in your own sample set). This gets Opus-level accuracy exactly where it's needed without paying Opus rates on every routine, clean invoice. It reduces how often a human needs to be pulled in at all, but doesn't remove the need for the confirmation flow itself — no model tier eliminates the value of a human glancing at a genuinely ambiguous field before it becomes a price-creep data point. Model choice is a real lever on accuracy and cost, not a substitute for testing the schema and confidence thresholds against real invoices — that validation is still open (Section 13).

**Backend:** Supabase (Postgres), multi-tenant from day one — every table keyed by `organization_id`, strict row-level isolation via RLS. This matters enormously here because (a) multi-tenant SaaS is the goal, and (b) the Community Price Index feature in Phase 2 depends on being able to safely aggregate across tenants, which is much harder to retrofit than to design in from the start.

**v8 change — tenancy ownership:** `organizations` and `users` are **not** local Supabase tables. Clerk Organizations already owns that data (org identity, membership, roles) as the source of truth — duplicating it in Postgres would just be a sync problem. Every domain table below stores `organization_id` as Clerk's org id (text) directly, and RLS policies check it via a Postgres function reading the `org_id` claim off the Clerk-issued JWT (Supabase configured with Clerk as a Third-Party Auth provider — no separate Supabase user record). Implemented in `supabase/migrations/`.

**Data model (as implemented):**
- `invoices` (org_id, vendor_id, image_url(s), date, totals, raw AI response, status, source: camera | email_pdf, extraction_model: sonnet_5 | opus_4_8, escalated: boolean)
- `invoice_line_items` (invoice_id, normalized_item_id, raw_description, qty, unit_of_measure, unit_price, extended_price, parsed_weight, weight_source: structured_field|parsed_description|manual_entry|product_photo|none, weight_basis: standard_pack|catch_weight, normalized_price_per_lb, line_item_type: charge|credit, category, confidence, low_confidence_fields, reconciliation_status: pending|received|short|missing — `short` retained in the schema per the 6.4 note above even though the UI only surfaces received/missing/pending today)
- `vendors` (org-scoped, canonical name, fuzzy-matched aliases, **contact_name, contact_phone, account_number**)
- `items` (org-scoped canonical item catalog, used for price history matching and cross-vendor comparison)
- `price_alerts` (org_id, item_id, vendor_id, previous_price, new_price, detected_at)
- `delivery_disputes` (org_id, invoice_id, line_item_id, status, amount, draft_message, sent_at)
- `insight_briefings` (org_id, period_start, period_end, structured_data_snapshot, generated_text, delivered_at, channel: push|email)

**Storage:** Original invoice images retained indefinitely (source-of-truth for disputes) — plan storage costs accordingly at scale.

## 10. Non-Functional Requirements

- **Accuracy over blind automation:** given this data feeds financial decisions, the low-confidence-field-confirmation flow (6.3) is a core requirement, not a nice-to-have. This is the single biggest lesson from the competitive research — every serious player in this space (MarginEdge, Ottimate) relies on human-assisted review because pure OCR/AI on real-world, often crumpled/handwritten/thermal-paper invoices isn't reliable enough alone yet.
- **Grounded narration, not free generation:** the AI insight briefing (5.5) is only ever allowed to narrate numbers that already exist in computed structured data (price alerts, spend rollups, comparison deltas) — it never has open-ended access to raw invoice data when writing summary text. This is what keeps the product's most opinionated-sounding feature from being its least trustworthy one.
- **Zero data-entry burden by default:** the product never *requires* the user to type in a weight or any other missing field to get the core wedge feature working. Price-creep tracking always works off whatever the vendor actually printed (case, lb, or otherwise, see 6.3); cross-vendor comparison activates automatically whenever a weight can be parsed from the invoice itself. An optional, per-item fallback (manual entry or product-photo capture, see 6.3) exists for owners who want comparison on a specific item badly enough to take an extra step — but it is opt-in, never a prompt inserted into the default scanning flow. Parsing a number that's genuinely printed, and reading one off a product-label photo, are not the same as guessing one that isn't there — the product still never estimates or infers a value it doesn't actually have evidence for.
- **Offline resilience:** capture must work with zero signal; sync/process on reconnect.
- **Data isolation:** strict multi-tenant boundaries; this is a financial-data product, treat it with the same care as fintech.
- **Latency:** target invoice-to-extracted-data turnaround in seconds to low minutes, not hours — this is a meaningful differentiator vs. incumbents (some cited at up to 24-48 hours with human review queues).
- **Human-in-the-loop for outbound communication:** vendor dispute drafts (6.4) and any future negotiation messages are always reviewed and manually sent by the owner/manager, never auto-sent.
- **Privacy for Community Price Index:** requires real anonymization/aggregation design (minimum tenant thresholds before a data point is shown, no reverse-engineering a specific competitor's price) before this feature ships — flag for legal review when scoped.

## 11. Success Metrics

- **Activation:** % of new sign-ups that scan a first invoice within 24 hours (proxy for whether the OTP + capture flow is truly frictionless).
- **Time-to-value:** median time from sign-up to first price-creep alert or dashboard insight (bulk backfill onboarding should pull this way down).
- **Extraction accuracy:** % of line items requiring human correction (should trend down as normalization/matching improves).
- **Escalation rate:** % of invoices auto-escalated from Sonnet 5 to Opus 4.8 (9), and whether the escalated pass actually reduces human corrections enough to justify the added cost/latency — the whole point of tiering is that this rate stays low.
- **Weight-normalization coverage:** % of line items with a weight from each source — structured field, parsed from description, optional manual entry, optional product photo, or none — a proxy for how much of the catalog gets cross-vendor comparison for free vs. how often owners bother with the opt-in fallback, and where the description-parsing logic in 6.3 needs improvement.
- **Dispute recovery:** $ amount flagged via delivery reconciliation, and % resolved/credited — a very concrete, provable ROI number for the sales pitch to new operators.
- **Retention:** weekly active scanning rate per organization (invoices are recurring — a healthy restaurant should be scanning multiple times per week).
- **Expansion:** free → paid conversion rate; multi-location tenant growth (Phase 2 signal).
- **Briefing engagement:** open/view rate on AI insight briefings (5.5), and ideally a signal of whether they drove an action (e.g. viewing the underlying alert, initiating a dispute) — the feature only earns its differentiation claim if people actually read and act on it, not just receive it.

## 12. Competitive Positioning Summary

| | MarginEdge / Ottimate / Restaurant365 | This Product |
|---|---|---|
| Price | $200–500+/location/month | Order-of-magnitude lower for single-location |
| Onboarding | Weeks, sales call required | Email + OTP, minutes; bulk backfill for instant history |
| Extraction | AI + human review team (hours-days) | AI-first, lightweight in-app confirmation (seconds-minutes) |
| Target | Multi-unit groups, ops/finance teams | Independent owner-operators |
| Cross-vendor price comparison | Not highlighted in market research reviewed | Phase 1 feature — immediate value, no cold start |
| Delivery/short-shipment reconciliation | Not a focus area in market research reviewed | Phase 1 feature, tied to captured vendor contact info |
| Cross-restaurant benchmarking | None found in market research | Community Price Index (Phase 2) — key differentiator |
| Proactive AI insight briefings | Dashboards/reports the operator must go read | Phase 1 feature — periodic, plain-English, pushed unprompted |
| Inventory/recipe costing/AP | Deep (their core value) | Explicit non-goal at MVP — stay focused on the wedge |

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
- **v9 — home/business audience split (3, 6.1):** whether the audience choice needs to be persisted (Clerk org metadata or a DB column) so it can inform campaign attribution/analytics, or whether route-param-only (today's implementation) is sufficient since it's copy-only. Also open: whether "vendors"/"restaurant" terminology elsewhere in the app (tab labels, dashboard copy, the store's `Vendor` naming) should eventually fork per audience too, or whether that's scope creep past what a campaign-facing onboarding split needs — deliberately not done in this pass.
