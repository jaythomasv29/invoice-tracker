import type { SupabaseClient } from "@supabase/supabase-js";
import {
  unitDefinition,
  type PurchaseObservation,
} from "../shared/measurement.ts";
import {
  resolveProductPricing,
  type ProductRecord,
  type ProductPricing,
} from "../shared/productCost.ts";
export type PurchasedProduct = {
  key: string;
  purchase: PurchaseObservation;
  count: number;
};
export async function searchPurchases(
  db: SupabaseClient,
  query: string,
  offset = 0,
): Promise<PurchasedProduct[]> {
  const { data, error } = await db.rpc("purchase_product_catalog", {
    p_query: query.trim(),
    p_limit: 200,
    p_offset: offset,
  });
  if (error) throw new Error("Could not search purchases. Please retry.");
  return (data ?? []).map((r: any) => ({
    key: r.product_key,
    purchase: r.purchase,
    count: Number(r.purchase_count),
  }));
}
export async function fetchSavedProducts(
  db: SupabaseClient,
  organizationId: string,
): Promise<ProductRecord[]> {
  const rows: ProductRecord[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from("items")
      .select(
        "id,canonical_name,category,product_key,source_line_id,pack_quantity,pack_unit,pack_count,manual_price",
      )
      .eq("organization_id", organizationId)
      .order("canonical_name")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error("Could not load saved products.");
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}
export async function productPrices(
  db: SupabaseClient,
  ids: string[],
): Promise<
  Map<string, { product: ProductRecord; observations: PurchaseObservation[] }>
> {
  const map = new Map<
    string,
    { product: ProductRecord; observations: PurchaseObservation[] }
  >();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db.rpc("product_cost_observations", {
      p_item_ids: ids.slice(offset, offset + 200),
    });
    if (error) throw new Error("Could not load product prices.");
    for (const row of data ?? [])
      map.set(row.product.id, {
        product: row.product,
        observations: row.observations ?? [],
      });
  }
  return map;
}
export async function savePurchaseProduct(
  db: SupabaseClient,
  organizationId: string,
  row: PurchasedProduct,
): Promise<string> {
  const input = {
    organization_id: organizationId,
    canonical_name: row.purchase.clean_name || row.purchase.raw_description,
    product_key: row.key,
    source_line_id: row.purchase.id,
  };
  const { error } = await db.from("items").upsert(input, {
    onConflict: "organization_id,product_key",
    ignoreDuplicates: true,
  });
  if (error) throw new Error("Could not save this product.");
  const { data, error: readError } = await db
    .from("items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("product_key", row.key)
    .single();
  if (readError || !data) throw new Error("Could not open saved product.");
  return data.id;
}
export async function fetchProduct(
  db: SupabaseClient,
  id: string,
): Promise<{
  product: ProductRecord;
  pricing: ProductPricing;
  observations: PurchaseObservation[];
}> {
  const data = (await productPrices(db, [id])).get(id);
  if (!data) throw new Error("Product was not found in this workspace.");
  return {
    ...data,
    pricing: resolveProductPricing(data.product, data.observations),
  };
}
export async function createManualProduct(
  db: SupabaseClient,
  organizationId: string,
  name: string,
): Promise<string> {
  if (!name.trim() || name.trim().length > 250)
    throw new Error("Enter a product name up to 250 characters.");
  const { data, error } = await db
    .from("items")
    .insert({
      organization_id: organizationId,
      canonical_name: name.trim(),
      product_key: `manual:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not add product.");
  return data.id;
}

export async function updateProduct(
  db: SupabaseClient,
  id: string,
  input: {
    canonical_name: string;
    pack_quantity: number | null;
    pack_unit: string | null;
    pack_count: number | null;
    manual_price: number | null;
  },
) {
  if (!input.canonical_name.trim() || input.canonical_name.trim().length > 250)
    throw new Error("Enter a product name up to 250 characters.");
  if (
    input.pack_quantity != null &&
    (!Number.isFinite(input.pack_quantity) ||
      input.pack_quantity <= 0 ||
      input.pack_quantity > 1000000)
  )
    throw new Error("Enter a package size greater than zero.");
  if (
    input.pack_quantity != null &&
    (!input.pack_unit ||
      !unitDefinition(input.pack_unit) ||
      unitDefinition(input.pack_unit)?.dimension === "pack")
  )
    throw new Error("Choose a weight, liquid volume, or count unit.");
  if (
    input.pack_count != null &&
    (!Number.isFinite(input.pack_count) ||
      input.pack_count <= 0 ||
      input.pack_count > 1000000)
  )
    throw new Error("Enter a pack count greater than zero.");
  if (
    input.manual_price != null &&
    (!Number.isFinite(input.manual_price) ||
      input.manual_price < 0 ||
      input.manual_price > 1000000)
  )
    throw new Error("Enter a valid package price.");
  const { error } = await db
    .from("items")
    .update({
      ...input,
      canonical_name: input.canonical_name.trim(),
      pack_unit: input.pack_quantity == null ? null : input.pack_unit,
      pack_count: input.pack_quantity == null ? null : (input.pack_count ?? 1),
    })
    .eq("id", id);
  if (error) throw new Error("Could not save product. Please retry.");
}

export async function purchaseHistory(db: SupabaseClient, key: string, offset = 0): Promise<PurchaseObservation[]> {
  const { data, error } = await db.rpc('purchase_product_history', { p_key: key, p_limit: 100, p_offset: offset });
  if (error) throw new Error('Could not load purchase history. Please retry.');
  return data ?? [];
}

export async function searchProductGroups(db: SupabaseClient, query: string, offset = 0): Promise<import('./productGroups').ProductGroup[]> {
  const {data,error}=await db.rpc('purchase_product_groups',{p_query:query.trim(),p_limit:200,p_offset:offset});
  if(error) throw new Error('Could not load products. Please retry.');
  return (data??[]).map((r:any)=>({key:r.group_key,name:r.group_key==='product:bean sprouts'?'Bean sprouts':r.product_name,variants:r.variants}));
}
