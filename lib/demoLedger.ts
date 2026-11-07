// Fictional sample-restaurant ledger behind the first-run product tour and the
// App Store / website captures. Pure and dependency-free (node-importable, so
// tests/demoLedger.test.mjs and scripts/capture/render-demo-invoice.mjs can run
// it directly); lib/demoData.ts maps it into app-shape store state.
//
// "Willow & Pine Kitchen" is an invented New American restaurant doing roughly
// $9–10k/week in food and supply purchases across six invented suppliers. No
// real distributor, restaurant or customer data is used.
//
// Determinism: each vendor's deliveries are indexed by `k` (0 = most recent).
// Line items, quantities and prices are a pure function of (vendor, k), so the
// k-th most recent delivery always has the same content; only its date moves
// with `now`. That keeps the review-screen invoice (Cascade k=0) identical to
// launch-assets/brand/demo-invoice.svg on any day, and keeps the price-alert
// stories (derived below from the same lines) consistent with the invoices.

export const DEMO_RESTAURANT_NAME = 'Willow & Pine Kitchen';
export const DEMO_HORIZON_DAYS = 63; // ~9 weeks: this month + all of last month
export const DEMO_TAX_RATE = 0.0825; // applied to cleaning + paper/packaging lines only

export type DemoVendorKey = 'cascade' | 'golden' | 'pinnacle' | 'harbor' | 'meadow' | 'northline';

interface VendorSpec {
  id: string;
  name: string;
  color: string;
  prefix: string;
  numberStart: number;
  weekdays: number[]; // Date#getDay()
  biweekly?: boolean;
  // Deliveries in the most recent N days were never logged — the cadence gap
  // that powers the "missing invoice" flag.
  unloggedRecentDays?: number;
}

export const DEMO_VENDORS: Record<DemoVendorKey, VendorSpec> = {
  cascade: { id: 'demo-v-cascade', name: 'Cascade Foodservice', color: '#5DB075', prefix: 'CF-', numberStart: 884210, weekdays: [1] },
  golden: { id: 'demo-v-golden', name: 'Golden Valley Produce', color: '#5B7FD4', prefix: 'GV', numberStart: 31570, weekdays: [2, 4, 6] },
  pinnacle: { id: 'demo-v-pinnacle', name: 'Pinnacle Meats', color: '#E09030', prefix: 'PM-', numberStart: 20618, weekdays: [3] },
  harbor: { id: 'demo-v-harbor', name: 'Harbor Seafood Co.', color: '#4AABB8', prefix: 'HS-', numberStart: 7742, weekdays: [4], unloggedRecentDays: 12 },
  meadow: { id: 'demo-v-meadow', name: 'Meadowbrook Dairy', color: '#9B7FD4', prefix: 'MD-', numberStart: 15309, weekdays: [5] },
  northline: { id: 'demo-v-northline', name: 'Northline Paper & Supply', color: '#C0705A', prefix: 'NP-', numberStart: 4471, weekdays: [2], biweekly: true },
};
export const DEMO_VENDOR_KEYS = Object.keys(DEMO_VENDORS) as DemoVendorKey[];

// ---- Catalog ---------------------------------------------------------------
// [key, clean name, printed description, unit, base price, category, qty min,
//  qty max, inclusion probability (1 = every delivery), price steps]
// Price steps are [k, price]: deliveries with index <= k (i.e. that one and
// everything newer) bill at `price`. Weight-billed LB lines carry one decimal.
type Step = [k: number, price: number];
type CatalogRow = [string, string, string, string, number, string, number, number, number, Step[]?];

const CATALOG: Record<DemoVendorKey, CatalogRow[]> = {
  cascade: [
    ['oil', 'Fryer Oil, Canola', 'OIL CANOLA FRY CLEAR 35 LB JIB', 'CS', 38.5, 'dry_goods', 8, 10, 1, [[0, 42.75]]],
    ['fries', 'French Fries, 3/8" Skin-On', 'FRY 3/8 SKIN-ON FRZ 6/5 LB', 'CS', 42.8, 'dry_goods', 18, 22, 1],
    ['buns', 'Brioche Buns, 4.5"', 'BUN BRIOCHE 4.5IN SLICED 4/12 CT', 'CS', 31.6, 'dry_goods', 12, 15, 1],
    ['tortillas', 'Corn Tortillas, 6"', 'TORTILLA CORN WHT 6IN 10/24 CT', 'CS', 24.6, 'dry_goods', 5, 7, 1],
    ['flour', 'All-Purpose Flour', 'FLOUR AP BLEACHED 50 LB', 'BG', 21.4, 'dry_goods', 3, 4, 1],
    ['cola', 'Cola Syrup, Bag-in-Box', 'SYRUP COLA BIB 5 GAL', 'EA', 98.4, 'beverage', 3, 4, 1],
    ['coffee', 'Coffee, Medium Roast', 'COFFEE MED RST WHL BEAN 5 LB', 'BG', 41.5, 'beverage', 3, 4, 1],
    ['mayo', 'Mayonnaise, Heavy Duty', 'MAYO HVY DUTY 4/1 GAL', 'CS', 46.2, 'dry_goods', 2, 3, 1],
    ['gloves', 'Nitrile Gloves, Large', 'GLOVE NITRILE BLK LG 10/100', 'CS', 64.5, 'cleaning', 2, 2, 1],
    ['evoo', 'Extra Virgin Olive Oil', 'OIL OLIVE XVRGN 4/3 LT', 'CS', 96.8, 'dry_goods', 1, 2, 0.8],
    ['rings', 'Onion Rings, Beer-Battered', 'ONION RING BEER BATTER 4/2.5 LB', 'CS', 38.9, 'dry_goods', 3, 4, 0.8],
    ['ketchup', 'Ketchup, Fancy', 'KETCHUP FANCY 6/#10', 'CS', 33.9, 'dry_goods', 2, 3, 0.8],
    ['lemonade', 'Lemonade Syrup, Bag-in-Box', 'SYRUP LEMONADE BIB 5 GAL', 'EA', 86.2, 'beverage', 1, 2, 0.7],
    ['sparkling', 'Sparkling Water, 12 oz', 'WATER SPARKLING CAN 24/12 OZ', 'CS', 18.4, 'beverage', 4, 6, 0.7],
    ['pickles', 'Dill Pickle Chips', 'PICKLE CHIP DILL CRINKLE 5 GAL', 'EA', 36.4, 'dry_goods', 1, 2, 0.7],
    ['panko', 'Panko Breadcrumbs', 'BREADCRUMB PANKO 25 LB', 'BG', 34.2, 'dry_goods', 1, 2, 0.6],
    ['crushed', 'Crushed Tomatoes', 'TOMATO CRUSHED 6/#10', 'CS', 29.8, 'dry_goods', 2, 3, 0.6],
    ['rice', 'Long Grain Rice', 'RICE LONG GRAIN 25 LB', 'BG', 19.75, 'dry_goods', 2, 3, 0.6],
    ['sanitizer', 'Quat Sanitizer', 'SANITIZER QUAT 4/1 GAL', 'CS', 52.8, 'cleaning', 1, 1, 0.6],
    ['sugar', 'Granulated Sugar', 'SUGAR GRAN CANE 25 LB', 'BG', 18.9, 'dry_goods', 1, 2, 0.5],
    ['detergent', 'Pot & Pan Detergent', 'DETERGENT POT&PAN 4/1 GAL', 'CS', 39.6, 'cleaning', 1, 1, 0.5],
    ['pepper', 'Black Pepper, Coarse', 'PEPPER BLK COARSE 18 OZ', 'EA', 14.85, 'dry_goods', 2, 3, 0.5],
    ['salt', 'Kosher Salt', 'SALT KOSHER 12/3 LB', 'CS', 28.4, 'dry_goods', 1, 1, 0.5],
  ],
  golden: [
    ['avocado', 'Avocados, Hass', 'AVOCADO HASS 48 CT', 'CS', 58.4, 'produce', 2, 3, 1, [[5, 54.2]]],
    ['romaine', 'Romaine Hearts', 'ROMAINE HEARTS 12/3 CT', 'CS', 42.75, 'produce', 2, 3, 1],
    ['limes', 'Limes, 200 ct', 'LIMES 200 CT', 'CS', 36.5, 'produce', 1, 2, 1, [[1, 41.25]]],
    ['romas', 'Roma Tomatoes', 'TOMATO ROMA 25 LB', 'CS', 27.8, 'produce', 1, 2, 1],
    ['onions', 'Yellow Onions, Jumbo', 'ONION YELLOW JUMBO 50 LB', 'BG', 28.5, 'produce', 1, 1, 1],
    ['cilantro', 'Cilantro', 'CILANTRO 30 CT', 'CS', 24.9, 'produce', 1, 1, 1],
    ['asparagus', 'Asparagus, Standard', 'ASPARAGUS STD 11 LB', 'CS', 44.0, 'produce', 1, 1, 0.8],
    ['potatoes', 'Russet Potatoes, 70 ct', 'POTATO RUSSET 70 CT 50 LB', 'CS', 31.2, 'produce', 1, 1, 0.7],
    ['spring', 'Spring Mix', 'SPRING MIX 3 LB', 'CS', 16.8, 'produce', 2, 4, 0.8],
    ['garlic', 'Garlic, Peeled', 'GARLIC PEELED 5 LB JAR', 'EA', 17.4, 'produce', 1, 2, 0.8],
    ['cabbage', 'Green Cabbage', 'CABBAGE GREEN 50 LB', 'CS', 26.4, 'produce', 1, 1, 0.7],
    ['jalapeno', 'Jalapeños', 'PEPPER JALAPENO 10 LB', 'CS', 18.6, 'produce', 1, 1, 0.7],
    ['lemons', 'Lemons, 115 ct', 'LEMONS 115 CT', 'CS', 41.6, 'produce', 1, 1, 0.6],
    ['carrots', 'Carrots, Jumbo', 'CARROT JUMBO 25 LB', 'BG', 19.6, 'produce', 1, 1, 0.5],
    ['shallots', 'Shallots', 'SHALLOTS 10 LB', 'BG', 24.3, 'produce', 1, 1, 0.5],
    ['thyme', 'Thyme', 'HERB THYME 1 LB', 'EA', 12.5, 'produce', 1, 1, 0.5],
  ],
  pinnacle: [
    ['thigh', 'Chicken Thigh, Boneless Skinless', 'CHKN THIGH BNLS SKNLS 4/10 LB', 'LB', 1.62, 'protein', 190, 230, 1, [[6, 1.71], [3, 1.82], [0, 1.94]]],
    ['strip', 'NY Strip Steak, 12 oz', 'BEEF STRIP NY 12 OZ CHOICE', 'LB', 12.4, 'protein', 40, 50, 1],
    ['beef', 'Ground Beef 80/20', 'BEEF GRND 80/20 CHUB 4/10 LB', 'LB', 4.35, 'protein', 70, 90, 1],
    ['wings', 'Chicken Wings, Jumbo', 'CHKN WING JMBO 1&2 JNT 40 LB', 'CS', 112.0, 'protein', 2, 3, 1],
    ['bacon', 'Bacon, Applewood Smoked', 'BACON APPLEWOOD 18/22 15 LB', 'CS', 68.25, 'protein', 2, 3, 1],
    ['breast', 'Chicken Breast, 6 oz', 'CHKN BRST BNLS 6 OZ 4/10 LB', 'LB', 2.89, 'protein', 60, 90, 0.8],
    ['shortrib', 'Beef Short Rib, Boneless', 'BEEF SHORT RIB BNLS CHOICE', 'LB', 9.85, 'protein', 20, 30, 0.7],
    ['pork', 'Pork Shoulder, Bone-In', 'PORK BUTT BONE-IN 2/8 LB', 'LB', 2.35, 'protein', 30, 40, 0.6],
  ],
  harbor: [
    ['shrimp', 'Shrimp 16/20, Peeled & Deveined', 'SHRIMP P&D T-OFF 16/20 IQF 2 LB', 'BG', 16.4, 'seafood', 20, 25, 1, [[0, 17.95]]],
    ['salmon', 'Atlantic Salmon Fillet', 'SALMON ATL FILLET SKIN-ON 3-4 LB', 'LB', 10.45, 'seafood', 36, 44, 1],
    ['calamari', 'Calamari Tubes & Tentacles', 'CALAMARI T&T 2.5 LB', 'BG', 14.6, 'seafood', 5, 8, 1],
    ['cod', 'Cod Loin, 6 oz', 'COD LOIN 6 OZ IQF 10 LB', 'LB', 9.2, 'seafood', 20, 30, 0.8],
    ['mussels', 'Mussels, PEI', 'MUSSELS PEI 10 LB', 'BG', 24.0, 'seafood', 2, 3, 0.8],
    ['crab', 'Lump Crab Meat', 'CRAB LUMP PASTEURIZED 1 LB', 'EA', 28.5, 'seafood', 3, 5, 0.6],
    ['scallops', 'Sea Scallops U/10', 'SCALLOP SEA U/10 DRY', 'LB', 21.8, 'seafood', 8, 10, 0.5],
  ],
  meadow: [
    ['eggs', 'Large Eggs, Grade AA', 'EGGS LG GR AA LOOSE 15 DZ', 'CS', 42.0, 'dairy', 3, 4, 1, [[2, 47.4]]],
    ['butter', 'Unsalted Butter', 'BUTTER UNSALTED AA 36/1 LB', 'CS', 148.5, 'dairy', 1, 1, 1],
    ['cream', 'Heavy Cream, 36%', 'CREAM HVY 36% 12/1 QT', 'CS', 52.8, 'dairy', 2, 2, 1],
    ['buttermilk', 'Buttermilk', 'BUTTERMILK CULTURED 9/.5 GAL', 'CS', 31.5, 'dairy', 2, 3, 1],
    ['parm', 'Parmesan Wedge', 'CHEESE PARMESAN WEDGE', 'LB', 9.4, 'dairy', 6, 10, 1],
    ['milk', 'Whole Milk', 'MILK WHOLE 4/1 GAL', 'CS', 21.6, 'dairy', 1, 2, 1],
    ['cheddar', 'Sharp Cheddar, Sliced', 'CHEESE CHED SHARP SLI 4/2.5 LB', 'CS', 48.9, 'dairy', 1, 2, 0.8],
    ['sourcream', 'Sour Cream', 'SOUR CREAM 5 LB', 'EA', 11.2, 'dairy', 2, 3, 0.7],
    ['cotija', 'Cotija, Crumbled', 'CHEESE COTIJA CRMBL 5 LB', 'EA', 26.4, 'dairy', 1, 1, 0.7],
  ],
  northline: [
    ['togo', 'To-Go Container, Kraft 32 oz', 'CONT KRAFT FOLD 32 OZ 200 CT', 'CS', 54.8, 'paper_packaging', 3, 4, 1, [[1, 59.95]]],
    ['clamshell', 'Clamshell 9x9, Compostable', 'CLAMSHELL 9X9 BAGASSE 200 CT', 'CS', 48.6, 'paper_packaging', 2, 3, 1],
    ['deli', 'Deli Containers 16 oz, w/ Lids', 'CONT DELI 16 OZ W/LID 240 CT', 'CS', 39.4, 'paper_packaging', 1, 2, 1],
    ['napkins', 'Dinner Napkins', 'NAPKIN DINNER 2-PLY 3000 CT', 'CS', 36.2, 'paper_packaging', 1, 2, 1],
    ['portion', 'Portion Cups 2 oz, w/ Lids', 'CUP PORTION 2 OZ W/LID 2500 CT', 'CS', 41.2, 'paper_packaging', 1, 1, 1],
    ['towels', 'Paper Towel Rolls', 'TOWEL ROLL KRAFT 800 FT 6 CT', 'CS', 45.8, 'paper_packaging', 1, 1, 1],
    ['liners', 'Trash Liners, 40-45 gal', 'LINER 40X46 1.5 MIL 250 CT', 'CS', 38.6, 'cleaning', 1, 2, 1],
    ['bags', 'Kraft Bags, #12', 'BAG KRAFT #12 500 CT', 'CS', 44.5, 'paper_packaging', 1, 1, 0.8],
    ['wrap', 'Film Wrap, 18"', 'FILM 18IN X 2000 FT', 'EA', 24.9, 'paper_packaging', 1, 2, 0.7],
    ['foil', 'Foil Sheets 12x10.75', 'FOIL SHEET 12X10.75 3000 CT', 'CS', 47.8, 'paper_packaging', 1, 1, 0.6],
    ['utensils', 'Wooden Utensil Kit', 'KIT UTENSIL WOOD 4-PC 500 CT', 'CS', 52.3, 'paper_packaging', 1, 1, 0.6],
  ],
};

// Lines the kitchen flagged as not delivered on the review screen (the
// delivery-gap card's worklist): [vendor, delivery index k, item key].
const MISSING_LINES: [DemoVendorKey, number, string][] = [['golden', 1, 'cilantro'], ['pinnacle', 2, 'bacon']];
const MIN_LINES = 6;
const MAX_LINES = 18;

// ---- Output types ----------------------------------------------------------

export interface DemoLedgerLine {
  key: string;
  name: string; // clean_name
  raw: string; // printed description
  qty: number;
  unit: string;
  unitPrice: number;
  ext: number; // qty × unitPrice, rounded to cents
  category: string;
  missing: boolean;
}

export interface DemoLedgerInvoice {
  id: string;
  vendor: DemoVendorKey;
  vendorId: string;
  vendorName: string;
  vendorColor: string;
  k: number; // 0 = this vendor's most recent delivery
  invoiceNumber: string;
  dateIso: string; // local yyyy-mm-dd
  daysAgo: number;
  createdAt: string; // ISO timestamp of the (same-day) upload
  lines: DemoLedgerLine[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface DemoLedgerAlert {
  id: string;
  itemName: string;
  vendorId: string;
  vendorName: string;
  previousPrice: number;
  newPrice: number;
  unit: string;
  pctChange: number;
  absChange: number;
  priceDate: string;
  previousPriceDate: string;
  detectedAt: string;
  read: boolean;
}

export interface DemoLedgerRecipe {
  id: string;
  name: string;
  costEstimate: number;
  confidence: number;
  menuPrice: number;
}

export interface DemoLedger {
  invoices: DemoLedgerInvoice[]; // newest first
  alerts: DemoLedgerAlert[];
  recipes: DemoLedgerRecipe[];
}

// ---- Helpers ---------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

export function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Small deterministic PRNG keyed by a string (FNV-1a → mulberry32 step).
function rand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let t = (h += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function priceAt(row: CatalogRow, k: number): number {
  let price = row[4];
  for (const [stepK, stepPrice] of [...(row[9] ?? [])].sort((a, b) => b[0] - a[0])) if (k <= stepK) price = stepPrice;
  return price;
}

function qtyFor(row: CatalogRow, seed: string): number {
  const [, , , unit, , , min, max] = row;
  const r = rand(`${seed}:qty`);
  if (unit === 'LB' && max >= 20) return Math.round((min + r * (max - min)) * 10) / 10; // catch weight
  return min + Math.floor(r * (max - min + 1));
}

function linesFor(vendor: DemoVendorKey, k: number): DemoLedgerLine[] {
  const rows = CATALOG[vendor];
  const seed = (key: string) => `${vendor}:${k}:${key}`;
  let picked = rows.filter((row) => row[8] >= 1 || rand(seed(row[0])) < row[8]);
  for (const row of rows) if (picked.length < MIN_LINES && !picked.includes(row)) picked.push(row);
  picked = rows.filter((row) => picked.includes(row)).slice(0, MAX_LINES); // catalog order, capped
  return picked.map((row) => {
    const qty = qtyFor(row, seed(row[0]));
    const unitPrice = priceAt(row, k);
    return {
      key: row[0], name: row[1], raw: row[2], unit: row[3], qty, unitPrice,
      ext: round2(qty * unitPrice), category: row[5],
      missing: MISSING_LINES.some(([v, mk, key]) => v === vendor && mk === k && key === row[0]),
    };
  });
}

// ---- Ledger ----------------------------------------------------------------

export function buildDemoLedger(now: Date = new Date()): DemoLedger {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOfToday = new Date(today);
  mondayOfToday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  // Logged delivery dates per vendor, newest first. Today's delivery only
  // counts once it has plausibly arrived and been scanned (after 9am).
  const dates: Record<DemoVendorKey, { date: Date; daysAgo: number }[]> = {
    cascade: [], golden: [], pinnacle: [], harbor: [], meadow: [], northline: [],
  };
  for (let daysAgo = 0; daysAgo <= DEMO_HORIZON_DAYS; daysAgo++) {
    if (daysAgo === 0 && now.getHours() < 9) continue;
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
    const weeksBack = Math.round((mondayOfToday.getTime() - monday.getTime()) / (7 * 86400000));
    for (const key of DEMO_VENDOR_KEYS) {
      const v = DEMO_VENDORS[key];
      if (!v.weekdays.includes(date.getDay())) continue;
      if (v.biweekly && weeksBack % 2 === 1) continue;
      if (v.unloggedRecentDays && daysAgo < v.unloggedRecentDays) continue;
      dates[key].push({ date, daysAgo });
    }
  }

  const invoices: DemoLedgerInvoice[] = [];
  for (const key of DEMO_VENDOR_KEYS) {
    const v = DEMO_VENDORS[key];
    dates[key].forEach(({ date, daysAgo }, k) => {
      const lines = linesFor(key, k);
      const subtotal = round2(lines.reduce((s, l) => s + l.ext, 0));
      const taxable = lines.filter((l) => l.category === 'cleaning' || l.category === 'paper_packaging').reduce((s, l) => s + l.ext, 0);
      const tax = round2(taxable * DEMO_TAX_RATE);
      // Scanned the same morning it arrived (never in the future).
      const created = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 40 + Math.floor(rand(`${key}:${k}:t`) * 90));
      if (created > now) created.setTime(now.getTime() - 5 * 60000);
      invoices.push({
        id: `demo-inv-${key}-${k}`,
        vendor: key, vendorId: v.id, vendorName: v.name, vendorColor: v.color, k,
        invoiceNumber: `${v.prefix}${v.numberStart - k}`,
        dateIso: localIso(date), daysAgo,
        createdAt: created.toISOString(),
        lines, subtotal, tax, total: round2(subtotal + tax),
      });
    });
  }
  invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Price alerts — one per increase, exactly as the server's detectPriceCreep
  // records them: same item/unit/vendor, previous vs. new delivery price.
  const alerts: DemoLedgerAlert[] = [];
  const weekAgo = localIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
  for (const key of DEMO_VENDOR_KEYS) {
    const mine = invoices.filter((i) => i.vendor === key).sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    const last = new Map<string, { price: number; date: string }>();
    for (const inv of mine) {
      for (const line of inv.lines) {
        const prev = last.get(line.key);
        if (prev && line.unitPrice > prev.price) {
          const [y, m, d] = inv.dateIso.split('-').map(Number);
          alerts.push({
            id: `demo-alert-${key}-${line.key}-${inv.k}`,
            itemName: line.name, vendorId: inv.vendorId, vendorName: inv.vendorName,
            previousPrice: prev.price, newPrice: line.unitPrice, unit: line.unit,
            pctChange: Math.round(((line.unitPrice - prev.price) / prev.price) * 1000) / 10,
            absChange: round2(line.unitPrice - prev.price),
            priceDate: inv.dateIso, previousPriceDate: prev.date,
            detectedAt: new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            read: inv.dateIso < weekAgo,
          });
        }
        last.set(line.key, { price: line.unitPrice, date: inv.dateIso });
      }
    }
  }
  alerts.sort((a, b) => b.priceDate.localeCompare(a.priceDate) || a.id.localeCompare(b.id));

  return { invoices, alerts, recipes: buildRecipes() };
}

// ---- Recipes ---------------------------------------------------------------
// Plate cost = Σ portion (in purchase units) × the current invoice price, plus
// a small allowance for seasoning/garnish. Portions are realistic: e.g. 7 oz
// raw thigh = 0.44 LB; one 4.5" bun = 1/48 CS; 6 oz fries = 1/80 of a 30 lb CS;
// 1 oz butter = 1/576 of a 36 × 1 lb CS.
type Portion = [vendor: DemoVendorKey, key: string, qty: number];
const RECIPES: { id: string; name: string; menuPrice: number; confidence: number; extra: number; portions: Portion[] }[] = [
  {
    id: 'demo-recipe-01', name: 'Buttermilk Fried Chicken Sandwich', menuPrice: 17, confidence: 0.9, extra: 0.22,
    portions: [['pinnacle', 'thigh', 0.44], ['cascade', 'buns', 1 / 48], ['meadow', 'buttermilk', 1 / 72], ['cascade', 'flour', 0.005], ['cascade', 'oil', 1 / 100], ['golden', 'cabbage', 0.004], ['cascade', 'pickles', 1 / 400], ['cascade', 'mayo', 1 / 256], ['cascade', 'fries', 1 / 80]],
  },
  {
    id: 'demo-recipe-02', name: 'Steak Frites', menuPrice: 36, confidence: 0.88, extra: 0.35,
    portions: [['pinnacle', 'strip', 0.75], ['cascade', 'fries', 1 / 60], ['meadow', 'butter', 1 / 576], ['golden', 'shallots', 0.003], ['golden', 'thyme', 0.006], ['cascade', 'oil', 1 / 120]],
  },
  {
    id: 'demo-recipe-03', name: 'Grilled Shrimp Tacos', menuPrice: 18, confidence: 0.86, extra: 0.25,
    portions: [['harbor', 'shrimp', 0.17], ['cascade', 'tortillas', 3 / 240], ['golden', 'avocado', 1 / 96], ['golden', 'cabbage', 0.004], ['golden', 'limes', 1 / 200], ['golden', 'cilantro', 1 / 120], ['meadow', 'cotija', 0.0125], ['meadow', 'sourcream', 0.0125]],
  },
  {
    id: 'demo-recipe-04', name: 'Pan-Seared Salmon', menuPrice: 29, confidence: 0.84, extra: 0.3,
    portions: [['harbor', 'salmon', 0.44], ['golden', 'asparagus', 0.25 / 11], ['golden', 'potatoes', 1 / 70], ['meadow', 'butter', 1 / 576], ['meadow', 'cream', 1 / 384], ['golden', 'lemons', 1 / 460]],
  },
  {
    id: 'demo-recipe-05', name: 'Caesar Salad', menuPrice: 14, confidence: 0.62, extra: 0.4,
    portions: [['golden', 'romaine', 1 / 36], ['meadow', 'parm', 0.06], ['meadow', 'eggs', 1 / 180], ['cascade', 'evoo', 1 / 400], ['golden', 'lemons', 1 / 460], ['golden', 'garlic', 0.005]],
  },
];

export function currentDemoPrice(vendor: DemoVendorKey, key: string): number {
  const row = CATALOG[vendor].find((r) => r[0] === key);
  if (!row) throw new Error(`Unknown demo item ${vendor}/${key}`);
  return priceAt(row, 0);
}

function buildRecipes(): DemoLedgerRecipe[] {
  return RECIPES.map((r) => ({
    id: r.id, name: r.name, menuPrice: r.menuPrice, confidence: r.confidence,
    costEstimate: round2(r.portions.reduce((s, [v, key, q]) => s + q * currentDemoPrice(v, key), r.extra)),
  }));
}
