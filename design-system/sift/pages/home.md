# Home and navigation — November 6, 2026

Owner-directed refinement: retain the supplied Wise-inspired typography, Sift palette and features; introduce Apple-inspired glass controls and gentle, repeated panel entrances. This overrides the earlier flat-navigation and single Home entrance guidance for Home and the bottom bar.

## Hierarchy

Home leads with spending and period navigation. The evergreen spend panel contains the total, saved-document count, supplier/store count and average. The horizontal supplier-distribution bar and its wrapping color-keyed supplier legend remain inside the green spend panel (owner preference). The detailed supplier list and every supplier link live in the separate “Where it went” panel. Search follows the financial overview, then expanded purchasing/shopping intelligence. Keep Personal/Business and subscription gating intact.

## Materials

Use the existing expo-blur systemMaterialLight on iOS, with a warm ivory wash and clipped specular border. Restrict it to navigation and the search control; financial panels remain opaque. The bottom bar floats above the home indicator, with a sage selection capsule and an explicit Scan label. Preserve existing colors, destinations, press semantics and tour targets.

GlassSurface starts opaque until accessibility preferences are read. Reduce Transparency or Increase Contrast uses solid white. Android and web use the same opaque fallback. This is a system-blur treatment inspired by Apple glass; it does not claim the iOS 26 GlassView/refraction API. No dependency was added.

## Motion

DashboardMotion runs visibility checks and animation on the UI thread. Fade from the current entrance state and move up at most 14 points over 460 ms with cubic ease-out; cap stagger at 120 ms. Reveal each panel when it enters the scroll viewport, once per open/data cycle. Replay on Home focus, background-to-active return and completed data refresh. Keep keys stable so period selections and menus do not reset. Nested summary panels inherit the measured origin of their containing group.

Honor Reduce Motion in reveals, tab selection, focus scale and press springs. Keep content in layout during motion, never gate data access on animation completion. AppState subscriptions exist only while Home is focused; request sequence and workspace-scope checks prevent obsolete requests from updating the loading/motion state.

## Verification

See docs/STYLING_PASS.md. Browser fixtures verify layout and the web animation implementation, not native material fidelity, VoiceOver or physical-phone frame rate.

References: [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Apple Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Expo BlurView](https://docs.expo.dev/versions/latest/sdk/blur-view/). UI/UX Pro Max glassmorphism navigation guidance was verified and adapted to the existing native stack.

The green panel also carries a compact all-time saved-history milestone with an earned badge and progress toward the next saved-invoice/receipt target. Reuse kitchenProgress deduplication and thresholds; period changes must not change this all-time count. Its library action retains the existing destination.
