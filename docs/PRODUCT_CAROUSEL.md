# Purchased-product carousel and AI pattern reviews

November 6, 2026. The existing green Spending panel is now the first page of a horizontal carousel. Products loads the complete purchased-product catalog in 200-record pages and virtualizes the cards. History loads on demand; the detail sheet paginates all recorded lines and opens their original invoice. Records are grouped by the existing exact supplier/raw-description/billing-unit key. Merely viewing a product does not create or edit catalog entries or invoice data.

Product cards show the last recorded date, billed quantity, amount and supplier. Missing dates are labelled; upload dates never become order-date predictors. The Spending page retains its horizontal supplier bar, legend, totals and saved-history milestone. Day/week/month controls apply only to that page. Navigation has explicit Previous/Next buttons as well as swiping, dynamic content height and Reduce Motion support.

## Evidence and unlocks

shared/reorderForecast.ts deduplicates line IDs, groups invoice quantities, combines same-day orders, rejects missing/invalid/future dates and non-positive/unknown quantities or charges, and uses up to seven recent purchase dates. Four distinct usable dates are required. Median purchase intervals produce a stock-check window with an observed-deviation buffer. Irregular intervals, substantially changed order size, uncertain retail identity or histories older than three usual cycles suppress the timing window.

These are buying-history cues, not calibrated demand forecasts. They have no inventory, sales, depletion, open orders or shelf-life input; no purchase quantity is recommended. The card shows recent evidence, source count and uncertainty. Pattern progress is earned from saved history, not spending more money.

## AI service

product-reorder-insight uses the existing Anthropic provider/model and signed Clerk/RLS workspace verification. Server-side Pro/legacy Plus and existing AI consent are required before any provider call or cached result. Only derived dates, quantities and numeric pattern facts are sent to Anthropic; product names, raw descriptions, photos, prices, addresses and account numbers are not part of its prompt. The structured tool selects a permitted stock-review action and focus; model text cannot invent dates, inventory or quantities. Displayed facts and explanations come from verified records and validated output enums.

Reviews have a separate 60-attempt/calendar-month and 10-attempt/rolling-day allowance per workspace; failures count toward abuse protection. They do not consume scans or recipe drafts. Identical evidence is cached for up to 24 hours. The paywall lists the included review allowance. AI permission is rechecked after inference and before serving cache. Both immediate deletion and maintenance retries remove insight jobs and wait for recent running reviews.

Migration: 20261106010000_product_reorder_insights.sql adds only a read-only RLS history RPC plus the separately protected job/cache table and service-only reservation RPC. No existing invoices or lines are rewritten. Backend functions deployed: product-reorder-insight, delete-account and maintenance.

## Verification

- TypeScript/ESLint, 47 Node tests; Deno checks for new and affected functions.
- Every migration applied to a disposable PostgreSQL 14 database. SQL fixtures verify saved/void/credit/draft filtering, pagination, workspace isolation, client privilege restrictions, busy/cached requests, separate budgets and deletion tombstones. Fixture writes roll back.
- Hosted disposable development identities: real signed JWTs, two workspaces and four fictional weekly invoices. Verified anonymous/forged rejection, cross-workspace isolation, consent requirement, a real Anthropic review, grounded cadence/action, no recommended quantity, cache reuse, withdrawal blocking cache, and server-side Pro enforcement. All identities, templates, consent, invoices, lines, vendors and insight jobs created by the test were cleaned up.
- Actual UI components rendered in the isolated browser fixture: Spending/Products switch, next product, hidden spending filters in Products mode, last date/quantity/price, evidence progress and history sheet with invoice destinations. Native gesture feel, VoiceOver and largest Dynamic Type still require phone confirmation.
- iOS runtime fingerprint matches installed TestFlight build 7: 062bedef39aff97c339accbe22183fe3470f622f. No native dependency was added.

## Smart Sift branding

Product reviews, recipe drafts, permission controls, onboarding, and plan labels use **Smart Sift**. Anthropic (Claude) remains explicitly disclosed where data sharing is explained. This is a naming change; the deployed provider remains Anthropic. Apple’s Foundation Models could support on-device reviews in a future native build, with runtime availability checks and a clearly disclosed cloud fallback. No Apple model integration is included in this OTA.
