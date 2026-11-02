create table public.billing_sync_locks (
 organization_id text primary key,
 token uuid not null,
 expires_at timestamptz not null
);
alter table public.billing_sync_locks enable row level security;
revoke all on public.billing_sync_locks from anon,authenticated;
create or replace function public.claim_billing_sync(p_org text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_token uuid := gen_random_uuid(); v_result uuid;
begin
 insert into billing_sync_locks values(p_org,v_token,now()+interval '90 seconds')
 on conflict(organization_id) do update set token=v_token,expires_at=now()+interval '90 seconds'
 where billing_sync_locks.expires_at<now() returning token into v_result;
 return v_result;
end $$;
create or replace function public.release_billing_sync(p_org text,p_token uuid)
returns void language sql security definer set search_path=public as $$
 delete from billing_sync_locks where organization_id=p_org and token=p_token;
$$;
revoke all on function public.claim_billing_sync(text) from public,anon,authenticated;
revoke all on function public.release_billing_sync(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_billing_sync(text) to service_role;
grant execute on function public.release_billing_sync(text,uuid) to service_role;
