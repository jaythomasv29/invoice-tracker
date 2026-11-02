export type InvoiceIdentity = {
  vendor: string;
  number?: string | null;
  date?: string | null;
  total?: number | null;
};
const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export function compareInvoiceIdentity(
  a: InvoiceIdentity,
  b: InvoiceIdentity,
): "same" | "possible" | null {
  if (!normalize(a.vendor) || normalize(a.vendor) !== normalize(b.vendor))
    return null;
  const an = normalize(a.number ?? ""),
    bn = normalize(b.number ?? "");
  if (an && bn)
    return an === bn && (!a.date || !b.date || a.date === b.date)
      ? "same"
      : null;
  return a.date &&
    a.date === b.date &&
    a.total != null &&
    b.total != null &&
    Math.abs(a.total - b.total) < 0.01
    ? "possible"
    : null;
}
