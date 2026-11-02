# Sift release work — November 1, 2026

Work branch: `launch/app-store-readiness`. Public release is not yet approved or verified.

## Confirmed decisions

- Apple account: chimpchamp92@gmail.com, team Y63ZLHZGKY.
- TestFlight for standalone physical iPhone testing. Release builds bundle JS/assets; no Metro/computer is needed at runtime. Internet is required for hosted authentication/data/AI.
- New Expo project @jvongampai/siftcosts, ID 90a6fb52-c47f-4a1f-af47-f07488c2767a.
- Free + Pro for new customers; legacy Plus remains recognized. Owner delegated final price/limits: Pro $19.99/month, 150 successful invoice scans and 25 AI recipe draft attempts/month. Free remains 10 scans/month. Broader real-invoice cost sampling remains required.
- Public support address temporarily chimpchamp92@gmail.com.

## Completed or underway

- Hosted Supabase project mfabuswvobhatxacikmc restored from pause; existing migrations/data schema were preserved.
- Launch migrations add protected AI accounting, affirmative consent, serialized subscription reconciliation, deletion tombstones and storage cleanup. All six launch migrations and the updated Edge Functions are deployed.
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
- RevenueCat Pro product, entitlement, monthly offering, authenticated webhook and internal sandbox allowlist are configured. Apple subscription draft updated to $19.99/month in the US. RevenueCat V1 secret verified with both synthetic customer creation/read and deletion, then securely configured on the hosted server. Apple territory pricing equalization applied with US-only availability retained; store status READY_TO_SUBMIT. Replace the review screenshot placeholder and test actual StoreKit purchase/restore.
- Maintenance scheduling configured in Vault/pg_cron every five minutes with a dedicated random token. Hosted endpoint returns 200 with zero failures; deleted-invoice private-photo cleanup passed. Monthly invoice attempt budget deployed and transactionally verified (Free 20 attempts, Pro 180); successful usage remains protected. Full disposable-account deletion passed: nested photos, restaurant records, RevenueCat customer and Clerk identity removed, durable status completed.
- Website waitlist backend environment is configured; production legal/support pages are deployed with the selected 150/25 allowances. Production waitlist submit, case-insensitive duplicate handling and invalid-email rejection all passed; disposable row removed.
- Build 3 (5672f50e-ac16-4e0f-a863-63b159d3e3e8) failed on a cloud npm lockfile mismatch. Lockfile and local-file dependency resolution are now repaired; full clean install and all four app tests pass under the builder's Node 22.13.0/npm 10.9.2. Updated build 4 f3f40c96-0915-4e26-99bf-cb16078b7984 FINISHED from commit ca4528f with live authentication and selected pricing. Submission 2b41a8be-abff-4519-9216-0c16608f0123 FINISHED without error; Apple processing COMPLETE with no warnings/errors. Build 4 is VALID and its internalBuildState is IN_BETA_TESTING; testing instructions saved. Build 2 IPA inspection confirms bundled JavaScript/fonts, iOS 26.5 SDK, and no microphone/local-network prompts. Build 4 IPA: com.siftcosts.app, version 1.0.0 (4), iOS 26.5 SDK, minimum iOS 16.4, 7,375,428-byte JS bundle and seven fonts. Live Clerk public key and hosted Supabase URL present; development Clerk public key and checked Clerk/RevenueCat server secrets absent. No microphone or local-network usage prompt. Physical-phone testing with the computer/server off remains required.
- Current checks: app type/lint/four tests pass, six billing tests pass, all changed functions type-check, Expo Doctor 18/18, production configuration guard passes, live iOS Hermes export succeeds. One fictional invoice extracted with two correct line totals ($60), duplicate reprocessing refused, review saved atomically and saved invoice reloaded; broader accuracy/cost trial and store screenshots/reviewer access remain. Dependency audit still reports three high tooling-path findings (image-size, zod and propagated Expo CLI); no critical findings. Major overrides are deferred pending compatibility validation.
- Hosted Free recipe denial, paid recipe drafting (unconfirmed ingredient template) and authoritative RevenueCat reconciliation back to Free all passed. Actual Apple/StoreKit purchase/restore/renewal lifecycle remains pending. Do not label the app launch-ready from static checks alone.

## November 1 verification checkpoint

Local website and isolated PostgreSQL test processes were stopped after validation. The app backend and maintenance worker run in hosted Supabase; neither depends on those local processes. Expo export produced the live-config iOS Hermes bundle and bundled fonts/assets. Broader real-invoice accuracy/cost sampling remains required; the single fictional invoice is a functional smoke test.

App Store Connect English metadata, Business category, privacy/support links and TestFlight description are saved as drafts. Version 1.0.0 uses MANUAL release. Existing app name is Sift: Invoice & Recipe Costing. No public review submission has been made.

Final Expo Doctor remains 18/18 after the clean-install repair. Current npm audit: 43 total findings (3 high, 38 moderate, 2 low, 0 critical), including tooling and optional web-wallet dependency paths; public release still requires a documented security disposition.

RevenueCat webhook checks passed on the hosted endpoint: unauthorized denied (401), wrong app denied (400), authenticated TEST accepted (200). A fictional $60 invoice fixture is included under docs/fixtures for phone QA.

Phone QA checkpoint: owner reports successful production sign-in and restaurant creation on build 4. Confirmed the production owner/admin membership; enabled sandbox entitlements for that specific restaurant and retained the three existing internal development restaurants. Verified the hosted configuration digest and RevenueCat customer access (currently Free, no entitlement records). Next: computer-off scan/save/reopen and sandbox purchase/restore.

## Build 4 phone feedback and follow-up

Owner confirmed sign-in, restaurant creation and one saved invoice. Reported that camera controls remained usable during processing, progress was an opaque spinner, basic home spending was insufficient and Pro price unavailable. A later clarification confirms price is still unavailable; do not mark purchase/restore passed. Owner reports active Paid Applications Agreement, completed tax/banking and US storefront. Server catalog, live IPA SDK key, SKU, bundle ID, in-app purchase capability, US availability and current $19.99 price schedule all match. A fresh native diagnostic reference is being added; device StoreKit fetch remains unresolved.

Implemented for next beta: modal processing lock with disabled dismissal/gesture/back, actual upload/duplicate/read/save phases and elapsed time (no invented ETA), per-period home totals/counts/vendor breakdowns with historical day/week/month navigation for all plans, paginated invoice history, Needs review recovery, strict exact/strong duplicate prevention and serialized atomic duplicate commits. Header-only uncertain matches remain confirmable; different invoice numbers and shared terms pages are not hard duplicates. Server migrations and extraction function deployed. Twelve app tests and hosted extraction/atomic duplicate/progress-isolation checks pass. Phone UI validation remains pending.

Further Apple draft checks found no app territory availability record and an empty base app pricing schedule. Created US-only app availability and explicitly set the download price to Free; subscription remains $19.99. No review or release performed. Do not claim these changes fixed StoreKit until the device loads a price. Build 5 (86e937e2-135f-4db2-b647-7396b1439ff7, commit 3a01f38) is building. A real concurrent hosted commit test passed: one duplicate rejected, one invoice persisted, successful usage exactly one. Different invoices sharing a terms page also pass.

Build 5 FINISHED and upload ef86c834-7dda-4fe8-9a64-81b2b73481fa FINISHED without error; Apple processing. IPA 1.0.0 (5), iOS 26.5 SDK, JS bundle 7,390,508 bytes; spending card, progress RPC and purchase error reference verified in the bundle. Checked server secrets absent.

Build 5 Apple processing COMPLETE (no errors/warnings); VALID and IN_BETA_TESTING. Build-specific regression instructions saved and internal Team (Expo) access verified. Owner should update to 1.0.0 (5) and test scanner lock/progress, historical home metrics, Needs review, duplicates and Pro price/error reference. Price/purchase/restore remain unverified on the phone.

## Standalone beta OTA setup

Owner authorized configuring EAS Update to avoid a cloud build for every routine UI/JavaScript change. Installed SDK-compatible expo-updates; configured ON_LOAD/background download, fingerprint runtime compatibility, TestFlight channel beta and a separate production channel. Both channel-to-branch mappings created; no production update published. Publishing uses the live production environment to match TestFlight authentication/backend. One enabling TestFlight binary is required; build 5 cannot receive OTA. Source configuration/compatibility test passes; update publish and enabling build verification underway. No public release or subscription success implied.
