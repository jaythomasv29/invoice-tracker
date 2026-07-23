# Shipping Readiness Report

Resume-point document for the scan-screen redesign + App Store readiness pass. Read this before picking up further refinement work — it says what's real, what's still mock, and what's left.

## What changed

### Phase 1 — Scan screen redesign (`app/scan/index.tsx`, `app/scan/review.tsx`)

- Real rotating processing spinner (`react-native-reanimated`), replacing a static non-spinning `View` that only looked like a loading indicator.
- The store's existing `scanStage`/`setScanStage` is now the single source of truth for processing state — the screen no longer duplicates it with local `useState`.
- Shutter-flash animation on capture; the real captured photo now carries through as `Invoice.imageUris` and displays as an actual thumbnail on the review screen (previously a solid gray placeholder box).
- "Tap to view full image" is now a real full-screen, swipeable image viewer modal — previously the text existed with no `onPress` at all.
- Removed the cosmetic "Batch" toggle (confirmed in its own code comment to do nothing functional — every capture always produced a single-page invoice regardless of the toggle). Multi-page invoices are still fully supported via "Import from library" (pick multiple photos at once).
- Removed "Simulate offline," a dev-only toggle that was shipping in production UI. Replaced with real connectivity detection (`expo-network`'s `useNetworkState`) — the offline banner now reflects actual network state, no manual switch.
- Added `onCameraReady` gating (capture is disabled until the camera reports ready) and a real flash/torch toggle (`CameraView`'s `enableTorch`), useful given the PRD's own "one-handed at a loading dock" scenario.
- Mounted `<Toast />` on the scan screen — capture/upload/extraction errors were previously swallowed silently (toast state was set but nothing rendered it on this screen).
- The Save button on the review screen now shows a real "Saving…" state with a spinner instead of silently pausing for 900ms with no visual change.

### Phase 2 — App-wide polish pass (4 parallel subagents)

- **Haptics + Toast + data-integrity fixes**: consistent `expo-haptics` feedback added across `vendors.tsx`, `more.tsx`, `vendor/[id].tsx`, onboarding screens, and auth screens (previously only 4 of ~19 route files used haptics at all). Mounted `<Toast />` on the More screen, which called `showToast` four times with nothing rendering it. Fixed two hardcoded `"4 active this week"` strings (home dashboard + vendors screen) to derive from the real `vendors.length`.
- **Loading states**: new reusable `components/ui/Spinner.tsx`, generalized from the scan screen's rotating indicator. Applied to auth/verify/onboarding submit buttons and the home dashboard's data-fetch window, replacing bare text swaps with a visible loading state.
- **Transitions + data animations**: `briefing`/`disputes` now use `slide_from_bottom`, `vendor/[id]`/`invoice/[id]` use `fade_from_bottom` (previously all four used the default full push, despite reading as detail/sheet views). `DonutChart`'s ring segments now animate in on data change instead of snapping. The Alerts screen animates the read/unread section move via `LayoutAnimation`.
- **Error boundary + Sentry + housekeeping**: new `components/ErrorBoundary.tsx` wraps the whole app — a render crash now shows a real "Something went wrong / Try again" screen instead of blank/white with zero telemetry. `@sentry/react-native` is installed and initialized (no-ops safely until a real DSN is supplied — see Setup below). Removed dead root `App.tsx`/`index.ts` Expo boilerplate (recoverable from git history if ever needed; confirmed nothing referenced them).

### Phase 3 — App Store technical readiness

- `eas.json` created (development/preview/production build profiles; `submit.production.ios` left blank pending your Apple Developer account details).
- `expo-splash-screen` wired into `app.json` (was previously unused despite the asset existing).
- Fixed the microphone permission string — `expo-camera`'s plugin always injects an `NSMicrophoneUsageDescription` even though this app never uses audio; it now reads as an accurate, App-Review-safe explanation instead of Expo's generic boilerplate default.
- `SETUP.md` updated: new Sentry checklist section, and the Apple section now reflects that `eas.json` exists (previously marked not-yet-done).

## Two real bugs found and fixed during verification

Both of these were caught by actually running the app in the simulator after merging all four subagents' work — not by code review or `tsc` (which stayed clean throughout).

1. **`DonutChart` crash loop** (`components/ui/DonutChart.tsx`) — the polish pass's first attempt animated the ring's reveal using `react-native-reanimated`'s `useAnimatedProps` on a `react-native-svg` `Circle` (via `Animated.createAnimatedComponent`). This combination crashed continuously (dozens of errors per second) as soon as the Home dashboard rendered. Rewritten using the classic React Native `Animated` API — the same proven pattern already used successfully by `Toast.tsx` — animating `strokeDashoffset` numerically instead of templating `strokeDasharray` strings on the UI thread. Confirmed stable afterward.
2. **Infinite re-render loop via `useSupabase()`** (`lib/supabase.ts`) — the hook memoized the Supabase client on Clerk's `getToken`, which is not a referentially stable function across renders. Combined with `useFocusEffect`'s actual implementation (it re-fires its internal effect whenever the passed-in callback's identity changes, not only on real focus/blur transitions) and a newly-added `setState` call in the home dashboard's fetch-loading logic, this produced a genuine infinite loop — "Maximum update depth exceeded." The bug was latent before this session (silently re-fetching on every render) but had no visible symptom until a synchronous `setState` in the same effect pushed it over React's loop-detection threshold. Fixed by keeping the Supabase client memoized with a stable empty dependency array and reading `getToken` through a ref, so the client identity never changes across the session.

Both fixes are narrow and root-caused, not just symptom-patched — worth knowing about if either area gets touched again.

## Phase 4 — Shipping-readiness audit: scope cut + real-loop completion

A deliberate scope pass against an explicit "ship at launch" list: the real loop
(scan → alert → dashboard → reconcile), email+OTP auth with Clerk's default
org roles, camera-only capture, CSV export, and search/history with the
original image kept. Two kinds of work: cutting things outside that scope,
and finishing the things inside it that were still mock.

**Cut:**

- **Opus 4.8 escalation tier** (`supabase/functions/extract-invoice/index.ts`) — extraction is Sonnet 5 only now. Low-confidence flagging (`confidence`, `low_confidence_fields`) is unchanged and still drives the 2-tap confirm UI; only the automatic re-extraction on a bigger model was removed.
- **Weight-parsing** — `parsed_weight`/`weight_source`/`weight_basis` removed from the extraction prompt/schema, `store/useStore.ts`, `lib/invoicePipeline.ts`, and the "Add weight to compare vendors" UI block in `app/scan/review.tsx`. Soft cut: the DB columns (`invoice_line_items.parsed_weight`/`weight_source`/`weight_basis`/`normalized_price_per_lb`) were left in place, nullable and unused, rather than a destructive migration. Price alerts work at whatever unit the vendor printed (case, lb, box) and never needed this.

**Built (previously mock or missing entirely):**

- **Vendor dedup bug, fixed + live data merged.** Root cause: not literal duplicate names — OCR whitespace/punctuation drift ("S. J. Distributors LLC" vs "S.J. Distributors LLC") that the old exact-match `ilike` query correctly failed to catch. Vendor resolution in `extract-invoice/index.ts` now normalizes (lowercase, strip punctuation, collapse whitespace) and checks the `aliases` column (existed in the schema since the initial migration, never populated until now) before creating a new vendor. The two existing duplicate rows in the live DB were merged: the orphaned row's invoice was repointed to the survivor, the variant spelling was added to `aliases`, and the duplicate row was deleted.
- **Real price-creep alerts** — previously `MOCK_ALERTS`, now a real detection pass. `price_alerts` table already existed in the initial schema (shaped around the not-yet-built canonical `items` catalog); extended with `line_item_id`/`item_name` via migration `20260720150000_price_alerts_line_item_ref.sql` so alerts don't require that catalog to exist. `extract-invoice/index.ts` compares each new charge line item against the same vendor's most recent prior line item with a matching `clean_name` + `unit_of_measure` (case-insensitive), and inserts an alert when price rose more than 3%. `store/useStore.ts`'s `fetchPriceAlerts` replaces the mock array; `markAlertRead` now writes through to the DB.
- **Vendor/invoice screens wired to real Supabase data** (`MOCK_VENDORS`/`MOCK_INVOICES`/`MOCK_DAY_DATA` removed) — this was mostly done in the prior session (`fetchDashboardSummary`, `fetchVendorInvoices`, `fetchInvoiceById`); this pass added the pieces still missing for the "manage invoices/search/history" part of the scope:
  - **Global "All Invoices" view** — folded into the Vendors tab as a segmented control ("Vendors" / "All Invoices") rather than a 6th tab bar item, with client-side search by vendor name or invoice number (`fetchAllInvoices` in `lib/invoicePipeline.ts`).
  - **Original image viewable after save** — images were always kept in Storage but there was no way back to them once an invoice was saved. `components/ui/ImageViewerModal.tsx` generalizes the modal that used to be local to `app/scan/review.tsx`; a new "View original invoice" tile on `app/invoice/[id].tsx` lazily signs and fetches the stored image(s) (`fetchInvoiceImageUrls`).
  - **Disputes screen** — was a flat list with one global total and no vendor contact info. Now grouped by vendor with a per-vendor running dollar total and an inline contact card (rep name, tappable phone number), matching the pattern already used on `app/vendor/[id].tsx`.
  - **Category-over-time spend** — new "Spend by category" card on the home dashboard (`DonutChart`, same pattern as the existing "Delivery check" tile), aggregated in `fetchDashboardSummary` from the same invoice fetch used for vendor/day totals.
  - **Real CSV export** — was a `showToast('coming soon')` stub. `lib/csvExport.ts` builds a CSV (date, vendor, invoice #, item, qty, unit, prices, category, verification status) from `fetchAllInvoices` and hands off to the native share sheet via `expo-file-system` (new dependency, v19 `File`/`Paths` API) + `expo-sharing` (new dependency).
- Also fixed while wiring price alerts sign display: the spend-change arrow on the home dashboard was hardcoded to always show ↑ in green — now shows ↑/↓ matching the actual sign, red when spend increased.

**Not touched, still true:**

- **Cross-vendor item-normalization catalog** (`invoice_line_items.item_id` / `items.canonical_name`) — still unbuilt. Price alerts now work without it (matching directly on `clean_name` + `unit_of_measure` per vendor), so this is lower priority than it was.
- **Real offline upload queueing** — still just connectivity detection, no queue/retry. Explicitly out of scope per the "camera-only capture, no offline queue" launch scope.
- **AI briefings** — still hardcoded text in `app/briefing.tsx`.
- **Crash reporting is wired but inert** — `@sentry/react-native` needs a real DSN (see `SETUP.md`).
- **Apple Developer Program enrollment and `eas submit` credentials** — human-only steps tracked in `SETUP.md`.
- **"Invite staff" in More is a dead stub** — Clerk's org roles (Owner/Manager/Staff) are used only for tenant scoping today, never role-gated UI, which matches the "single-tier roles" launch scope as-is. Flagging only because there's currently no way to actually get a second person into an org.

## Phase 5 — App Store compliance audit

Audited the app specifically against Apple's App Review Guidelines, not just feature completeness. One hard blocker found and fixed; the rest were submission-process gaps.

**Fixed:**

- **No in-app account deletion (Guideline 5.1.1(v) — hard rejection reason).** The app supports account creation (Clerk email/OTP sign-up) but had no way to delete that account from within the app, which Apple requires. Added a "Delete account" action to `app/(tabs)/more.tsx` (destructive `Alert` confirm → `user.delete()` via Clerk → redirect to `/(auth)`). This only deletes the person's sign-in identity, not their organization's invoice data — the confirmation copy says so explicitly, since org data is shared with any other members. Requires a one-time Clerk dashboard toggle ("Allow users to delete their own account") — added to `SETUP.md`, unchecked; until it's enabled, the button surfaces Clerk's error via toast rather than silently failing.
- **Legal links were dead text, and no privacy policy existed anywhere.** The sign-in screen's "Terms of Service and Privacy Policy" line was static, non-tappable text pointing at nothing — Apple requires a live, working Privacy Policy URL in App Store Connect, and dead legal links read poorly in review either way. Drafted `legal/privacy-policy.html` and `legal/terms-of-service.html` (self-contained static pages, accurate to this app's actual data flow: Clerk for auth, Supabase for storage, Anthropic for OCR extraction, Sentry for crash reports, no ads/tracking/data sale). Both have `[FILL IN ...]` placeholders for the launch date and a real contact email — intentionally not invented. Wired `constants/legal.ts` (`PRIVACY_POLICY_URL`/`TERMS_URL`, read from `EXPO_PUBLIC_PRIVACY_POLICY_URL`/`EXPO_PUBLIC_TERMS_URL`) into the sign-in screen's legal text and More → "Privacy & data" (previously a `coming soon` stub). Until those env vars are set, both fall back to a no-op/toast instead of opening a dead link. `SETUP.md` has the hosting + env var checklist.
- **Export compliance question on every build.** Added `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` to `app.json` — the app only uses HTTPS, so this is accurate and skips App Store Connect's encryption questionnaire on each submission.

**Checked, no issue found:**

- RLS is enabled with tenant-isolation policies on every table (`supabase/migrations/20260717035812_init_schema.sql`) — no cross-org data leak risk.
- App icon is 1024×1024 with no alpha channel — meets App Store asset requirements.
- `.env` is properly gitignored and was never tracked; no secrets in the client bundle (only Clerk publishable key + Supabase anon key, both designed to be public).
- `expo-notifications` plugin is configured but not yet wired to request permission or register a token anywhere in the app — inert, not a rejection risk, and left in place since the PRD's price-alert/briefing features are designed around push delivery.
- Remaining More-screen stubs ("Invite staff," "Notification settings," "Alert sensitivity") are honest `coming soon` toasts, not broken/misleading UI — acceptable for a v1 submission under Guideline 2.1.

**Verified this session:** `tsc --noEmit` clean; Metro successfully bundled both changed screens (`more.tsx`, `sign-in.tsx`) with no resolution/syntax errors; booted the app in a live iOS Simulator (already signed into a real account) and confirmed the home screen renders correctly with these changes included. Did not tap through to the More screen's new delete-account control in the simulator, since that account is real and the action is irreversible — verify that flow manually, expecting a Clerk error toast until the dashboard toggle above is enabled.

## Suggested next steps, roughly in priority order

1. Enable "Allow users to delete their own account" in the Clerk dashboard, then manually test the new Delete Account flow end-to-end on a throwaway test account (not a real org).
2. Fill in the placeholders in `legal/privacy-policy.html` and `legal/terms-of-service.html`, host them, and set `EXPO_PUBLIC_PRIVACY_POLICY_URL`/`EXPO_PUBLIC_TERMS_URL`.
3. Scan a real invoice for a vendor/item that already has price history to confirm a `price_alerts` row lands end-to-end (verified everything up to that point this session; the detection query itself needs a live scan to trigger).
4. Fill in `EXPO_PUBLIC_SENTRY_DSN` (create a free Sentry project) so the error boundary's caught exceptions actually get reported somewhere.
5. Decide whether "Invite staff" needs a real Clerk `organization.inviteMember` flow before launch, or if Owner-only usage is fine for v1.
6. Once ready for a real device build: `eas login`, fill in `eas.json`'s `submit.production.ios` fields (also enter the Privacy Policy URL in App Store Connect's App Privacy section), and run `eas build --platform ios`.
