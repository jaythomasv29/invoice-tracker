# AI-Assisted Recipe Costing — Architecture Spec

Status: **Phase 1 implemented** (dishes only, weight-based costing) — see §8 phasing.
Built: `recipes`/`recipe_ingredients` tables + `resolve_item_cost_per_gram` / `link_line_items_to_item` RPCs + `recipe-images` bucket (migrations `20260722100000`–`20260722100002`, deployed); the `draft-recipe` edge function (deployed, Pro-gated); `lib/recipeCosting.ts` (data + cost/confidence model); and the screens under `app/recipes/`. Phases 2–4 (prep items, count/volume units, live-recalc automation, price-creep→dish tie-in) remain per §8.
Audience: whoever builds this next — every section is meant to be buildable as written, with open questions called out explicitly rather than glossed over.

## 0. Grounding — what already exists

This feature must slot into the current schema and conventions, not fork a parallel system:

- **`vendors`** — org-scoped, `aliases text[]` for fuzzy name resolution, `color` assigned via `create_vendor_with_palette_color` RPC.
- **`items`** — the canonical, cross-vendor catalog (`id, organization_id, canonical_name, category`). Exists today but **`invoice_line_items.item_id` is always null** — nothing populates it yet. This is the central fact this spec has to design around (see §2).
- **`invoices` / `invoice_line_items`** — line items carry `raw_description`, `clean_name` (AI-sanitized display name), `qty`, `unit_of_measure` (vendor's own unit — CS/LB/EA/BX/OZ...), `unit_price`, `extended_price`, and — important — **`normalized_price_per_lb`**, `parsed_weight`, `weight_source`, `weight_basis`. Extraction already normalizes weight-based pricing to a per-lb basis, handling catch-weight cases. This is reusable, not something to reinvent (see §3).
- **`price_alerts`** — fires when a `(vendor, clean_name, unit_of_measure)` match's `unit_price` jumps >3% vs. its most recent prior invoice. Pro-only. This is the existing "price creep" signal this feature should ride on for dish-level cost deltas.
- **`extract-invoice` edge function** — the pattern to mirror for any new AI call: forward the caller's Clerk JWT so Supabase RLS runs as the user (no service-role bypass), Claude Sonnet (`claude-sonnet-5`) called with a single forced tool-use (`tool_choice: {type:'tool', name:...}`) against a strict JSON schema, images fetched from a private Storage bucket via short-lived signed URL and base64-inlined into the request, low-confidence fields flagged rather than re-extracted with a bigger model, plan-gated before any Claude spend.
- **RLS convention** — every table: `organization_id text not null`, `alter table ... enable row level security`, one `for all using (organization_id = private.current_org_id()) with check (...)` policy. `private.current_org_id()` reads the `org_id` claim off the Clerk JWT. No local `organizations` table — Clerk owns that.
- **Reversible vs. hard delete convention** — line items use `voided_at timestamptz` (nullable, reversible, filtered out of aggregates); invoices use a real hard delete. Recipes should follow the line-item pattern (they're the more analogous "many small rows composing a parent" case).
- **Client mapping layer** — `lib/invoicePipeline.ts` maps DB rows to app-shape types (`mapInvoice`, `mapLineItem`) and owns write operations (`updateLineItem`, `setLineItemVoided`); `store/useStore.ts` holds the zustand shape consumed by screens. New feature should add a parallel `lib/recipeCosting.ts` + store slice, not bolt onto the invoice ones.
- **Tab bar** (`app/(tabs)/_layout.tsx`) is full: Home, Alerts, Scan (center), Vendors, More. There's no free slot for a 6th tab — Recipes should live as a stack under **More**, mirroring how `app/vendor/[id].tsx` and `app/invoice/[id].tsx` are pushed screens rather than tabs.

---

## 1. Data model

### 1.1 Unified `recipes` table (dish and prep item are the same shape)

A dish and a prep item are structurally identical: a named thing with a list of quantified components, a confidence score, and a computed cost. The only real differences are (a) a prep item has an operator-set batch yield and no menu price, and (b) a dish's ingredients can point *at* a prep item as a component. Rather than four parallel tables (`dishes`, `dish_ingredients`, `prep_items`, `prep_ingredients`), use one self-referential pair: **`recipes`** + **`recipe_ingredients`**, discriminated by `kind`. This halves the CRUD/cost-rollup/confidence logic that has to be built and kept in sync, and lets a dish-level ingredient row and a prep-level ingredient row share one resolution code path.

```sql
-- Illustrative schema, not a literal migration file.

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  kind text not null check (kind in ('dish', 'prep')),
  name text not null,

  -- AI draft provenance (mirrors invoices.raw_ai_response / extraction_model)
  source_photo_path text,          -- storage path in the recipe-images bucket, if drafted from a photo
  ai_draft_raw jsonb,              -- raw record_recipe_draft tool-use output, kept for audit/re-draft
  draft_model text check (draft_model in ('sonnet_5', 'opus_4_8')),

  -- Prep-item-only, operator-set, NEVER written by AI (see §4)
  batch_yield_qty numeric,
  batch_yield_unit text,

  -- Dish-only, optional
  menu_price numeric(10,2),

  -- Cached rollup (recomputed per §5, not authoritative — recompute-on-read
  -- always wins; this is a display/list-view cache)
  cost_low numeric(10,4),
  cost_high numeric(10,4),
  cost_estimate numeric(10,4),      -- midpoint, what list views show
  confidence numeric not null default 0,   -- 0-1
  cost_computed_at timestamptz,

  created_by text,
  created_at timestamptz not null default now(),
  voided_at timestamptz             -- reversible delete, same pattern as invoice_line_items
);

create index recipes_org_idx on public.recipes (organization_id);
create index recipes_kind_idx on public.recipes (organization_id, kind);

alter table public.recipes enable row level security;
create policy "recipes_tenant_isolation" on public.recipes
  for all
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

-- Prep items must have a yield before they can be referenced as a
-- component anywhere (enforced at the app layer at "use this prep item"
-- time, not by a DB constraint, since a prep item is legitimately
-- yield-less while still being drafted).
```

```sql
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  recipe_id uuid not null references public.recipes (id) on delete cascade,  -- parent dish or prep item

  component_type text not null check (component_type in ('item', 'prep')),
  item_id uuid references public.items (id),                 -- set iff component_type = 'item'
  component_prep_id uuid references public.recipes (id),     -- set iff component_type = 'prep' (must be kind='prep')

  raw_ingredient_name text not null,   -- AI draft text or operator free-type, e.g. "rice noodles", "pad thai sauce"
  qty numeric not null,
  unit text not null,                  -- recipe's own unit: g | oz | lb | ml | floz | cup | tbsp | tsp | each

  -- AI draft's original values, kept so the UI can show "AI suggested 40g"
  -- next to the operator's current slider value, and so a "reset to AI
  -- suggestion" action is possible.
  ai_qty numeric,
  ai_unit text,
  ai_est_cost_share numeric,           -- 0-1, AI's rough guess at this ingredient's share of dish cost

  confirmed boolean not null default false,  -- operator has actively touched this row (see §4 re: gaming)
  position int not null default 0,
  created_at timestamptz not null default now(),

  constraint recipe_ingredients_component_target check (
    (component_type = 'item' and item_id is not null and component_prep_id is null) or
    (component_type = 'prep' and component_prep_id is not null and item_id is null)
  ),
  constraint recipe_ingredients_no_self_ref check (component_prep_id is distinct from recipe_id)
);

create index recipe_ingredients_org_idx on public.recipe_ingredients (organization_id);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);
create index recipe_ingredients_item_idx on public.recipe_ingredients (item_id);
create index recipe_ingredients_component_prep_idx on public.recipe_ingredients (component_prep_id);

alter table public.recipe_ingredients enable row level security;
create policy "recipe_ingredients_tenant_isolation" on public.recipe_ingredients
  for all
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());
```

**Nesting depth**: the schema *can* express prep-of-prep-of-prep recursion (self-reference through `component_prep_id`), but the product spec only asks for one level ("pause that ingredient and offer the same draft-and-confirm loop one level down"). Cap it at one level in the app layer (the prep-item sub-flow's own ingredient rows are only ever allowed `component_type = 'item'`, never `'prep'`) rather than a DB trigger — simpler, and a DB-level cycle-detection trigger for arbitrary depth is real complexity this feature doesn't need yet. Revisit if operators ask for nested preps (e.g., a mother sauce built from another prep sauce).

### 1.2 Unit conversion — where factors live

Two different problems, two different homes:

**Physical unit conversion (weight/volume, universal)** — g↔oz↔lb, ml↔floz↔cup↔tbsp↔tsp. These are physical constants, not org data. Put them in a small shared constants module (`lib/unitConversion.ts` on the client, mirrored into the edge function the same way `VENDOR_COLOR_PALETTE` is hand-kept in sync between `lib/invoicePipeline.ts` and `extract-invoice/index.ts` today) — no DB table needed.

**Pack-size conversion (item-specific, not derivable from physics)** — "1 case of chicken breast = how many lb", "1 case of this sauce = how many 32oz jugs". This genuinely varies per item and per vendor pack, and the app doesn't know it. Two sub-cases:

- **Weight-based items priced by case/box on the invoice**: `invoice_line_items.normalized_price_per_lb` *already solves this* — extraction already normalizes catch-weight and standard-pack cases down to a per-lb price. Recipe costing should consume `normalized_price_per_lb` directly for any ingredient matched to a weight-based item, and only needs the universal lb→g/oz constant on top. **No new pack-size data needed for the weight case** — this is the biggest reuse win in the whole design and is why §6 phasing restricts the MVP to weight units only.
- **Count-based and volume-based items** (each, dozen, gallon jugs, etc.) have no equivalent normalized column today. These need a small new table, populated by the operator the first time it matters (not upfront):

```sql
create table public.item_unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  item_id uuid not null references public.items (id) on delete cascade,
  purchase_unit text not null,       -- the vendor's unit_of_measure, e.g. "CS", "BX"
  base_unit text not null check (base_unit in ('g', 'ml', 'each')),
  purchase_to_base_factor numeric not null,  -- "1 CS = this many <base_unit>"
  source text not null default 'manual' check (source in ('manual', 'ai_suggested')),
  created_at timestamptz not null default now(),
  unique (organization_id, item_id, purchase_unit)
);
-- org-scoped index + RLS policy, same pattern as above.
```

Prompted inline, once, the first time an operator confirms a count/volume ingredient whose matched item has no conversion row yet ("This case of napkins — how many each per case?"). Cached per item thereafter, reused by every recipe. `source: 'ai_suggested'` is a placeholder for later — Claude could propose a default from the item name/description, but MVP just asks the operator (see §8: pack-size errors are silent and compounding, not worth guessing).

### 1.3 Recipe cost history (for trend + "up 9% this month")

```sql
create table public.recipe_cost_history (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  cost_estimate numeric(10,4) not null,
  confidence numeric not null,
  computed_at timestamptz not null default now()
);
create index recipe_cost_history_recipe_idx on public.recipe_cost_history (recipe_id, computed_at desc);
-- org-scoped index + RLS policy, same pattern as above.
```

One row per recompute (§5 governs when that happens). This is what powers the dish-detail sparkline and the month-over-month delta — cheap to write, append-only, never updated in place.

### 1.4 Should canonical-item normalization be a prerequisite?

Not a blocking, big-bang prerequisite — but it is a real dependency for §2 to work at all, so it has to ship *alongside* this feature rather than after it. Recommendation: **skip the "backfill the whole catalog first" project. Normalize opportunistically, the same way vendor resolution already works.**

`extract-invoice/index.ts` doesn't require a pre-populated vendor list — it normalizes the incoming name, matches against existing `vendors` (+ `aliases`), and creates a new vendor row on first sight. Do the same for `items`: normalization only has to exist at the moment an operator is confirming a recipe ingredient (see §2.1), not for every historical line item up front. This is the cheapest correct sequencing and reuses a pattern that's already proven in this codebase.

---

## 2. Ingredient → cost resolution

### 2.1 Matching an ingredient to a purchased good

When an operator confirms a dish/prep ingredient (component_type='item'):

1. Fuzzy-search the org's `items.canonical_name` for the ingredient's raw name (client-side substring/trigram match against an already-loaded org item list — item catalogs are small, dozens to low hundreds of rows, no need for a server round trip per keystroke).
2. Operator picks an existing item, **or** types a new canonical name → `insert into items`.
3. On either branch, opportunistically backfill: `update invoice_line_items set item_id = :item_id where organization_id = :org and item_id is null and clean_name ilike :canonical_name` (same `ilike` normalization already used by `detectPriceCreep`). This is a cheap, org-scoped, indexed update — it means the *next* recipe that references the same ingredient benefits from a fully-linked history, and existing invoices retroactively light up without a separate migration job.
4. Store `recipe_ingredients.item_id = :item_id`.

Because step 3 only backfills rows matching that exact `clean_name`, and different vendors/invoices spell the same product slightly differently, item_id linkage will be incomplete for a while. **Cost resolution (§2.2) must not assume `item_id` coverage is complete** — it always falls back to a `clean_name` match against the item's canonical name, so it works correctly on day one even with zero backfilled rows, and gets faster/tighter over time as more line items get linked. This robustness (rather than a hard dependency on a completed normalization pass) is what makes "not a blocking prerequisite" true in practice, not just in theory.

### 2.2 Per-unit cost from invoice history

A Postgres function, callable via RPC (same style as `create_vendor_with_palette_color` — plain SQL/plpgsql, runs with caller privileges so RLS still applies, no service-role bypass):

```sql
-- Illustrative signature.
create function public.resolve_item_cost_per_base_unit(p_item_id uuid, p_organization_id text)
returns table (cost_per_base_unit numeric, base_unit text, sample_size int, as_of timestamptz)
...
```

Logic:

1. Pull the item's own `canonical_name`. Query `invoice_line_items` joined to `invoices`, scoped to the org, `line_item_type = 'charge'`, `voided_at is null`, and `invoices.status = 'saved'`, where `item_id = p_item_id` **or** `clean_name ilike canonical_name` (the fallback from §2.1). Pool across **all vendors** — an operator's "true cost" is what they're actually paying now, not a single vendor's price; blending is the sane default (flagged as an open question in §8 for operators who want vendor-specific scenario costing later).
2. **Price choice: trailing average, not latest-only.** Take the most recent N purchases (recommend N=3, or a 60-day window, whichever yields more data — small orgs may only buy an item monthly) and average. A single most-recent invoice is too noisy for a number operators will set menu prices against; price-alert-style single-point deltas are for *alerting*, not for the cost that's baked into a dish's economics. Weight equally by purchase (not by qty), since a small trial order shouldn't be swamped by one bulk case.
3. Normalize each contributing row to a per-base-unit price *before* averaging:
   - Weight-priced item → prefer `normalized_price_per_lb` when present (already catch-weight-correct) → convert lb to g via the universal constant.
   - Count/volume item → `unit_price / item_unit_conversions.purchase_to_base_factor` for that row's `unit_of_measure`; if no conversion row exists yet for that `purchase_unit`, exclude the row and surface "needs unit setup" rather than silently guessing.
4. Return the averaged per-base-unit cost, the base unit, how many purchases contributed (feeds confidence in §4 — one data point is weaker evidence than five), and the most recent contributing date.

### 2.3 Prep-item cost

```
prep_cost_total = Σ (component cost)  over all recipe_ingredients where recipe_id = the prep item
prep_cost_per_base_unit = prep_cost_total / batch_yield_qty   (in batch_yield_unit)
```

Each component cost is `qty (converted to the matched item's base unit) × cost_per_base_unit` from §2.2 for `component_type='item'` rows, or (recursively, one level only per §1.1) the referenced prep item's own `prep_cost_per_base_unit × qty` for `component_type='prep'` rows — moot at one level of nesting since a prep item's own ingredients are item-only, but keep the code path generic since it's free.

`batch_yield_qty`/`batch_yield_unit` are **only ever operator-entered**, never defaulted, never AI-suggested. A recipe of `kind='prep'` with a null yield cannot be selected as a dish ingredient — the UI blocks "use this prep item" until yield is set (see §7).

### 2.4 Dish rollup

```
dish_cost = Σ over recipe_ingredients (qty converted to base unit) × per-base-unit cost of the matched item or prep item
```

Computed live (§5), not by walking cached child costs, so a price change three prep-levels down is never stale by construction.

---

## 3. Confidence & cost-range model

### 3.1 Per-ingredient point cost (needed even for unconfirmed rows, to compute shares)

Every `recipe_ingredient` needs *some* cost number to weight it, even before the operator touches it:

- If matched to a real item/prep with price history → the resolved cost from §2 (a real number).
- If not yet matched (still just AI's `raw_ingredient_name` + `ai_qty`/`ai_unit`) → estimate from `ai_est_cost_share`: `estimated_dish_total × ai_est_cost_share`, where `estimated_dish_total` is bootstrapped from a rough per-category $/unit table (protein/produce/dairy/etc., same categories `invoice_line_items.category` already uses) the first time, then refined once *any* ingredient in the dish resolves to a real cost.

### 3.2 Cost range (interval arithmetic, not statistical — see §8)

Per ingredient:

- **Confirmed + resolved** (real price data, operator has actively adjusted/accepted the qty): `low = high = point_cost` (optionally widened by the min/max of the contributing purchases from §2.2, not just their average, if the UI wants to show "this ingredient itself has been volatile" — nice-to-have, not required for v1).
- **Unconfirmed**: `low = point_cost × (1 − u)`, `high = point_cost × (1 + u)`, where `u` starts wide for a pure AI guess (recommend ±40%) and narrows once the operator has touched the slider even without hitting "confirm" (±15%) — sliding is itself a signal of engagement, distinct from confirming.

Dish range = **additive**: `dish_low = Σ low_i`, `dish_high = Σ high_i`. This is a simplifying assumption (true uncertainty doesn't add linearly if errors are independent — a proper treatment would use variance propagation / Monte Carlo). Called out explicitly here and in §8 as a known simplification, acceptable because operators read the range as "how rough is this number," not as a statistical confidence interval — a wider, honest range is a better failure mode than a falsely tight one.

### 3.3 Confidence score

```
ingredient_confidence_i =
    1.0                                if confirmed AND resolved to real price data
    component_prep.confidence          if component_type = 'prep'  (propagation — see below)
    0.3                                if touched (slider moved) but not confirmed
    0.15                               if untouched AI draft default
```

(Numbers are starting points to tune, not load-bearing constants — expose as one named config, don't scatter magic numbers.)

```
cost_share_i = point_cost_i / Σ point_cost   (recomputed on every change — no circularity: point costs
                                               are computed first per §3.1, shares and confidence derive
                                               from them, both recompute together on any edit)

recipe.confidence = Σ (cost_share_i × ingredient_confidence_i)
```

This is exactly the "weighted by cost share" requirement — nailing down the 3g of dried chili with a slider swing barely moves confidence; nailing down the chicken breast (60% of the plate's cost) moves it a lot.

**Prep-item propagation**: a dish ingredient with `component_type='prep'` gets `ingredient_confidence_i = component_prep.confidence` directly — *not* automatically 1.0 just because the operator confirmed "yes, this dish uses pad thai sauce." Confirming *inclusion* of a prep item is a different fact from that prep item's *internal* recipe being accurate. If the prep item itself is only 40% confident (half its ingredients still AI-guessed), every dish that uses it is capped accordingly until someone goes and finishes refining the prep item — which is the exact behavior the product spec asks for ("dish's confidence inherits the prep item's confidence until it's refined"), and it falls out of the formula for free rather than needing special-case code.

---

## 4. AI draft flow

New edge function `draft-recipe`, mirroring `extract-invoice`'s shape (Clerk JWT forwarded so RLS applies, plan-gated, Sonnet via forced tool-use, images signed-URL'd out of private storage).

**Input**: `{ recipeId: uuid }` — client creates a draft `recipes` row first (status implied by `ai_draft_raw is null`), optionally uploads a photo to a new private `recipe-images` bucket at `{organizationId}/{recipeId}/0.jpg` (same path convention as `invoice-images`), then invokes the function with just the id — same two-step "create draft row, then invoke" shape `createDraftInvoice` + `uploadInvoiceImages` + `extractInvoice` already establishes in `lib/invoicePipeline.ts`.

**Tool schema**:

```ts
const RECIPE_DRAFT_TOOL = {
  name: 'record_recipe_draft',
  description: 'Record a starting-point recipe template for a restaurant dish or prep item. This is a rough draft the operator will confirm and adjust — never the operator\'s actual recipe.',
  input_schema: {
    type: 'object',
    properties: {
      normalized_name: { type: 'string' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            raw_name: { type: 'string', description: 'A specific, purchasable ingredient name — avoid vague terms unless the item is genuinely a multi-ingredient component (see is_likely_prep)' },
            approx_qty: { type: 'number' },
            unit: { type: 'string', description: 'g | oz | lb | ml | floz | cup | tbsp | tsp | each' },
            is_likely_prep: { type: 'boolean', description: 'true if this is itself typically a multi-ingredient prep component (a sauce, stock, marinade, dressing, batter) rather than a single purchasable good' },
            est_cost_share: { type: 'number', description: '0-1 rough share of this dish\'s total ingredient cost; all ingredients\' shares should sum to roughly 1' },
          },
          required: ['raw_name', 'approx_qty', 'unit', 'is_likely_prep', 'est_cost_share'],
        },
      },
      draft_confidence: { type: 'number', description: '0-1 — your own confidence this is a reasonable starting template for this dish' },
    },
    required: ['normalized_name', 'ingredients', 'draft_confidence'],
  },
};
```

Note what's **not** in the schema: no `batch_yield` field anywhere, for dish or prep drafts. This isn't just a prompt instruction (which a model can ignore) — it's structurally absent, so there is nothing for Claude to fill in even if it tried. Yield is entered by the operator only, at prep-item-confirm time (§1.3, §7).

**Prompt approach** (paraphrased, not final copy):
- State plainly this is a *template* from general dish knowledge (+ the photo if given), not the operator's actual recipe — the operator will adjust every quantity.
- Quantities are per single plated serving for dishes; for prep items, quantities are relative to whatever batch size is typical to describe (a stock pot, a hotel pan) — since yield is operator-set regardless, the AI's prep quantities only need to be internally proportional, not tied to a real yield number.
- Prefer specific, purchasable ingredient names ("boneless chicken thigh," not "chicken") so downstream fuzzy-matching against the org's `items` catalog has a chance — flag genuinely compound items (sauces, stocks, dressings) via `is_likely_prep` instead of trying to expand them inline.
- `est_cost_share` values should sum to ~1 across the ingredient list — this seeds §3.1's cost-share weighting before any real price data exists.
- If given a photo: describe what's visible, infer the dish from visual cues, cross-reference with general knowledge of the named dish if a name was also given.

**Where the AI cost is incurred**: exactly once per dish draft and once per prep item drafted (i.e., proportional to *distinct recipes*, not to views or price changes). After confirmation, `ai_draft_raw`/`draft_model` stay on the row purely as provenance — nothing about cost resolution (§2) or live recompute (§5) ever calls Claude again. This is why ongoing recalculation is free: it's SQL aggregation over `invoice_line_items` that already exist for an unrelated reason (they were extracted to build the invoice, not for costing), same data reused, no incremental extraction cost.

**Duplicate-check for prep items** (step 4 of the flow): don't feed the org's full prep-item catalog into the prompt on every draft — unnecessary token cost and an extra way for the model to hallucinate a "match." Instead, client-side (or a light post-processing step, no extra Claude call): for every ingredient flagged `is_likely_prep: true`, fuzzy-match `raw_name` against the org's existing `recipes where kind='prep'` names, same substring/trigram approach as item matching in §2.1. Surface "Looks like you may already have 'Pad Thai Sauce' — use it instead of drafting a new one?" Accept → set `component_type='prep', component_prep_id=<existing>`. Reject/new → enter the prep sub-flow draft loop (recursive `draft-recipe` call scoped to the new prep `recipes` row, one level deep per §1.1).

---

## 5. Live recalculation

**Compute-on-read is the primary mechanism**, not a push pipeline — recipe counts per org are small (dozens, not thousands of dishes), and the SQL aggregation in §2/§2.4 is cheap (indexed lookups over a bounded trailing window, no full-table scans). Recommend:

- **Dish detail screen** (§7): always recompute live via the Postgres cost-rollup function on open — the operator viewing "what does this dish cost right now" should never see a stale cached number for the one dish they're actually looking at.
- **List/menu view**: read the cached `recipes.cost_estimate`/`confidence`/`cost_computed_at` columns (cheap, no N recomputes for a scrolling list) with a lightweight staleness check: recompute lazily if `cost_computed_at` is older than the org's most recent **saved** invoice (`max(invoices.created_at) where status='saved'` — one indexed query, comparable to what `monthlyExtractionCount` already does in `extract-invoice`). If stale, recompute and rewrite the cache (and append a `recipe_cost_history` row) before rendering that row.
- **On invoice save** (status flips to `'saved'`): no synchronous recompute of every recipe touching those items — would block the save path for an unrelated feature. Instead this is exactly what the lazy staleness check above catches the next time any recipe list/detail is viewed, which for a restaurant's normal usage pattern (check menu costs periodically, not every time an invoice is scanned) is more than fast enough.
- **Nightly job** (Phase 3, not MVP): a scheduled Edge Function sweep that recomputes every recipe past its staleness threshold regardless of whether anyone's looked, so `recipe_cost_history` accumulates a real trend line even for dishes nobody's opened in a while, and so the price-creep tie-in below has fresh data to work from without depending on the operator having opened the app.

**Tie-in to existing price-creep detection** — this is the "chicken parm up 9% this month" surface: `detectPriceCreep` already writes `price_alerts` rows keyed by `(vendor_id, item_name via clean_name)` when a unit price jumps >3%. Extend that (or add a small follow-up query the dish detail screen runs) to join forward: `price_alerts → invoice_line_items.clean_name/item_id → items → recipe_ingredients → recipes`. For each affected recipe, compute the *dish-level* impact, which is smaller than the raw ingredient's own % change (an ingredient that's 20% of the dish jumping 9% moves the dish ~1.8%, not 9%) — that distinction matters, a raw ingredient alert and a dish-cost alert are different numbers and both should say so. Surface as a section on the dish detail screen ("Recent price moves affecting this dish: Chicken Breast +9%, dish cost +1.8%") computed on read alongside the live cost — no new alerts table needed for v1; only add one (`recipe_cost_alerts`) if/when this needs to push a notification rather than just annotate a screen the operator opens.

---

## 6. AI edge function summary (mirrors `extract-invoice`)

| | `extract-invoice` (existing) | `draft-recipe` (new) |
|---|---|---|
| Input | `{ invoiceId }` | `{ recipeId }` |
| Images | invoice photo(s), required | dish/prep photo, optional (name-only drafting is valid) |
| Model | `claude-sonnet-5`, forced tool-use | same |
| Tool | `record_invoice_extraction` | `record_recipe_draft` |
| Writes | `invoices`, `invoice_line_items`, resolves/creates `vendors` | `recipes.ai_draft_raw` + draft `recipe_ingredients` rows, no auto item resolution (operator does that at confirm time, §2.1) |
| Plan gate | Free orgs capped monthly | Same cap family — recipe drafts are a Claude spend and should count against/alongside the existing free-tier extraction cap, or get their own smaller cap (product decision, not architectural — just don't leave it ungated) |
| Auth | Caller's Clerk JWT forwarded, RLS enforced | Same |

---

## 7. Screens / flow

All new screens live under a new `app/recipes/` route group (stack, pushed from a "Recipes" entry point added to `app/(tabs)/more.tsx`), following the existing `app/vendor/[id].tsx` / `app/invoice/[id].tsx` pushed-detail-screen pattern rather than a new tab.

1. **Recipes list** (`app/recipes/index.tsx`) — every `recipe` where `kind='dish'`, each row: name, cached `cost_estimate`, confidence badge (color-coded low/med/high, reusing the `catColor`-style category color system already established), margin % if `menu_price` set. Empty state → "Start a dish."
2. **Start dish** (`app/recipes/new.tsx`) — name field + camera/photo-picker (reuse the existing scan camera component), "Draft with AI" → creates the draft `recipes` row, uploads photo if any, invokes `draft-recipe`, navigates to review.
3. **Draft review** (`app/recipes/[id]/review.tsx`) — the core screen. Header: running cost range + confidence meter (recomputed client-side on every slider move from §3, no round trip needed until save). Ingredient rows: name (tap to open item-match search, §2.1), quantity slider bound to `qty`/`unit` with the AI's original value shown as a ghost mark for reference, confirm affordance. Rows flagged `is_likely_prep` (or matched against an existing prep item, §4) render as an expandable chip rather than a slider — tapping opens the prep sub-flow.
4. **Prep item sub-flow** (`app/recipes/[id]/prep/[prepId].tsx`) — same review UI, scoped to the prep `recipes` row, `component_type` locked to `'item'` only (no further nesting, §1.1). Duplicate-check banner up top if a fuzzy match was found (§4). A **required** batch yield field (qty + unit, free entry, no default, no AI suggestion) gates the "Use this prep item" action — cannot return to the parent dish without it set. Once set, returns to the parent draft review with that ingredient now resolved to `component_type='prep'`.
5. **Ingredient match** (modal/sheet over review) — search existing `items` (or the recipe-level list of `recipes where kind='prep'` when resolving a flagged component), or type-to-create a new canonical item. First time a count/volume item is matched, prompts the pack-size conversion input from §1.2.
6. **Dish cost detail** (`app/recipes/[id]/index.tsx`) — the "done" state: live-computed true cost (always recomputed on open, §5), confidence badge, cost trend sparkline from `recipe_cost_history`, ingredient cost breakdown (each row's $ contribution, tap to jump back into review to adjust), menu price input with live margin %/food-cost % if set, and the price-impact section from §5's price-creep tie-in.

---

## 8. Phasing

**Phase 0 — prerequisite, ships alongside Phase 1, not before it.** Opportunistic `item_id` backfill-on-match (§2.1, §1.4). No standalone migration/backfill project — it's a few lines inside the ingredient-match flow, and cost resolution is designed (§2.2) to work correctly even with partial linkage via the `clean_name` fallback.

**Phase 1 — MVP.** Cheapest viable version that's still genuinely useful:
- Dishes only — **no prep items yet.** Prep-item nesting is real complexity (recursive draft-and-confirm, duplicate-check, yield gating, confidence propagation) and a flat single-level dish recipe already delivers "true cost of a dish, kept live" on its own.
- **Weight units only** (g/oz/lb) for ingredient quantities in v1 — this is the single biggest scope-reduction lever available, because it means §1.2's item-specific pack-size table (`item_unit_conversions`) isn't needed yet at all; `normalized_price_per_lb` + a universal lb↔g constant covers 100% of MVP unit conversion. Count/volume ingredients get a "not yet supported, coming soon" state in the ingredient-match picker.
- `draft-recipe` edge function, `record_recipe_draft` tool, draft review screen with sliders, confidence/range model (§3), item matching (§2.1), dish cost detail screen (§7.6) including menu price + margin.
- Live recalc: compute-on-read only (§5, first two bullets) — no nightly job yet.
- No price-creep tie-in yet (dish detail just shows current cost, no "recent price moves" section).

**Phase 2 — prep items.** `component_type='prep'` fully wired: prep sub-flow screen, batch yield gating, duplicate-check against existing prep items, confidence propagation (§3.3's prep branch). Count/volume units + `item_unit_conversions` (prep items in particular tend to use volume — sauces, dressings — so this naturally lands with prep items rather than being deferred further).

**Phase 3 — live-recalc automation + price-creep tie-in.** Nightly sweep job, `recipe_cost_history` trend sparkline in the UI, the price-alert → dish-impact join from §5, dish-level cost-delta surfacing ("chicken parm cost up 9% this month") on the dish detail screen and/or as a new alert type.

**Phase 4 — stretch.** Variance-based (not additive) cost-range math; vendor-specific "what if I switched suppliers" scenario costing instead of blended-across-vendors; POS integration for real sales-mix-weighted food-cost %; AI-suggested menu pricing off target food-cost %; periodic "re-verify this prep item's yield" nudges.

---

## 9. Open questions / risks

- **Unit-conversion accuracy.** Weight-based items are well-covered by reusing `normalized_price_per_lb`. Count/volume pack sizes (§1.2) are operator-entered and will sometimes be wrong (an operator misremembers "24 per case" vs. actual 20) — errors here are silent and compound into every dish using that item, with no automatic way to detect they're wrong. Consider a periodic sanity check (e.g., flag if a computed per-unit cost is >3x the org's own historical range for that item) rather than trusting entry forever.
- **Ingredient-match ambiguity.** Fuzzy/`ilike` matching on `clean_name` will both false-positive (matching "Chicken Breast" invoices that are actually a different cut/grade/case-size than what the operator meant) and false-negative (missing a real match due to spelling drift). The existing vendor-alias pattern helps for vendors; items have no equivalent `aliases` column today — worth adding if match misses turn out common in practice.
- **AI draft trust / rubber-stamping.** The confidence model (§3.3) assumes "confirmed" reflects genuine operator engagement, but nothing stops an operator from tapping through every slider without adjusting values, producing a recipe that reads as high-confidence while still being the AI's raw guess. `confirmed` should mean "operator saw and accepted this specific value," not "operator tapped a global confirm-all button" — worth being deliberate about not offering a bulk-confirm action in v1, even though it'd be a natural UX ask, until there's a better way to distinguish real review from rubber-stamping.
- **Yield estimation.** Batch yield is explicitly operator-entered to avoid the AI silently fabricating a number nobody checked — but operators themselves often don't know exact yield either (cooking loss, evaporation, trim waste aren't usually measured in a working kitchen), so this shifts the risk rather than eliminating it. A wrong yield silently distorts every dish that uses the prep item, with no signal that it's wrong. Phase 4's re-verify nudge is a partial mitigation; there's no way to fully solve this without the operator actually weighing a batch.
- **Price data sparsity.** New or rarely-reordered ingredients may have only one historical invoice, making the "trailing average" in §2.2 just one data point — technically fine mechanically, but the confidence model doesn't currently discount for *thin* price history vs. *robust* price history (an item bought once vs. twenty times both currently just resolve to "confirmed + resolved = 1.0" per §3.3). Worth folding `sample_size` from §2.2 into the confidence formula rather than treating any resolved match as equally trustworthy.
- **Multi-vendor blending.** §2.2 blends cost across all vendors carrying an item by default. Some operators may specifically want "what does this cost from my primary vendor" rather than a blend — flagged as a Phase 4 scenario-costing item, not solved here.
- **Recipe staleness vs. reality.** Nothing detects when an operator's actual kitchen practice has drifted from what's recorded (a recipe quietly stops being confirmed-accurate the day the chef starts using a different cut without updating the app). Out of scope for this feature to solve — noted so it isn't mistaken for a gap in the cost math rather than a gap in real-world sync.
