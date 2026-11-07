// Deterministic post-processing of a model extraction, before anything is
// written. Each rule here maps to a failure seen on real invoices (Thaiphoon,
// Nov 2026) — keep them narrow and explainable, never "fix" a printed number.

export type RawLine = {
  description: string;
  clean_name: string;
  item_code?: string;
  quantity: number;
  unit_of_measure: string;
  unit_price: number;
  extended_price: number;
  line_item_type: 'charge' | 'credit';
  category?: string;
  confidence: number;
  low_confidence_fields?: string[];
  pricing_basis?: 'per_unit' | 'per_weight';
  catch_weight?: number;
  weight_unit?: 'lb' | 'kg';
  [k: string]: unknown;
};

export type RepairedLine = RawLine & {
  parsed_weight: number | null;
  weight_source: 'structured_field' | 'none';
  weight_basis: 'catch_weight' | null;
  normalized_price_per_lb: number | null;
};

const KG_TO_LB = 2.20462;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.02, Math.abs(b) * 0.01);
const isLbUnit = (u: string) => /^(lb|lbs|#|pound|pounds)$/i.test(u.trim().replace(/\.$/, ''));

// A row with nothing priced on it and no item code is description overflow
// from the row above (wrapped text / page break) — e.g. the "$0 Eggs" line that
// a reviewer then typed $17.50 into, overstating the invoice.
function isOverflowRow(li: RawLine): boolean {
  return num(li.extended_price) === 0 && num(li.unit_price) === 0 && num(li.quantity) === 0 && !li.item_code?.trim();
}

export function repairLineItems(lines: RawLine[]): { lines: RepairedLine[]; mergedOverflowRows: number } {
  const out: RepairedLine[] = [];
  let merged = 0;
  for (const raw of lines ?? []) {
    if (isOverflowRow(raw) && out.length > 0) {
      const prev = out[out.length - 1];
      prev.description = `${prev.description} ${raw.description}`.trim();
      merged++;
      continue;
    }
    const li: RepairedLine = {
      ...raw,
      unit_of_measure: raw.unit_of_measure ?? '',
      low_confidence_fields: [...(raw.low_confidence_fields ?? [])],
      parsed_weight: null,
      weight_source: 'none',
      weight_basis: null,
      normalized_price_per_lb: null,
    };
    const flag = (...fields: string[]) => {
      for (const f of fields) if (!li.low_confidence_fields!.includes(f)) li.low_confidence_fields!.push(f);
      li.confidence = Math.min(num(li.confidence) || 1, 0.5);
    };

    const qty = num(li.quantity), price = num(li.unit_price), ext = num(li.extended_price);
    const weight = num(li.catch_weight) * (li.weight_unit === 'kg' ? KG_TO_LB : 1);

    if (li.pricing_basis === 'per_weight' && weight > 0) {
      // Catch weight: compare and cost per pound, keep the case count in text.
      li.weight_basis = 'catch_weight';
      li.weight_source = 'structured_field';
      li.parsed_weight = round(weight, 3);
      const perLb = li.weight_unit === 'kg' ? price / KG_TO_LB : price;
      li.normalized_price_per_lb = round(perLb, 4);
      li.description = `${li.description} (${qty} ${li.unit_of_measure || 'unit'} @ ${round(weight, 3)} lb)`.trim();
      li.quantity = round(weight, 3);
      li.unit_of_measure = 'LB';
      li.unit_price = round(perLb, 4);
      if (!close(li.quantity * li.unit_price, ext)) flag('catch_weight', 'unit_price');
    } else {
      if (isLbUnit(li.unit_of_measure) && price > 0) {
        li.parsed_weight = qty || null;
        li.weight_source = 'structured_field';
        li.normalized_price_per_lb = price;
      }
      // Math doesn't hold → most likely an unflagged catch-weight or misread.
      if (ext !== 0 && price !== 0 && qty !== 0 && !close(qty * price, ext)) flag('quantity', 'unit_price');
    }
    out.push(li);
  }
  return { lines: out, mergedOverflowRows: merged };
}

function round(n: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// Missing pages: "Page 3 of 4" printed but only pages 1–3 photographed.
export function missingPages(pageInfo: Array<{ page?: number; of?: number }> | undefined): number[] {
  const seen = new Set<number>();
  let total = 0;
  for (const p of pageInfo ?? []) {
    if (num(p.page) > 0) seen.add(num(p.page));
    total = Math.max(total, num(p.of));
  }
  if (!total || total > 20) return [];
  const missing: number[] = [];
  for (let n = 1; n <= total; n++) if (!seen.has(n)) missing.push(n);
  return missing;
}

// --- Vendor resolution ------------------------------------------------------

export type VendorRow = { id: string; name: string; aliases?: string[] | null; contact_phone?: string | null; account_number?: string | null };
export type ExtractedVendor = { name?: string; contact_phone?: string; account_number?: string; name_visible?: boolean };

// Letters/digits only, so "S. J. Distributors, LLC" == "S.J. Distributors LLC"
// (same rule the commit-time duplicate check uses in SQL).
export function normalizeVendorName(name: string): string {
  return (name ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
const phoneKey = (p?: string | null) => {
  const d = (p ?? '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : null;
};
const accountKey = (a?: string | null) => {
  const k = (a ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return k.length >= 3 ? k : null;
};

export const UNKNOWN_VENDOR_NAME = 'Unknown vendor';
export function isPlaceholderVendorName(name?: string): boolean {
  const n = (name ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return !n || ['unknown', 'unknownvendor', 'na', 'none', 'notvisible', 'illegible', 'vendor'].includes(n);
}

export type VendorMatch =
  | { kind: 'name'; vendor: VendorRow }
  | { kind: 'contact'; vendor: VendorRow }
  | { kind: 'none' };

// Name (or alias) wins when the name was actually printed. Otherwise — or when
// the name matches nothing — the vendor's printed phone or the restaurant's
// account number with that vendor identifies it (the Ocean Paradise invoice
// whose logo was under the clip was filed as an invented "Sysco San Francisco"
// despite carrying Ocean Paradise's phone and account number).
export function matchVendor(extracted: ExtractedVendor, vendors: VendorRow[]): VendorMatch {
  const target = normalizeVendorName(extracted.name ?? '');
  const byName = target && !isPlaceholderVendorName(extracted.name)
    ? vendors.find((v) => normalizeVendorName(v.name) === target || (v.aliases ?? []).some((a) => normalizeVendorName(a) === target))
    : undefined;
  if (byName && extracted.name_visible !== false) return { kind: 'name', vendor: byName };

  // A printed-but-unknown name needs BOTH phone and account to agree (two
  // independent signals) before we override it — a single shared number (e.g.
  // the restaurant's own phone mis-read as the vendor's) must never pull a
  // genuinely new vendor under an existing one. An obscured/placeholder name
  // can be identified by either signal alone, if it's unambiguous.
  const phone = phoneKey(extracted.contact_phone);
  const account = accountKey(extracted.account_number);
  const nameTrusted = extracted.name_visible !== false && !isPlaceholderVendorName(extracted.name);
  const byContact = vendors.filter((v) => {
    const phoneHit = !!phone && phoneKey(v.contact_phone) === phone;
    const accountHit = !!account && accountKey(v.account_number) === account;
    return nameTrusted ? phoneHit && accountHit : phoneHit || accountHit;
  });
  if (byContact.length === 1) return { kind: 'contact', vendor: byContact[0] };

  if (byName) return { kind: 'name', vendor: byName };
  return { kind: 'none' };
}
