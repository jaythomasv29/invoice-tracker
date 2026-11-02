-- Prevent repeated failed scans from bypassing the monthly cost boundary.
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
 -- Successful scans are refunded on failure, but model requests still cost money.
 -- Bound total monthly invoice attempts as well as successful usage.
 if p_kind='invoice' and (select count(*) from ai_jobs where organization_id=p_org and kind='invoice' and month_start=v_month) >= p_cap + greatest(10,ceil(p_cap * 0.2)::int) then
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
