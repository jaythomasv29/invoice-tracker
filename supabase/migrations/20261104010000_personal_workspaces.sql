-- Personal workspaces use verified Clerk users, without creating paid Clerk organizations.
create table public.personal_workspaces (
 id text primary key default ('pws_'||replace(gen_random_uuid()::text,'-','')) check(id ~ '^pws_[a-f0-9]{32}$'),
 owner_user_id text not null, owner_issuer text not null, name text not null default 'My household' check(length(name) between 2 and 80),
 plan text not null default 'free' check(plan in ('free','pro')), created_at timestamptz not null default now(),
 unique(owner_user_id,owner_issuer)
);
alter table public.personal_workspaces enable row level security;
revoke all on public.personal_workspaces from anon,authenticated;
grant select on public.personal_workspaces to authenticated;
create function private.account_is_deleted() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from account_deletions where user_id=auth.jwt()->>'sub'); $$;
create policy personal_workspace_owner on public.personal_workspaces for select to authenticated
 using(owner_user_id=auth.jwt()->>'sub' and owner_issuer=auth.jwt()->>'iss' and not private.account_is_deleted());
create function public.create_personal_workspace(p_name text default 'My household') returns text
 language plpgsql security definer set search_path=public as $$
declare result text;
begin
 if nullif(auth.jwt()->>'sub','') is null or nullif(auth.jwt()->>'iss','') is null or private.account_is_deleted() then raise exception 'Sign in required'; end if;
 if length(trim(p_name)) not between 2 and 80 then raise exception 'Use a name between 2 and 80 characters'; end if;
 insert into personal_workspaces(owner_user_id,owner_issuer,name) values(auth.jwt()->>'sub',auth.jwt()->>'iss',trim(p_name))
 on conflict(owner_user_id,owner_issuer) do nothing;
 select id into result from personal_workspaces where owner_user_id=auth.jwt()->>'sub' and owner_issuer=auth.jwt()->>'iss';
 return result;
end $$;
revoke all on function public.create_personal_workspace(text) from public,anon;
grant execute on function public.create_personal_workspace(text) to authenticated;
create or replace function private.current_org_id() returns text language plpgsql stable security definer set search_path=public as $$
declare selected text := nullif(current_setting('request.headers',true),'')::jsonb->>'x-sift-workspace'; candidate text;
begin
 if private.account_is_deleted() then return null; end if;
 if selected like 'pws_%' then
  select id into candidate from personal_workspaces where id=selected and owner_user_id=auth.jwt()->>'sub' and owner_issuer=auth.jwt()->>'iss';
 else
  candidate := nullif(auth.jwt()->'o'->>'id','');
  if selected is not null and selected<>candidate then return null; end if;
 end if;
 if exists(select 1 from account_deletions where candidate=any(organization_ids)) then return null; end if;
 return candidate;
end $$;
create or replace function public.current_identity() returns jsonb language sql stable security invoker as $$
 select jsonb_build_object('user_id',auth.jwt()->>'sub','issuer',auth.jwt()->>'iss','organization_id',private.current_org_id(),'organization_role',auth.jwt()->'o'->>'rol'); $$;
-- A shared Apple receipt stays on one verified owner identity across both modes.
create table public.workspace_billing_links (
 workspace_id text primary key, account_type text not null check(account_type in ('personal','business')),
 owner_user_id text not null, owner_issuer text not null, customer_id text not null,
 unique(owner_user_id,owner_issuer,account_type)
);
alter table public.workspace_billing_links enable row level security;
revoke all on public.workspace_billing_links from anon,authenticated;
create function public.bind_workspace_billing(p_workspace text,p_type text,p_user text,p_issuer text,p_preferred_customer text) returns text
 language plpgsql security definer set search_path=public as $$
declare result text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user||':'||p_issuer,0));
 select customer_id into result from workspace_billing_links where workspace_id=p_workspace;
 if result is not null then return result; end if;
 if exists(select 1 from workspace_billing_links where owner_user_id=p_user and owner_issuer=p_issuer and account_type=p_type) then
  raise exception 'One workspace per account type is supported for purchases';
 end if;
 select customer_id into result from workspace_billing_links where owner_user_id=p_user and owner_issuer=p_issuer limit 1;
 result := coalesce(result,p_preferred_customer,p_workspace);
 insert into workspace_billing_links values(p_workspace,p_type,p_user,p_issuer,result);
 return result;
end $$;
revoke all on function public.bind_workspace_billing(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.bind_workspace_billing(text,text,text,text,text) to service_role;
