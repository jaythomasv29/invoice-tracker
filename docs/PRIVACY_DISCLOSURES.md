# Published App Privacy disclosures — November 3, 2026

Apple App Store Connect has all 15 selected data types configured. Each is declared for **App Functionality**, linked to identity (including account/device linkage), with **no tracking**. No advertising, marketing, personalization or analytics purpose was selected. Owner explicitly confirmed Apple's final legal attestation. Publication completed and the browser showed ‘Published a few seconds ago by James Vongampai’.

| Apple data types | Actual processing |
|---|---|
| Name, Email Address | Clerk accounts and support contact; optional profile names |
| Phone Number, Physical Address | Supplier/contact information and invoice contents |
| Other Financial Info | Invoice amounts, purchasing records and business financial content |
| Photos or Videos | Invoice images and optional dish images; no camera video recording |
| Customer Support | User-provided support requests |
| Other User Content | Recipe names, ingredients, notes and other submitted content |
| User ID | User/restaurant IDs used by Clerk, Supabase and RevenueCat |
| Device ID | SDK installation/device identifiers used for service reliability and purchase operation; no IDFA advertising flow |
| Purchase History | App Store subscription status/transactions through RevenueCat |
| Product Interaction | Server-side scan/recipe requests and usage accounting |
| Crash Data, Performance Data, Other Diagnostic Data | Native/JavaScript diagnostics and SDK service reliability context |

Technical evidence: `lib/aiConsent.ts`, `app/_layout.tsx`, `lib/purchases.ts`, `supabase/functions/_shared/aiControls.ts`, authentication and private storage configuration, plus website privacy policy. Identity linkage is declared conservatively; filtering diagnostic content does not make all provider/device records anonymous.

No contacts/address-book access, location permission, audio recording, health data, advertising SDK or cross-app advertising tracking is implemented. Payment card details stay with Apple and are not received by Sift. Search filtering remains local. Images and financial documents can contain user-supplied personal data, which is why their contents are covered rather than described as anonymous.

AI provider: Anthropic (Claude). Consent names the provider and what leaves the device, is required before new requests, and can be withdrawn in Profile. Do not claim provider zero retention without verified account terms.

Public policy: https://siftcosts.com/privacy. Apple's definitions: https://developer.apple.com/app-store/app-privacy-details/.
