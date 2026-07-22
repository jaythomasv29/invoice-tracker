-- extract-invoice previously picked a new vendor's chart color by reading
-- `count(*) from vendors` and then inserting as two separate round-trips.
-- Two invoices for two different new vendors processed at the same time
-- (e.g. a batch upload) could both read the same count before either insert
-- landed, so both vendors got the same palette color — confirmed live: two
-- vendors created together this way rendered as the same color in the spend
-- chart, indistinguishable in the stacked bar. Wrapping the count+insert in
-- one function with a per-organization advisory lock serializes concurrent
-- creations for the same org (unrelated orgs are unaffected) so each new
-- vendor sees an up-to-date count.
--
-- No `security definer` — runs with the caller's own privileges so the
-- existing `vendors_tenant_isolation` RLS policy still enforces
-- organization_id on the insert, same as the plain `.insert()` it replaces.
create or replace function public.create_vendor_with_palette_color(
  p_organization_id text,
  p_name text,
  p_contact_name text,
  p_contact_phone text,
  p_account_number text,
  p_palette text[]
)
returns public.vendors
language plpgsql
set search_path = public
as $$
declare
  v_count int;
  v_color text;
  v_row public.vendors;
begin
  perform pg_advisory_xact_lock(hashtext(p_organization_id)::bigint);

  select count(*) into v_count from public.vendors where organization_id = p_organization_id;
  v_color := p_palette[(v_count % array_length(p_palette, 1)) + 1];

  insert into public.vendors (organization_id, name, color, contact_name, contact_phone, account_number)
  values (p_organization_id, p_name, v_color, p_contact_name, p_contact_phone, p_account_number)
  returning * into v_row;

  return v_row;
end;
$$;

-- Repair vendor rows already affected by the race: recompute every vendor's
-- color in creation order, per organization, using the same palette. This
-- is what the function above would have produced without the race, so it's
-- safe to apply unconditionally rather than trying to detect which rows
-- collided.
do $$
declare
  palette text[] := array['#5DB075', '#5B7FD4', '#E09030', '#4AABB8', '#E07A30', '#9B7FD4'];
begin
  update public.vendors v
  set color = palette[(ranked.rn % array_length(palette, 1)) + 1]
  from (
    select id, row_number() over (partition by organization_id order by created_at, id) - 1 as rn
    from public.vendors
  ) ranked
  where v.id = ranked.id;
end;
$$;
