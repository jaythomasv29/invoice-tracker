-- Fix: extract-invoice's plan gate (public.reserve_extraction_slot) failed at
-- runtime with "permission denied for schema private".
--
-- Why it only bit now: private.current_org_id() is a simple STABLE sql function,
-- so when it appears in an RLS policy the planner INLINES it into the policy
-- expression — there is no by-name call at run time, hence no permission check
-- on the `private` schema. Every RLS read has worked for exactly this reason.
-- reserve_extraction_slot / release_extraction_slot are plpgsql, though, and
-- `v_org := private.current_org_id()` is a genuine by-name call: resolving it
-- requires the authenticated role to hold USAGE on schema `private`, which was
-- never granted. So the first plpgsql caller of the helper is the first thing to
-- surface the gap — the extraction plan gate.
--
-- Granting USAGE does NOT expose `private` through the Supabase/PostgREST API
-- (only schemas on the API's exposed list are reachable over HTTP); it only lets
-- in-database callers resolve the helper. EXECUTE on functions already defaults
-- to PUBLIC, but we grant it explicitly so the intent is self-documenting.
grant usage on schema private to authenticated;
grant execute on function private.current_org_id() to authenticated;
