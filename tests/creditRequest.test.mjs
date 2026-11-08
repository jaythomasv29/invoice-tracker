import test from "node:test";
import assert from "node:assert/strict";
import { buildCreditRequestMessage, creditTotal } from "../lib/creditRequestMessage.ts";

const lines = [
  { id: "a", desc: "Chicken Thigh Boneless", qty: 2, unit: "CS", ext: 1234.5 },
  { id: "b", desc: "Romaine Hearts", qty: 1, unit: "CS", ext: 38.25 },
];

test("credit request lists every missing line with a comma-formatted total", () => {
  const msg = buildCreditRequestMessage({
    vendorName: "Pinnacle Foods", invoiceNumber: "88412", date: "Nov 5, 2026",
    restaurantName: "Willow & Pine Kitchen", lines,
  });
  assert.match(msg, /^Hi Pinnacle Foods,/);
  assert.match(msg, /invoice #88412 dated Nov 5, 2026, the following 2 items were billed but not received/);
  assert.match(msg, /• Chicken Thigh Boneless — 2 CS \(\$1,234.50\)/);
  assert.match(msg, /Total: \$1,272.75/);
  assert.match(msg, /Willow & Pine Kitchen$/);
});

test("single item and missing invoice number read naturally", () => {
  const msg = buildCreditRequestMessage({ vendorName: "", invoiceNumber: "", date: "", lines: [lines[1]] });
  assert.match(msg, /^Hi there,/);
  assert.match(msg, /On our invoice, the following item was billed/);
});

test("creditTotal rounds to cents and ignores non-finite amounts", () => {
  assert.equal(creditTotal([{ ext: 0.1 }, { ext: 0.2 }, { ext: NaN }]), 0.3);
});
