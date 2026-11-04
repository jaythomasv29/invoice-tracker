# Sift launch verification — November 3, 2026

Public release remains gated; no App Review submission has been made.

| Check | Result | Evidence / remaining work |
|---|---|---|
| Real saved invoices | Preserved | Four saved invoices with source photos; read-only baseline unchanged after function deployments. No invoice deletions or re-extractions. |
| Real-invoice spending accuracy | Sampled | Four totals and the historical invoice date compared against source images; 34 saved line items reviewed. This is a limited sample, not a general accuracy guarantee. More supplier/layout samples remain advisable. |
| Supplier bar / scan controls / animations | Implemented; phone checks pending | Current beta includes the bar and native motion. Actual rendering, processing lock and smoothness still need physical-phone confirmation. |
| Price and purchase | Owner reports pass | Build 7 shows a price and successful purchase. |
| Cancellation and resubscription | Owner reports pass | Owner canceled and renewed successfully. Server expiry tests preserve paid-through access. New Profile status distinguishes renewal, auto-renewal off, billing issue and expiry. |
| Restore purchases | Awaiting owner | Do not infer restore success from purchase or resubscription. |
| Catch-weight / adjusted line totals | Fixed | Explicit weight cost resolution and line-total preservation; ambiguous case sizes remain unknown. Atomic edit saves line and invoice totals together. Existing invoices were not rewritten. |
| Reviewer access | Configured | Dedicated Gmail alias approved by owner; separate fictional restaurant, normal password authentication, production frontend sign-in completed. Credentials stored only in ignored local file and Apple reviewer fields. |
| Privacy questionnaire | In progress | Account, invoice, purchase, usage and diagnostic categories; app functionality, linked identity, no tracking. Verify completion/publish before submission. |
| Age rating | Draft saved | Content questionnaire completed, 16+ override consistent with business audience and privacy policy. No age-assurance claim. |
| Listing assets | Prepared | Six screenshots, preview, header/search artwork and icon already uploaded. Recheck delivery states and subscription review screenshot. |
| Final native binary | Still required before public review | Build 7 is the beta QA baseline. A final production-channel binary must embed the approved changes; do not rely on beta OTA for public App Review. |

## Verification safeguards

No owner account deletion, sign-out, invoice reset or real-invoice duplicate re-upload was performed. New sample records belong only to the dedicated review restaurant. Secrets and original invoice photographs are excluded from committed evidence and marketing exports.

## Sources

- [Apple: complete App Review information](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review)
- [Apple: app privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple: age-rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)
