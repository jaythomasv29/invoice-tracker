# Personal workspace capture and dual-workspace creative

Actual 1320 × 2868 native simulator capture of the Personal dashboard. Household/store names and all purchases are fictional, isolated from the owner's records. Three grocery examples were extracted by the hosted AI pipeline; the household-supplies example is an explicit fixture. The development-only QA entitlement override previews paid UI and does not change server billing or scan allowances. No login ticket or account secret is shipped.

- `raw/personal-home.png`: unchanged native capture.
- `personal-home-*.webp`: website encoding of the same full screen; geometry preserved.
- `social-card.svg/png`: dual-workspace social artwork.
- `subscription-review-upload.json`: Apple upload identifiers/status, no credentials.
- App Store wrapper: `../../screenshots/app-store/07-personal.svg/png`.
- Header/search creative: `../../creative/` (both modes; app icon preserved).

Rebuild artwork with `node scripts/prepare-personal-launch-assets.cjs`; website capture exports are supported by `node scripts/prepare-website-media.cjs`. The supplied launch film remains a Business preview, identified as such on the website.
