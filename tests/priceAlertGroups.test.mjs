import test from "node:test";
import assert from "node:assert/strict";
import { groupPriceAlerts } from "../lib/priceAlertGroups.ts";

const a = (id, o) => ({ id, itemName: "Chicken Thigh, boneless", vendorId: "v1", vendorName: "Pinnacle", unit: "lb", read: true, detectedAt: "Nov 7", ...o });

// Real shape from Thaiphoon dev: four increases of one product, one alert each.
test("repeat increases of one product become one creep story", () => {
  const groups = groupPriceAlerts([
    a("4", { previousPrice: 1.84, newPrice: 1.94, pctChange: 5.43, priceDate: "2026-07-20", previousPriceDate: "2026-07-06", read: false }),
    a("1", { previousPrice: 1.62, newPrice: 1.68, pctChange: 3.7, priceDate: "2026-06-15", previousPriceDate: "2026-06-02" }),
    a("3", { previousPrice: 1.75, newPrice: 1.84, pctChange: 5.14, priceDate: "2026-07-06", previousPriceDate: "2026-06-29" }),
    a("2", { previousPrice: 1.68, newPrice: 1.75, pctChange: 4.17, priceDate: "2026-06-29", previousPriceDate: "2026-06-15" }),
    a("x", { itemName: "Lime", unit: "case", previousPrice: 22, newPrice: 23, pctChange: 4.55, priceDate: "2026-07-01" }),
  ]);
  assert.equal(groups.length, 2);
  const [chicken, lime] = groups;
  assert.equal(chicken.increases, 4);
  assert.equal(chicken.latest.id, "4");
  assert.equal(chicken.firstPrice, 1.62);
  assert.equal(chicken.latestPrice, 1.94);
  assert.equal(chicken.firstDate, "2026-06-02");
  assert.equal(Math.round(chicken.totalPct * 10) / 10, 19.8);
  assert.ok(chicken.unread);
  assert.deepEqual(chicken.ids, ["1", "2", "3", "4"]);
  assert.equal(lime.increases, 1);
});

test("same name at different vendors or units stays separate", () => {
  const groups = groupPriceAlerts([
    a("1", { previousPrice: 1, newPrice: 1.1, pctChange: 10, priceDate: "2026-07-01" }),
    a("2", { vendorId: "v2", previousPrice: 1, newPrice: 1.1, pctChange: 10, priceDate: "2026-07-01" }),
    a("3", { unit: "CS", previousPrice: 30, newPrice: 33, pctChange: 10, priceDate: "2026-07-01" }),
  ]);
  assert.equal(groups.length, 3);
});
