import test from "node:test";
import assert from "node:assert/strict";
import { buildDemoLedger, localIso } from "../lib/demoLedger.ts";
import { groupPriceAlerts } from "../lib/priceAlertGroups.ts";
import { initialsFor } from "../lib/initials.ts";

const NOWS = [new Date(2026, 10, 7, 11), new Date(2026, 11, 1, 8), new Date(2027, 0, 4, 15), new Date(2026, 1, 28, 19)];
const sumBetween = (ledger, from, to) =>
  ledger.invoices.filter((i) => i.dateIso >= from && i.dateIso <= to).reduce((s, i) => s + i.total, 0);

test("sample restaurant spends ~$38–42k in the prior full month and ~$9–10k a typical week", () => {
  for (const now of NOWS) {
    const ledger = buildDemoLedger(now);
    const prev = sumBetween(ledger, localIso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), localIso(new Date(now.getFullYear(), now.getMonth(), 0)));
    assert.ok(prev >= 37000 && prev <= 43000, `prior month ${prev} on ${now.toDateString()}`);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 56);
    const avgWeek = sumBetween(ledger, localIso(start), localIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) / 8;
    assert.ok(avgWeek >= 8500 && avgWeek <= 10500, `avg week ${avgWeek}`);
  }
});

test("every line multiplies out and every invoice foots", () => {
  const ledger = buildDemoLedger(NOWS[0]);
  for (const inv of ledger.invoices) {
    assert.ok(inv.lines.length >= 6 && inv.lines.length <= 18, `${inv.id} has ${inv.lines.length} lines`);
    for (const l of inv.lines) assert.equal(l.ext, Math.round(l.qty * l.unitPrice * 100) / 100, `${inv.id} ${l.name}`);
    const subtotal = Math.round(inv.lines.reduce((s, l) => s + l.ext, 0) * 100) / 100;
    assert.equal(inv.subtotal, subtotal);
    assert.equal(inv.total, Math.round((inv.subtotal + inv.tax) * 100) / 100);
  }
});

test("price alerts tell a multi-increase creep story that matches the invoices", () => {
  for (const now of NOWS) {
    const ledger = buildDemoLedger(now);
    const groups = groupPriceAlerts(ledger.alerts);
    const streak = groups.find((g) => g.increases >= 3);
    assert.ok(streak, "a product crept up at least 3 times");
    assert.equal(streak.latest.itemName, "Chicken Thigh, Boneless Skinless");
    assert.equal(Math.round(streak.totalPct * 10) / 10, 19.8);
    assert.ok(groups.length >= 4 && groups.length <= 6);
    for (const a of ledger.alerts) {
      const at = (date, price) => ledger.invoices.some((i) => i.vendorId === a.vendorId && i.dateIso === date && i.lines.some((l) => l.name === a.itemName && l.unit === a.unit && l.unitPrice === price));
      assert.ok(at(a.priceDate, a.newPrice), `${a.id} new price on its invoice`);
      assert.ok(at(a.previousPriceDate, a.previousPrice), `${a.id} previous price on its invoice`);
    }
  }
});

test("review-screen invoice content does not depend on the date", () => {
  const [a, b] = [NOWS[0], NOWS[2]].map((now) => buildDemoLedger(now).invoices.find((i) => i.vendor === "cascade" && i.k === 0));
  assert.deepEqual(a.lines, b.lines);
  assert.equal(a.invoiceNumber, b.invoiceNumber);
  assert.equal(a.total, b.total);
});

test("initials skip punctuation-only words", () => {
  assert.equal(initialsFor("Willow & Pine Kitchen"), "WP");
  assert.equal(initialsFor("  sift  "), "S");
  assert.equal(initialsFor("(Main) Street Café"), "MS");
});
