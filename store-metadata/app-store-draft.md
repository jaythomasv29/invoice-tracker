# App Store listing draft — Sift

Status: draft; public submission requires phone, StoreKit and deletion tests plus final screenshots and privacy review.

Name: Sift: Invoice & Food Costs
Subtitle: Scan invoices. Track costs.
Primary category: Business
Language: English (US)
Initial availability: United States
Support URL: https://siftcosts.com/support
Privacy URL: https://siftcosts.com/privacy
Terms URL: https://siftcosts.com/terms
Support email: chimpchamp92@gmail.com

## Description

Turn restaurant invoices into organized purchasing records with Sift. Photograph or import an invoice, review the extracted details, and save it for your restaurant.

• Review vendor names, dates, quantities and prices before saving.
• Keep invoice photos alongside your records.
• Follow ingredient prices and purchasing trends.
• Build recipes and calculate ingredient costs with Pro.

Free includes up to 10 invoice scans per calendar month. Pro includes up to 150 invoice scans and 25 AI recipe draft attempts per calendar month. Review the current subscription price and terms in the app before purchasing.

AI processing requires your permission. Extracted details and recipe suggestions can contain errors; always check the source invoice and ingredient costs. Internet access is required.

Pro renews automatically unless canceled through your Apple account settings. Payment is charged to your Apple account. Manage or cancel subscriptions in iPhone Settings. Deleting a Sift account does not cancel an Apple subscription.

## Reviewer preparation

Provide a working production review account and restaurant before submission, with a fictional invoice and a recipe available. Do not put credentials in this repository; add them directly to App Store Connect review information.

Steps: sign in using the provided account, open Scan, grant camera/photo and AI processing permission, scan the fictional invoice, review and save. Open Pro to view the monthly Apple subscription and Restore Purchases. Profile contains AI permission withdrawal, legal links, support and account deletion.

TestFlight and App Review purchases use sandbox receipts. Explicitly allow the review restaurant in the server sandbox organization list before review. Confirm the reviewer account can complete sign-in without depending on an inaccessible email inbox; resolve a suitable review access method before submission.

## Remaining store inputs

- Real iPhone screenshots of the finished app; subscription review image must replace the catalog tool's placeholder.
- Verify subscription metadata, all required territory prices and Apple product readiness.
- Complete App Privacy from the data inventory below and verify each SDK's current disclosures.
- Complete age rating and export compliance truthfully; verify Apple agreements/tax/banking with account owner.
- Verify the listing name/subtitle availability and lengths in App Store Connect.

## Privacy inventory for final questionnaire

Authentication: email address, user and restaurant identifiers (Clerk). Invoices/photos and recipe inputs: user content stored in Supabase; sent to Anthropic only after affirmative permission. Purchases/subscription identifiers: Apple/RevenueCat. Diagnostics: Sentry with content redaction. Waitlist: submitted email address. No advertising or cross-app tracking is intentionally implemented. Confirm the applicable Apple data-type, purpose and linkage answers against production configuration and SDK behavior before submission.
