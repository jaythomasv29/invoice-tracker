import {
  WORKSPACE_PLANS,
  type AccountType,
} from '../shared/workspacePolicy.ts';
export const PLUS_PRICE_LABEL = '$8.99/mo'; // retired legacy plan
export const PRO_PRICE_LABEL = '$9.99/mo'; // marketing only; purchase UI uses StoreKit
export interface PlanFeature {
  label: string;
  free: string | boolean;
  plus: string | boolean;
  pro: string | boolean;
  differentiator?: boolean;
  comingSoon?: boolean;
}
export function featuresFor(type: AccountType): PlanFeature[] {
  const p = WORKSPACE_PLANS[type];
  const personal = type === 'personal';
  const row = (
    label: string,
    free: string | boolean,
    pro: string | boolean,
    differentiator = false,
  ) => ({ label, free, plus: pro, pro, differentiator });
  return [
    row(
      personal ? 'Receipts / month' : 'Invoices / month',
      `${p.free.scans}`,
      `${p.pro.scans}`,
      true,
    ),
    row('Saved history & basic spending', true, true),
    row(
      personal ? 'Store-grouped receipts' : 'Supplier-grouped invoices',
      true,
      true,
    ),
    row('CSV export', true, true),
    row('Product carousel & purchase history', true, true),
    row('AI product reviews / month', false, '60', true),
    row('Item price alerts', false, true, true),
    row('Advanced spending trends', false, true, true),
    row('Category breakdowns', false, true),
    row('Top-spend items', false, true),
    ...(personal
      ? []
      : [
          row('Missing-invoice reminders', false, true),
          row('AI recipe drafts / month', false, '10', true),
        ]),
  ];
}
export const PLAN_FEATURES = featuresFor('business');
export const PAYWALL_HEADLINE = 'Clarity for every purchase.';
export const PAYWALL_SUBHEAD =
  'Keep your saved history, even when your subscription ends.';
