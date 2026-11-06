# Sift release work — November 2, 2026

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

OTA verification: initial iOS beta update group 39f7a731-10f0-4e8d-993e-885c7adad711 published from commit 255d03e. Runtime c679d8b41e86371737a4b1a2779d24876d7d74db exactly matches build 6's computed fingerprint. A real manifest request with the beta channel and runtime returns HTTP 200 with that update; the production channel returns 204 and does not expose it. Expo Doctor 18/18 and 13 app tests pass (12 existing plus channel/runtime isolation). Enabling build 6 bff8210e-568a-471f-b3f6-1b6f1593f54b is IN_PROGRESS; Apple upload and phone receipt remain pending.

Build 6 FINISHED; EAS submission a68a84c4-2279-4347-8ed8-182734908f2f FINISHED. Signed IPA inspected: version 1.0.0 (6), bundle com.siftcosts.app, beta channel, correct hosted update URL, updates enabled/ALWAYS launch check/zero wait. SDK 57 stores EXUpdatesRuntimeVersion as file:fingerprint; the packaged EXUpdates.bundle/fingerprint resolves to c679d8b41e86371737a4b1a2779d24876d7d74db, exactly matching the published update. Embedded JS 7,390,508 bytes, live Clerk key present, exact development Clerk key and checked server secrets absent. Apple processing and phone receipt remain pending.

Clean npm ci succeeded with the builder's Node/npm; full typecheck/lint/13 tests pass. Current audit is 44 (3 high, 39 moderate, 2 low, 0 critical): adding expo-updates propagates the pre-existing glob advisory through its Node build utility (utils/src/vcs.ts), with no additional high/critical findings. Public security disposition remains outstanding; no incompatible forced downgrade applied.

Apple build 63112634-718c-4b21-9b68-393c2b221ed1 (1.0.0 build 6) is VALID and IN_BETA_TESTING, with auto-notification enabled. Internal Team (Expo) group includes build 6; build-specific OTA/phone regression instructions saved. OTA export also checked: live authentication, exact development key absent and checked server secrets absent. Configuration, live manifest delivery, runtime match and signed binary verification are complete. Owner must install 1.0.0 (6) from TestFlight; actual phone OTA receipt/behavior, Pro purchase/restore and prior launch gates remain unverified. This setup used one additional Expo cloud iOS build; future compatible beta JS/assets updates use EAS Update's separate allowance.


## November 2 — interface, branding and launch media

- Modern forest/ivory interface implemented: Kitchen overview, day/week/month spending, invoice/vendor/average metrics, top supplier amounts, invoice library search, clearer recipe cost shares, progressive invoice notes and accessible touch targets. Existing scan and duplicate safeguards remain.
- Full app typecheck/lint and all 15 regression tests pass, including recipe shares above 100% and missing menu-price handling. Native UI captures were reviewed on iOS 18.6 in Expo Go; this does not replace physical TestFlight or StoreKit checks.
- New receipt-S icon and matching splash are embedded in native build 7, EAS `fc695648-0d64-446a-831a-fe6076653e24`, submission `76e2d8dc-9fbb-4619-9448-f9f97c9e469f`. Apple build `f55259dd-a40b-44a4-8cb8-a5532b3d7df6` is VALID / IN_BETA_TESTING. Draft App Store version is attached to build 7; no public review was submitted.
- IPA verification confirms bundle ID, live authentication, beta OTA channel, correct packaged fingerprint and absence of checked server secrets/capture bootstrap.
- Build 6 modern-UI OTA group `7ccaed14-0bb1-41a2-bb4b-c20174a42009` matches its native runtime `c679d8b41e86371737a4b1a2779d24876d7d74db`. Owner confirmed the modern interface arrived on the physical phone by OTA. Build 7 uses runtime `062bedef39aff97c339accbe22183fe3470f622f`.
- `launch-assets/` contains six App Store screenshots with actual app captures, editable SVGs, header/search artwork, opaque 1024 icon, 22-second native-screen preview and source recording. All content is fictional sample data. Apple processed all six screenshots and preview COMPLETE. Header/search images and ACTIVE draft placements are accepted by the API; browser editor verified 1 of 1 Header Asset and 1 of 1 Search Results Asset.
- siftcosts.com production refreshed with the new design, real app captures, icon/social artwork and accurate feature labels. Production deployment READY, public pages/assets HTTP 200; website build/lint and visual check passed.
- Pro pricing/purchase/restore on the physical phone, reviewer access, real-invoice accuracy/cost sampling and remaining privacy/release gates remain outstanding.

- Build 7 compatible OTA group `d6d04159-11a9-4e8d-9a14-73a889d82541`, update `01a19b5c-30c4-7c75-b7e9-e7d56d8fe8aa`, includes the final recipe average edge-case fix. Actual beta manifests verified for both native runtimes. Build 7 physical-phone checks remain pending.
- Disposable development capture organization/user deleted after media capture; capture server and local website preview stopped. No production restaurant data was used for the public assets.


## November 3 — supplier distribution and motion

- Home Total spending now includes a proportional color-coded supplier bar and a complete name/amount legend for the selected calendar period. Supplier colors use the full registry so period changes keep them consistent. Negative net supplier balances remain in totals/legend and are explicitly excluded from positive-spend segments.
- Added UI-thread spring press feedback across Home, recipes and invoice/supplier controls, a spending-total fade, supplier segment layout transitions, purchasing-insights reveal, tab crossfades and native detail pushes. New motion honors system Reduce Motion. No native package changes.
- No backend calls, data migrations or invoice deletions were performed. Owner's two real supplier invoices were not modified.
- Typecheck/lint and all 15 regression tests pass; iOS Hermes exports succeed. Physical-phone animation and supplier-display checks remain pending.
- Build 6 beta OTA group `dcfc6d37-0c34-4eaf-b14f-2913eab3e895`, update `01a1a0d2-6b96-726a-8037-91dfc8cfd7dd`, runtime `c679d8b41e86371737a4b1a2779d24876d7d74db`. Compatible native configuration was used for each export, then current build 7 configuration restored. No cloud native build was consumed.
- Build 7 beta OTA group `dce48792-fcce-41d3-8bfe-adf0c29efe57`, update `01a1a0d0-a210-76a2-afc7-f1b9196ce4b8`, runtime `062bedef39aff97c339accbe22183fe3470f622f`. Compatible native configuration was used for each export, then current build 7 configuration restored. No cloud native build was consumed.


## November 3 — launch verification and cancellation behavior

- Owner reports build 7 price loading, successful purchase, cancellation and resubscription. Restore purchases remains awaiting explicit confirmation.
- Real-invoice audit reviewed four saved invoices/34 line items and source photos, including a historical invoice. Identified explicit-weight resolution and catch-weight editing gaps; no owner invoices were deleted, re-extracted or rewritten.
- Deployed function-only migrations `20261103010000` and `20261103011000`: read-time explicit-weight costing, purchase-date ordering, and atomic invoice-line editing with printed extended totals. SQL conversion/ambiguity, tenant isolation, and actual rollback-on-total-failure checks pass. Owner invoice snapshot remains identical before/after deployment.
- Profile now displays renewal dates or auto-renewal-off/paid-through dates, distinguishes inactive and billing-issue states, identifies sandbox subscriptions, and refreshes on focus/return from Apple settings. Authoritative access refreshes on cold launch and app foreground. Cancellation does not revoke access before expiry.
- Dedicated reviewer account uses approved Gmail alias, separate fictional restaurant and regular password authentication. Production Frontend API sign-in completed; disposable test session then revoked. Existing email-code flow remains available. Credentials and reviewer notes are saved in the Apple draft; fictional test invoice attachment is COMPLETE. Sandbox allowlist retained the owner and all three internal test restaurants while adding only the dedicated review restaurant.
- App Privacy has all 15 declared data types configured: App Functionality, identity-linked, no tracking. Browser verified 15 purposes/15 linkage answers/no unconfigured categories. Publication awaits owner confirmation of Apple's final legal attestation. `docs/PRIVACY_DISCLOSURES.md` records the draft.
- Age-rating content questionnaire is saved with a 16+ business-audience override (legacy API reports 17+). Listing remains PREPARE_FOR_SUBMISSION / MANUAL release.
- Six screenshots and preview are COMPLETE; header/search assets remain prepared draft assets. Public privacy/terms/support pages return 200. Subscription review screenshot is confirmed visually blank and still needs a real native paywall capture.
- TypeScript, lint and 23 JavaScript regression tests pass. Final Hermes release export contains the new flows; five checked server/reviewer secrets are absent in both UTF-8 and UTF-16 strings.
- Final build 7 OTA group `95936610-f2c0-4c39-8c71-00170ce583e3`, update `01a1a436-244d-79e5-b0ba-27c96dc69aaa`, runtime `062bedef39aff97c339accbe22183fe3470f622f` exactly matches build 7; actual beta manifest verified. No native cloud build was consumed. Final App Store submission still needs a production-profile binary embedding approved fixes, rather than relying on beta OTA.


Owner confirmation update: Restore purchases succeeded on build 7 and Pro remained unlocked. Owner explicitly approved Apple's privacy legal attestation; App Privacy responses were published. Browser verification showed “Published a few seconds ago by James Vongampai.” This publication does not submit the app for App Review or release it. Subscription end-date phone confirmation, a real paywall review screenshot and the final production binary remain outstanding.


## Expanded Home intelligence and app motion — November 4

- Used the UI/UX skill and existing Sift design system for shared interactions and route surfaces. Purchasing intelligence is permanently expanded, with Kitchen momentum, honest invoice milestones/upload-day activity, recipe entry, alerts and purchasing patterns. Updated tour copy removes the former daily-streak/countdown promise.
- Spending figures drill into a saved-invoice date range matching Home, including invoice-date history and explicit upload-date fallback. Clear restores the full captured library. Supplier, alert, item-history, recipe and invoice links retain real destinations and paid-feature gates.
- Shared native press springs and short route reveals apply across authentication, scanning/review, invoices, suppliers, recipes, alerts, paywall and Profile. Motion uses the existing Reanimated dependency and honors Reduce Motion. Added calendar/invoice accessibility labels and larger calendar touch targets. Camera processing locks and invoice storage are unchanged.
- Expo Go skips native StoreKit configuration so fictional UI previews can run; TestFlight retains normal RevenueCat initialization. No native dependency/config change is required.
- Verified actual simulator rendering with a disposable development identity and local fictional ledger; momentum opens the library, November filtering shows the correct 3 invoices/$217.90, and Clear restores 12. Removed the temporary capture route/config override and deleted only the disposable development identity/organization afterward. No production invoice writes or data migration.
- Physical-phone motion, large-text and new Home-link confirmation remain owner QA. Re-capture the approved new Home for final public marketing/listing parity before the production release candidate.

- Published beta iOS OTA `01a1a8c7-9567-7715-b4a2-557be0b7dcf1` (group `7432151b-261e-4017-96c8-1a9ffca81d2c`) from `cd9cd3e`. Runtime `062bedef39aff97c339accbe22183fe3470f622f` matches TestFlight build 7. Verified the beta manifest returns HTTP 200 and this exact update/runtime. Production configuration, typecheck, lint and all 27 tests pass; exported source map excludes the temporary capture route and environment files. This used EAS Update, with no new native build.


## Website media refresh — November 4

- siftcosts.com now uses seven fresh native captures from the current app UI, including the supplier spending bar and expanded Purchasing intelligence. Current phone visuals preserve native geometry and use content-hashed, high-quality WebP exports selected by `website/src/content/media.json`.
- Added the owner's 45-second 1920 × 1080 Downloads launch film with native click-to-play controls, inline iPhone playback, optional English captions and a text description. Preserved the exact original in the project; the website edition changes only the last 7.5 seconds to an accurate “Coming to iPhone” closing card and retains the original audio. No autoplay/full-video preload.
- Improved small-phone action placement and kept navigation/hero visible on cold loads, with reduced-motion support for the remaining shared effects. Native application code, production invoices, legal content and billing configuration are unchanged.
- Final production deployment `dpl_47KUF4jogrdAB5ZnnLaBLuBMUZaQ`, source website commit `442c7b2`, is READY on https://siftcosts.com. Local/cloud builds and lint passed. Visually checked desktop dark and 375-point iPhone light layouts; native Safari playback advances, and desktop pause works. Fully decoded the film, verified its audio matches the original, and checked fast-start metadata.
- Public verification: current HTML references new media and excludes the previous Home filename; all seven screenshot files and the film matched local SHA-256 hashes, video byte ranges return 206, captions/poster/legal pages return 200, and the optimized Home image returns 750 × 1630 with the correct native ratio. Final HTML also keeps navigation/hero visible without waiting for entrance animation. Evidence, source media and rebuild instructions: `launch-assets/website/2026-11-04/`.
- Temporary app capture changes were restored, capture route removed and disposable development identity deleted. No EAS update/native build, production data write, App Store asset replacement or App Review submission was needed for this website change.

## Home styling beta update — November 6

Published iOS beta OTA group `8f88a3bc-c289-4551-a46a-04f8c8c83da5`, update `01a1b063-a00d-7660-8cd1-003a09f720e7`, from source `f36c3a7`. Runtime `062bedef39aff97c339accbe22183fe3470f622f` matches existing TestFlight build 7. The green panel contains the supplier bar, matching legend and an all-time saved-history milestone with an earned badge. Replaced the oversized Kitchen/Household heading with a compact status/Scan row. Includes glass-inspired bottom navigation, viewport/data/resume panel reveals and the preceding styling pass.

Verified the public beta manifest returns HTTP 200 with this exact update/runtime. The Hermes source map includes the final compact header, legend and milestone/motion components and excludes environment/capture-fixture sources. Production configuration, TypeScript, ESLint and all 41 tests passed with Node 22.13.0/npm 10.9.2. No native cloud build or App Store submission was used. Physical-phone confirmation of native appearance, motion and largest text remains outstanding. Evidence: `docs/HOME_POLISH_ROLLOUT.json`.
