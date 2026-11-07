import test from "node:test";
import assert from "node:assert/strict";
import { buildHouseholdLedger, DEMO_STORES, DEMO_HOUSEHOLD_HORIZON_DAYS } from "../lib/demoHousehold.ts";
import { localIso } from "../lib/demoLedger.ts";
import { buildPriceWatch } from "../lib/householdPriceWatch.ts";
import { groupPriceAlerts } from "../lib/priceAlertGroups.ts";
import { HOUSEHOLD_CATEGORIES } from "../shared/categories.ts";
import { comparablePrice } from "../shared/receiptComparison.ts";

const NOWS = [new Date(2026, 10, 7, 15), new Date(2026, 11, 1, 8), new Date(2027, 0, 4, 15), new Date(2026, 1, 28, 19), new Date(2026, 6, 15, 12)];
const sumBetween = (ledger, from, to) =>
  ledger.invoices.filter((i) => i.dateIso >= from && i.dateIso <= to).reduce((s, i) => s + i.total, 0);
const watchRows = (ledger) =>
  ledger.invoices.flatMap((inv) =>
    inv.lines.map((l) => ({
      invoice_id: inv.id, clean_name: l.name, qty: l.qty, extended_price: l.ext, retail_product: l.retail,
      invoices: { invoice_date: inv.dateIso, created_at: inv.createdAt, vendor_id: inv.vendorId },
    })),
  );

test("sample household spends ~$900–1,300 in the prior full month over ~6–9 weeks of receipts", () => {
  for (const now of NOWS) {
    const ledger = buildHouseholdLedger(now);
    const prev = sumBetween(ledger, localIso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), localIso(new Date(now.getFullYear(), now.getMonth(), 0)));
    assert.ok(prev >= 900 && prev <= 1300, `prior month ${prev.toFixed(2)} on ${now.toDateString()}`);
    const oldest = ledger.invoices.reduce((m, i) => Math.max(m, i.daysAgo), 0);
    assert.ok(oldest >= 42 && oldest <= DEMO_HOUSEHOLD_HORIZON_DAYS, `history spans ${oldest} days`);
    // Personal Pro allows 40 scans a month; a believable household stays well under.
    const thisMonth = ledger.invoices.filter((i) => i.dateIso >= localIso(new Date(now.getFullYear(), now.getMonth(), 1))).length;
    assert.ok(thisMonth <= 20, `${thisMonth} receipts this month`);
  }
});

test("every receipt line multiplies out and every receipt foots", () => {
  for (const now of NOWS) {
    for (const inv of buildHouseholdLedger(now).invoices) {
      assert.ok(inv.lines.length >= 3, `${inv.id} has ${inv.lines.length} lines`);
      for (const l of inv.lines) {
        assert.equal(l.ext, Math.round(l.qty * l.unitPrice * 100) / 100, `${inv.id} ${l.name}`);
        assert.ok(l.ext > 0 && l.unitPrice > 0);
        if (l.unit === "LB") assert.equal(Math.round(l.qty * 100) / 100, l.qty, "weighed to the hundredth");
        else assert.ok(Number.isInteger(l.qty), `${l.name} counted in whole units`);
        if (l.retail) assert.equal(l.retail.net_line_total, l.ext, "net line total is what was paid");
        assert.ok(HOUSEHOLD_CATEGORIES.includes(l.category), `${l.name}: ${l.category}`);
      }
      const subtotal = Math.round(inv.lines.reduce((s, l) => s + l.ext, 0) * 100) / 100;
      assert.equal(inv.subtotal, subtotal);
      assert.equal(inv.total, Math.round((inv.subtotal + inv.tax) * 100) / 100);
      assert.ok(new Date(inv.createdAt) <= now, "never scanned in the future");
    }
  }
});

test("realistic household lines: sub-$1 unit prices and only fictional stores", () => {
  const ledger = buildHouseholdLedger(NOWS[0]);
  const lines = ledger.invoices.flatMap((i) => i.lines);
  assert.ok(lines.some((l) => l.unitPrice < 1 && l.unit === "LB"), "e.g. bananas by the pound");
  assert.ok(lines.some((l) => l.unitPrice < 1 && l.unit === "EA"), "e.g. limes each");
  const names = new Set(ledger.invoices.map((i) => i.vendorName));
  assert.deepEqual([...names].sort(), Object.values(DEMO_STORES).map((s) => s.name).sort());
  // Retail identities are invented store SKUs, never barcodes.
  for (const l of lines) if (l.retail) { assert.equal(l.retail.barcode, undefined); assert.match(l.retail.store_sku, /^(GW|CC|CW)-\d+$/); }
});

test("household alerts are real net-unit-price increases between dated purchases", () => {
  for (const now of NOWS) {
    const ledger = buildHouseholdLedger(now);
    assert.ok(ledger.alerts.length >= 4, `${ledger.alerts.length} alerts`);
    for (const a of ledger.alerts) {
      assert.ok(a.pctChange > 3 && a.newPrice > a.previousPrice);
      assert.ok(["each", "100g", "100ml"].includes(a.unit), a.unit);
      assert.ok(a.previousPriceDate < a.priceDate);
      const inv = ledger.invoices.find((i) => i.vendorId === a.vendorId && i.dateIso === a.priceDate);
      const line = inv.lines.find((l) => l.name === a.itemName);
      assert.equal(comparablePrice(line.retail, line.qty, line.ext, inv.vendorId).price, a.newPrice);
    }
    const eggs = groupPriceAlerts(ledger.alerts).find((g) => g.latest.itemName === "Large Eggs, 12 ct");
    assert.ok(eggs && eggs.increases === 2, "eggs crept up twice");
  }
  const nov = buildHouseholdLedger(NOWS[0]);
  assert.ok(nov.alerts.filter((a) => !a.read).length >= 2, "some increases are new this week");
});

test("the Home price watch ranks repeat purchases with the biggest moves", () => {
  const watch = buildPriceWatch(watchRows(buildHouseholdLedger(NOWS[0])));
  assert.equal(watch.length, 4);
  assert.equal(watch[0].name, "Large Eggs, 12 ct");
  assert.ok(watch.every((w) => w.count > 1));
  assert.equal(Math.round((watch[0].last / watch[0].first - 1) * 1000) / 10, 20.1);
});

test("deterministic: the k-th most recent trip has the same lines on any day", () => {
  const a = buildHouseholdLedger(NOWS[0]).invoices.find((i) => i.id === "demo-rcpt-greenway-1");
  const b = buildHouseholdLedger(new Date(2026, 10, 14, 15)).invoices.find((i) => i.id === "demo-rcpt-greenway-1");
  assert.deepEqual(a.lines, b.lines);
  assert.notEqual(a.dateIso, b.dateIso);
});
