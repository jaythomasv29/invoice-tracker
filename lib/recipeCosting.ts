import type { SupabaseClient } from '@supabase/supabase-js';

// Client data + cost-model layer for AI Recipe Costing (Phase 1: dishes only,
// weight-based ingredient costing). See RECIPE_COSTING.md.

// ---- App-shape types -------------------------------------------------------

export interface RecipeIngredient {
  id: string;
  rawName: string;
  qty: number;
  unit: string;                 // g | oz | lb (costable) | others (not yet)
  aiQty: number | null;
  aiUnit: string | null;
  aiEstCostShare: number | null;
  confirmed: boolean;
  itemId: string | null;        // resolved catalog item, once matched
  position: number;
  // Filled in on the client after resolving cost from invoice history:
  costPerGram?: number | null;  // null = no weight-based price history found
  sampleSize?: number;
}

export interface Recipe {
  id: string;
  name: string;
  sourcePhotoPath: string | null;
  menuPrice: number | null;
  costEstimate: number | null;
  confidence: number;
  hasDraft: boolean;            // ai_draft_raw present
  ingredients: RecipeIngredient[];
}

export interface RecipeListItem {
  id: string;
  name: string;
  costEstimate: number | null;
  confidence: number;
  menuPrice: number | null;
}

export interface ItemMatch {
  id: string;
  canonicalName: string;
  category: string | null;
}

// ---- Unit conversion (weight only in Phase 1) ------------------------------

const GRAMS_PER: Record<string, number> = { g: 1, oz: 28.349523125, lb: 453.59237 };

export function isWeightUnit(unit: string): boolean {
  return unit in GRAMS_PER;
}

export function toGrams(qty: number, unit: string): number | null {
  const factor = GRAMS_PER[unit];
  return factor == null ? null : qty * factor;
}

// ---- Cost + confidence model (spec §3) -------------------------------------

export interface RecipeCost {
  estimate: number;
  low: number;
  high: number;
  confidence: number; // 0-1
}

// Point cost for an ingredient when it resolves to a weight-priced item.
function resolvedCost(ing: RecipeIngredient): number | null {
  if (ing.costPerGram == null || !isWeightUnit(ing.unit)) return null;
  const grams = toGrams(ing.qty, ing.unit);
  if (grams == null) return null;
  return grams * ing.costPerGram;
}

// Computes the dish's live cost, range, and confidence from its ingredients.
// Resolved ingredients use real per-gram cost; unresolved ones are estimated
// from their AI cost-share, scaled to the implied dish total the resolved
// ingredients establish. Confidence is cost-share-weighted (nailing the
// expensive ingredients matters far more than the cheap ones).
export function computeRecipeCost(ingredients: RecipeIngredient[]): RecipeCost {
  if (ingredients.length === 0) return { estimate: 0, low: 0, high: 0, confidence: 0 };

  // Establish an implied dish total from the resolved ingredients, so the
  // unresolved ones can be estimated proportionally to their AI cost-share.
  let resolvedSum = 0;
  let resolvedShareSum = 0;
  for (const ing of ingredients) {
    const rc = resolvedCost(ing);
    if (rc != null) {
      resolvedSum += rc;
      resolvedShareSum += ing.aiEstCostShare ?? 0;
    }
  }
  const impliedTotal = resolvedShareSum > 0 ? resolvedSum / resolvedShareSum : 0;

  const point: number[] = [];
  const isResolved: boolean[] = [];
  for (const ing of ingredients) {
    const rc = resolvedCost(ing);
    if (rc != null) {
      point.push(rc);
      isResolved.push(true);
    } else {
      point.push((ing.aiEstCostShare ?? 0) * impliedTotal);
      isResolved.push(false);
    }
  }

  const total = point.reduce((s, x) => s + x, 0);

  let estimate = 0;
  let low = 0;
  let high = 0;
  let confidence = 0;
  ingredients.forEach((ing, i) => {
    const pc = point[i];
    estimate += pc;
    const share = total > 0 ? pc / total : 0;

    // Uncertainty band + per-ingredient confidence.
    if (isResolved[i] && ing.confirmed) {
      low += pc;
      high += pc;
      confidence += share * 1.0;
    } else if (ing.confirmed) {
      // confirmed but not weight-resolvable (e.g. an "each"/volume item) —
      // trusted quantity, but the cost itself is still an estimate.
      low += pc * 0.75;
      high += pc * 1.25;
      confidence += share * 0.5;
    } else {
      const touched = ing.qty !== ing.aiQty; // slid off the AI default
      const u = touched ? 0.15 : 0.4;
      low += pc * (1 - u);
      high += pc * (1 + u);
      confidence += share * (touched ? 0.3 : 0.15);
    }
  });

  return {
    estimate: Math.round(estimate * 100) / 100,
    low: Math.round(low * 100) / 100,
    high: Math.round(high * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ---- Data access -----------------------------------------------------------

export async function createDraftDish(
  supabase: SupabaseClient,
  organizationId: string,
  name: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({ organization_id: organizationId, kind: 'dish', name })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Could not create dish');
  return data.id as string;
}

export async function uploadRecipePhoto(
  supabase: SupabaseClient,
  organizationId: string,
  recipeId: string,
  localUri: string,
): Promise<string> {
  const path = `${organizationId}/${recipeId}/0.jpg`;
  const arrayBuffer = await fetch(localUri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage
    .from('recipe-images')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Could not upload photo: ${error.message}`);
  await supabase.from('recipes').update({ source_photo_path: path }).eq('id', recipeId);
  return path;
}

// Invokes the AI draft edge function (Pro-gated server-side).
export async function draftRecipe(supabase: SupabaseClient, recipeId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('draft-recipe', { body: { recipeId } });
  if (error) {
    const context = (error as { context?: Response }).context;
    let detail: string | undefined;
    try {
      const raw = await context?.text();
      detail = raw ? JSON.parse(raw)?.error : undefined;
    } catch {
      // not JSON
    }
    throw new Error(detail ?? error.message ?? 'Could not draft recipe');
  }
  if (data?.error) throw new Error(data.error);
}

function mapIngredient(row: any): RecipeIngredient {
  return {
    id: row.id,
    rawName: row.raw_ingredient_name,
    qty: Number(row.qty ?? 0),
    unit: row.unit ?? 'g',
    aiQty: row.ai_qty == null ? null : Number(row.ai_qty),
    aiUnit: row.ai_unit ?? null,
    aiEstCostShare: row.ai_est_cost_share == null ? null : Number(row.ai_est_cost_share),
    confirmed: !!row.confirmed,
    itemId: row.item_id ?? null,
    position: row.position ?? 0,
  };
}

export async function fetchRecipes(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<RecipeListItem[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, cost_estimate, confidence, menu_price')
    .eq('organization_id', organizationId)
    .eq('kind', 'dish')
    .is('voided_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    costEstimate: r.cost_estimate == null ? null : Number(r.cost_estimate),
    confidence: Number(r.confidence ?? 0),
    menuPrice: r.menu_price == null ? null : Number(r.menu_price),
  }));
}

export async function fetchRecipe(supabase: SupabaseClient, recipeId: string): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, source_photo_path, menu_price, cost_estimate, confidence, ai_draft_raw, recipe_ingredients(*)')
    .eq('id', recipeId)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Recipe not found');
  const ingredients = ((data as any).recipe_ingredients ?? [])
    .map(mapIngredient)
    .sort((a: RecipeIngredient, b: RecipeIngredient) => a.position - b.position);
  return {
    id: data.id,
    name: data.name,
    sourcePhotoPath: (data as any).source_photo_path ?? null,
    menuPrice: (data as any).menu_price == null ? null : Number((data as any).menu_price),
    costEstimate: (data as any).cost_estimate == null ? null : Number((data as any).cost_estimate),
    confidence: Number((data as any).confidence ?? 0),
    hasDraft: (data as any).ai_draft_raw != null,
    ingredients,
  };
}

// Resolves current weight-based cost/gram for an ingredient's matched item from
// invoice history (RPC in the migration). Returns null if no weight-priced
// history exists for that item yet.
export async function resolveIngredientCost(
  supabase: SupabaseClient,
  itemId: string,
): Promise<{ costPerGram: number; sampleSize: number } | null> {
  const { data, error } = await supabase.rpc('resolve_item_cost_per_gram', { p_item_id: itemId });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.cost_per_gram == null) return null;
  return { costPerGram: Number(row.cost_per_gram), sampleSize: Number(row.sample_size ?? 0) };
}

export async function searchItems(
  supabase: SupabaseClient,
  organizationId: string,
  query: string,
): Promise<ItemMatch[]> {
  const q = query.trim();
  let req = supabase
    .from('items')
    .select('id, canonical_name, category')
    .eq('organization_id', organizationId)
    .order('canonical_name', { ascending: true })
    .limit(25);
  if (q) req = req.ilike('canonical_name', `%${q}%`);
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ id: r.id, canonicalName: r.canonical_name, category: r.category ?? null }));
}

// Creates a canonical item and opportunistically backfills matching historical
// line items (so future cost lookups get tighter). Returns the new item id.
export async function createItem(
  supabase: SupabaseClient,
  organizationId: string,
  canonicalName: string,
  category?: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('items')
    .insert({ organization_id: organizationId, canonical_name: canonicalName, category: category ?? null })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Could not create item');
  await supabase.rpc('link_line_items_to_item', { p_item_id: data.id, p_canonical_name: canonicalName });
  return data.id as string;
}

export async function updateIngredient(
  supabase: SupabaseClient,
  ingredientId: string,
  patch: Partial<{ qty: number; unit: string; confirmed: boolean; item_id: string; raw_ingredient_name: string }>,
): Promise<void> {
  const { error } = await supabase.from('recipe_ingredients').update(patch).eq('id', ingredientId);
  if (error) throw new Error(error.message);
}

// Persists the computed rollup + optional menu price back onto the recipe.
export async function saveRecipeRollup(
  supabase: SupabaseClient,
  recipeId: string,
  patch: { cost_estimate?: number; confidence?: number; menu_price?: number | null },
): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .update({ ...patch, cost_computed_at: new Date().toISOString() })
    .eq('id', recipeId);
  if (error) throw new Error(error.message);
}

export async function deleteRecipe(supabase: SupabaseClient, recipeId: string): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .update({ voided_at: new Date().toISOString() })
    .eq('id', recipeId);
  if (error) throw new Error(error.message);
}
