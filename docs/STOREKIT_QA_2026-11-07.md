# StoreKit QA — November 7, 2026

## App Store Connect configuration

Version 1.0.0 uses production build 9 (Apple build ID `8bc54d86-74ea-4c92-a3ff-7914c8a455dd`), is VALID and is available to the existing internal TestFlight group. The iOS review draft contains the app version, both subscription versions and both subscription group versions; all five items are READY_FOR_REVIEW. The submission has no submitted date. Manual release remains selected.

The owner confirmed only original/sample app content and users' private uploads. Apple's Content Rights declaration is now DOES_NOT_USE_THIRD_PARTY_CONTENT. Production and Sandbox server notification URLs both use RevenueCat's existing endpoint with V2. Apple's App Store Server API confirmed successful delivery of a TEST notification in Sandbox. A Production test request returned HTTP 401; production delivery is not claimed verified. No endpoint token or authentication credential is stored in this report.

## Actual simulator checks

A separate **Sift StoreKit QA** iPhone 16 Pro simulator on iOS 18.6 was created. The owner's existing simulator and invoices were not changed. The existing review account signed in successfully using the saved reviewer credentials. Sample/demo mode was exited before store checks. A separate Personal household was added to that fictional review identity.

The installed simulator app uses the real hosted Clerk, Supabase, RevenueCat and StoreKit services. Its purchase/paywall source files match the current release source, but this simulator app is not the physical-device TestFlight build 9 binary.

| Check | Result |
|---|---|
| Business product/price retrieval | Passed: Business Pro, $9.99/month, 100 scans |
| Personal product/price retrieval | Passed: Personal Pro, $4.99/month, 40 scans |
| Workspace switching | Passed between the review restaurant and separate Personal household |
| Business purchase authentication cancellation | Passed: paywall recovers and remains Free |
| Personal purchase completion | Blocked: Apple sandbox authentication returns ASDErrorDomain 530 / AMSErrorDomain 100; no transaction returned |
| Dedicated Settings > Developer > Sandbox Apple Account sign-in | Attempted; no active sandbox account persisted after authentication |
| Personal restore with no active subscription | Passed: “Nothing to restore” / “No active subscription was found for your Apple ID.” |
| Successful purchase and restore of active subscriptions | Not verified; requires working Apple sandbox authentication on a test device |

A dedicated US sandbox tester, `storekit-qa-20261107@siftcosts.com`, was created in App Store Connect for these tests. Its password is not included in the repository. The review billing customer's RevenueCat record contained no subscriptions or entitlements after the blocked purchase attempts. No purchase was completed and no paid access was fabricated.

## Automated checks

Twelve targeted Node billing/workspace/subscription tests and six Deno billing tests passed. They cover separate entitlements, quotas, cancellation/paid-through access, expiry, valid grace periods, sandbox restrictions and unknown-product rejection. They do not replace an Apple transaction and active restore test.

## Remaining device check

Use TestFlight **1.0.0 (9)** on an available iPhone. Purchase Personal Pro, return to Business and purchase Business Pro, switch between both workspaces and restore each plan. Verify both remain active independently. Cancel renewal for one and confirm its paid-through access and the other plan remain correct. TestFlight purchases use Apple's sandbox; inspect the Apple sheet before confirming.

No public App Review submission or release was performed.
