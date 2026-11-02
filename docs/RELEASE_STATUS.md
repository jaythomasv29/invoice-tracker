# Sift release work — November 1, 2026

Work branch: `launch/app-store-readiness`. Public release is not yet approved or verified.

## Confirmed decisions

- Apple account: chimpchamp92@gmail.com, team Y63ZLHZGKY.
- TestFlight for standalone physical iPhone testing. Release builds bundle JS/assets; no Metro/computer is needed at runtime. Internet is required for hosted authentication/data/AI.
- New Expo project @jvongampai/siftcosts, ID 90a6fb52-c47f-4a1f-af47-f07488c2767a.
- Free + Pro for new customers; legacy Plus remains recognized. Pro allowance provisionally 500 scans and 50 AI recipe draft attempts/month; actual store pricing and costs need validation.
- Public support address temporarily chimpchamp92@gmail.com.

## Completed or underway

- Hosted Supabase project mfabuswvobhatxacikmc restored from pause; existing migrations/data schema were preserved.
- Launch migrations add protected AI accounting, affirmative consent, serialized subscription reconciliation, deletion tombstones and storage cleanup. All five launch migrations and the updated Edge Functions are deployed.
- Free/Pro paywall, offering retry state, server reconciliation, purchase identity serialization, AI consent controls, tenant state clearing, atomic AI writes and review saves implemented locally.
- Production Clerk instance created: ins_3LXFt0fMIMkpHYrhM40exVTI28G, app app_3GcUYfuOsQtxCikxoZjRVj6TMvr. DNS, SSL and mail verification completed. Native iOS application registered; live and development Clerk issuers and server routing configured.
- Website recreated under jaythomasv29s-projects/siftcosts; custom siftcosts.com now serves privacy/terms/support with HTTP 200. Updated support address deployed.
- First EAS iOS build 8041aacd-2840-4915-add3-2607aebf4908, build number 2, uses testflight profile and beta/test Clerk configuration. This is an early checkpoint, not the final release candidate; changes after upload require another build.
- Apple distribution signing configured by user. App Store Connect app 6797084602 and internal TestFlight group configured. Build 2 upload completed (submission 16083df7-f4a7-4ccd-8b60-10f46dd3f1f9).

## Validation so far

- TypeScript, lint and four release/configuration/security tests pass.
- All migrations apply in isolated PostgreSQL on port 55439 (`/tmp/sift-launch-pg`). SQL security checks cover quota tampering, resource locks, idempotent release and deletion tombstones. Atomic extraction/review rollback and tenant isolation SQL tests also pass. Hosted disposable-identity checks passed for consent, quota protection and failed-job cleanup.
- Six RevenueCat state tests pass; changed Edge Functions pass Deno type checking.
- iOS Hermes bundle/assets exported successfully to /tmp/sift-standalone-export.
- Website production build/lint pass; support page visually inspected in Chrome.
- Expo patches updated within SDK57. Expo Doctor passes all 18 checks. A CommonJS-compatible URI decoder security patch is vendored and tested; final export and audit review remain. React/ReactDOM intentionally stay matched at 19.2.7 rather than downgrade.

## Outstanding gates

- Verify production sign-in on a physical phone; production Clerk configuration is complete.
- RevenueCat Pro product, entitlement, monthly offering, authenticated webhook and internal sandbox allowlist are configured. Apple subscription created at $24.99/month in the US. Initial read-only key verification was insufficient: the saved key is an Apple public SDK key, not a V1 secret. Replacement sk_ key requested; full customer deletion remains blocked. Subscription review screenshot and pricing completeness still need verification.
- Maintenance scheduling configured in Vault/pg_cron every five minutes; verify execution and deletion/photo cleanup end-to-end with disposable fixtures.
- Connect website waitlist backend environment and verify support pages after final redeploy.
- Build and upload a newer TestFlight candidate containing the subsequent fixes. Build 2 IPA inspection confirms bundled JavaScript/fonts, iOS 26.5 SDK, and no microphone/local-network prompts. Physical-phone testing with the computer/server off remains required.
- Current checks: app type/lint/four tests pass, six billing tests pass, all changed functions type-check, Expo Doctor 18/18, production configuration guard passes, live iOS Hermes export succeeds. One fictional invoice extracted with two correct line totals ($60); broader accuracy/cost trial and store screenshots/reviewer access remain. Dependency audit still reports three high tooling-path findings (image-size, zod and propagated Expo CLI); no critical findings. Major overrides are deferred pending compatibility validation.
- Actual Apple/StoreKit purchase/restore/renewal lifecycle and full deletion evidence are still pending. Do not label the app launch-ready from static checks alone.
