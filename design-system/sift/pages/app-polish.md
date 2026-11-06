# Native app styling — November 6, 2026

Owner-provided reference: Wise Design style reference. This pass adapts its visual hierarchy and shapes while retaining Sift's existing Colors tokens, Manrope font family, features, copy, navigation destinations and data behavior. These styling decisions supersede the earlier card-radius and restrained-shadow guidance for the surfaces changed in this pass.

- Flat surfaces: use ivory canvas, white cards, evergreen hero and existing sage accent. No imported Wise palette, gradients, decorative photography or new font dependencies.
- Shapes: shared 28-point content cards, 32-point spend hero and fully rounded action/segment pills. Dense invoice rows keep a 24-point radius and compact padding; inputs remain recognizable fields.
- Typography: 30–32-point page headings, tight tracking, readable body leading. Preserve Manrope 800 for headlines/amounts and 400–600 for supporting UI. Avoid the reference's desktop display sizes and compressed 0.85 line height on native screens.
- Home: sage spend amount against evergreen, sage invoice action and selected period, stronger section spacing. Purchasing intelligence stays expanded.
- Navigation: opaque white rounded surface, existing green scan action, unchanged tab visibility and safe-area inset.
- Interaction: keep existing press springs, Reduce Motion support, processing/disabled states and all handlers. Period controls have at least 44-point targets; dropdown starts below its trigger.

Verification results and remaining device QA are recorded in docs/STYLING_PASS.md.
