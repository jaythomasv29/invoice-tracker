// RevenueCat / Apple IAP client wrapper — replaces the Stripe web-checkout path
// in lib/billing.ts (see IAP_MIGRATION_PLAN.md).
//
// Setup (see IAP_MIGRATION_PLAN.md):
//   1. `npx expo install react-native-purchases` (done).
//   2. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY in .env (RevenueCat public SDK key,
//      `appl_...` — public, safe to ship like the Clerk publishable key).
//   3. RevenueCat project: entitlements `plus` + `pro`; products
//      `sift_plus_monthly` + `sift_pro_monthly`; offering `default` exposing
//      them as the standard `$rc_monthly`… (see PAID_TIERS below). The
//      identifiers here must match the dashboard config exactly.
//
// Requires a dev/prod build — RevenueCat does not run in Expo Go.

import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import type { Plan } from './entitlements';

// The paid tiers, in ascending order. Each `entitlement` + `productId` must match
// the RevenueCat dashboard / App Store Connect exactly. Monthly only at launch —
// annual products are deferred (add `sift_*_annual` here when they ship).
export const PAID_TIERS: { plan: Extract<Plan, 'plus' | 'pro'>; entitlement: string; productId: string }[] = [
  { plan: 'plus', entitlement: 'plus', productId: 'sift_plus_monthly' },
  { plan: 'pro', entitlement: 'pro', productId: 'sift_pro_monthly' },
];

export type PaidTier = 'plus' | 'pro';

const RC_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

let configured = false;

// Call once at startup (app/_layout.tsx), before any other Purchases call.
// Idempotent — safe if a fast refresh re-runs it.
export function configurePurchases(): void {
  if (configured) return;
  // iOS-only for now (Android/web aren't launched). Leaving `configured` false
  // makes every other call in this module short-circuit to a no-op.
  if (Platform.OS !== 'ios') return;
  if (!RC_IOS_KEY) {
    // Fail soft in dev without a key rather than crashing startup — purchases
    // just won't work until the key is set. Mirrors the Sentry no-DSN pattern.
    console.warn('[purchases] EXPO_PUBLIC_REVENUECAT_IOS_KEY not set — IAP disabled');
    return;
  }
  Purchases.configure({ apiKey: RC_IOS_KEY });
  configured = true;
}

// Bind the RevenueCat identity to the Clerk *organization* id. The Pro plan is
// org-scoped (a restaurant subscribes, not a person), so the entitlement and
// the fulfillment webhook both key off the org id. Call whenever the active org
// changes; call signOutPurchases() when there's no org (signed out).
//
// See the org-vs-Apple-ID caveat in IAP_MIGRATION_PLAN.md — restore is per
// Apple ID, which is acceptable for the current owner-only model.
export async function identifyOrg(orgId: string): Promise<CustomerInfo | null> {
  if (!configured) return null;
  const { customerInfo } = await Purchases.logIn(orgId);
  return customerInfo;
}

export async function signOutPurchases(): Promise<void> {
  if (!configured) return;
  // Anonymous purchases can't be logged out; ignore that specific error.
  try {
    await Purchases.logOut();
  } catch {
    // no-op — was already anonymous
  }
}

// Resolves the effective plan from RevenueCat entitlements. `pro` wins over
// `plus` if somehow both are active; no paid entitlement → 'free'.
export function planFromCustomerInfo(info: CustomerInfo | null | undefined): Plan {
  const active = info?.entitlements.active ?? {};
  if (active['pro']) return 'pro';
  if (active['plus']) return 'plus';
  return 'free';
}

// True once configure() has run with a key on iOS. The paywall uses this to
// decide whether to run the IAP flow or degrade gracefully (RevenueCat project
// / key may not be set up yet during the migration).
export function purchasesReady(): boolean {
  return configured;
}

export type TierPackages = Record<PaidTier, PurchasesPackage | null>;

function findByProductId(offering: PurchasesOffering, productId: string): PurchasesPackage | null {
  return offering.availablePackages.find((p) => p.product.identifier === productId) ?? null;
}

// The Plus + Pro packages from the current (`default`) offering. Each package
// carries the store-localized price string the paywall must display (Apple
// 3.1.2), so prefer `pkg.product.priceString` over any hardcoded label. Matched
// by product id against PAID_TIERS, falling back to RevenueCat's `.monthly`
// accessor for whichever tier the dashboard put in that standard slot.
export async function getTierPackages(): Promise<TierPackages> {
  if (!configured) return { plus: null, pro: null };
  const offerings = await Purchases.getOfferings();
  const current: PurchasesOffering | null = offerings.current;
  if (!current) return { plus: null, pro: null };
  return {
    plus: findByProductId(current, 'sift_plus_monthly'),
    pro: findByProductId(current, 'sift_pro_monthly'),
  };
}

export interface PurchaseResult {
  plan: Plan;
  cancelled: boolean;
}

// Runs the native StoreKit purchase sheet for the given tier's package. On
// success RevenueCat reports the entitlement immediately; the *server* gate
// (extract-invoice reads the Clerk plan flag) catches up once the
// revenuecat-webhook lands — the paywall's poll-Clerk-org loop bridges that gap.
export async function purchaseTier(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!configured) throw new Error('Purchases not configured');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { plan: planFromCustomerInfo(customerInfo), cancelled: false };
  } catch (e: any) {
    // User backing out of the sheet is a normal outcome, not an error to alert.
    if (e?.userCancelled || e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { plan: 'free', cancelled: true };
    }
    throw e;
  }
}

// Apple requires a Restore Purchases action. Re-syncs entitlements for the
// signed-in Apple ID and returns the resulting plan.
export async function restorePurchases(): Promise<Plan> {
  if (!configured) throw new Error('Purchases not configured');
  const info = await Purchases.restorePurchases();
  return planFromCustomerInfo(info);
}

// Opens the native App Store subscription-management sheet (replaces the Stripe
// billing portal). Cancels/changes flow back through the revenuecat-webhook.
export async function manageSubscription(): Promise<void> {
  if (!configured) return;
  await Purchases.showManageSubscriptions();
}
