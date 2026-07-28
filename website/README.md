# Sift marketing site

Standalone Next.js (App Router, TypeScript, Tailwind v4) site — the public
face of the Sift app for App Store review, marketing, and pre-launch waitlist
signups. Lives inside the Expo app's repo but deploys and runs completely
independently of it.

## Routes

| Route             | Purpose                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| `/`                 | Parallax landing page — hero, feature sections, waitlist CTAs.          |
| `/api/waitlist`     | `POST { email, source? }` — inserts into Supabase, used by `WaitlistForm`. |
| `/billing-return`   | Stripe redirects here after checkout/the billing portal; bounces the visitor into the native app via `sift://billing-return`. |
| `/privacy`          | Privacy policy (ported from `../legal/privacy-policy.html`).            |
| `/terms`            | Terms of service (ported from `../legal/terms-of-service.html`).        |

## Local setup

```bash
cd website
npm install
cp .env.local.example .env.local   # fill in the three Supabase values below
npm run dev
```

Env vars (`.env.local`, never committed):

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same values as the Expo app's `.env` (same Supabase project).
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, from Supabase dashboard → Project Settings → API. Used solely by `/api/waitlist` to write to `waitlist_signups`, a table with no anon-facing RLS policies at all (see the migration).

## Before this goes live — things only a human can do

1. **Apply the new migration.** This site added `supabase/migrations/20260723140000_waitlist_signups.sql` (plus two earlier security-fix migrations from the same session — `20260723120000_verified_current_org_id_rpc.sql` and `20260723130000_atomic_extraction_quota.sql`). From the repo root: `supabase db push`.
2. **Deploy this site** (Vercel is the path of least resistance for a Next.js app — `vercel` from this directory, or connect the repo and set the root directory to `website/`). Set the three env vars above in the deployment's environment settings.
3. **Point `APP_RETURN_URL` at the real domain.** The Stripe edge functions (`create-checkout`, `billing-portal`) currently use a placeholder: `npx supabase secrets set APP_RETURN_URL=https://<your-deployed-domain>/billing-return`.
4. **Fill in the legal page placeholders.** `/privacy` and `/terms` still carry `[FILL IN DATE BEFORE PUBLISHING]` and `[FILL IN CONTACT EMAIL]` — update both `website/src/app/privacy/page.tsx` and `website/src/app/terms/page.tsx` (and the original `../legal/*.html` files stay as the canonical source text if you'd rather edit those and re-port).
5. **Point the App Store Connect / `.env` legal URLs here** instead of a separate static host: `EXPO_PUBLIC_PRIVACY_POLICY_URL=https://<domain>/privacy`, `EXPO_PUBLIC_TERMS_URL=https://<domain>/terms`.
6. **App Store badge**: intentionally not included anywhere on the site — the app isn't listed yet. Add Apple's official "Download on the App Store" badge (from Apple's Marketing Resources — don't reuse a screenshot from elsewhere) to the hero/nav once there's a real App Store URL to link it to.
