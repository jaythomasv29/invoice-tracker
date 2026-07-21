# Setup checklist

Things only you can do (account creation, dashboard config, secrets) —
nothing here can be provisioned by Claude. Check items off as you go; this
file stays in the repo so it doesn't get lost in chat history.

## Clerk (auth)

- [x] Create an app at clerk.com (`app_3GcUYfuOsQtxCikxoZjRVj6TMvr`)
- [ ] Authentication → enable **Email address** as an identifier, verification strategy **email code** (v8 pivot — SMS/phone auth needs a paid Clerk plan; email code is free-tier)
- [ ] Turn off password (email OTP only, no password fallback)
- [ ] Organizations → enable (needed for the restaurant/org model)
- [x] Copy the **publishable key** → `.env` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [x] Copy the **secret key** → `.env` as `CLERK_SECRET_KEY` (stashed for later — not used by the client; will move to a Supabase Edge Function secret if/when we need server-side Clerk Backend API calls)
- [ ] User & Authentication → **Account portal / restrictions** → enable **"Allow users to delete their own account"**. Required for the in-app "Delete account" flow (More screen) — Apple rejects apps that support account creation but not in-app account deletion (Guideline 5.1.1(v)). Without this toggle, `user.delete()` will fail with a Clerk error surfaced via toast.

## Supabase (backend)

- [x] Create a project at supabase.com (**"invoice tracker"**, ref `mfabuswvobhatxacikmc`)
- [x] Clerk as a Third-Party Auth provider — done via `supabase/config.toml`'s `[auth.third_party.clerk]` block (`domain` decoded from the publishable key) + `supabase config push`, not the dashboard UI. Confirmed applied (`supabase config push` reports "Remote Auth config is up to date").
- [x] Copy the **project URL** → `.env` as `EXPO_PUBLIC_SUPABASE_URL`
- [x] Copy the **anon key** → `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [x] Link the local project: `supabase link --project-ref mfabuswvobhatxacikmc`
- [x] Push the schema: `supabase db push` — applied, all 7 tables + RLS policies live on the remote project (confirmed via `supabase migration list`)

## Anthropic (OCR extraction)

- [x] Create an API key at console.anthropic.com
- [x] Add it as a **Supabase Edge Function secret** (moved from `.env`, where it doesn't belong, to `supabase secrets set` — Edge Functions can't see the app's local `.env`)
- [x] Deploy the function: `supabase functions deploy extract-invoice` — live, `status: ACTIVE`, `verify_jwt: true`

## Sentry (crash reporting)

- [ ] Create an account/project at sentry.io (React Native platform)
- [ ] Copy the **DSN** → `.env` as `EXPO_PUBLIC_SENTRY_DSN`

## Local env file

- [x] `.env` populated with Clerk + Supabase keys
- [x] `.env` is gitignored — verified not tracked by git

## Legal pages (required before App Store submission)

- [ ] Fill in the placeholders in `legal/privacy-policy.html` and `legal/terms-of-service.html` — the `[FILL IN DATE BEFORE PUBLISHING]` and `[FILL IN CONTACT EMAIL]` markers in each file. Have a human (ideally with legal review, even if brief) confirm the drafted content is accurate for your actual data practices before publishing.
- [ ] Host both files somewhere public — easiest is GitHub Pages: enable Pages on this repo (Settings → Pages → deploy from `main` branch, `/legal` or root), or paste the content into a Notion page shared publicly, or host on any static site.
- [ ] Put the resulting URLs in `.env` as `EXPO_PUBLIC_PRIVACY_POLICY_URL` and `EXPO_PUBLIC_TERMS_URL`. Until these are set, the sign-in screen's legal links and More → Privacy & data silently no-op instead of opening a dead link — so nothing breaks, but submission needs them filled in.
- [ ] Apple also requires the Privacy Policy URL entered directly in App Store Connect (App Privacy section) — same URL, separate field.

## Apple (later — App Store release phase)

- [ ] Apple Developer Program enrollment ($99/yr), if not already done
- [x] `eas.json` created (`build` profiles for development/preview/production + a `submit` stanza) — the `submit.production.ios` block's `appleId`/`ascAppId`/`appleTeamId` are left blank since those come from your own Apple Developer account
- [ ] Fill in `eas.json`'s `submit.production.ios` fields once enrolled (App Store Connect app-specific ID, Apple ID, team ID)
- [ ] Run `eas login` and `eas build --platform ios` once ready to produce a real build

---

Once Clerk + Supabase are wired up, tell me and we can smoke-test real
sign-in end-to-end together.
