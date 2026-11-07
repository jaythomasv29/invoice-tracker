// Groups per-invoice price alerts into one price-creep story per product.
//
// The database records one alert per increase (one per delivery), so a
// product that crept up four times would otherwise appear as four separate
// rows, and "N items crept up" would count deliveries, not items. A group
// shows the latest increase plus the cumulative change across its streak.

export type AlertLike = {
  id: string;
  itemName: string;
  vendorId: string | null;
  vendorName: string;
  previousPrice: number;
  newPrice: number;
  unit: string;
  pctChange: number;
  read: boolean;
  priceDate?: string | null; // ISO yyyy-mm-dd of the delivery with the new price
  previousPriceDate?: string | null;
  detectedAt: string;
};

export type PriceAlertGroup<A extends AlertLike = AlertLike> = {
  key: string;
  latest: A;
  alerts: A[]; // oldest → newest
  ids: string[];
  firstPrice: number;
  firstDate: string | null;
  latestPrice: number;
  totalPct: number;
  increases: number;
  unread: boolean;
};

const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function groupPriceAlerts<A extends AlertLike>(alerts: A[]): PriceAlertGroup<A>[] {
  const byKey = new Map<string, A[]>();
  for (const a of alerts) {
    if (!(a.pctChange > 0)) continue;
    const key = `${a.vendorId ?? ''}|${norm(a.itemName)}|${norm(a.unit)}`;
    const list = byKey.get(key);
    if (list) list.push(a);
    else byKey.set(key, [a]);
  }
  const dateOf = (a: A) => a.priceDate ?? '';
  const groups: PriceAlertGroup<A>[] = [];
  for (const [key, list] of byKey) {
    list.sort((x, y) => dateOf(x).localeCompare(dateOf(y)) || x.id.localeCompare(y.id));
    const first = list[0];
    const latest = list[list.length - 1];
    const firstPrice = first.previousPrice;
    groups.push({
      key,
      latest,
      alerts: list,
      ids: list.map((a) => a.id),
      firstPrice,
      firstDate: first.previousPriceDate ?? null,
      latestPrice: latest.newPrice,
      totalPct: firstPrice > 0 ? ((latest.newPrice - firstPrice) / firstPrice) * 100 : latest.pctChange,
      increases: list.length,
      unread: list.some((a) => !a.read),
    });
  }
  // Newest increase first; undated (legacy) alerts last.
  return groups.sort((a, b) => dateOf(b.latest).localeCompare(dateOf(a.latest)) || b.totalPct - a.totalPct);
}

export function formatAlertDate(iso: string | null | undefined, fallback = ''): string {
  if (!iso) return fallback;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return fallback;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
