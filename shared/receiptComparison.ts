/** Conservative comparisons: unknown identity, package size, or discounts produce no price claim. */
export interface RetailProduct {
  barcode?: string | null;
  store_sku?: string | null;
  brand?: string | null;
  variant?: string | null;
  package_quantity?: number | null;
  package_unit?: string | null;
  package_count?: number | null;
  net_line_total?: number | null;
  discount_complete?: boolean;
  identity_confident?: boolean;
}
const units: Record<string, { factor: number; unit: string }> = {
  g: { factor: 1, unit: 'g' },
  kg: { factor: 1000, unit: 'g' },
  oz: { factor: 28.349523125, unit: 'g' },
  lb: { factor: 453.59237, unit: 'g' },
  ml: { factor: 1, unit: 'ml' },
  l: { factor: 1000, unit: 'ml' },
  fl_oz: { factor: 29.5735295625, unit: 'ml' },
  count: { factor: 1, unit: 'each' },
  each: { factor: 1, unit: 'each' },
};
export type ComparablePrice = {
  key: string;
  price: number;
  unit: string;
  quantity: number;
};
const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
export function comparablePrice(
  product: RetailProduct | undefined | null,
  purchased: number,
  total: number,
  storeId: string,
): ComparablePrice | null {
  if (
    !product?.identity_confident ||
    !product.discount_complete ||
    !Number.isFinite(purchased) ||
    purchased <= 0 ||
    !Number.isFinite(total) ||
    total <= 0
  )
    return null;
  const qty = product.package_quantity;
  const count = product.package_count ?? 1;
  const unit = units[clean(product.package_unit ?? '')];
  if (
    !qty ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    !Number.isFinite(count) ||
    count <= 0 ||
    !unit
  )
    return null;
  const barcode = product.barcode?.replace(/\s/g, '');
  const sku = product.store_sku?.trim();
  // Brand + a model-generated name alone is insufficient proof of product identity.
  const identity =
    barcode && /^\d{8,14}$/.test(barcode)
      ? `barcode:${barcode}`
      : sku
        ? `store:${storeId}:sku:${clean(sku)}`
        : null;
  if (!identity) return null;
  const net = product.net_line_total;
  if (net == null || !Number.isFinite(net) || net < 0 || net > total + 0.011)
    return null;
  const quantity = qty * count * unit.factor;
  return {
    key: `${identity}:${quantity.toFixed(6)}:${unit.unit}`,
    price: (net / (purchased * quantity)) * (unit.unit === 'each' ? 1 : 100),
    unit: unit.unit === 'each' ? 'each' : `100${unit.unit}`,
    quantity: purchased * quantity,
  };
}
export function compareRetailPurchases(
  a: ComparablePrice | null,
  b: ComparablePrice | null,
) {
  if (!a || !b || a.key !== b.key || a.unit !== b.unit || a.price <= 0)
    return null;
  return {
    pct: (b.price / a.price - 1) * 100,
    unit: a.unit,
    previous: a.price,
    current: b.price,
  };
}
