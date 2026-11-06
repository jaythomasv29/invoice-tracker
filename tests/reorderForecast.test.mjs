import { test } from "node:test";
import assert from "node:assert/strict";
import {
  forecastReorder,
  allowedInsightAction,
} from "../shared/reorderForecast.ts";
const row = (id, date, qty = 2, extra = {}) => ({
  id,
  raw_description: "Case tomatoes 25 lb",
  qty,
  unit_of_measure: "case",
  extended_price: 30,
  invoices: {
    id: "inv-" + id,
    vendor_id: "v",
    invoice_date: date,
    created_at: "2026-11-06T12:00:00Z",
  },
  ...extra,
});
const weekly = () =>
  ["2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"].map((d, i) =>
    row(String(i), d),
  );
test("four real dated purchases produce an evidence-based stock-check window, not an order quantity", () => {
  const f = forecastReorder(weekly(), "2026-11-06");
  assert.equal(f.datedOrderCount, 4);
  assert.equal(f.medianDays, 7);
  assert.deepEqual(f.window, { from: "2026-11-05", to: "2026-11-07" });
  assert.equal(f.status, "review");
  assert.equal(allowedInsightAction(f), "check_stock");
  assert.equal(f.lastQuantity, 2);
  assert.equal("recommendedQuantity" in f, false);
});
test("duplicate lines, split invoices and same-day purchases do not unlock four dates", () => {
  const a = row("a", "2026-10-30");
  const b = row("b", "2026-10-30");
  const f = forecastReorder([a, a, b, row("c", "2026-10-23")], "2026-11-06");
  assert.equal(f.datedOrderCount, 2);
  assert.equal(f.orderCount, 3);
  assert.equal(f.lastQuantity, 4);
  assert.equal(f.window, null);
});
test("missing, malformed, impossible and future invoice dates cannot become predictors", () => {
  const rows = [
    row("a", null),
    row("b", "2026-02-30"),
    row("c", "tomorrow"),
    row("d", "2026-11-07"),
  ];
  const f = forecastReorder(rows, "2026-11-06");
  assert.equal(f.datedOrderCount, 0);
  assert.equal(f.window, null);
  assert.equal(allowedInsightAction(f), "build_history");
  assert.throws(() => forecastReorder([], "invalid"));
});
test("irregular gaps and substantially different quantities suppress timing", () => {
  const f = forecastReorder(
    ["2026-09-01", "2026-10-10", "2026-10-17", "2026-10-24"].map((d, i) =>
      row(String(i), d),
    ),
    "2026-11-06",
  );
  assert.equal(f.status, "irregular");
  assert.equal(f.window, null);
  const rows = weekly();
  rows[3].qty = 5;
  const q = forecastReorder(rows, "2026-11-06");
  assert.equal(q.status, "quantity_changed");
  assert.equal(q.window, null);
});
test("uncertain product identity and stale histories do not imply a purchase is due", () => {
  const rows = weekly();
  rows[1].retail_product = { identity_confident: false };
  assert.equal(
    forecastReorder(rows, "2026-11-06").status,
    "identity_uncertain",
  );
  const stale = forecastReorder(weekly(), "2026-12-01");
  assert.equal(stale.status, "stale");
  assert.equal(stale.window, null);
  assert.equal(forecastReorder(weekly(), "2026-10-31").status, "upcoming");
});
test("non-positive charges and unknown/non-positive quantities cannot create cadence evidence", () => {
  const rows = [
    ...weekly().slice(0, 3),
    row("x", "2026-10-30", null),
    row("y", "2026-10-31", 0),
    row("z", "2026-11-01", 2, { extended_price: -10 }),
  ];
  assert.equal(forecastReorder(rows, "2026-11-06").datedOrderCount, 3);
});
