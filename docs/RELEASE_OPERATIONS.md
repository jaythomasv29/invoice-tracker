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

## Standalone beta updates (EAS Update)

TestFlight builds from the `testflight` profile use channel `beta`. Future App Store builds from `production` use channel `production`; never promote beta changes by repointing the production channel. Both use the EAS **production environment** because TestFlight tests the live hosted backend and live Clerk instance. The channel and environment serve different purposes.

`expo-updates` is enabled with ON_LOAD checks and zero startup wait. The embedded app starts immediately; a downloaded update applies on a subsequent cold launch. The phone needs internet to download it, but no Metro or computer. Build 5 and older do not support OTA; install the new enabling build first.

Runtime policy is `fingerprint`: native dependencies/configuration changes require a new compatible binary. Keep the same Node/npm and production environment for builds and updates. Do not replace this policy with a fixed runtime to force an incompatible update onto a phone.

After `npm run check`, publish **iOS only** with the production environment loaded before app configuration:

```sh
eas env:exec production 'APP_ENV=production SENTRY_DISABLE_AUTO_UPLOAD=true eas update --channel beta --platform ios --environment production --message "Describe the beta change" --non-interactive' --non-interactive
```

Verify the published update runtime matches the installed build's runtime and record its update group ID/message. Force-quit Sift, reopen with internet and allow the download, then force-quit/reopen again. The TestFlight build number stays unchanged. Publish routine JavaScript/layout/assets changes this way; native libraries, permissions, icons, splash configuration and Expo SDK upgrades need another binary. EAS Update has separate usage allowances.

To recover from a bad beta update, use `eas update:roll-back-to-embedded --help` and target the beta branch/runtime, or republish a verified previous compatible update. Never alter production mappings as part of beta recovery. Device confirmation is required before declaring an OTA update tested.
