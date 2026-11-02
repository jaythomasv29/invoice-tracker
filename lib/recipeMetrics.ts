// Unweighted average across recipes with valid cost and menu-price data.
// Values above 100% are meaningful: ingredients cost more than the menu price.
export function averageIngredientCostShare(recipes: { costEstimate: number | null; menuPrice: number | null }[]) {
  const shares = recipes.flatMap(({costEstimate, menuPrice}) =>
    costEstimate != null && menuPrice != null && Number.isFinite(costEstimate) && Number.isFinite(menuPrice) && costEstimate >= 0 && menuPrice > 0
      ? [costEstimate / menuPrice * 100] : []);
  return { pricedCount: shares.length, average: shares.length ? shares.reduce((sum, x) => sum + x, 0) / shares.length : null };
}
