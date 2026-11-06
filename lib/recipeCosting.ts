import { computeIngredientCosts } from "../shared/recipeIngredients.ts";
import {
  unitDefinition,
  normalizePurchase,
  type NormalizedPurchase,
} from "../shared/measurement.ts";
import { resolveProductPricing } from "../shared/productCost.ts";
import {
  productPrices,
  searchPurchases,
  fetchSavedProducts,
  createManualProduct,
  type PurchasedProduct,
} from "./products";
import { displayUnitCost } from "../shared/measurement.ts";
import {
  DEFAULT_RECIPE_LABOR,
  validateRecipeLabor,
  type RecipeLaborSettings,
} from "../shared/recipeLabor.ts";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { ensureAiConsent } from "./aiConsent";
import type { SupabaseClient } from "@supabase/supabase-js";

// Recipe data and cost resolution. Preserve source invoices; convert only within
// compatible weight, liquid-volume, or count units. Labor remains operator-entered.

// ---- App-shape types -------------------------------------------------------

export interface RecipeIngredient {
  id: string;
  rawName: string;
  qty: number;
  unit: string; // g | oz | lb (costable) | others (not yet)
  aiQty: number | null;
  aiUnit: string | null;
  aiEstCostShare: number | null;
  aiEstUnitCost: number | null; // AI's rough $/unit guess — fallback until matched to a priced item
  confirmed: boolean;
  itemId: string | null; // resolved catalog item, once matched
  position: number;
  // Filled in on the client after resolving cost from invoice history:
  costPerGram?: number | null; // null = no weight-based price history found
  sampleSize?: number;
  unitCost?: NormalizedPurchase | null;
  manualPrice?: boolean;
}

export interface Recipe {
  labor: RecipeLaborSettings;
  id: string;
  name: string;
  sourcePhotoPath: string | null;
  menuPrice: number | null;
  costEstimate: number | null;
  confidence: number;
  hasDraft: boolean; // ai_draft_raw present
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
  purchase?: PurchasedProduct;
  priceLabel?: string;
}

// ---- Measurement compatibility ------------------------------

export function isWeightUnit(unit: string) {
  return unitDefinition(unit)?.dimension === "mass";
}
export function toGrams(qty: number, unit: string): number | null {
  const u = unitDefinition(unit);
  return u?.dimension === "mass" ? qty * u.factor : null;
}
export type RecipeCost = ReturnType<typeof computeIngredientCosts>;
export const computeRecipeCost = computeIngredientCosts;

// Plain-language explanation of what's driving the confidence score, and what
// to do about it — confidence is built entirely from ingredients matched to
// real invoice line items (see resolveIngredientCost's trailing purchase
// average), so the fix is always "match more ingredients" / "upload more
// invoices" rather than anything the operator can do by hand.
export function confidenceHint(confidence: number): string {
  if (confidence >= 0.8)
    return "Backed mostly by real purchase prices from your invoices.";
  if (confidence >= 0.4) {
    return "Match more ingredients to your invoice history, or upload recent invoices, to sharpen this estimate.";
  }
  return "This is mostly a rough starting estimate. Match ingredients to real purchases — or upload more invoices — for a tighter number.";
}

// ---- Data access -----------------------------------------------------------

export async function createDraftDish(
  supabase: SupabaseClient,
  organizationId: string,
  name: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("recipes")
    .insert({ organization_id: organizationId, kind: "dish", name })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "Could not create dish");
  return data.id as string;
}

export async function uploadRecipePhoto(
  supabase: SupabaseClient,
  organizationId: string,
  recipeId: string,
  localUri: string,
): Promise<string> {
  const path = `${organizationId}/${recipeId}/0.jpg`;
  const image = await manipulateAsync(localUri, [{ resize: { width: 2000 } }], {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  const arrayBuffer = await fetch(image.uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage
    .from("recipe-images")
    .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Could not upload photo: ${error.message}`);
  await supabase
    .from("recipes")
    .update({ source_photo_path: path })
    .eq("id", recipeId);
  return path;
}

// Invokes the AI draft edge function (Pro-gated server-side).
export async function draftRecipe(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<void> {
  if (!(await ensureAiConsent(supabase)))
    throw new Error("AI processing was not allowed.");
  const { data, error } = await supabase.functions.invoke("draft-recipe", {
    body: { recipeId },
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    let detail: string | undefined;
    try {
      const raw = await context?.text();
      detail = raw ? JSON.parse(raw)?.error : undefined;
    } catch {
      // not JSON
    }
    throw new Error(detail ?? error.message ?? "Could not draft recipe");
  }
  if (data?.error) throw new Error(data.error);
}

function mapIngredient(row: any): RecipeIngredient {
  return {
    id: row.id,
    rawName: row.raw_ingredient_name,
    qty: Number(row.qty ?? 0),
    unit: row.unit ?? "g",
    aiQty: row.ai_qty == null ? null : Number(row.ai_qty),
    aiUnit: row.ai_unit ?? null,
    aiEstCostShare:
      row.ai_est_cost_share == null ? null : Number(row.ai_est_cost_share),
    aiEstUnitCost:
      row.ai_est_unit_cost == null ? null : Number(row.ai_est_unit_cost),
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
    .from("recipes")
    .select(
      "id,name,menu_price,servings,recipe_ingredients!recipe_ingredients_recipe_id_fkey(*)",
    )
    .eq("organization_id", organizationId)
    .eq("kind", "dish")
    .is("voided_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const resolved = await resolveIngredientCosts(
    supabase,
    rows.flatMap((r: any) => (r.recipe_ingredients ?? []).map(mapIngredient)),
  );
  const byId = new Map(resolved.map((ing) => [ing.id, ing]));
  return rows.map((r: any) => {
    const cost = computeRecipeCost(
      (r.recipe_ingredients ?? []).map((i: any) => byId.get(i.id)!),
    );
    return {
      id: r.id,
      name: r.name,
      costEstimate: cost.complete
        ? cost.estimate / Number(r.servings ?? 1)
        : null,
      confidence: cost.confidence,
      menuPrice: r.menu_price == null ? null : Number(r.menu_price),
    };
  });
}

export async function fetchRecipe(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<Recipe> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients!recipe_ingredients_recipe_id_fkey(*)")
    .eq("id", recipeId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Recipe not found");
  const ingredients = ((data as any).recipe_ingredients ?? [])
    .map(mapIngredient)
    .sort(
      (a: RecipeIngredient, b: RecipeIngredient) => a.position - b.position,
    );
  return {
    id: data.id,
    labor: {
      ...DEFAULT_RECIPE_LABOR,
      servings: Number(data.servings ?? 1),
      prepMinutes: data.prep_minutes == null ? null : Number(data.prep_minutes),
      cookMinutes: data.cook_minutes == null ? null : Number(data.cook_minutes),
      laborMinutes:
        data.labor_minutes == null ? null : Number(data.labor_minutes),
      laborRate: data.labor_rate == null ? null : Number(data.labor_rate),
    },
    name: data.name,
    sourcePhotoPath: (data as any).source_photo_path ?? null,
    menuPrice:
      (data as any).menu_price == null
        ? null
        : Number((data as any).menu_price),
    costEstimate:
      (data as any).cost_estimate == null
        ? null
        : Number((data as any).cost_estimate),
    confidence: Number((data as any).confidence ?? 0),
    hasDraft: (data as any).ai_draft_raw != null,
    ingredients,
  };
}

// Resolve compatible prices in batches, using the latest three usable purchase observations.
export async function resolveIngredientCosts(
  db: SupabaseClient,
  ingredients: RecipeIngredient[],
): Promise<RecipeIngredient[]> {
  const ids = [
    ...new Set(ingredients.flatMap((i) => (i.itemId ? [i.itemId] : []))),
  ];
  const data = await productPrices(db, ids);
  return ingredients.map((ing) => {
    if (!ing.itemId) return ing;
    const row = data.get(ing.itemId);
    const pricing = row
      ? resolveProductPricing(row.product, row.observations, ing.unit)
      : null;
    return {
      ...ing,
      unitCost: pricing?.unitCost ?? null,
      costPerGram:
        pricing?.unitCost?.dimension === "mass"
          ? pricing.unitCost.costPerBaseUnit
          : null,
      sampleSize: pricing?.sampleSize ?? 0,
      manualPrice: pricing?.isManual ?? false,
    };
  });
}
export async function resolveIngredientCost(
  db: SupabaseClient,
  itemId: string,
  unit = "g",
) {
  const row = (await productPrices(db, [itemId])).get(itemId);
  if (!row) return null;
  const p = resolveProductPricing(row.product, row.observations, unit);
  if (!p.unitCost) return null;
  return {
    costPerGram:
      p.unitCost.dimension === "mass" ? p.unitCost.costPerBaseUnit : null,
    unitCost: p.unitCost,
    sampleSize: p.sampleSize,
    manualPrice: p.isManual,
  };
}

export async function searchItems(
  supabase: SupabaseClient,
  organizationId: string,
  query: string,
): Promise<ItemMatch[]> {
  const [saved, purchases] = await Promise.all([
    fetchSavedProducts(supabase, organizationId),
    searchPurchases(supabase, query),
  ]);
  const filtered = saved
    .filter((p) =>
      p.canonical_name.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .slice(0, 25);
  const prices = await productPrices(
    supabase,
    filtered.map((p) => p.id),
  );
  const label = (cost: NormalizedPurchase | null) => {
    if (!cost) return "Package size needed";
    const d = displayUnitCost(cost);
    return `$${d.value.toFixed(3)}/${d.unit}`;
  };
  const keys = new Set(filtered.map((p) => p.product_key));
  return [
    ...filtered.map((p) => {
      const row = prices.get(p.id);
      const cost = row
        ? resolveProductPricing(row.product, row.observations).unitCost
        : null;
      return {
        id: p.id,
        canonicalName: p.canonical_name,
        category: p.category,
        priceLabel: label(cost),
      };
    }),
    ...purchases
      .filter((p) => !keys.has(p.key))
      .slice(0, 25)
      .map((p) => ({
        id: p.purchase.id,
        canonicalName: p.purchase.clean_name || p.purchase.raw_description,
        category: p.purchase.invoices.vendors?.name ?? null,
        purchase: p,
        priceLabel: label(normalizePurchase(p.purchase)),
      })),
  ];
}
export const createItem = createManualProduct;

export async function deleteIngredient(
  supabase: SupabaseClient,
  ingredientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("id", ingredientId);
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
    .from("recipe_ingredients")
    .insert({
      organization_id: organizationId,
      recipe_id: recipeId,
      component_type: "item",
      raw_ingredient_name: input.rawName,
      qty: input.qty,
      unit: input.unit,
      confirmed: true,
      position,
    })
    .select()
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "Could not add ingredient");
  return mapIngredient(data);
}

export async function updateIngredient(
  supabase: SupabaseClient,
  ingredientId: string,
  patch: Partial<{
    qty: number;
    unit: string;
    confirmed: boolean;
    item_id: string;
    raw_ingredient_name: string;
  }>,
): Promise<void> {
  const { error } = await supabase
    .from("recipe_ingredients")
    .update(patch)
    .eq("id", ingredientId);
  if (error) throw new Error(error.message);
}

// Persists the computed rollup + optional menu price back onto the recipe.
export async function saveRecipeRollup(
  supabase: SupabaseClient,
  recipeId: string,
  patch: {
    cost_estimate?: number | null;
    confidence?: number;
    menu_price?: number | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("recipes")
    .update({ ...patch, cost_computed_at: new Date().toISOString() })
    .eq("id", recipeId);
  if (error) throw new Error(error.message);
}

export async function deleteRecipe(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<void> {
  const { error } = await supabase
    .from("recipes")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", recipeId);
  if (error) throw new Error(error.message);
}

export async function saveRecipeLabor(
  db: SupabaseClient,
  id: string,
  labor: RecipeLaborSettings,
) {
  validateRecipeLabor(labor);
  const { error } = await db
    .from("recipes")
    .update({
      servings: labor.servings,
      prep_minutes: labor.prepMinutes,
      cook_minutes: labor.cookMinutes,
      labor_minutes: labor.laborMinutes,
      labor_rate: labor.laborRate,
      cost_estimate: null,
    })
    .eq("id", id);
  if (error) throw new Error("Could not save yield and labor.");
}
