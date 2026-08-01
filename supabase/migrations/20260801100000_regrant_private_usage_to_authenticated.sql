-- Re-apply the `private` schema grants for the `authenticated` role.
--
-- 20260729140000_grant_private_usage_to_authenticated.sql is recorded in the
-- remote migration history, but the grant is NOT actually in effect on the
-- remote DB: extract-invoice still fails at runtime with
--   "Could not check extraction quota: permission denied for schema private"
-- from public.reserve_extraction_slot (security invoker), which calls
-- private.current_org_id() by name and therefore needs USAGE on schema private.
--
-- Because the earlier version is already in `supabase_migrations`, `db push`
-- skips it — so this fresh, idempotent migration re-runs the same grants to
-- close the gap. Safe to run repeatedly; grants are additive and reversible.
grant usage on schema private to authenticated;
grant execute on function private.current_org_id() to authenticated;
