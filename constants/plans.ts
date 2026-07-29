import { PLAN_INVOICE_CAPS } from '../lib/entitlements';

// Copy + comparison data for the paywall and the Subscription row. Three tiers
// at launch (Free / Plus / Pro), monthly only — annual is deferred. The two
// paid tiers share the same feature set and differ only by monthly invoice
// volume (the cost gate); price-creep alerts, spend tracking, and recipe costing
// are the reasons to leave Free. If you later want a Pro-only feature, flip its
// `plus` cell to false and gate it on `isPro` (not `isPaid`) in the app.

// Placeholder labels shown only until RevenueCat returns the real store-localized
// prices (Apple requires displaying the actual price). Monthly only for launch.
export const PLUS_PRICE_LABEL = '$8.99/mo';
export const PRO_PRICE_LABEL = '$24.99/mo';

export interface PlanFeature {
  label: string;
  // Cell text. `true`/`false` render as a check / lock; a string renders verbatim.
  free: string | boolean;
  plus: string | boolean;
  pro: string | boolean;
  // Highlight the rows that are the real reasons to upgrade off Free.
  differentiator?: boolean;
  // Decided but not shipped yet — renders a "Soon" tag so the paywall stays honest.
  comingSoon?: boolean;
}

export const PLAN_FEATURES: PlanFeature[] = [
  {
    label: 'Invoices / month',
    free: `${PLAN_INVOICE_CAPS.free}`,
    plus: `${PLAN_INVOICE_CAPS.plus}`,
    pro: `${PLAN_INVOICE_CAPS.pro}`,
    differentiator: true,
  },
  { label: 'Notes on entries', free: true, plus: true, pro: true },
  { label: 'Vendor-grouped storage & history', free: true, plus: true, pro: true },
  { label: 'Price-creep alerts', free: false, plus: true, pro: true, differentiator: true },
  { label: 'Total spend + trends across vendors', free: false, plus: true, pro: true, differentiator: true },
  { label: 'Spend by category', free: false, plus: true, pro: true },
  { label: 'Top-spend items (80/20)', free: false, plus: true, pro: true },
  { label: 'Missing-invoice alerts', free: false, plus: true, pro: true },
  { label: 'AI recipe costing — true cost per dish', free: false, plus: true, pro: true, differentiator: true },
];

export const PAYWALL_HEADLINE = 'Know your true costs. Catch every overcharge.';
export const PAYWALL_SUBHEAD =
  'Plus and Pro watch every invoice for quiet price hikes, track where your money goes across every vendor, and price out what each dish actually costs you — Pro just fits more invoices each month.';
