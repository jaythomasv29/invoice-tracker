-- Marketing-site waitlist. Unlike every other table in this schema, this one
-- is NOT organization-scoped: signups come from anonymous visitors on the
-- public Next.js site who have no Clerk session and therefore no
-- organization_id, so there's nothing to tenant-isolate on. Writes happen
-- exclusively through the /api/waitlist route handler using the service-role
-- key (which bypasses RLS). RLS is enabled with zero anon/authenticated
-- policies, so the table is completely inaccessible via the public PostgREST
-- API — a visitor can't read the email list or spam inserts around the route
-- handler's validation.
create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text, -- basic attribution, e.g. "landing_hero" vs "landing_footer"
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

-- Intentionally NO policies: only the service role (which bypasses RLS) may
-- touch this table. Do not add anon/authenticated insert or select policies.

-- Case-insensitive uniqueness: "Foo@x.com" and "foo@x.com" are the same
-- signup. A unique index on lower(email) does this without the citext
-- extension (no extension is enabled for it in the existing schema, and the
-- route handler already normalizes to lowercase before inserting). This index
-- also serves email lookups, so no separate plain index on email is needed.
create unique index waitlist_signups_email_lower_key
  on public.waitlist_signups (lower(email));
