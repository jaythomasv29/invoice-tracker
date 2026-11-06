export interface RecipeLaborSettings {
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  laborMinutes: number | null;
  laborRate: number | null;
}
export const DEFAULT_RECIPE_LABOR: RecipeLaborSettings = {
  servings: 1,
  prepMinutes: null,
  cookMinutes: null,
  laborMinutes: null,
  laborRate: null,
};
export function validateRecipeLabor(s: RecipeLaborSettings) {
  if (!Number.isFinite(s.servings) || s.servings <= 0 || s.servings > 100000)
    throw new Error("Enter a batch yield greater than zero.");
  for (const [label, value] of [
    ["Prep time", s.prepMinutes],
    ["Cook time", s.cookMinutes],
    ["Hands-on labor", s.laborMinutes],
    ["Labor rate", s.laborRate],
  ] as const) {
    if (
      value != null &&
      (!Number.isFinite(value) || value < 0 || value > 1000000)
    )
      throw new Error(`${label} must be a valid nonnegative number.`);
  }
  return s;
}
export function recipeLaborBreakdown(
  ingredientCost: number,
  settings: RecipeLaborSettings,
  ingredientsComplete = true,
) {
  validateRecipeLabor(settings);
  const labor =
    settings.laborMinutes === 0
      ? 0
      : settings.laborMinutes != null && settings.laborRate != null
        ? (settings.laborMinutes / 60) * settings.laborRate
        : null;
  const knownBatch = ingredientCost + (labor ?? 0);
  return {
    ingredients: ingredientCost,
    labor,
    knownBatch,
    perServing: knownBatch / settings.servings,
    ingredientsPerServing: ingredientCost / settings.servings,
    laborPerServing: labor == null ? null : labor / settings.servings,
    complete: ingredientsComplete && labor != null,
  };
}
