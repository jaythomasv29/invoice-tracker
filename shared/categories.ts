/** Line-item categories, shared by the native app and the extract-invoice Edge Function. */
export const BUSINESS_CATEGORIES = ['protein', 'produce', 'dairy', 'dry_goods', 'seafood', 'beverage', 'paper_packaging', 'cleaning', 'other'] as const;
export const HOUSEHOLD_CATEGORIES = ['produce', 'meat_seafood', 'dairy_eggs', 'bakery', 'pantry', 'frozen', 'beverages', 'cleaning', 'toiletries', 'household', 'other'] as const;

const key = (c: string | null | undefined) =>
  (c ?? '').toLowerCase().trim().replace(/&/g, ' ').replace(/[\s/-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

/** Snap a model-supplied category onto the workspace's fixed list ('other' when unknown). */
export function normalizeCategory(c: string | null | undefined, personal: boolean): string {
  const k = key(c);
  const list: readonly string[] = personal ? HOUSEHOLD_CATEGORIES : BUSINESS_CATEGORIES;
  return list.includes(k) ? k : 'other';
}

const LABELS: Record<string, string> = {
  meat_seafood: 'Meat & Seafood',
  dairy_eggs: 'Dairy & Eggs',
  paper_packaging: 'Paper & Packaging',
};

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return 'Other';
  const label = LABELS[key(category)];
  if (label) return label;
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
