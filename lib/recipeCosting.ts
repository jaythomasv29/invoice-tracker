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
  aiEstUnitCost: number | null;  // AI's rough $/unit guess — fallback until matched to a priced item
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

// Fallback point cost for an ingredient with no real price match yet: the
// AI's rough $/unit guess from general market knowledge, scaled by qty. This
// is what keeps the dish total from reading $0.00 right after Auto Cost,
// before anything's been matched to invoice history.
function aiEstimatedCost(ing: RecipeIngredient): number | null {
  if (ing.aiEstUnitCost == null) return null;
  return ing.qty * ing.aiEstUnitCost;
}

// How much a resolved price should count, scaled by how many recent
// purchases back it (resolve_item_cost_per_gram averages up to 3 — see the
// migration RPC — so 3 is where this maxes out). A price backed by a single
// invoice is a real price, just a thin one; this is what makes uploading
// more invoices for an already-matched ingredient measurably sharpen the
// estimate, instead of a 1-purchase match scoring identically to a 3+.
function sampleConfidence(sampleSize: number | undefined): number {
  const n = sampleSize ?? 1;
  if (n <= 0) return 0.3;
  if (n === 1) return 0.5;
  if (n === 2) return 0.75;
  return 1.0;
}

// Computes the dish's live cost, range, and confidence from its ingredients.
// Resolved ingredients use real per-gram cost from invoice history, weighted
// by how many purchases back that price (sampleConfidence); ones with an AI
// unit-cost guess use that (scaled by qty); anything left uses the AI
// cost-share scaled to the implied dish total the resolved ingredients
// establish (0 if none are resolved yet). Confidence is cost-share-weighted
// (nailing the expensive ingredients matters far more than the cheap ones).
export function computeRecipeCost(ingredients: RecipeIngredient[]): RecipeCost {
  if (ingredients.length === 0) return { estimate: 0, low: 0, high: 0, confidence: 0 };

  // Establish an implied dish total from the resolved ingredients, so any
  // ingredient with neither a real price nor an AI unit-cost guess can still
  // be estimated proportionally to its AI cost-share.
  let resolvedSum = 0;
  let resolvedShareSum = 0;
  for (const ing of ingredients) {
    const rc = resolvedCost(ing);
    if (rc != null) {
      resolvedSum += rc;
      resolvedShareSum += ing.aiEstCostShare ?? 0;
    }
  }
  // Floor the divisor so a resolved ingredient with a tiny AI-estimated cost
  // share can't extrapolate to a wildly inflated implied dish total — e.g. a
  // $2 garnish tagged at a 5% cost share would otherwise imply a $40 dish,
  // and every unresolved ingredient gets costed off that inflated total. This
  // caps how much any single resolved ingredient can amplify the implied
  // total (at MIN_SHARE_FOR_EXTRAPOLATION = 0.2, at most 5x) without
  // affecting dishes where the resolved ingredients already cover a
  // reasonable share of the cost.
  const MIN_SHARE_FOR_EXTRAPOLATION = 0.2;
  const impliedTotal = resolvedShareSum > 0
    ? resolvedSum / Math.max(resolvedShareSum, MIN_SHARE_FOR_EXTRAPOLATION)
    : 0;

  const point: number[] = [];
  const isResolved: boolean[] = [];
  for (const ing of ingredients) {
    const rc = resolvedCost(ing);
    if (rc != null) {
      point.push(rc);
      isResolved.push(true);
      continue;
    }
    const aiCost = aiEstimatedCost(ing);
    if (aiCost != null) {
      point.push(aiCost);
    } else {
      point.push((ing.aiEstCostShare ?? 0) * impliedTotal);
    }
    isResolved.push(false);
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
      const sc = sampleConfidence(ing.sampleSize);
      const u = (1 - sc) * 0.2;
      low += pc * (1 - u);
      high += pc * (1 + u);
      confidence += share * sc;
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

// Plain-language explanation of what's driving the confidence score, and what
// to do about it — confidence is built entirely from ingredients matched to
// real invoice line items (see resolveIngredientCost's trailing purchase
// average), so the fix is always "match more ingredients" / "upload more
// invoices" rather than anything the operator can do by hand.
export function confidenceHint(confidence: number): string {
  if (confidence >= 0.8) return 'Backed mostly by real purchase prices from your invoices.';
  if (confidence >= 0.4) {
    return 'Match more ingredients to your invoice history, or upload recent invoices, to sharpen this estimate.';
  }
  return 'This is mostly a rough starting estimate. Match ingredients to real purchases — or upload more invoices — for a tighter number.';
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
    aiEstUnitCost: row.ai_est_unit_cost == null ? null : Number(row.ai_est_unit_cost),
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
    .select(
      'id, name, source_photo_path, menu_price, cost_estimate, confidence, ai_draft_raw, recipe_ingredients!recipe_ingredients_recipe_id_fkey(*)'
    )
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

export async function deleteIngredient(supabase: SupabaseClient, ingredientId: string): Promise<void> {
  const { error } = await supabase.from('recipe_ingredients').delete().eq('id', ingredientId);
  if (error) throw new Error(error.message);
}

export async function addIngredient(
  supabase: SupabaseClient,
  organizationId: string,
  recipeId: string,
  input: { rawName: string; qty: number; unit: string },
  position: number,
): Promise<RecipeIngredient> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .insert({
      organization_id: organizationId,
      recipe_id: recipeId,
      component_type: 'item',
      raw_ingredient_name: input.rawName,
      qty: input.qty,
      unit: input.unit,
      confirmed: true,
      position,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Could not add ingredient');
  return mapIngredient(data);
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
