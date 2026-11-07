/** "1,234.50": two decimals with thousands separators (prefix "$" yourself). */
export function money2(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
