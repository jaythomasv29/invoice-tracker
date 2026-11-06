import {
  convertQuantity,
  priceForRecipeQuantity,
  type NormalizedPurchase,
} from "./measurement.ts";
export interface CostableIngredient {
  qty: number;
  unit: string;
  confirmed: boolean;
  aiQty: number | null;
  aiUnit?: string | null;
  aiEstUnitCost: number | null;
  aiEstCostShare?: number | null;
  costPerGram?: number | null;
  unitCost?: NormalizedPurchase | null;
  sampleSize?: number;
  manualPrice?: boolean;
}
export function ingredientCost(ing: CostableIngredient): {
  amount: number | null;
  source: "purchase" | "manual" | "ai" | "missing";
} {
  if (!Number.isFinite(ing.qty) || ing.qty < 0)
    return { amount: null, source: "missing" };
  const unit =
    ing.unitCost ??
    (ing.costPerGram != null
      ? {
          dimension: "mass" as const,
          costPerBaseUnit: ing.costPerGram,
          totalQuantity: 1,
          basis: "Purchase weight",
          manual: false,
          net: false,
        }
      : null);
  if (unit) {
    const value = priceForRecipeQuantity(unit, ing.qty, ing.unit);
    if (value != null && Number.isFinite(value) && value >= 0)
      return { amount: value, source: ing.manualPrice ? "manual" : "purchase" };
  }
  if (
    ing.aiEstUnitCost != null &&
    Number.isFinite(ing.aiEstUnitCost) &&
    ing.aiEstUnitCost >= 0
  ) {
    const converted = convertQuantity(
      ing.qty,
      ing.unit,
      ing.aiUnit ?? ing.unit,
    );
    const q =
      converted ??
      ((ing.aiUnit ?? ing.unit).trim().toLowerCase() ===
      ing.unit.trim().toLowerCase()
        ? ing.qty
        : null);
    if (q != null) return { amount: q * ing.aiEstUnitCost, source: "ai" };
  }
  return { amount: null, source: "missing" };
}
export function computeIngredientCosts(ingredients: CostableIngredient[]) {
  let estimate = 0,
    low = 0,
    high = 0,
    weightedConfidence = 0,
    missingCount = 0,
    estimatedCount = 0;
  for (const ing of ingredients) {
    const cost = ingredientCost(ing);
    if (cost.amount == null) {
      missingCount++;
      continue;
    }
    const actual = cost.source === "purchase";
    if (!actual) estimatedCount++;
    const confidence =
      actual && ing.confirmed
        ? (ing.sampleSize ?? 1) >= 3
          ? 1
          : (ing.sampleSize ?? 1) === 2
            ? 0.75
            : 0.5
        : cost.source === "manual" && ing.confirmed
          ? 0.5
          : ing.confirmed
            ? 0.4
            : 0.15;
    const uncertainty = actual
      ? (1 - confidence) * 0.2
      : cost.source === "manual"
        ? 0.15
        : 0.4;
    estimate += cost.amount;
    low += cost.amount * (1 - uncertainty);
    high += cost.amount * (1 + uncertainty);
    weightedConfidence += cost.amount * confidence;
  }
  return {
    estimate,
    low,
    high,
    confidence: estimate > 0 ? weightedConfidence / estimate : 0,
    missingCount,
    estimatedCount,
    complete: ingredients.length > 0 && missingCount === 0,
  };
}
