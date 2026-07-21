-- Fix private.current_org_id(): Clerk's default session token does not carry
-- a flat `org_id` claim (what the initial migration assumed) — organization
-- data is nested under a short `"o"` key: {"o": {"id": "org_...", "rol":
-- "admin", "slg": "..."}}. Confirmed directly from a live decoded token
-- during end-to-end testing. Every RLS policy in this project routes through
-- this one function, so fixing it here fixes tenant isolation everywhere.

create or replace function private.current_org_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt()->'o'->>'id', '')
$$;
