/** US customary liquid units. Never convert mass to volume without density. */
export type Dimension = "mass" | "volume" | "count" | "pack";
export type Unit = { dimension: Dimension; factor: number; label: string };
const units: Record<string, Unit> = {};
function define(
  names: string[],
  dimension: Dimension,
  factor: number,
  label: string,
) {
  for (const name of names) units[name] = { dimension, factor, label };
}
define(["g", "gram", "grams"], "mass", 1, "g");
define(["kg", "kgs", "kilogram", "kilograms"], "mass", 1000, "kg");
define(["oz", "ounce", "ounces"], "mass", 28.349523125, "oz");
define(["lb", "lbs", "pound", "pounds"], "mass", 453.59237, "lb");
define(["ml", "milliliter", "milliliters"], "volume", 1, "mL");
define(["l", "liter", "liters", "litre", "litres"], "volume", 1000, "L");
define(
  ["fl_oz", "fl oz", "floz", "fluid ounce", "us fl oz"],
  "volume",
  29.5735295625,
  "US fl oz",
);
define(["cup", "cups", "us cup"], "volume", 236.5882365, "US cup");
define(["tbsp", "tablespoon"], "volume", 14.78676478125, "US tbsp");
define(["tsp", "teaspoon"], "volume", 4.92892159375, "US tsp");
define(["gal", "gallon", "gallons", "us gal"], "volume", 3785.411784, "US gal");
define(["qt", "quart", "quarts"], "volume", 946.352946, "US qt");
define(["pt", "pint", "pints"], "volume", 473.176473, "US pt");
define(
  ["ea", "each", "pc", "pcs", "piece", "pieces", "ct", "count"],
  "count",
  1,
  "each",
);
define(["pack", "cs", "case", "bx", "box", "bag"], "pack", 1, "purchase unit");
export function unitDefinition(value: string): Unit | null {
  return units[value.trim().toLowerCase().replace(/\./g, "")] ?? null;
}
export function convertQuantity(
  qty: number,
  from: string,
  to: string,
): number | null {
  const a = unitDefinition(from),
    b = unitDefinition(to);
  return Number.isFinite(qty) &&
    qty >= 0 &&
    a &&
    b &&
    a.dimension === b.dimension
    ? (qty * a.factor) / b.factor
    : null;
}
export interface PurchaseObservation {
  id: string;
  raw_description: string;
  clean_name?: string | null;
  qty: number | string | null;
  unit_of_measure: string | null;
  unit_price?: number | string | null;
  extended_price: number | string | null;
  normalized_price_per_lb?: number | string | null;
  retail_product?: {
    package_quantity?: number;
    package_count?: number;
    package_unit?: string;
    net_line_total?: number;
    discount_complete?: boolean;
    identity_confident?: boolean;
  } | null;
  invoices: {
    id: string;
    vendor_id: string;
    invoice_date: string | null;
    created_at: string;
    vendors?: { name?: string | null } | null;
  };
}
export interface PackMeasurement {
  pack_quantity?: number | null;
  pack_unit?: string | null;
  pack_count?: number | null;
}
export type NormalizedPurchase = {
  dimension: Dimension;
  totalQuantity: number;
  costPerBaseUnit: number;
  basis: string;
  manual: boolean;
  net: boolean;
};
const positive = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
export function normalizePurchase(
  row: PurchaseObservation,
  pack?: PackMeasurement,
): NormalizedPurchase | null {
  const qty = positive(row.qty),
    extended = row.extended_price == null ? NaN : Number(row.extended_price);
  if (!qty || !Number.isFinite(extended) || extended < 0) return null;
  const retail = row.retail_product;
  let total = extended;
  let net = false;
  if (retail) {
    if (
      !retail.discount_complete ||
      retail.net_line_total == null ||
      !Number.isFinite(retail.net_line_total) ||
      retail.net_line_total < 0 ||
      retail.net_line_total > extended + 0.011
    )
      return null;
    total = retail.net_line_total;
    net = true;
  }
  const result = (
    quantity: number,
    dimension: Dimension,
    basis: string,
    manual = false,
  ): NormalizedPurchase | null =>
    Number.isFinite(quantity) && quantity > 0
      ? {
          dimension,
          totalQuantity: quantity,
          costPerBaseUnit: total / quantity,
          basis,
          manual,
          net,
        }
      : null;
  if (pack?.pack_quantity != null) {
    const u = unitDefinition(pack.pack_unit ?? "");
    const amount = positive(pack.pack_quantity),
      count = positive(pack.pack_count ?? 1);
    return u && amount && count
      ? result(
          qty * amount * count * u.factor,
          u.dimension,
          "User-entered package size",
          true,
        )
      : null;
  }
  if (retail?.identity_confident && retail.package_quantity) {
    const u = unitDefinition(retail.package_unit ?? "");
    const amount = positive(retail.package_quantity),
      count = positive(retail.package_count ?? 1);
    if (u && amount && count)
      return result(
        qty * amount * count * u.factor,
        u.dimension,
        "Receipt package size",
      );
  }
  const description = row.raw_description ?? "";
  const catchWeight = description.match(
    /IN TOTAL\s*:\s*(\d+(?:\.\d+)?)\s*LBS?\b/i,
  );
  if (catchWeight)
    return result(
      Number(catchWeight[1]) * 453.59237,
      "mass",
      "Printed total catch weight",
    );
  const u = unitDefinition(row.unit_of_measure ?? "");
  if (u && u.dimension !== "pack" && u.dimension !== "count")
    return result(qty * u.factor, u.dimension, "Printed quantity and unit");
  const multi = [
    ...description.matchAll(
      /\b(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(FL\s*OZ|LBS?|OZ|KG|G|ML|L|CT|COUNT)\b/gi,
    ),
  ];
  if (multi.length > 1) return null;
  if (multi.length === 1) {
    const m = multi[0];
    if (
      /\d+(?:\.\d+)?\s*(FL\s*OZ|LBS?|OZ|KG|G|ML|L|CT|COUNT)\b/i.test(
        description.replace(m[0], ""),
      )
    )
      return null;
    const measure = unitDefinition(m[3]);
    if (measure)
      return result(
        qty * Number(m[1]) * Number(m[2]) * measure.factor,
        measure.dimension,
        "Printed multipack size",
      );
  }
  if (/\d+\s*\/\s*\d+/.test(description)) return null;
  const single = [
    ...description.matchAll(
      /\b(\d+(?:\.\d+)?)\s*(FL\s*OZ|LBS?|OZ|KG|G|ML|L|CT|COUNT)\b/gi,
    ),
  ];
  if (single.length === 1) {
    const m = single[0],
      measure = unitDefinition(m[2]);
    if (measure)
      return result(
        qty * Number(m[1]) * measure.factor,
        measure.dimension,
        "Printed package size",
      );
  }
  // EA may mean a carton or case. Require a printed count or a confirmed size before recipe conversion.
  return null;
}
export function displayUnitCost(
  price: NormalizedPurchase,
  system: "metric" | "us" = "us",
) {
  const display =
    price.dimension === "mass"
      ? system === "us"
        ? { factor: 453.59237, label: "lb" }
        : { factor: 100, label: "100 g" }
      : price.dimension === "volume"
        ? system === "us"
          ? { factor: 29.5735295625, label: "US fl oz" }
          : { factor: 100, label: "100 mL" }
        : {
            factor: 1,
            label: price.dimension === "count" ? "each" : "purchase unit",
          };
  return { value: price.costPerBaseUnit * display.factor, unit: display.label };
}
export function priceForRecipeQuantity(
  price: NormalizedPurchase,
  qty: number,
  unit: string,
): number | null {
  const u = unitDefinition(unit);
  return u &&
    u.dimension === price.dimension &&
    Number.isFinite(qty) &&
    qty >= 0
    ? qty * u.factor * price.costPerBaseUnit
    : null;
}
