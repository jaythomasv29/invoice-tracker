// Fictional sample-household ledger: the Personal workspace's counterpart to
// lib/demoLedger.ts (the sample restaurant). Pure and dependency-free apart
// from the shared retail-comparison rules, so tests/demoHousehold.test.mjs can
// import it directly; lib/demoData.ts maps it into app-shape store state.
//
// "Maple Street Home" is an invented two-adult household spending roughly
// $1,000–1,200 a month on groceries and household essentials across four
// invented stores. No real retailer, brand, barcode or customer data is used:
// package identities are store SKUs in an invented format, never UPCs.
//
// Determinism mirrors the restaurant ledger: each store's trips are indexed by
// `k` (0 = most recent) and a trip's lines are a pure function of (store, k),
// so only the dates move with `now`. Household price alerts are derived from
// those lines with the same net-unit-price comparison the server runs
// (shared/receiptComparison.ts), so alerts, the Home price watch and the
// receipts always agree.

import { comparablePrice, compareRetailPurchases, type RetailProduct } from '../shared/receiptComparison.ts';
import { localIso, rand } from './demoLedger.ts';

export const DEMO_HOUSEHOLD_NAME = 'Maple Street Home';
export const DEMO_HOUSEHOLD_HORIZON_DAYS = 63; // ~9 weeks: this month + all of last month
export const DEMO_HOUSEHOLD_TAX_RATE = 0.0825; // non-food lines only (cleaning, toiletries, household, other)
// Mirrors the server's PRICE_ALERT_THRESHOLD_PCT (supabase/functions/_shared/priceAlerts.ts).
const ALERT_THRESHOLD_PCT = 3;

export type DemoStoreKey = 'greenway' | 'coop' | 'costwise' | 'pharmacy';

interface StoreSpec {
  id: string;
  name: string;
  color: string;
  prefix: string;
  numberStart: number;
  weekday: number; // Date#getDay()
  hour: number; // typical time the receipt is scanned, local
  // Every other week; trips in weeks where (weeks back from this week) % 2
  // equals `skipParity` don't happen.
  skipParity?: 0 | 1;
}

export const DEMO_STORES: Record<DemoStoreKey, StoreSpec> = {
  greenway: { id: 'demo-s-greenway', name: 'Greenway Market', color: '#5DB075', prefix: '', numberStart: 418230, weekday: 6, hour: 11 },
  coop: { id: 'demo-s-coop', name: 'Corner Co-op Grocers', color: '#E09030', prefix: 'R', numberStart: 77215, weekday: 3, hour: 18 },
  costwise: { id: 'demo-s-costwise', name: 'Costwise Club', color: '#5B7FD4', prefix: 'W', numberStart: 902114, weekday: 0, hour: 13, skipParity: 0 },
  pharmacy: { id: 'demo-s-pharmacy', name: 'Main St Pharmacy', color: '#9B7FD4', prefix: 'MS', numberStart: 5530, weekday: 4, hour: 17, skipParity: 1 },
};
export const DEMO_STORE_KEYS = Object.keys(DEMO_STORES) as DemoStoreKey[];

// ---- Catalog ---------------------------------------------------------------
// [key, clean name, printed receipt text, unit, base price, category, qty min,
//  qty max, inclusion probability (1 = every trip), price steps, package]
// Price steps are [k, price]: trips with index <= k (that one and everything
// newer) ring up at `price`. LB lines are weighed (two decimals). `package`
// is [quantity, unit, store SKU] for packaged goods whose size and SKU are
// printed — those, and only those, take part in net-unit-price comparisons,
// exactly like a conservatively extracted real receipt.
type Step = [k: number, price: number];
type Pkg = [quantity: number, unit: 'g' | 'kg' | 'oz' | 'lb' | 'ml' | 'l' | 'fl_oz' | 'count', sku: string];
type CatalogRow = [string, string, string, string, number, string, number, number, number, Step[]?, Pkg?];

const CATALOG: Record<DemoStoreKey, CatalogRow[]> = {
  greenway: [
    ['bananas', 'Bananas', 'BANANAS', 'LB', 0.69, 'produce', 2.1, 3.2, 1],
    ['apples', 'Honeycrisp Apples', 'APPLES HONEYCRISP', 'LB', 2.49, 'produce', 1.8, 3.1, 0.8],
    ['spinach', 'Baby Spinach, 5 oz', 'GW BABY SPINACH 5OZ', 'EA', 3.99, 'produce', 1, 2, 0.8, undefined, [5, 'oz', 'GW-20114']],
    ['avocados', 'Avocados', 'AVOCADOS HASS', 'EA', 1.25, 'produce', 2, 4, 0.7],
    ['carrots', 'Carrots, 2 lb Bag', 'CARROTS 2LB', 'EA', 1.99, 'produce', 1, 1, 0.6],
    ['cherrytom', 'Cherry Tomatoes, 10 oz', 'TOMATO CHERRY 10OZ', 'EA', 3.49, 'produce', 1, 1, 0.6],
    ['limes', 'Limes', 'LIMES', 'EA', 0.5, 'produce', 3, 5, 0.5],
    ['onions', 'Yellow Onions, 3 lb Bag', 'ONIONS YELLOW 3LB', 'EA', 3.49, 'produce', 1, 1, 0.5, undefined, [3, 'lb', 'GW-20431']],
    ['eggs', 'Large Eggs, 12 ct', 'GW LG GRADE A EGGS 12CT', 'EA', 3.49, 'dairy_eggs', 1, 2, 1, [[5, 3.79], [0, 4.19]], [12, 'count', 'GW-30018']],
    ['milk', 'Whole Milk, 1 gal', 'GW WHOLE MILK 1GAL', 'EA', 4.29, 'dairy_eggs', 1, 1, 1, undefined, [128, 'fl_oz', 'GW-30002']],
    ['yogurt', 'Greek Yogurt, 32 oz', 'GW GREEK YOGURT PLN 32OZ', 'EA', 5.79, 'dairy_eggs', 1, 1, 0.8, undefined, [32, 'oz', 'GW-30140']],
    ['cheddar', 'Sharp Cheddar, 8 oz', 'GW SHARP CHEDDAR 8OZ', 'EA', 3.99, 'dairy_eggs', 1, 1, 0.7, undefined, [8, 'oz', 'GW-30227']],
    ['chicken', 'Chicken Breast, Boneless', 'CHKN BRST BNLS SKNLS', 'LB', 4.99, 'meat_seafood', 2.1, 3.3, 1],
    ['turkey', 'Sliced Turkey Breast, 8 oz', 'GW DELI TURKEY BRST 8OZ', 'EA', 5.49, 'meat_seafood', 1, 1, 0.6],
    ['beef', 'Ground Beef 85/15, 1 lb', 'GRND BEEF 85/15 1LB', 'EA', 6.49, 'meat_seafood', 1, 2, 0.8, [[3, 6.99]], [1, 'lb', 'GW-40055']],
    ['salmon', 'Salmon Fillet', 'SALMON FILLET ATL', 'LB', 11.99, 'meat_seafood', 0.9, 1.4, 0.4],
    ['bread', 'Whole Wheat Bread, 20 oz', 'GW WHL WHEAT BREAD 20OZ', 'EA', 3.29, 'bakery', 1, 1, 1, undefined, [20, 'oz', 'GW-50012']],
    ['tortillas', 'Flour Tortillas, 10 ct', 'GW FLOUR TORTILLA 10CT', 'EA', 2.99, 'bakery', 1, 1, 0.4],
    ['pasta', 'Spaghetti, 16 oz', 'GW SPAGHETTI 16OZ', 'EA', 1.79, 'pantry', 1, 2, 0.6, undefined, [16, 'oz', 'GW-60310']],
    ['marinara', 'Marinara Sauce, 24 oz', 'GW MARINARA 24OZ', 'EA', 3.49, 'pantry', 1, 1, 0.5],
    ['cereal', 'Oat Cereal, 18 oz', 'GW TOASTED OATS CEREAL 18OZ', 'EA', 4.79, 'pantry', 1, 1, 0.5],
    ['pb', 'Peanut Butter, 16 oz', 'GW PEANUT BUTTER CRMY 16OZ', 'EA', 3.79, 'pantry', 1, 1, 0.3],
    ['beans', 'Black Beans, 15 oz', 'GW BLACK BEANS 15OZ', 'EA', 0.99, 'pantry', 2, 3, 0.6],
    ['coffee', 'Ground Coffee, Medium Roast 12 oz', 'GW COFFEE MED RST 12OZ', 'EA', 8.99, 'pantry', 1, 1, 0.5, undefined, [12, 'oz', 'GW-60488']],
    ['peas', 'Frozen Peas, 16 oz', 'GW FRZ PEAS 16OZ', 'EA', 2.49, 'frozen', 1, 1, 0.5],
    ['pizza', 'Frozen Margherita Pizza', 'GW FRZ PIZZA MARGHERITA', 'EA', 6.99, 'frozen', 1, 2, 0.5],
    ['icecream', 'Vanilla Ice Cream, 48 oz', 'GW ICE CREAM VANILLA 48OZ', 'EA', 5.99, 'frozen', 1, 1, 0.3],
    ['oj', 'Orange Juice, 52 oz', 'GW ORANGE JUICE 52OZ', 'EA', 4.99, 'beverages', 1, 1, 0.8, [[4, 5.49]], [52, 'fl_oz', 'GW-70021']],
    ['sparkling', 'Sparkling Water, 8 pk', 'GW SPARKLING WATER 8PK', 'EA', 4.99, 'beverages', 1, 1, 0.5],
  ],
  coop: [
    ['oatmilk', 'Oat Milk, 64 oz', 'OAT MILK ORIG 64OZ', 'EA', 4.49, 'dairy_eggs', 1, 2, 1, [[0, 4.79]], [64, 'fl_oz', 'CC-1180']],
    ['bananas', 'Organic Bananas', 'ORG BANANAS', 'LB', 0.89, 'produce', 1.4, 2.4, 0.8],
    ['strawberries', 'Strawberries, 1 lb', 'STRAWBERRIES 1LB', 'EA', 3.99, 'produce', 1, 2, 0.7],
    ['apples', 'Gala Apples', 'ORG APPLES GALA', 'LB', 2.29, 'produce', 1.2, 2.2, 0.6],
    ['cucumbers', 'Cucumbers', 'CUCUMBERS', 'EA', 0.79, 'produce', 2, 3, 0.7],
    ['tomatoes', 'Roma Tomatoes', 'TOMATOES ROMA', 'LB', 1.49, 'produce', 1.0, 1.8, 0.7],
    ['lemons', 'Lemons', 'LEMONS', 'EA', 0.69, 'produce', 2, 4, 0.5],
    ['basil', 'Fresh Basil', 'BASIL FRESH', 'EA', 2.49, 'produce', 1, 1, 0.4],
    ['sourdough', 'Sourdough Loaf', 'SOURDOUGH LOAF', 'EA', 5.49, 'bakery', 1, 1, 0.8],
    ['feta', 'Feta Crumbles, 6 oz', 'FETA CRUMBLE 6OZ', 'EA', 4.29, 'dairy_eggs', 1, 1, 0.4],
    ['butter', 'Unsalted Butter, 1 lb', 'BUTTER UNSALTED 1LB', 'EA', 5.29, 'dairy_eggs', 1, 1, 0.5, undefined, [16, 'oz', 'CC-1204']],
    ['granola', 'Granola, 12 oz', 'GRANOLA HONEY 12OZ', 'EA', 5.99, 'pantry', 1, 1, 0.5],
  ],
  costwise: [
    ['towels', 'Paper Towels, 12 Rolls', 'CW PAPER TOWEL 12 ROLL', 'EA', 21.99, 'household', 1, 1, 1, [[1, 23.49]], [12, 'count', 'CW-118204']],
    ['tissue', 'Bath Tissue, 30 Rolls', 'CW BATH TISSUE 30 ROLL', 'EA', 24.99, 'household', 1, 1, 0.7, undefined, [30, 'count', 'CW-118210']],
    ['rotisserie', 'Rotisserie Chicken', 'CW ROTISSERIE CHICKEN', 'EA', 4.99, 'meat_seafood', 1, 1, 0.8],
    ['thighs', 'Chicken Thighs, 6 lb', 'CW CHKN THIGH BNLS 6LB', 'EA', 14.99, 'meat_seafood', 1, 1, 0.8, undefined, [6, 'lb', 'CW-224107']],
    ['coffee', 'Whole Bean Coffee, 2.5 lb', 'CW WHL BEAN COFFEE 2.5LB', 'EA', 17.99, 'pantry', 1, 1, 1, [[0, 19.99]], [2.5, 'lb', 'CW-330561']],
    ['eggs', 'Large Eggs, 24 ct', 'CW LG EGGS 24CT', 'EA', 6.49, 'dairy_eggs', 1, 1, 0.7, undefined, [24, 'count', 'CW-224300']],
    ['berries', 'Frozen Mixed Berries, 4 lb', 'CW FRZ MIXED BERRY 4LB', 'EA', 12.99, 'frozen', 1, 1, 0.7],
    ['spinach', 'Organic Spinach, 1 lb', 'CW ORG SPINACH 1LB', 'EA', 4.99, 'produce', 1, 1, 0.6],
    ['yogurt', 'Greek Yogurt Cups, 24 ct', 'CW GREEK YOGURT 24CT', 'EA', 15.49, 'dairy_eggs', 1, 1, 0.5],
    ['salmon', 'Frozen Salmon Fillets, 3 lb', 'CW FRZ SALMON FLT 3LB', 'EA', 22.99, 'frozen', 1, 1, 0.4],
    ['detergent', 'Laundry Detergent, 150 oz', 'CW LAUNDRY DET 150OZ', 'EA', 19.99, 'cleaning', 1, 1, 0.5, undefined, [150, 'fl_oz', 'CW-440118']],
    ['dishsoap', 'Dish Soap, 2-pack', 'CW DISH SOAP 2PK', 'EA', 8.99, 'cleaning', 1, 1, 0.5],
    ['trash', 'Trash Bags, 13 gal, 120 ct', 'CW KITCHEN BAGS 13G 120CT', 'EA', 17.99, 'household', 1, 1, 0.4],
    ['oil', 'Extra Virgin Olive Oil, 2 L', 'CW EVOO 2L', 'EA', 16.99, 'pantry', 1, 1, 0.5, undefined, [2, 'l', 'CW-330790']],
    ['almonds', 'Roasted Almonds, 2.5 lb', 'CW ROASTED ALMOND 2.5LB', 'EA', 14.99, 'pantry', 1, 1, 0.5],
    ['water', 'Spring Water, 40 pk', 'CW SPRING WATER 40PK', 'EA', 5.49, 'beverages', 1, 1, 0.6],
    ['toothpaste', 'Toothpaste, 5-pack', 'CW TOOTHPASTE 5PK', 'EA', 11.99, 'toiletries', 1, 1, 0.3],
  ],
  pharmacy: [
    ['shampoo', 'Shampoo, 12 oz', 'MS SHAMPOO 12OZ', 'EA', 6.49, 'toiletries', 1, 1, 0.6],
    ['bodywash', 'Body Wash, 18 oz', 'MS BODY WASH 18OZ', 'EA', 7.49, 'toiletries', 1, 1, 0.6],
    ['tissues', 'Facial Tissues, 3 Boxes', 'MS FACIAL TISSUE 3PK', 'EA', 5.49, 'household', 1, 1, 0.6],
    ['deodorant', 'Deodorant, 2.6 oz', 'MS DEODORANT 2.6OZ', 'EA', 5.99, 'toiletries', 1, 1, 0.5],
    ['toothbrush', 'Toothbrushes, 2 ct', 'MS TOOTHBRUSH SOFT 2CT', 'EA', 4.99, 'toiletries', 1, 1, 0.4],
    ['handsoap', 'Hand Soap Refill, 56 oz', 'MS HAND SOAP REFILL 56OZ', 'EA', 7.99, 'cleaning', 1, 1, 0.4],
    ['vitamins', 'Daily Multivitamin, 100 ct', 'MS MULTIVITAMIN 100CT', 'EA', 11.99, 'other', 1, 1, 0.4],
    ['floss', 'Dental Floss', 'MS DENTAL FLOSS', 'EA', 3.49, 'toiletries', 1, 1, 0.3],
  ],
};
const MIN_LINES = 3;
const MAX_LINES = 28;
const TAXED = new Set(['cleaning', 'toiletries', 'household', 'other']);

// ---- Output types ----------------------------------------------------------

export interface DemoReceiptLine {
  key: string;
  name: string; // clean_name
  raw: string; // printed receipt text
  qty: number;
  unit: string;
  unitPrice: number;
  ext: number; // qty × unitPrice, rounded to cents
  category: string;
  missing: false;
  retail: RetailProduct | null; // only for packaged goods with a printed size + SKU
}

export interface DemoReceipt {
  id: string;
  vendor: DemoStoreKey;
  vendorId: string;
  vendorName: string;
  vendorColor: string;
  k: number; // 0 = this store's most recent trip
  invoiceNumber: string;
  dateIso: string; // local yyyy-mm-dd
  daysAgo: number;
  createdAt: string;
  lines: DemoReceiptLine[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface DemoHouseholdAlert {
  id: string;
  itemName: string;
  vendorId: string;
  vendorName: string;
  previousPrice: number; // net unit price (per each / 100 g / 100 ml)
  newPrice: number;
  unit: string; // 'each' | '100g' | '100ml'
  pctChange: number;
  absChange: number;
  priceDate: string;
  previousPriceDate: string;
  detectedAt: string;
  read: boolean;
}

export interface DemoHouseholdLedger {
  invoices: DemoReceipt[]; // newest first
  alerts: DemoHouseholdAlert[];
}

// ---- Helpers ---------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

function priceAt(row: CatalogRow, k: number): number {
  let price = row[4];
  for (const [stepK, stepPrice] of [...(row[9] ?? [])].sort((a, b) => b[0] - a[0])) if (k <= stepK) price = stepPrice;
  return price;
}

function qtyFor(row: CatalogRow, seed: string): number {
  const [, , , unit, , , min, max] = row;
  const r = rand(`${seed}:qty`);
  if (unit === 'LB') return Math.round((min + r * (max - min)) * 100) / 100; // weighed at the register
  return min + Math.floor(r * (max - min + 1));
}

function linesFor(store: DemoStoreKey, k: number): DemoReceiptLine[] {
  const rows = CATALOG[store];
  const seed = (key: string) => `household:${store}:${k}:${key}`;
  let picked = rows.filter((row) => row[8] >= 1 || rand(seed(row[0])) < row[8]);
  for (const row of rows) if (picked.length < MIN_LINES && !picked.includes(row)) picked.push(row);
  picked = rows.filter((row) => picked.includes(row)).slice(0, MAX_LINES);
  return picked.map((row) => {
    const qty = qtyFor(row, seed(row[0]));
    const unitPrice = priceAt(row, k);
    const ext = round2(qty * unitPrice);
    const pkg = row[10];
    return {
      key: row[0], name: row[1], raw: row[2], unit: row[3], qty, unitPrice, ext, category: row[5], missing: false,
      retail: pkg
        ? { store_sku: pkg[2], package_quantity: pkg[0], package_unit: pkg[1], package_count: 1, net_line_total: ext, discount_complete: true, identity_confident: true }
        : null,
    };
  });
}

// ---- Ledger ----------------------------------------------------------------

export function buildHouseholdLedger(now: Date = new Date()): DemoHouseholdLedger {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOfToday = new Date(today);
  mondayOfToday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const invoices: DemoReceipt[] = [];
  for (const key of DEMO_STORE_KEYS) {
    const s = DEMO_STORES[key];
    let k = 0;
    for (let daysAgo = 0; daysAgo <= DEMO_HOUSEHOLD_HORIZON_DAYS; daysAgo++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
      if (date.getDay() !== s.weekday) continue;
      const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
      const weeksBack = Math.round((mondayOfToday.getTime() - monday.getTime()) / (7 * 86400000));
      if (s.skipParity !== undefined && weeksBack % 2 === s.skipParity) continue;
      // Scanned after getting home; a trip later today hasn't happened yet.
      const created = new Date(date.getFullYear(), date.getMonth(), date.getDate(), s.hour, Math.floor(rand(`household:${key}:${k}:t`) * 55));
      if (created > now) continue;
      const lines = linesFor(key, k);
      const subtotal = round2(lines.reduce((sum, l) => sum + l.ext, 0));
      const tax = round2(lines.filter((l) => TAXED.has(l.category)).reduce((sum, l) => sum + l.ext, 0) * DEMO_HOUSEHOLD_TAX_RATE);
      invoices.push({
        id: `demo-rcpt-${key}-${k}`,
        vendor: key, vendorId: s.id, vendorName: s.name, vendorColor: s.color, k,
        invoiceNumber: `${s.prefix}${s.numberStart - k * 7}`,
        dateIso: localIso(date), daysAgo,
        createdAt: created.toISOString(),
        lines, subtotal, tax, total: round2(subtotal + tax),
      });
      k++;
    }
  }
  invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Household price alerts, as refresh-household-insights → detectPriceCreep
  // records them: same store + SKU + package size, previous vs. new net unit
  // price, only above the 3% threshold.
  const alerts: DemoHouseholdAlert[] = [];
  const weekAgo = localIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
  for (const key of DEMO_STORE_KEYS) {
    const mine = invoices.filter((i) => i.vendor === key).sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    const last = new Map<string, { price: ReturnType<typeof comparablePrice>; date: string }>();
    for (const inv of mine) {
      for (const line of inv.lines) {
        const current = comparablePrice(line.retail, line.qty, line.ext, inv.vendorId);
        if (!current) continue;
        const prev = last.get(current.key);
        const cmp = prev ? compareRetailPurchases(prev.price, current) : null;
        if (prev && cmp && cmp.pct > ALERT_THRESHOLD_PCT) {
          const [y, m, d] = inv.dateIso.split('-').map(Number);
          alerts.push({
            id: `demo-halert-${key}-${line.key}-${inv.k}`,
            itemName: line.name, vendorId: inv.vendorId, vendorName: inv.vendorName,
            previousPrice: cmp.previous, newPrice: cmp.current, unit: cmp.unit,
            pctChange: Math.round(cmp.pct * 100) / 100,
            absChange: Math.round((cmp.current - cmp.previous) * 10000) / 10000,
            priceDate: inv.dateIso, previousPriceDate: prev.date,
            detectedAt: new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            read: inv.dateIso < weekAgo,
          });
        }
        last.set(current.key, { price: current, date: inv.dateIso });
      }
    }
  }
  alerts.sort((a, b) => b.priceDate.localeCompare(a.priceDate) || a.id.localeCompare(b.id));

  return { invoices, alerts };
}
