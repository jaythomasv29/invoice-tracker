-- Fix (real root cause): extract-invoice's plan gate still failed at runtime with
--   "permission denied for schema private"
-- even after granting `private` USAGE to `authenticated` (20260729140000 /
-- 20260801100000). Reason: requests authenticated via the Clerk third-party
-- token execute under the **anon** Postgres role, not `authenticated`. Every
-- public table already grants full DML to BOTH anon and authenticated (the
-- Supabase default) and isolation is enforced by RLS via private.current_org_id()
-- from the JWT — so the app works fine as anon everywhere EXCEPT the one
-- plpgsql-by-name call (reserve_extraction_slot -> private.current_org_id()),
-- which needs USAGE on schema private for the executing role. That role is anon.
--
-- Grant anon the same access authenticated already has. As documented on the
-- earlier grant: USAGE on `private` does NOT expose it over the PostgREST API
-- (only API-exposed schemas are HTTP-reachable) — it only lets the in-database
-- caller resolve the helper. current_org_id() reads only the caller's own JWT,
-- and RLS still scopes every row by org, so this changes no data-access surface.
grant usage on schema private to anon, authenticated;
grant execute on function private.current_org_id() to anon, authenticated;
