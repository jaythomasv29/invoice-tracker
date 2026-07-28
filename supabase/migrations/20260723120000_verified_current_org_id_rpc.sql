-- billing-portal and create-checkout previously derived org_id by locally
-- base64-decoding the caller's Clerk JWT payload with no signature check
-- (supabase/functions/_shared/clerkAuth.ts:decodeJwt) — since those two
-- functions never touch an RLS-scoped query, that decoded org_id was never
-- actually verified. An attacker could send an unsigned/forged JWT with an
-- arbitrary org_id claim and open another org's Stripe billing portal, or
-- overwrite another org's stripe_customer_id.
--
-- This RPC exposes private.current_org_id() (which reads auth.jwt(), a claim
-- set populated only from a JWT whose signature Supabase's third-party-auth
-- integration has already verified against Clerk's JWKS) so edge functions
-- can get a trustworthy org id the same way every RLS policy already does.
create or replace function public.current_org_id()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select private.current_org_id();
$$;

grant execute on function public.current_org_id() to authenticated;
