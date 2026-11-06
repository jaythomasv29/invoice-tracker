import type { PurchaseObservation } from "../shared/measurement.ts";
export type SupplierOption = {
  key: string;
  purchase: PurchaseObservation;
  count: number;
};
export type ProductGroup = {
  key: string;
  name: string;
  variants: SupplierOption[];
};
/** Deliberately conservative: preserve brands, varieties, preparation and printed sizes. */
export function commercialProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bbean[\s-]*sprouts?\b/g, "bean sprouts")
    .replace(/\s+/g, " ")
    .trim();
}
export function groupSupplierOptions(
  options: SupplierOption[],
): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const option of options) {
    const name =
      option.purchase.clean_name?.trim() || option.purchase.raw_description;
    const normalized = commercialProductName(name),
      key = `product:${normalized}`;
    const group = groups.get(key) ?? {
      key,
      name: normalized === "bean sprouts" ? "Bean sprouts" : name,
      variants: [],
    };
    if (!group.variants.some((v) => v.key === option.key))
      group.variants.push(option);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}
