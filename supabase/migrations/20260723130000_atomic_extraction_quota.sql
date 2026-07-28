-- Closes a free-cap race: the previous enforcement in extract-invoice
-- (count existing scanned/saved invoices, compare to the cap, then proceed)
-- was a classic check-then-act — N concurrent requests from a free org
-- sitting at cap-1 could all read the same under-cap count and all pass,
-- each spending a full Sonnet extraction. This table + the RPCs below make
-- reservation atomic: the increment and the cap check happen in one
-- UPDATE ... WHERE used < cap statement, so concurrent callers serialize on
-- the row and only the first `cap - used` of them succeed.

create table if not exists public.extraction_usage (
  organization_id text not null,
  month_start date not null,
  used int not null default 0,
  primary key (organization_id, month_start)
);

alter table public.extraction_usage enable row level security;

create policy "org can read own extraction usage" on public.extraction_usage
  for select
  using (organization_id = private.current_org_id());

create policy "org can insert own extraction usage" on public.extraction_usage
  for insert
  with check (organization_id = private.current_org_id());

create policy "org can update own extraction usage" on public.extraction_usage
  for update
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

grant select, insert, update on public.extraction_usage to authenticated;

-- Atomically reserves one extraction slot for the caller's org this calendar
-- month, if under p_cap. Returns allowed=false (and the current used count,
-- for the client's "X of Y used" copy) without incrementing when at cap.
create or replace function public.reserve_extraction_slot(p_cap int)
returns table(allowed boolean, used int)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org text := private.current_org_id();
  v_month date := date_trunc('month', now())::date;
  v_used int;
begin
  if v_org is null then
    raise exception 'no organization in session';
  end if;

  insert into extraction_usage (organization_id, month_start, used)
  values (v_org, v_month, 0)
  on conflict (organization_id, month_start) do nothing;

  update extraction_usage e
    set used = e.used + 1
    where e.organization_id = v_org and e.month_start = v_month and e.used < p_cap
  returning e.used into v_used;

  if v_used is null then
    select used into v_used from extraction_usage
      where organization_id = v_org and month_start = v_month;
    return query select false, v_used;
  else
    return query select true, v_used;
  end if;
end;
$$;

grant execute on function public.reserve_extraction_slot(int) to authenticated;

-- Best-effort release of a reserved slot when the extraction it was reserved
-- for turns out not to count (duplicate detected, or the extraction itself
-- failed) — mirrors the old behavior where the cap only ever counted
-- invoices that actually reached scanned/saved status.
create or replace function public.release_extraction_slot()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org text := private.current_org_id();
  v_month date := date_trunc('month', now())::date;
begin
  if v_org is null then return; end if;
  update extraction_usage
    set used = greatest(used - 1, 0)
    where organization_id = v_org and month_start = v_month;
end;
$$;

grant execute on function public.release_extraction_slot() to authenticated;
