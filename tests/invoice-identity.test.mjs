import test from "node:test";
import assert from "node:assert/strict";
import { compareInvoiceIdentity } from "../supabase/functions/_shared/invoiceIdentity.ts";
const base = {
  vendor: "S.J. Foods",
  number: "INV-001",
  date: "2026-11-01",
  total: 60,
};
test("same vendor/invoice is recognized despite formatting differences", () =>
  assert.equal(
    compareInvoiceIdentity(base, {
      ...base,
      vendor: "S. J. Foods",
      number: "INV 001",
    }),
    "same",
  ));
test("different invoice numbers are not duplicates even with same date/total", () =>
  assert.equal(
    compareInvoiceIdentity(base, { ...base, number: "INV-002" }),
    null,
  ));
test("reused numbers on different dates remain separate", () =>
  assert.equal(
    compareInvoiceIdentity(base, { ...base, date: "2025-11-01" }),
    null,
  ));
test("matching date/total without a number is only a possible duplicate", () =>
  assert.equal(
    compareInvoiceIdentity(base, { ...base, number: null }),
    "possible",
  ));
