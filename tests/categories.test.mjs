import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCategory, categoryLabel } from "../shared/categories.ts";

test("household receipts keep household categories, snapped to the list", () => {
  assert.equal(normalizeCategory("dairy_eggs", true), "dairy_eggs");
  assert.equal(normalizeCategory("Meat & Seafood", true), "meat_seafood");
  assert.equal(normalizeCategory("Dairy/Eggs", true), "dairy_eggs");
  assert.equal(normalizeCategory("toiletries", true), "toiletries");
  assert.equal(normalizeCategory("dry_goods", true), "other");
  assert.equal(normalizeCategory(undefined, true), "other");
});

test("business invoices keep the distributor list", () => {
  assert.equal(normalizeCategory("Dry Goods", false), "dry_goods");
  assert.equal(normalizeCategory("dairy_eggs", false), "other");
  assert.equal(normalizeCategory("paper-packaging", false), "paper_packaging");
});

test("labels read naturally and are idempotent on display labels", () => {
  assert.equal(categoryLabel("dairy_eggs"), "Dairy & Eggs");
  assert.equal(categoryLabel("meat_seafood"), "Meat & Seafood");
  assert.equal(categoryLabel("dry_goods"), "Dry Goods");
  assert.equal(categoryLabel("Dairy & Eggs"), "Dairy & Eggs");
  assert.equal(categoryLabel(null), "Other");
});
