import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSpend } from "../lib/spendSummary.ts";
const now = new Date(2026, 10, 1, 12);
const row = (id, date, total, vendor = "a") => ({
  id,
  invoice_date: date,
  total,
  vendor_id: vendor,
  created_at: new Date(2026, 10, 1, 12).toISOString(),
});
test("historical invoices use invoice date while current vendors aggregate together", () => {
  const invoices = [
    row("old", "2026-10-01", 40),
    row("a", "2026-11-01", 12),
    row("b", "2026-11-01", 18, "b"),
  ];
  const month = summarizeSpend(invoices, "month", 0, now);
  assert.equal(month.total, 30);
  assert.equal(month.count, 2);
  assert.equal(month.vendors.length, 2);
  assert.equal(month.allTotal, 70);
  assert.equal(summarizeSpend(invoices, "month", -1, now).total, 40);
});
test("calendar week crosses the month and missing dates explicitly use local upload date", () => {
  const invoices = [row("oct", "2026-10-31", 10), row("missing", null, 20)];
  assert.equal(summarizeSpend(invoices, "week", 0, now).total, 30);
  const daily = summarizeSpend(invoices, "day", 0, now);
  assert.equal(daily.total, 20);
  assert.equal(daily.fallbackCount, 1);
});
test("repeated IDs cannot inflate metrics and credits reduce spending", () => {
  const invoices = [
    row("a", "2026-11-01", 20),
    row("a", "2026-11-01", 20),
    row("credit", "2026-11-01", -5),
  ];
  assert.equal(summarizeSpend(invoices, "month", 0, now).total, 15);
  assert.equal(summarizeSpend(invoices, "month", 0, now).count, 2);
});
test("more than one thousand invoices remain in historical totals", () => {
  const invoices = Array.from({ length: 1005 }, (_, i) =>
    row(String(i), "2026-11-01", 1),
  );
  assert.equal(summarizeSpend(invoices, "month", 0, now).total, 1005);
});
