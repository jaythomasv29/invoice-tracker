# Release operations

## Build and upload

Use Node 22.13.0 and npm 10.9.2, matching EAS. Run `npm ci` and `npm run check`. Run Expo Doctor after changing native dependencies. Keep package-lock.json synchronized using the same npm version as the cloud builder.

`npm run build:testflight` loads the EAS production environment before resolving Expo configuration. This is required because the production guard deliberately rejects the development Clerk key in the local .env file. Cloud post-install validates production configuration again. TestFlight extends the production Release profile and bundles JavaScript/assets; no Metro or local web server is used at runtime.

After a successful build, submit its exact build ID with `eas submit --platform ios --profile testflight --id BUILD_ID --non-interactive`. Verify EAS submission success and Apple processing before inviting phone testing. A finished build alone does not mean it is installed or approved.

## Configuration ownership

Client public keys are in the EAS production environment. Clerk/RevenueCat secret keys live only in Supabase function secrets and ignored local .env.*.local files. Never place a secret key in an EXPO_PUBLIC_ variable. The RevenueCat server key must be a V1 secret starting sk_; reading a subscriber alone is insufficient to prove secret privileges because public SDK keys can do that too. Verify synthetic customer deletion as well.

Supabase accepts the live Clerk issuer and the retained internal-development issuer. Clerk session claims include role=authenticated. The maintenance worker uses a dedicated random MAINTENANCE_AUTH_TOKEN, also stored in Vault as sift_maintenance_key. The cron SQL is in supabase/operations/schedule-maintenance.sql. Verify net._http_response status/content; cron's succeeded status only confirms it queued a request.

RevenueCat entitlement pro maps to sift_pro_monthly and the current offering's monthly package. Server reconciliation reads RevenueCat and writes Clerk plan metadata. Sandbox receipts grant paid access only to explicitly allowed organization IDs in REVENUECAT_SANDBOX_ORGS. Add the production phone/reviewer restaurant before its sandbox purchase test; never enable sandbox receipts for all restaurants.

## Evidence and gates

Hosted disposable-identity tests on November 1 passed consent enforcement, client quota protection, fictional invoice extraction, duplicate protection, atomic review save/reload, paid recipe drafting, unsupported entitlement removal, full account deletion and private-photo cleanup. Fixtures and temporary JWT templates were removed. Live Clerk sign-in still needs a physical phone: production Clerk correctly prohibits development-only session fabrication.

The dependency audit still has tooling-path high findings in image-size and Zod (including propagated Expo CLI). Do not force incompatible major upgrades into the SDK; resolve or assess those before public release. Doctor and a functional export do not replace phone, subscription, accuracy or security review.

Follow PHONE_TEST_CHECKLIST.md. Store listing/reviewer/privacy drafts are in store-metadata/app-store-draft.md. No public App Review submission or production launch has been performed.
