import { WORKSPACE_PLANS, type AccountType } from '../shared/workspacePolicy.ts';
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
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Sentry from '@sentry/react-native';
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
let identifiedOrg: string | null = null;
let identityQueue: Promise<unknown> = Promise.resolve();
function serializeIdentity<T>(operation: () => Promise<T>): Promise<T> {
  const next = identityQueue.then(operation, operation);
  identityQueue = next.catch(() => {});
  return next;
}

// Call once at startup (app/_layout.tsx), before any other Purchases call.
// Idempotent — safe if a fast refresh re-runs it.
export function configurePurchases(): void {
  if (configured) return;
  // iOS-only for now (Android/web aren't launched). Leaving `configured` false
  // makes every other call in this module short-circuit to a no-op.
  if (Platform.OS !== 'ios' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
  if (!RC_IOS_KEY) {
    // Fail soft in dev without a key rather than crashing startup — purchases
    // just won't work until the key is set. Mirrors the Sentry no-DSN pattern.
    console.warn('[purchases] EXPO_PUBLIC_REVENUECAT_IOS_KEY not set — IAP disabled');
    return;
  }
  Purchases.configure({ apiKey: RC_IOS_KEY });
  configured = true;
}

// Bind RevenueCat to the canonical billing customer from the verified workspace
// profile. Existing business owners retain their original organization ID; both
// modes share that customer while separate products unlock their own workspace.
export async function identifyOrg(orgId: string): Promise<CustomerInfo | null> {
  return serializeIdentity(async () => {
    if (!configured) throw new Error('Purchases are unavailable on this build.');
    identifiedOrg = null;
    const { customerInfo } = await Purchases.logIn(orgId);
    identifiedOrg = orgId;
    return customerInfo;
  });
}
export async function signOutPurchases(): Promise<void> {
  return serializeIdentity(async () => {
    identifiedOrg = null;
    if (!configured || await Purchases.isAnonymous()) return;
    await Purchases.logOut();
  });
}

// Resolves the effective plan from RevenueCat entitlements. `pro` wins over
// `plus` if somehow both are active; no paid entitlement → 'free'.
export function planFromCustomerInfo(info: CustomerInfo | null | undefined, type: AccountType = 'business'): Plan {
  const active = info?.entitlements.active ?? {};
  if(type==='personal')return active.personal_pro?.productIdentifier==='sift_personal_pro_monthly'?'pro':'free';
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
export async function getTierPackages(type: AccountType = 'business'): Promise<TierPackages> {
  configurePurchases();
  if (!configured) throw new Error('Subscriptions are unavailable on this device.');
  let offerings;
  try { offerings = await Purchases.getOfferings(); }
  catch (error: any) {
    Sentry.captureException(new Error('Subscription products unavailable'), { tags: { iap_error_code: String(error?.code ?? 'unknown') } });
    const message = error?.code === PURCHASES_ERROR_CODE.NETWORK_ERROR ? 'Could not connect to the App Store. Check your connection and retry.' : 'The App Store is not returning this subscription yet. Please retry shortly.';
    const code = String(error?.code ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32);
    throw new Error(`${message} Support reference: RC-${code}.`);
  }
  const current: PurchasesOffering | null = offerings.current;
  if (!current) throw new Error('Subscriptions are temporarily unavailable. Please retry shortly.');
  if (!findByProductId(current, WORKSPACE_PLANS[type].product)) {
    Sentry.captureException(new Error('Pro StoreKit product missing from offering'), { tags: { iap_error_code: 'missing_pro_product' } });
    throw new Error('The App Store is not returning the Pro price yet. Please retry shortly.');
  }
  return {
    plus: findByProductId(current, 'sift_plus_monthly'),
    pro: findByProductId(current, WORKSPACE_PLANS[type].product),
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
export async function purchaseTier(pkg: PurchasesPackage, orgId: string, type: AccountType = 'business'): Promise<PurchaseResult> {
  if (!configured) throw new Error('Purchases not configured');
  return serializeIdentity(async () => {
  try {
    const { customerInfo: identified } = await Purchases.logIn(orgId);
    identifiedOrg = orgId;
    if (!identified) throw new Error('Could not verify restaurant identity.');
    if (identifiedOrg !== orgId) throw new Error('Restaurant changed. Please retry.');
    // A reopened paywall can outlive backend activation. Reuse the confirmed
    // store entitlement instead of presenting a second purchase sheet.
    if (planFromCustomerInfo(identified, type) === 'pro' && pkg.product.identifier === WORKSPACE_PLANS[type].product) {
      return { plan: 'pro', cancelled: false };
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { plan: planFromCustomerInfo(customerInfo,type), cancelled: false };
  } catch (e: any) {
    // User backing out of the sheet is a normal outcome, not an error to alert.
    if (e?.userCancelled || e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { plan: 'free', cancelled: true };
    }
    throw e;
  }
  });
}

// Apple requires a Restore Purchases action. Re-syncs entitlements for the
// signed-in Apple ID and returns the resulting plan.
export async function restorePurchases(orgId: string, type: AccountType = 'business'): Promise<Plan> {
  if (!configured) throw new Error('Purchases not configured');
  return serializeIdentity(async () => {
    await Purchases.logIn(orgId);
    identifiedOrg = orgId;
    const info = await Purchases.restorePurchases();
    return planFromCustomerInfo(info,type);
  });
}

// Opens the native App Store subscription-management sheet (replaces the Stripe
// billing portal). Cancels/changes flow back through the revenuecat-webhook.
export async function manageSubscription(): Promise<void> {
  if (!configured) return;
  await Purchases.showManageSubscriptions();
}

// Fresh, restaurant-scoped display information. It never changes server access.
export async function getSubscriptionEntitlement(orgId: string, type: AccountType = 'business') {
  return serializeIdentity(async () => {
    if (!configured) throw new Error('Purchases are unavailable on this build.');
    await Purchases.logIn(orgId);
    identifiedOrg = orgId;
    await Purchases.invalidateCustomerInfoCache();
    const info = await Purchases.getCustomerInfo();
    if(type==='personal')return info.entitlements.active.personal_pro??info.entitlements.all.personal_pro??null;
    return info.entitlements.active.pro ?? info.entitlements.active.plus ?? info.entitlements.all.pro ?? info.entitlements.all.plus ?? null;
  });
}
