-- Ensure the Data API role can reach the recipe-costing tables/functions.
-- RLS still governs row access; these are the table/function privileges
-- PostgREST needs on top of RLS. Idempotent if default privileges already
-- granted them at creation.

grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.recipe_ingredients to authenticated;
grant execute on function public.resolve_item_cost_per_gram(uuid) to authenticated;
grant execute on function public.link_line_items_to_item(uuid, text) to authenticated;
