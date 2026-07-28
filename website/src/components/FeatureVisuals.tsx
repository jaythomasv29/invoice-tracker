/**
 * Lightweight UI mockups for each feature section — built from plain divs so
 * they stay crisp at any size and match the Sift app's surface styling
 * (rounded cards, hairline borders, brand-green accents). No screenshots.
 */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-3xl border border-border bg-surface p-5 shadow-xl shadow-black/[0.06]">
      {children}
    </div>
  );
}

export function ScanVisual() {
  const rows = [
    { name: "Roma Tomatoes, 25 lb", price: "$34.50" },
    { name: "Olive Oil X-Virgin, 3 L", price: "$41.20" },
    { name: "Chicken Thigh, boneless", price: "$78.00" },
    { name: "Basmati Rice, 20 lb", price: "$29.75" },
  ];
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Sysco — Invoice #48213</div>
          <div className="text-xs text-muted">Extracted in 4.2s</div>
        </div>
        <span className="rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-bold text-brand-dark">
          12 line items
        </span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between py-2.5">
            <span className="text-sm text-foreground/90">{r.name}</span>
            <span className="text-sm font-semibold tabular-nums">{r.price}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted">Invoice total</span>
        <span className="text-base font-bold tabular-nums">$1,284.65</span>
      </div>
    </Card>
  );
}

export function AlertVisual() {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#E07A30" }} />
        <span className="text-sm font-semibold">Price alerts</span>
        <span className="ml-auto text-xs text-muted">this month</span>
      </div>
      {[
        { name: "Chicken Thigh, boneless", from: "$1.62/lb", to: "$1.94/lb", pct: "+19.8%" },
        { name: "Olive Oil X-Virgin", from: "$38.10", to: "$41.20", pct: "+8.1%" },
        { name: "Roma Tomatoes, 25 lb", from: "$31.00", to: "$34.50", pct: "+11.3%" },
      ].map((r) => (
        <div key={r.name} className="flex items-center justify-between rounded-2xl px-3 py-3 [&:not(:last-child)]:mb-2" style={{ background: "#FDF0E6" }}>
          <div>
            <div className="text-sm font-semibold text-foreground">{r.name}</div>
            <div className="text-xs text-muted">
              {r.from} <span className="mx-1">→</span> {r.to}
            </div>
          </div>
          <span className="text-sm font-bold" style={{ color: "#E07A30" }}>
            {r.pct}
          </span>
        </div>
      ))}
    </Card>
  );
}

export function VerifyVisual() {
  const items = [
    { name: "Roma Tomatoes, 25 lb", ok: true },
    { name: "Olive Oil X-Virgin, 3 L", ok: true },
    { name: "Chicken Thigh, boneless", ok: false },
    { name: "Basmati Rice, 20 lb", ok: true },
  ];
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold">Delivery check</span>
        <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#FDECEA", color: "#D94F3A" }}>
          1 missing
        </span>
      </div>
      <div className="space-y-2.5">
        {items.map((it) => (
          <div key={it.name} className="flex items-center gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{ background: it.ok ? "var(--color-brand)" : "#D94F3A" }}
            >
              {it.ok ? "✓" : "✕"}
            </span>
            <span className={`text-sm ${it.ok ? "text-foreground/90" : "text-foreground line-through decoration-[#D94F3A]/60"}`}>
              {it.name}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RecipeVisual() {
  const ingredients = [
    { name: "Rice noodles", cost: "$0.62" },
    { name: "Chicken thigh", cost: "$1.18" },
    { name: "Egg + tofu", cost: "$0.71" },
    { name: "Tamarind + sauce", cost: "$0.61" },
  ];
  return (
    <Card>
      <div className="mb-1 text-sm font-semibold">Pad Thai</div>
      <div className="mb-4 flex items-end gap-2">
        <span className="text-4xl font-extrabold tracking-tight tabular-nums">$3.12</span>
        <span className="mb-1 text-sm text-muted">true plate cost</span>
      </div>
      <div className="mb-4 space-y-2">
        {ingredients.map((r) => (
          <div key={r.name} className="flex items-center justify-between">
            <span className="text-sm text-foreground/90">{r.name}</span>
            <span className="text-sm font-medium tabular-nums text-muted">{r.cost}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-brand-light px-4 py-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Food cost</div>
          <div className="text-xs text-brand-dark/70">at $12.00 menu price</div>
        </div>
        <span className="text-xl font-extrabold text-brand-dark tabular-nums">26%</span>
      </div>
    </Card>
  );
}
