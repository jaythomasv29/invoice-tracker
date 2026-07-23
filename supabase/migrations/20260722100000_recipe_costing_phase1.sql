-- AI-Assisted Recipe Costing — Phase 1 schema (see RECIPE_COSTING.md).
--
-- Phase 1 scope: dishes only (no prep items yet) and weight-based ingredient
-- costing only (reusing invoice_line_items.normalized_price_per_lb). The table
-- shape is the full unified model from the spec so Phase 2 (prep items,
-- count/volume units) needs no schema rework — the app layer just doesn't
-- exercise the prep paths yet.
--
-- Tenancy/RLS mirror the rest of the schema: org-scoped by organization_id
-- (Clerk org id), one `for all` policy per table keyed on private.current_org_id().

-- recipes: a dish or a prep item are the same shape, discriminated by `kind`.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  kind text not null default 'dish' check (kind in ('dish', 'prep')),
  name text not null,

  -- AI draft provenance (mirrors invoices.raw_ai_response / extraction_model).
  source_photo_path text,
  ai_draft_raw jsonb,
  draft_model text check (draft_model in ('sonnet_5', 'opus_4_8')),

  -- Prep-only, operator-set, NEVER written by AI. Null for dishes.
  batch_yield_qty numeric,
  batch_yield_unit text,

  -- Dish-only, optional.
  menu_price numeric(10, 2),

  -- Cached rollup (recompute-on-read is authoritative; this backs list views).
  cost_estimate numeric(10, 4),
  confidence numeric not null default 0,
  cost_computed_at timestamptz,

  created_by text,
  created_at timestamptz not null default now(),
  voided_at timestamptz  -- reversible delete, same pattern as invoice_line_items
);

create index recipes_org_idx on public.recipes (organization_id);
create index recipes_kind_idx on public.recipes (organization_id, kind);

alter table public.recipes enable row level security;
create policy "recipes_tenant_isolation" on public.recipes
  for all
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

-- recipe_ingredients: a component of a recipe — either a purchased good
-- (component_type='item' → items catalog) or, in Phase 2, another prep recipe.
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  recipe_id uuid not null references public.recipes (id) on delete cascade,

  component_type text not null default 'item' check (component_type in ('item', 'prep')),
  item_id uuid references public.items (id),
  component_prep_id uuid references public.recipes (id),

  raw_ingredient_name text not null,  -- AI draft text or operator entry
  qty numeric not null default 0,
  unit text not null default 'g',     -- recipe unit: g | oz | lb (Phase 1) ...

  -- AI draft's original values, for "AI suggested 40g" ghost + reset.
  ai_qty numeric,
  ai_unit text,
  ai_est_cost_share numeric,          -- 0-1, AI's rough share-of-cost guess

  confirmed boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),

  constraint recipe_ingredients_component_target check (
    (component_type = 'item' and component_prep_id is null) or
    (component_type = 'prep' and component_prep_id is not null and item_id is null)
  ),
  constraint recipe_ingredients_no_self_ref check (component_prep_id is distinct from recipe_id)
);

create index recipe_ingredients_org_idx on public.recipe_ingredients (organization_id);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);
create index recipe_ingredients_item_idx on public.recipe_ingredients (item_id);

alter table public.recipe_ingredients enable row level security;
create policy "recipe_ingredients_tenant_isolation" on public.recipe_ingredients
  for all
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

-- Cost resolution (Phase 1, weight-only): current cost-per-gram for a catalog
-- item, from its recent purchase history. Reuses normalized_price_per_lb, which
-- extraction already computes (catch-weight-correct), so no pack-size data is
-- needed. Matches by item_id OR clean_name (opportunistic normalization means
-- item_id coverage is incomplete early on — the name fallback keeps this
-- correct on day one). Trailing average of the most recent purchases, not the
-- single latest, so a menu price isn't set against one noisy invoice.
--
-- SECURITY INVOKER + private.current_org_id() → runs as the caller under RLS.
create or replace function public.resolve_item_cost_per_gram(p_item_id uuid)
returns table (cost_per_gram numeric, sample_size int, as_of timestamptz)
language plpgsql
stable
security invoker
as $$
declare
  v_org text := private.current_org_id();
  v_name text;
begin
  select canonical_name into v_name
  from public.items
  where id = p_item_id and organization_id = v_org;
  if v_name is null then
    return;
  end if;

  return query
  with recent as (
    select li.normalized_price_per_lb as ppl, inv.created_at
    from public.invoice_line_items li
    join public.invoices inv on inv.id = li.invoice_id
    where li.organization_id = v_org
      and inv.status = 'saved'
      and li.line_item_type = 'charge'
      and li.voided_at is null
      and li.normalized_price_per_lb is not null
      and (li.item_id = p_item_id or li.clean_name ilike v_name)
    order by inv.created_at desc
    limit 3
  )
  select
    round((avg(ppl) / 453.59237)::numeric, 6) as cost_per_gram,  -- lb → g
    count(*)::int as sample_size,
    max(created_at) as as_of
  from recent
  having count(*) > 0;
end;
$$;

-- Backfills item_id on historical line items matching a canonical name — called
-- opportunistically when an operator resolves a recipe ingredient to an item,
-- so future cost lookups get tighter over time. Org-scoped via RLS.
create or replace function public.link_line_items_to_item(p_item_id uuid, p_canonical_name text)
returns void
language plpgsql
security invoker
as $$
declare
  v_org text := private.current_org_id();
begin
  update public.invoice_line_items
  set item_id = p_item_id
  where organization_id = v_org
    and item_id is null
    and clean_name ilike p_canonical_name;
end;
$$;
