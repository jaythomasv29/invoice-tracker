create table public.account_deletions (
 user_id text primary key,
 organization_ids text[] not null default '{}',
 status text not null default 'pending' check(status in ('pending','complete')),
 requested_at timestamptz not null default now(),
 completed_at timestamptz
);
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from anon,authenticated;
-- Existing RLS/Storage policies use this function. Tombstones stop stale JWT writes
-- while the retryable deletion job removes data and then the auth account.
create or replace function private.current_org_id()
returns text language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from account_deletions where user_id=auth.jwt()->>'sub')
 or exists(select 1 from account_deletions where (auth.jwt()->'o'->>'id')=any(organization_ids))
 then null else nullif(auth.jwt()->'o'->>'id','') end;
$$;
-- Job reservations must not race deletion. Redefine via a trigger to reject
-- new work against any restaurant being erased, including service-role calls.
create function public.reject_deleted_org_ai_job() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from account_deletions where new.organization_id=any(organization_ids)) then raise exception 'restaurant deletion in progress'; end if;
 return new;
end $$;
create trigger reject_deleted_org_ai_job before insert on public.ai_jobs for each row execute function public.reject_deleted_org_ai_job();
