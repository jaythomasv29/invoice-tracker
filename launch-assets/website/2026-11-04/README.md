# Website media refresh — November 4, 2026

Seven fresh 1320 × 2868 native captures from the current Sift UI (`cd9cd3e`), using a disposable development Clerk identity and the local fictional Willow & Pine Kitchen ledger. No production restaurant, invoice, photo, email or billing data was used or modified.

- `raw/`: Home with the supplier spending bar, expanded Purchasing intelligence, invoice review, price alerts, invoice library, recipes and suppliers. The native screen geometry, status bar and safe areas are preserved. Only the sample-mode exit banner was hidden during capture; the website labels the data as fictional.
- `*.webp`: high-quality browser exports. Matching content-hashed copies live in `website/public/screens/` so old cached images cannot replace the refresh.
- `video/Sift-launch-film-1920x1080-original.mp4`: exact copy of the file supplied in Downloads. SHA-256 `dc5761364281a4ca851d0c0a2b62acac0c904e22e114a64fde86d1ed07c3a526`.
- `video/Sift-launch-film-web-1920x1080.mp4`: 45-second 1080p H.264/AAC website edition. The first 37.5 seconds of supplied footage remain; the final 7.5 seconds use a new “Coming to iPhone” card because the app is still prelaunch. Original audio is retained. This does not recapture the app footage inside the supplied film.
- `video/web-closing-card.png`, `video/launch-film-poster.jpg`, `video/launch-film.en.vtt`: closing artwork, poster and optional English captions. A text description is also available below the website player.
- `manifest.json`: source and browser-export hashes, dimensions, duration and provenance. The website imports the matching manifest at `website/src/content/media.json`.

The player is click-to-play, with native controls, inline iPhone playback and no video preload/autoplay. The phone mockups use each capture's intrinsic ratio without cropping or repainting the interface.

Rebuild browser exports with `node scripts/prepare-website-media.cjs` from the repository root (requires the website's installed `sharp` dependency). `video/build-web-edition.py` rebuilds the website film/closing artwork; set `SIFT_FFMPEG` to a trusted ffmpeg executable if it is not on PATH. Then regenerate the browser exports. Temporary development capture routes/config overrides were removed after capture and the disposable identity was deleted.


## Live verification

Production deployment `dpl_47KUF4jogrdAB5ZnnLaBLuBMUZaQ` (website source `442c7b2`) is READY at https://siftcosts.com. `verification/public-media.json` records current HTML, checksums, video range support, captions/poster/legal responses and image-optimizer geometry. `verification/website-live-desktop.png` is a page-only crop of the final live desktop view, excluding personal browser chrome/bookmarks; `verification/website-live-mobile.png` captures the live 375-point iPhone Safari layout. Native app source was restored after capture and no production invoice data was changed.
