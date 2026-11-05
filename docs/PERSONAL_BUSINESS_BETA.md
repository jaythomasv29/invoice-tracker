# Personal + Business beta implementation — November 4, 2026

## Shipped scope

Personal: groceries and household shopping, user-owned workspace, receipt/store language, dated spending and colored store breakdown, receipt history, optional Personal Pro category/store trends and conservative repeat-product net-price history/watch/alerts. Business: existing restaurants/invoices retained, purchasing intelligence, suppliers/delivery checks and optional Business Pro recipe costing. Profile switches/adds workspaces. Personal never starts the restaurant demo tour or exposes recipe routes. Shared UI motion respects Reduce Motion.

Personal Free 5 / Pro 40 scans, $4.99 US/month. Business Free 10 / Pro 100 scans plus 10 AI recipe draft attempts, $9.99 US/month. Prices are configured in Apple/RevenueCat; actual StoreKit localized price is displayed. Separate subscription groups/products/entitlements, one purchasing-owner identity. Cancellation retains access through expiry and saved records afterward. No annual plan, pantry, shopping lists or household sharing in this release.

Personal is not a Clerk organization. RLS validates the workspace-selection header against signed user+issuer ownership or signed active Business membership; absence of the header preserves old Business clients. Only server code can change Personal plan or bind billing. Billing owner isolation prevents another administrator from binding their household to the original owner's Apple receipt. New account deletion jobs include verified issuer and erase household records/private photos plus solely owned businesses while retaining legitimate shared records.

## Verification completed

- Native app typecheck/lint and 33 Node regression tests, plus 6 Deno billing tests.
- All migrations applied in an isolated PostgreSQL database. SQL regression covers owner, different user, different issuer, forged Business/Personal selector, legacy header-free clients, client plan/billing tampering, shared owner billing identity, cross-owner billing rejection, edited-product metadata/alert invalidation and deletion tombstones.
- Hosted disposable Development Clerk identities verified no-organization Personal signup, Business-first and Personal-first billing identity continuity, exact ownership, plan update rejection and both workspace profiles.
- Three synthetic grocery receipt images went through the hosted AI pipeline and saved successfully. Printed totals, purchased quantity and package size matched. A readable item coupon produced an attributable net price; an uncertain coupon was conservatively excluded.
- Buying more at the same net unit price generated no false alert. A later reliable 33.33% net unit-price increase produced exactly one alert; repeated refresh did not duplicate it. Exact-image duplicate returned HTTP 409; spending and successful scan allowance stayed unchanged.
- Hosted disposable household deletion removed its auth user, household, receipt, vendor, billing link and private image.
- Preservation baseline compared all 35 pre-existing invoices and every original line-item field: unchanged. Additional records belong only to isolated fictional QA identities, not the owner's restaurant.
- Native simulator verified Personal/Business switching, separate Free limits, hidden Personal recipe tab, actual receipt/store dashboard, and readable Personal Pro price-watch values. Marketing screenshots use only fictional fixtures.
- Website build/lint and production deployment; new Personal screenshot, dual-workspace price table and privacy/terms copy. Existing film is labeled a Business preview. App Store draft description/name/subtitle, reviewer notes, Personal-first screenshot and header/search creative updated. Reviewer credentials preserved.
- Apple Personal product reached READY_TO_SUBMIT after completing regional price entries. Availability remains US-only. Personal Pro review screenshot is COMPLETE. Neither the app nor subscription was submitted to public review.

## Production services

Supabase additive migrations: 20261104010000 through 20261104014000. Functions: workspace-profile, extract-invoice, refresh-household-insights, draft-recipe, sync-subscription, revenuecat-webhook, delete-account and maintenance. `ai_model_usage` records model/token counts without receipt contents; it is service-only and follows workspace deletion.

Apple Personal group 22547486 / SKU sift_personal_pro_monthly / subscription 6830937359. Business retains group 22536267 / SKU sift_pro_monthly / subscription 6829616203. RevenueCat Personal product prod8e29fceaaf, entitlement personal_pro, package personal_monthly in the existing default offering. Canonical customer IDs retain existing restaurant IDs when Business came first; Personal-first owners retain their pws_ identity when adding Business.

Synthetic Sonnet usage across the first three receipts averaged 3,195 input and 985 output tokens, about $0.0162 at the published $2/M input + $10/M output rate, excluding fingerprint, retries, hosting and other fees. This is not representative real-invoice cost validation. See PRICING_DECISION.md.

## Remaining public-release checks

1. Physical TestFlight: verify new StoreKit prices, purchase Personal Pro, switch back to Business, restore each plan without losing the other, cancel one and confirm its paid-through date and the other plan's access. SDK native purchase sheets cannot be tested in Expo Go.
2. Representative real grocery receipts and supplier invoices, including long/multipage pages, discounts, returns and ambiguous identities: at least 20 approved samples with correction/cost measurements. Synthetic tests do not prove real-document accuracy.
3. Small-screen/landscape, largest Dynamic Type, Reduce Motion and motion smoothness on real hardware; simulator captures do not establish all physical accessibility/performance results.
4. Refresh/finally validate public listing assets against the final release candidate. Existing Business film/preview remains Business-focused; Personal has a separate actual native screenshot. Verify final App Privacy inventory still matches production SDK/data behavior. No new tracking or advertising SDK was added.
5. Build a production-channel App Store release candidate when ready; permission descriptions should explicitly include grocery/household receipts. Beta UI changes are delivered compatibly to build 7 by OTA, without another EAS native build. Do not submit the beta-channel binary as the final production release without reviewing channel/configuration.

Source SVGs, raw Personal capture and exported artwork: launch-assets/personal/2026-11-04 and launch-assets/screenshots/app-store/07-personal.*. Original supplied film and pre-existing exports are retained.
