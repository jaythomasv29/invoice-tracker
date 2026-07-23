import { FREE_MONTHLY_EXTRACTION_CAP } from '../lib/entitlements';

// Copy + comparison data for the paywall and the Subscription row. The two
// upgrade triggers are deliberately separate: extraction volume is the cost
// gate, while price-creep alerts + total spend tracking are the features people
// actually upgrade for.

export const PRO_PRICE_LABEL = '$29/mo'; // placeholder — real price comes from billing later

export interface PlanFeature {
  label: string;
  // Cell text. `true`/`false` render as a check / lock; a string renders verbatim.
  free: string | boolean;
  pro: string | boolean;
  // Highlight the rows that are the real Pro differentiators.
  differentiator?: boolean;
  // Decided for Pro but not shipped yet — render a "Soon" tag so the paywall
  // stays honest. See PLAN_STRATEGY.md for the roadmap.
  comingSoon?: boolean;
}

// The decided Free/Pro split (see PLAN_STRATEGY.md for the rationale). Basics
// first, building to the flagship (recipe costing) as the crescendo.
export const PLAN_FEATURES: PlanFeature[] = [
  {
    label: 'Capture + extraction',
    free: `${FREE_MONTHLY_EXTRACTION_CAP}/month`,
    pro: 'Unlimited',
  },
  { label: 'Notes on entries', free: true, pro: true },
  { label: 'Vendor-grouped storage & history', free: true, pro: true },
  { label: 'Price-creep alerts', free: false, pro: true, differentiator: true },
  { label: 'Total spend + trends across vendors', free: false, pro: true, differentiator: true },
  { label: 'Spend by category', free: false, pro: true },
  { label: 'Top-spend items (80/20)', free: false, pro: true },
  { label: 'Missing-invoice alerts', free: false, pro: true },
  {
    label: 'AI recipe costing — true cost per dish',
    free: false,
    pro: true,
    differentiator: true,
  },
];

export const PAYWALL_HEADLINE = 'Know your true costs. Catch every overcharge.';
export const PAYWALL_SUBHEAD =
  'Pro watches every invoice for quiet price hikes, tracks where your money goes across every vendor, and prices out what each dish actually costs you.';
