-- Clients may read usage but only trusted Edge Functions may mutate it.
drop policy if exists "org can insert own extraction usage" on public.extraction_usage;
drop policy if exists "org can update own extraction usage" on public.extraction_usage;
revoke insert, update, delete on public.extraction_usage from anon, authenticated;
revoke all on function public.reserve_extraction_slot(int) from public, anon, authenticated;
revoke all on function public.release_extraction_slot() from public, anon, authenticated;

create table public.ai_consents (
 user_id text primary key,
 version text not null,
 accepted_at timestamptz not null default now(),
 withdrawn_at timestamptz
);
alter table public.ai_consents enable row level security;
create policy own_consent_read on public.ai_consents for select to authenticated
 using (user_id = auth.jwt()->>'sub');
grant select on public.ai_consents to authenticated;
revoke insert, update, delete on public.ai_consents from anon, authenticated;

create or replace function public.set_ai_consent(p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_user text := auth.jwt()->>'sub';
begin
 if v_user is null then raise exception 'authentication required'; end if;
 insert into ai_consents(user_id,version,withdrawn_at)
 values(v_user,'2026-11-01',case when p_accept then null else now() end)
 on conflict(user_id) do update set version='2026-11-01',
 accepted_at=case when p_accept then now() else ai_consents.accepted_at end,
 withdrawn_at=case when p_accept then null else now() end;
end $$;
revoke all on function public.set_ai_consent(boolean) from public, anon;
grant execute on function public.set_ai_consent(boolean) to authenticated;

create or replace function public.current_identity()
returns jsonb language sql stable security invoker as $$
 select jsonb_build_object('user_id',auth.jwt()->>'sub','organization_id',private.current_org_id());
$$;
revoke all on function public.current_identity() from public, anon;
grant execute on function public.current_identity() to authenticated;

-- Private accounting of all attempts limits duplicate/failure AI spend as well.
-- Invoice allowance counts successful scans; hourly/daily attempt budgets count failures.
create table public.ai_jobs (
 id uuid primary key default gen_random_uuid(),
 organization_id text not null,
 resource_id uuid not null,
 kind text not null check(kind in ('invoice','recipe')),
 status text not null default 'running' check(status in ('running','complete','failed')),
 month_start date not null default date_trunc('month',now() at time zone 'UTC')::date,
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 quota_released boolean not null default false
);
create unique index ai_jobs_one_running on public.ai_jobs(kind,resource_id) where status='running';
create index ai_jobs_budget on public.ai_jobs(organization_id,kind,created_at);
alter table public.ai_jobs enable row level security;
revoke all on public.ai_jobs from anon, authenticated;

create or replace function public.begin_ai_job(p_org text,p_resource uuid,p_kind text,p_cap int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_used int; v_id uuid; v_month date := date_trunc('month',now() at time zone 'UTC')::date;
begin
 if p_kind not in ('invoice','recipe') or p_cap < 1 or p_cap > 500 then raise exception 'invalid budget'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ai:'||p_org,0));
 if exists(select 1 from ai_jobs where resource_id=p_resource and kind=p_kind and status='running') then
  return jsonb_build_object('allowed',false,'code','AI_BUSY');
 end if;
 if (select count(*) from ai_jobs where organization_id=p_org and created_at>now()-interval '1 hour') >= 40
 or (select count(*) from ai_jobs where organization_id=p_org and created_at>now()-interval '1 day') >= 150 then
  return jsonb_build_object('allowed',false,'code','AI_RATE_LIMIT');
 end if;
 if p_kind='invoice' then
  insert into extraction_usage(organization_id,month_start,used) values(p_org,v_month,0) on conflict do nothing;
  update extraction_usage set used=used+1 where organization_id=p_org and month_start=v_month and used<p_cap returning used into v_used;
 else
  select count(*) into v_used from ai_jobs where organization_id=p_org and kind='recipe' and month_start=v_month;
  if v_used<p_cap then v_used:=v_used+1; else v_used:=null; end if;
 end if;
 if v_used is null then return jsonb_build_object('allowed',false,'code','FREE_LIMIT_REACHED'); end if;
 insert into ai_jobs(organization_id,resource_id,kind,month_start) values(p_org,p_resource,p_kind,v_month) returning id into v_id;
 return jsonb_build_object('allowed',true,'id',v_id,'used',v_used);
end $$;

create or replace function public.finish_ai_job(p_id uuid,p_success boolean)
returns void language plpgsql security definer set search_path=public as $$
declare j ai_jobs;
begin
 select * into j from ai_jobs where id=p_id for update;
 if not found or j.status<>'running' then return; end if;
 if not p_success and j.kind='invoice' and not j.quota_released then
  update extraction_usage set used=greatest(used-1,0) where organization_id=j.organization_id and month_start=j.month_start;
 end if;
 update ai_jobs set status=case when p_success then 'complete' else 'failed' end,
 finished_at=now(),quota_released=not p_success where id=p_id;
end $$;
revoke all on function public.begin_ai_job(text,uuid,text,int) from public,anon,authenticated;
revoke all on function public.finish_ai_job(uuid,boolean) from public,anon,authenticated;
grant execute on function public.begin_ai_job(text,uuid,text,int) to service_role;
grant execute on function public.finish_ai_job(uuid,boolean) to service_role;

-- Atomic line-item replacement + invoice transition: never mark scanned before lines exist.
create or replace function public.complete_invoice_extraction(p_job uuid,p_vendor uuid,p_patch jsonb,p_lines jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare j ai_jobs;
begin
 select * into j from ai_jobs where id=p_job and kind='invoice' and status='running' for update;
 if not found then raise exception 'no active job'; end if;
 perform 1 from invoices where id=j.resource_id and organization_id=j.organization_id and status='pending' for update;
 if not found then raise exception 'invoice no longer pending'; end if;
 if not exists(select 1 from vendors where id=p_vendor and organization_id=j.organization_id) then raise exception 'invalid vendor'; end if;
 delete from invoice_line_items where invoice_id=j.resource_id;
 insert into invoice_line_items(organization_id,invoice_id,raw_description,clean_name,qty,unit_of_measure,unit_price,extended_price,line_item_type,category,confidence,low_confidence_fields,reconciliation_status)
 select j.organization_id,j.resource_id,x.raw_description,x.clean_name,x.qty,x.unit_of_measure,x.unit_price,x.extended_price,x.line_item_type,x.category,x.confidence,coalesce(x.low_confidence_fields,'{}'),'pending'
 from jsonb_to_recordset(p_lines) as x(raw_description text,clean_name text,qty numeric,unit_of_measure text,unit_price numeric,extended_price numeric,line_item_type text,category text,confidence numeric,low_confidence_fields text[]);
 update invoices set vendor_id=p_vendor,invoice_number=p_patch->>'invoice_number',invoice_date=nullif(p_patch->>'invoice_date','')::date,
 subtotal=(p_patch->>'subtotal')::numeric,tax=(p_patch->>'tax')::numeric,total=(p_patch->>'total')::numeric,
 raw_ai_response=p_patch->'raw_ai_response',status='scanned',extraction_model='sonnet_5',
 image_hashes=array(select jsonb_array_elements_text(p_patch->'image_hashes')) where id=j.resource_id;
 perform finish_ai_job(p_job,true);
end $$;
revoke all on function public.complete_invoice_extraction(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.complete_invoice_extraction(uuid,uuid,jsonb,jsonb) to service_role;

create or replace function public.complete_recipe_draft(p_job uuid,p_name text,p_draft jsonb,p_ingredients jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare j ai_jobs;
begin
 select * into j from ai_jobs where id=p_job and kind='recipe' and status='running' for update;
 if not found then raise exception 'no active job'; end if;
 perform 1 from recipes where id=j.resource_id and organization_id=j.organization_id and voided_at is null for update;
 if not found then raise exception 'recipe unavailable'; end if;
 delete from recipe_ingredients where recipe_id=j.resource_id;
 insert into recipe_ingredients(organization_id,recipe_id,component_type,raw_ingredient_name,qty,unit,ai_qty,ai_unit,ai_est_cost_share,ai_est_unit_cost,confirmed,position)
 select j.organization_id,j.resource_id,'item',x.raw_ingredient_name,x.qty,x.unit,x.ai_qty,x.ai_unit,x.ai_est_cost_share,x.ai_est_unit_cost,false,x.position
 from jsonb_to_recordset(p_ingredients) as x(raw_ingredient_name text,qty numeric,unit text,ai_qty numeric,ai_unit text,ai_est_cost_share numeric,ai_est_unit_cost numeric,position int);
 update recipes set name=p_name,ai_draft_raw=p_draft,draft_model='sonnet_5' where id=j.resource_id;
 perform finish_ai_job(p_job,true);
end $$;
revoke all on function public.complete_recipe_draft(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.complete_recipe_draft(uuid,text,jsonb,jsonb) to service_role;
