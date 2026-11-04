# Sift launch assets

Open `index.html` for the full gallery, `contact-sheet.png` for the six screenshots, and `previews/preview-contact-sheet.png` for representative video frames.

## Deliverables

- `brand/sift-icon.svg` and `brand/sift-icon-1024.png`: editable vector source and opaque RGB 1024 × 1024 app icon. The app uses the PNG at `assets/icon.png`; a native binary must be built/uploaded for App Store Connect to receive its icon. App icons cannot be replaced by OTA updates.
- `brand/sift-splash.svg`: matching transparent vector splash artwork; app export at `assets/splash-icon.png`.
- `screenshots/raw/`: six actual 1320 × 2868 iPhone simulator captures of Sift's React Native screens, running in Expo Go SDK 57 / iOS 18.6 on an iPhone 16 Pro Max simulator. This is UI verification, not StoreKit purchase verification.
- `screenshots/app-store/`: six coordinated 1320 × 2868 RGB PNG layouts and editable SVG sources. Story: spending, searchable invoices, invoice review, Pro recipe costing, Pro price alerts, supplier comparison.
- `creative/product-page-header-3840x1646.png` and SVG: 21:9 product page header.
- `creative/search-results-3840x2560.png` and SVG: 3:2 search-result creative with an actual app capture.
- `previews/sift-app-preview-886x1920.mp4`: 22-second native-screen preview, H.264 High / Level 4.0, 30 fps, yuv420p, silent stereo AAC 48 kHz. Feature captions occupy their own top band and label Pro features; no native UI is repainted.
- `previews/source/`: original simulator screen recording, scene markers and caption images. The renderer normalizes variable-frame-rate footage before trimming so static screen intervals remain correctly timed.
- `website/`: reusable downscaled PNG screen exports. The website also has full-resolution copies in `website/public/screens/`, updated icon/favicon and social artwork.
- `app-store-upload-status.json`: asset IDs, source hashes and verified processing state. It contains no authentication keys. Uploads and placements are drafts; this workflow does not submit App Review or release the app.

All restaurant, invoice, vendor and recipe content in these captures is fictional sample data. The matching sample invoice document in `brand/demo-invoice.*` exists only for product demonstration. No owner's live invoices, account identifiers, email addresses, financial details, credentials or real customer data appear in the artwork.

## Rebuild

Use the project's Node version and installed website dependencies. Install auxiliary media tools outside the app dependency graph:

```sh
npm install --prefix /tmp/sift-media-tools --no-package-lock sharp fontkit ffmpeg-static
node scripts/create-launch-assets.cjs
node scripts/create-app-preview.cjs
```

Set `SIFT_MEDIA_TOOLS` to use another tools directory. Manrope fonts come from the app's existing `@expo-google-fonts/manrope` package; headline text is converted to vector paths, preserving typography without installing fonts into the OS.

`scripts/capture/design-preview.tsx.template` is a development-only bootstrap template. It was temporarily copied into app/design-preview.tsx to activate a disposable **development** Clerk user, load the existing local sample ledger and navigate to the real screens. The bootstrap route was removed before release export; it is not part of the shipped app. Never use a production owner account for public marketing captures.

Uploads use `scripts/upload-launch-assets.cjs` with an authenticated API client factory specified by `SIFT_ASC_CLIENT`. Keep keys outside the repository. The script resumes from recorded IDs; confirm source checksums before reusing an already-uploaded filename after editing it. Verify processing state and browser placements before treating an upload as complete.

## Apple specifications checked November 2, 2026

- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- [App preview specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications)
- [Creative asset specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications)
- [Asset best practices](https://developer.apple.com/app-store/asset-best-practices/)

The app targets iPhone; no unsupported iPad or iPhone Duo layout is represented. Screenshots/preview use the API's APP_IPHONE_67 / IPHONE_67 display families, which cover the large Dynamic Island display. No pricing, invented savings, ratings, awards or competitor claims are included in the creative assets.


## Delivery verification

Apple processed all six screenshots and the preview as COMPLETE. Both header and search artwork show 1 of 1 assigned in the browser editor. Build 7 is VALID and in internal beta testing, attached to the App Store draft, and carries the new icon. The modern interface also reached the owner's build 6 by OTA, confirmed on the phone. No public App Review submission or release was performed.

The live website at https://siftcosts.com uses these native-screen exports. Physical build 7 and Pro purchase/restore checks remain in `docs/PHONE_TEST_CHECKLIST.md`.


## Current website refresh — November 4, 2026

The marketing website now selects fresh build-7-era native UI captures and a website launch film from [`website/2026-11-04/`](website/2026-11-04/README.md), through `website/src/content/media.json`. This includes the supplier spending bar and permanently expanded Purchasing intelligence. The original supplied Downloads movie is preserved alongside a prelaunch website edition with “Coming to iPhone” closing artwork. Public App Store screenshots and the older 22-second Apple preview remain separate; this website refresh does not replace uploaded Apple assets or submit the app.
