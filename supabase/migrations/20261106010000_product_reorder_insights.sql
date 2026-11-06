-- Read only saved, non-voided charge lines under the caller's verified workspace.
create function public.purchase_product_history(p_key text,p_limit int default 100,p_offset int default 0)
returns setof jsonb language sql stable security invoker set search_path=public as $$
 select to_jsonb(li)||jsonb_build_object('invoices',jsonb_build_object('id',inv.id,'vendor_id',inv.vendor_id,'invoice_date',inv.invoice_date,'created_at',inv.created_at,'vendors',jsonb_build_object('name',v.name)))
 from invoice_line_items li join invoices inv on inv.id=li.invoice_id and inv.organization_id=li.organization_id
 left join vendors v on v.id=inv.vendor_id and v.organization_id=li.organization_id
 where li.organization_id=private.current_org_id() and inv.status='saved' and li.voided_at is null and li.line_item_type='charge'
 and public.purchase_product_key(inv.vendor_id::text,li.raw_description,li.unit_of_measure)=p_key
 order by inv.invoice_date desc nulls last,inv.created_at desc,li.id desc
 limit least(greatest(p_limit,1),100) offset greatest(p_offset,0);
$$;
revoke all on function public.purchase_product_history(text,int,int) from public,anon;
grant execute on function public.purchase_product_history(text,int,int) to authenticated;
-- Separate insight budget: never consumes invoice scans or recipe drafts.
create table public.product_insight_jobs (
 id uuid primary key default gen_random_uuid(),organization_id text not null,
 request_hash text not null check(length(request_hash)=64),
 status text not null default 'running' check(status in ('running','complete','failed')),
 result jsonb,created_at timestamptz not null default now()
);
create index product_insight_budget on public.product_insight_jobs(organization_id,created_at);
alter table public.product_insight_jobs enable row level security;
revoke all on public.product_insight_jobs from anon,authenticated;
create function public.reserve_product_insight(p_org text,p_hash text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare cached jsonb;job uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('product-insight:'||p_org,0));
 if exists(select 1 from account_deletions where p_org=any(organization_ids)) then return jsonb_build_object('allowed',false,'code','DELETION_PENDING');end if;
 select result into cached from product_insight_jobs where organization_id=p_org and request_hash=p_hash and status='complete' and created_at>now()-interval '24 hours' order by created_at desc limit 1;
 if cached is not null then return jsonb_build_object('allowed',true,'cached',cached);end if;
 if exists(select 1 from product_insight_jobs where organization_id=p_org and request_hash=p_hash and status='running' and created_at>now()-interval '2 minutes') then return jsonb_build_object('allowed',false,'code','AI_BUSY');end if;
 if (select count(*) from product_insight_jobs where organization_id=p_org and created_at>=date_trunc('month',now() at time zone 'UTC'))>=60
 or (select count(*) from product_insight_jobs where organization_id=p_org and created_at>now()-interval '1 day')>=10 then return jsonb_build_object('allowed',false,'code','AI_RATE_LIMIT');end if;
 insert into product_insight_jobs(organization_id,request_hash) values(p_org,p_hash) returning id into job;
 return jsonb_build_object('allowed',true,'id',job);
end $$;
revoke all on function public.reserve_product_insight(text,text) from public,anon,authenticated;
grant execute on function public.reserve_product_insight(text,text) to service_role;
