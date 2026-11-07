// "Willow & Pine Kitchen" → "WP": words without a letter or digit ('&', '-',
// '·') are skipped, and leading punctuation ("(Main)") is ignored.
export function initialsFor(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .split(/\s+/)
    .map((w) => w.match(/[\p{L}\p{N}]/u)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
