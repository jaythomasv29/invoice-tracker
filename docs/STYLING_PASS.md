# Wise-inspired Sift polish

November 6, 2026. Styling-only changes across Home/insights, invoice library/rows, recipes, product controls, Profile, onboarding/sign-in, review save action and paywall. Existing color values, financial calculations, permissions, scan pipeline, subscription logic and routing are retained.

Shared shapes live in constants/Design.ts; rationale lives in design-system/sift/pages/app-polish.md. No font or package dependency was added.

Validation:
- TypeScript, ESLint and 41 existing tests passed on the initial styling changes.
- Final TypeScript and ESLint runs passed after the navigation refinement; git diff --check passed.
- Verified the diff leaves constants/Colors.ts, package manifests, lib/, store/, shared/ and supabase/ unchanged.
- The initial visual check did not complete: Expo web reports missing react-native-web; the first native build was stopped while planning. The simulator booted successfully, so describing it as blocked was inaccurate. A retry subsequently progressed into native dependency compilation without dependency or native-project changes. Rendering is not yet verified.
- Rendering at small-phone width, large text and safe-area checks are still required before release. No new screenshots or physical-device results are claimed.

Physical-device large-text, VoiceOver, safe-area and touch checks remain part of the existing launch checklist. The app declares light mode and portrait orientation; these changes do not add a dark theme or tablet support.

## Home and glass navigation follow-up

Implemented the owner's request for Home improvements, a glass-inspired bottom bar and repeated gentle motion:
- Spending comes first; supplier detail moved into “Where it went” with all period suppliers and links retained.
- Floating navigation capsule, active-tab surface, explicit Scan label, subtle focus/press response, stronger inactive-label contrast and keyboard hiding.
- Scroll visibility and nested origins drive individual panel entrances on the UI thread, with no per-frame React updates. Focus, app resume and completed data refresh replay entrances without remounting interactive controls.
- Data requests have focus, sequence and workspace-scope guards. The initial summary displays loading feedback.
- Existing expo-blur provides iOS system material. Opaque fallback honors Reduce Transparency / Increase Contrast. Reduce Motion suppresses animated movement.

Validation: final npm run check passed (TypeScript, ESLint, 41 tests). git diff --check passed. An isolated browser fixture rendered actual Home/dashboard/tab-control components with fictional demo data; auth, navigation host and network access were replaced in the fixture only. Checked 375-point phone width, Personal/Business labels and four/five destinations, period loading-to-data display, scrolling into lower panels, active-tab feedback and a browser prefers-reduced-motion fixture. No backend or app authentication bypass was added to the repository. The temporary fixture lives at /tmp/sift-ui-preview and is not part of release code.

The native retry produced a concrete toolchain error in .expo/xcodebuild.log: `package 'apple' is using Swift tools version 6.2.0 but the installed version is 6.1.0`. Installed Xcode is 16.4. The simulator itself boots; a compatible Xcode toolchain is needed to finish the native build. Native blur fidelity, physical-device frame rate, VoiceOver and largest Dynamic Type remain unverified. Browser fixture results do not substitute for these release checks.

Owner final refinements: restored the horizontal supplier distribution bar and a wrapping supplier legend inside the evergreen spend panel. Added an all-time saved-history milestone using the existing kitchenProgress logic, with an earned badge, next target, animated progress and library link. Full supplier amounts and drill-downs remain below. All 41 tests, TypeScript and lint passed under the release Node 22.13.0/npm 10.9.2 toolchain. Production fingerprint generation matched installed TestFlight build 7: 062bedef39aff97c339accbe22183fe3470f622f.
