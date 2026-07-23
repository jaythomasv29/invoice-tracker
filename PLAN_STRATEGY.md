# Free / Pro plan strategy

The decision on what goes in each tier, and *why* — optimized to entice Pro and
convert Free. This is the product rationale; `constants/plans.ts` is the
machine-readable version the paywall renders, and `PAYWALL.md` covers the
mechanics.

## Philosophy: two conversion engines, one moat

**The moat is their data.** Every invoice a restaurant extracts lives in the app
and becomes switching cost. So Free's job is not to be stingy — it's to get them
**capturing invoices and forming the habit**. The paid conversion comes from
turning that accumulated data into money decisions.

We run **two conversion engines at once** so we're never dependent on a single
trigger:

1. **Volume gate** — the 10 extractions/month cap. Converts *heavy* operators who
   scan a lot. They hit the wall fast and upgrade for unlimited.
2. **Insight gate** — the analytics + recipe costing. Converts *everyone else* —
   the operator who only scans a few invoices but desperately wants to know "am I
   getting ripped off?" and "what does my pad thai actually cost?"

**Teasers, not blank locks.** This is the single most important conversion tactic
and it's under-used today. A locked Pro surface should show a **real number
computed from the user's own data**, then lock the detail:

- Alerts tab (free): "**3 items went up in price this month** 🔒 — see which"
- Home spend (free): show *this month's total* as a number, lock the trend/breakdown
- Recipe costing (free): "Your pad thai costs **$3.12** 🔒 — see the breakdown"

Seeing their *own* number teased triggers curiosity + loss aversion far more than
an empty "Upgrade to unlock" card. (Today `ProLockCard` shows generic copy — see
"Follow-ups".)

**Recipe costing is the hero.** It's the one capability competitors (MarketMan,
xtraCHEF) charge far more for, and it *ties every other Pro feature together*:
price creep gets a punchline ("chicken parm up 9%"), category spend maps to the
menu, spend trends explain margin. That interconnection makes Pro feel like a
**system**, not a checklist of toggles.

## The tiers

| Capability | Free | Pro | Status |
|---|---|---|---|
| Capture + AI extraction | 10 / month | Unlimited | ✅ live |
| Notes on entries | ✓ | ✓ | ✅ live |
| Vendor-grouped storage + per-vendor history | ✓ | ✓ | ✅ live |
| This month's total spend (single number) | ✓ (teaser) | ✓ | ⏳ tweak |
| Price-creep alerts (item + vendor) | 🔒 teased count | ✓ | ✅ live |
| Total spend across vendors + spend **trend** | 🔒 | ✓ | ✅ live (trend exists) |
| Spend by **category** | 🔒 | ✓ | 🟡 near-term |
| **Top-spend items** (80/20 Pareto) | 🔒 | ✓ | 🟡 near-term |
| Order frequency / avg order size per vendor | 🔒 | ✓ | 🟡 near-term |
| **Missing-invoice** detection (cadence gap) | 🔒 | ✓ | 🟡 near-term |
| ★ **AI Recipe Costing** (live dish true-cost) | 🔒 (1 free dish) | ✓ | 🔵 roadmap |

Legend: ✅ built · 🟡 cheap to add, reuses extracted data · 🔵 flagship build (see
`RECIPE_COSTING.md`) · ⏳ small change.

### What stays Free and why
- **Extraction (capped)** — the on-ramp; builds the data moat. 10/mo is enough to
  feel the product, tight enough to convert active users.
- **Storage + per-vendor history** — never gate what they've already captured;
  that's the switching cost working for you.
- **Notes** — trivial, keeps Free genuinely useful so they stick around.
- **This month's total (one number)** — a deliberate teaser: shows the spend
  number, locks the *why*.

### What's Pro and why
Everything that turns stored invoices into **decisions**: where the money goes
(category, Pareto), whether prices are creeping, whether you're bleeding on
vendor fragmentation, whether you forgot to log an invoice — and the flagship,
what each dish actually costs.

## New metrics — placement, data readiness, cost to build

All Pro. All reuse data you already extract (cheap):

| Metric | Data ready? | Notes |
|---|---|---|
| Spend by category | ✅ `invoice_line_items.category` already tagged at extraction | Group + sum. Trivial. |
| Spend trend over time | ✅ `fetchDashboardSummary` already buckets week/month | Mostly a UI surfacing. |
| Order frequency / avg order size | ✅ invoices per vendor + totals | Simple aggregation. |
| Top-spend items (Pareto) | 🟡 line items have `clean_name` but `item_id` is null (not normalized) | v1: Pareto by `clean_name`; gets sharper once canonical-item matching lands. |
| Missing-invoice detection | 🟡 needs per-vendor cadence | Compute avg gap between a vendor's invoice dates; flag if `now − last > expected`. Cheap; a scheduled function or on-load compute. |

## Recipe costing — positioning & cost safety

Pro's anchor. Two things make it safe to include in flat-rate Pro:
1. **AI cost is bounded.** Claude is only used for the *draft* step (once per
   dish). After the operator confirms, the recipe is fixed — price updates reuse
   existing invoice price data, so ongoing recompute costs **nothing**.
2. **Trust comes from the operator, not the photo.** The AI drafts a template;
   the operator's slider-confirmation is what makes the number real. That keeps
   us out of "the AI guessed wrong and quoted a bad cost" liability.

**Conversion hook — "one free dish".** Let Free users cost *one* dish end-to-end.
It's a drug sample: once an operator sees their pad thai's true cost and margin,
Pro sells itself. (Track dishes created like we track extractions.)

Full architecture: `RECIPE_COSTING.md`.

## Pricing recommendation

Placeholder is **$29/mo**. With recipe costing as the hero — a feature
competitors gate behind $150–300/mo suites — I'd anchor higher: **$49/mo**, with
an annual discount (e.g. $490/yr) to lock in retention. The code reads price from
Stripe, so this is a dashboard change, not a code change — your call.

## Suggested build order

1. **Teaser-ify the existing locks** (cheap, highest conversion ROI): compute the
   real number behind each `ProLockCard` (alert count, this-month total).
2. **Surface the near-term metrics** (category, Pareto, order-frequency,
   missing-invoice) — all reuse extracted data; batch them as a "Pro insights" wave.
3. **Recipe costing MVP** — the flagship (see `RECIPE_COSTING.md` for phasing;
   canonical-item normalization is the key dependency).

## Open decisions for you (the knobs)

- **Price**: keep $29 or move to $49/annual? (Stripe dashboard.)
- **"One free dish" taste** for recipe costing — yes (recommended, strong hook) or
  keep recipe costing fully Pro-only?
- **Free extraction cap** — keep 10/mo, or lower (e.g. 5) to push volume-converts
  harder now that the insight gate does more of the converting?
