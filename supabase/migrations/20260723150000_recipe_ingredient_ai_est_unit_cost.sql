-- AI drafts previously only gave a relative cost SHARE per ingredient (0-1),
-- which is useless until at least one ingredient is matched to real invoice
-- history (nothing to scale the share against, so the dish total reads
-- $0.00 right after Auto Cost). This adds a rough absolute per-unit price
-- estimate from the AI's general market knowledge, used as the fallback
-- point cost until the operator matches the ingredient to a priced item.
alter table public.recipe_ingredients
  add column ai_est_unit_cost numeric;
