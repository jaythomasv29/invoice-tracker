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
export const PRO_PRICE_LABEL = '$19.99/mo';

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
  { label: 'Daily, weekly & monthly spending', free: true, plus: true, pro: true },
  { label: 'Notes on entries', free: true, plus: true, pro: true },
  { label: 'Vendor-grouped storage & history', free: true, plus: true, pro: true },
  { label: 'Price-creep alerts', free: false, plus: true, pro: true, differentiator: true },
  { label: 'Advanced spend trends', free: false, plus: true, pro: true, differentiator: true },
  { label: 'Spend by category', free: false, plus: true, pro: true },
  { label: 'Top-spend items (80/20)', free: false, plus: true, pro: true },
  { label: 'Missing-invoice alerts', free: false, plus: true, pro: true },
  { label: 'AI recipe costing — true cost per dish', free: false, plus: true, pro: true, differentiator: true },
];

export const PAYWALL_HEADLINE = 'Know your food costs. Spot supplier price changes.';
export const PAYWALL_SUBHEAD =
  'Pro tracks supplier price changes, shows spending across vendors, and helps cost dishes from your invoices. Includes 150 invoice scans and up to 25 AI recipe drafts per calendar month.';
