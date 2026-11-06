import {
  normalizePurchase,
  unitDefinition,
  type NormalizedPurchase,
  type PackMeasurement,
  type PurchaseObservation,
} from "./measurement.ts";
export interface ProductRecord extends PackMeasurement {
  id: string;
  canonical_name: string;
  category: string | null;
  product_key: string | null;
  source_line_id: string | null;
  manual_price: number | null;
}
export interface ProductPricing {
  unitCost: NormalizedPurchase | null;
  source: PurchaseObservation | null;
  sampleSize: number;
  isManual: boolean;
}
export function resolveProductPricing(
  product: ProductRecord,
  observations: PurchaseObservation[],
  recipeUnit?: string,
): ProductPricing {
  const dimension = recipeUnit ? unitDefinition(recipeUnit)?.dimension : null;
  if (recipeUnit && !dimension)
    return { unitCost: null, source: null, sampleSize: 0, isManual: false };
  if (
    !product.source_line_id &&
    product.manual_price != null &&
    product.pack_quantity != null
  ) {
    const p = normalizePurchase(
      {
        id: "manual",
        raw_description: product.canonical_name,
        qty: 1,
        unit_of_measure: product.pack_unit ?? "EA",
        extended_price: product.manual_price || 1,
        invoices: { id: "", vendor_id: "", invoice_date: null, created_at: "" },
      },
      product,
    );
    return {
      unitCost:
        p && (!dimension || p.dimension === dimension)
          ? {
              ...p,
              costPerBaseUnit: product.manual_price / p.totalQuantity,
              manual: true,
              basis: "Manual product estimate",
            }
          : null,
      source: null,
      sampleSize: 0,
      isManual: true,
    };
  }
  const priced = observations
    .map((source) => ({ source, price: normalizePurchase(source, product) }))
    .filter(
      (p): p is { source: PurchaseObservation; price: NormalizedPurchase } =>
        !!p.price && (!dimension || p.price.dimension === dimension),
    );
  const family = dimension ?? priced[0]?.price.dimension;
  const recent = priced.filter((p) => p.price.dimension === family).slice(0, 3);
  if (!recent.length)
    return {
      unitCost: null,
      source: observations[0] ?? null,
      sampleSize: 0,
      isManual: false,
    };
  const quantity = recent.reduce((sum, p) => sum + p.price.totalQuantity, 0);
  const amount = recent.reduce(
    (sum, p) => sum + p.price.costPerBaseUnit * p.price.totalQuantity,
    0,
  );
  return {
    unitCost: {
      ...recent[0].price,
      costPerBaseUnit: amount / quantity,
      totalQuantity: quantity,
      basis:
        product.pack_quantity != null
          ? "User-entered size · selected source"
          : recent.length > 1
            ? `Quantity-weighted average of ${recent.length} purchases`
            : recent[0].price.basis,
    },
    source: recent[0].source,
    sampleSize: recent.length,
    isManual: false,
  };
}
