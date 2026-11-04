# Sift marketing website

Next.js App Router / Tailwind website deployed to https://siftcosts.com, independently of the native Expo app. The linked Vercel project is `siftcosts`; use the existing `website/.vercel` link rather than creating a new project.

The landing page includes current native screenshots, expanded Purchasing intelligence, invoice review, Pro price alerts and recipe costing, a searchable invoice library, a click-to-play launch film and waitlist signups. Privacy, terms and support remain at `/privacy`, `/terms` and `/support`. The app is prelaunch: waitlist CTAs remain until its real public App Store listing is available.

## Work locally

```sh
cd website
npm ci
npm run dev
npm run lint
npm run build
```

Read `AGENTS.md` and the relevant installed Next.js docs before making changes. Next.js 16 image preloading uses `preload`; explicitly allowed optimization qualities are 75 and 90.

## Media

`src/content/media.json` selects content-hashed assets in `public/screens/` and `public/media/`. Native display ratios remain intact inside `PhoneFrame`. Video uses a poster and native controls, inline playback, optional captions and a text description; it does not autoplay or preload the full film. Shared Framer Motion settings respect Reduce Motion.

Source media, the supplied Downloads original, website film edition, hashes and rebuild instructions are in [`../launch-assets/website/2026-11-04/`](../launch-assets/website/2026-11-04/README.md). The supplied film's original final “On the App Store” card is replaced only in the website edition with “Coming to iPhone.”

## Hosting and environment

Deploy from this directory with the authenticated Vercel CLI using the existing project (`vercel --prod --yes`). Production has the waitlist's hosted Supabase configuration. For local waitlist testing, use an ignored `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`; never put the service key in a `NEXT_PUBLIC_` variable. Do not submit fake signups to production during UI/media checks.

`/billing-return` is retained for legacy deep links. Native subscriptions use Apple's in-app purchase flow. The website deployment does not create an EAS native build or modify restaurant data.
