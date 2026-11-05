# Personal + Business launch pricing — November 4, 2026

Owner-approved monthly launch hypothesis. This replaces the $19.99 / 150-scan / 25-draft draft. It is not a measured optimum or a promise of profitability.

| Workspace | Free scans/month | Pro/month (US) | Pro scans/month | AI recipe draft attempts |
|---|---:|---:|---:|---:|
| Personal | 5 | $4.99 | 40 | Not available |
| Business | 10 | $9.99 | 100 | 10 |

Personal focuses on groceries and household shopping: store/date spending, saved receipts, and Pro category/store trends and reliable repeat-product comparisons. Business retains supplier invoices, delivery checks, purchasing intelligence and Pro recipe costing. Saved records/basic spending/CSV remain accessible after cancellation or expiry. Calendar-month allowances reset in UTC, separately from Apple's renewal date. Failed/duplicate scans release successful-scan quota; attempt/rate limits still apply. Recipe limits count attempts. Annual plans, pantry management, shopping lists and household sharing remain deferred.

Each purchasing owner can link one Personal and one Business workspace, with separate Apple subscriptions/RevenueCat entitlements. Existing restaurant IDs, invoices and legacy Apple SKU `sift_pro_monthly` are retained. Personal uses `sift_personal_pro_monthly` / `personal_pro`. Both modes share an owner-verified RevenueCat customer identity to avoid restoring the Apple receipt between two competing identities. The billing customer cannot be shared across different Sift owners. Additional business memberships can be browsed; purchasing another Business subscription from the same owner is not supported in this release. A retired Business Plus product keeps its 300-scan allowance.

Personal workspaces live in Supabase and use verified Clerk user/issuer ownership, avoiding a Clerk organization for every household. Business membership stays with Clerk. Server-side workspace policy is shared with the client; client flags never authorize paid AI usage.

## Cost validation

The current extraction model remains Sonnet 5. Do not replace it with a cheaper model without benchmark accuracy evidence. Official pricing checked during the pricing discussion: [Sonnet 5](https://platform.claude.com/docs/en/models/sonnet-5/overview), $2/M input and $10/M output. Model usage is recorded server-side in `ai_model_usage` without receipt text, images or account email. Fingerprint and recipe usage are recorded as well. Failed HTTP requests without a returned token count are not measurable from this table; reconcile provider invoices.

Illustrative $0.025 per successful scan (5,000 input / 1,500 output tokens): Personal's full allowance costs $1; Business's costs $2.50 before fingerprints, retries, drafts, infrastructure, support and acquisition. At standard initial 70% Apple proceeds, $4.99 yields about $3.49 and $9.99 about $6.99 before taxes/other costs. At eligible 85% proceeds they yield about $4.24/$8.49. Confirm actual agreements/proceeds; Small Business Program enrollment is not assumed. RevenueCat fees and shared infrastructure also reduce margin. Heavy multi-page scans can exceed this illustrative cost substantially.

Before public launch, measure at least 20 representative approved real receipts/invoices including multipage documents, unreadable fields, discounts and different package formats. Report token distributions, failures/retries, correction rates and actual recurring bills. Synthetic fixtures establish functionality only. Revisit caps or pricing if heavy-use economics fail; no annual/unlimited commitment is made.
