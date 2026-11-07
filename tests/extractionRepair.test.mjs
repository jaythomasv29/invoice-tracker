import test from "node:test";
import assert from "node:assert/strict";
import {
  repairLineItems,
  missingPages,
  matchVendor,
  isPlaceholderVendorName,
} from "../supabase/functions/_shared/extractionRepair.ts";

const line = (o) => ({
  description: "Item",
  clean_name: "Item",
  quantity: 1,
  unit_of_measure: "CS",
  unit_price: 10,
  extended_price: 10,
  line_item_type: "charge",
  confidence: 0.95,
  ...o,
});

// Real case: Thaiphoon S.J. invoice 710e57b2 — "Eggs" description wrapped
// across a page break became a $0 line, which a reviewer then priced.
test("page-break overflow row merges into the item above", () => {
  const { lines, mergedOverflowRows } = repairLineItems([
    line({ description: "Eggs Large·Grade AA·#15DZ", clean_name: "Eggs", quantity: 1, unit_price: 17.5, extended_price: 17.5 }),
    line({ description: "雞蛋 <MarkCode/Label>", clean_name: "Eggs", quantity: 0, unit_price: 0, extended_price: 0, unit_of_measure: "", confidence: 0.4 }),
  ]);
  assert.equal(mergedOverflowRows, 1);
  assert.equal(lines.length, 1);
  assert.match(lines[0].description, /雞蛋/);
  assert.equal(lines[0].extended_price, 17.5);
});

test("a priced or coded zero-qty line is not treated as overflow", () => {
  const { lines } = repairLineItems([
    line({}),
    line({ description: "OUT OF STOCK Basil", quantity: 0, unit_price: 0, extended_price: 0, item_code: "BAS-1" }),
  ]);
  assert.equal(lines.length, 2);
});

// Real case: roasted duck — 1 CS, 8.830 LB @ 13.65/LB = 120.53, stored as
// 1 CS × $13.65 (unit cost understated 8.8×).
test("catch-weight line is normalised to pounds", () => {
  const [li] = repairLineItems([
    line({ description: "Roasted Duck", quantity: 1, unit_of_measure: "CS", unit_price: 13.65, extended_price: 120.53, pricing_basis: "per_weight", catch_weight: 8.83, weight_unit: "lb" }),
  ]).lines;
  assert.equal(li.unit_of_measure, "LB");
  assert.equal(li.quantity, 8.83);
  assert.equal(li.unit_price, 13.65);
  assert.equal(li.weight_basis, "catch_weight");
  assert.equal(li.normalized_price_per_lb, 13.65);
  assert.deepEqual(li.low_confidence_fields, []);
  assert.match(li.description, /1 CS @ 8\.83 lb/);
});

test("an unflagged catch-weight (qty × price ≠ amount) is flagged for review", () => {
  const [li] = repairLineItems([
    line({ quantity: 1, unit_price: 13.65, extended_price: 120.53 }),
  ]).lines;
  assert.ok(li.low_confidence_fields.includes("quantity"));
  assert.ok(li.confidence <= 0.5);
});

test("consistent lines are untouched, and per-lb lines get a per-lb cost", () => {
  const [a, b] = repairLineItems([
    line({ quantity: 4, unit_price: 64.8, extended_price: 259.2 }),
    line({ quantity: 15, unit_of_measure: "LB", unit_price: 2.5, extended_price: 37.5 }),
  ]).lines;
  assert.deepEqual(a.low_confidence_fields, []);
  assert.equal(a.confidence, 0.95);
  assert.equal(b.normalized_price_per_lb, 2.5);
  assert.equal(b.parsed_weight, 15);
});

test("missing pages are reported from 'Page n of m'", () => {
  assert.deepEqual(missingPages([{ page: 1, of: 4 }, { page: 2, of: 4 }, { page: 3, of: 4 }]), [4]);
  assert.deepEqual(missingPages([{ page: 1, of: 1 }]), []);
  assert.deepEqual(missingPages(undefined), []);
});

const vendors = [
  { id: "sj", name: "S.J. Distributors LLC", aliases: [], contact_phone: "+16693365935", account_number: "110989" },
  { id: "op", name: "Ocean Paradise Produce", aliases: [], contact_phone: "(415) 821-1628", account_number: "TPHP 0" },
];

test("vendor name match tolerates punctuation drift", () => {
  assert.equal(matchVendor({ name: "S. J. Distributors, LLC" }, vendors).vendor?.id, "sj");
});

// Real case: Ocean Paradise logo under the clipboard clip → model invented
// "Sysco San Francisco" while the phone and account were Ocean Paradise's.
test("obscured name resolves by phone/account", () => {
  const m = matchVendor({ name: "Sysco San Francisco", name_visible: false, contact_phone: "415-821-1628" }, vendors);
  assert.equal(m.kind, "contact");
  assert.equal(m.vendor.id, "op");
});

test("printed unknown name needs phone AND account to override", () => {
  assert.equal(matchVendor({ name: "Sysco San Francisco", contact_phone: "415-821-1628" }, vendors).kind, "none");
  assert.equal(matchVendor({ name: "Sysco San Francisco", contact_phone: "415-821-1628", account_number: "TPHP-0" }, vendors).vendor?.id, "op");
});

test("placeholder names never become vendors", () => {
  assert.ok(isPlaceholderVendorName("<UNKNOWN>"));
  assert.ok(isPlaceholderVendorName(""));
  assert.ok(!isPlaceholderVendorName("EDS"));
  assert.equal(matchVendor({ name: "", account_number: "110989" }, vendors).vendor?.id, "sj");
});
