alter table public.items add column product_key text,add column source_line_id uuid references public.invoice_line_items(id) on delete set null,
 add column pack_quantity numeric check(pack_quantity>0),add column pack_unit text,add column pack_count numeric check(pack_count>0),add column manual_price numeric check(manual_price>=0);
create unique index items_workspace_product_key on public.items(organization_id,product_key);
alter table public.recipes add column servings numeric not null default 1 check(servings>0 and servings<=100000),
 add column prep_minutes numeric check(prep_minutes>=0 and prep_minutes<=1000000),add column cook_minutes numeric check(cook_minutes>=0 and cook_minutes<=1000000),
 add column labor_minutes numeric check(labor_minutes>=0 and labor_minutes<=1000000),add column labor_rate numeric check(labor_rate>=0 and labor_rate<=1000000);
-- Product references never rewrite or merge original invoice records.
create function public.purchase_product_key(p_vendor text,p_description text,p_unit text) returns text language sql immutable set search_path=public as $$
 select 'v:'||coalesce(p_vendor,'')||'|d:'||regexp_replace(lower(trim(coalesce(p_description,''))),'[[:space:]]+',' ','g')||'|u:'||lower(trim(coalesce(p_unit,'')));
$$;
create function public.purchase_product_catalog(p_query text default '',p_limit int default 200,p_offset int default 0)
returns table(product_key text,purchase jsonb,purchase_count bigint) language sql stable security invoker set search_path=public as $$
 with candidates as (
 select public.purchase_product_key(inv.vendor_id::text,li.raw_description,li.unit_of_measure) as key,li.*,inv.invoice_date,inv.created_at as uploaded_at,
  jsonb_build_object('id',inv.id,'vendor_id',inv.vendor_id,'invoice_date',inv.invoice_date,'created_at',inv.created_at,'vendors',jsonb_build_object('name',v.name)) as invoice_json,v.name as vendor_name,
  row_number() over(partition by public.purchase_product_key(inv.vendor_id::text,li.raw_description,li.unit_of_measure) order by coalesce(inv.invoice_date::timestamptz,inv.created_at) desc,inv.created_at desc,li.id desc) as rank,
  count(*) over(partition by public.purchase_product_key(inv.vendor_id::text,li.raw_description,li.unit_of_measure)) as n
 from invoice_line_items li join invoices inv on inv.id=li.invoice_id and inv.organization_id=li.organization_id
 left join vendors v on v.id=inv.vendor_id and v.organization_id=li.organization_id
 where li.organization_id=private.current_org_id() and inv.status='saved' and li.voided_at is null and li.line_item_type='charge'
 ) select key,(to_jsonb(c)-'rank'-'key'-'n'-'invoice_json')||jsonb_build_object('invoices',invoice_json),n from candidates c
 where rank=1 and (nullif(trim(p_query),'') is null or position(lower(trim(p_query)) in lower(concat_ws(' ',clean_name,raw_description,vendor_name)))>0)
 order by lower(coalesce(clean_name,raw_description)),key limit least(greatest(p_limit,1),200) offset greatest(p_offset,0);
$$;
create function public.product_cost_observations(p_item_ids uuid[]) returns table(product jsonb,observations jsonb)
language sql stable security invoker set search_path=public as $$
 select to_jsonb(it),coalesce((
  select jsonb_agg(to_jsonb(priced)-'effective_date' order by effective_date desc,id) from (
   select li.*,coalesce(inv.invoice_date::timestamptz,inv.created_at) as effective_date,
    jsonb_build_object('id',inv.id,'vendor_id',inv.vendor_id,'invoice_date',inv.invoice_date,'created_at',inv.created_at,'vendors',jsonb_build_object('name',v.name)) as invoices
   from invoice_line_items li join invoices inv on inv.id=li.invoice_id and inv.organization_id=li.organization_id left join vendors v on v.id=inv.vendor_id and v.organization_id=li.organization_id
   where li.organization_id=private.current_org_id() and inv.status='saved' and li.line_item_type='charge' and li.voided_at is null and (
    (it.source_line_id is not null and (li.id=it.source_line_id or (it.pack_quantity is null and public.purchase_product_key(inv.vendor_id::text,li.raw_description,li.unit_of_measure)=(
     select public.purchase_product_key(si.vendor_id::text,sl.raw_description,sl.unit_of_measure) from invoice_line_items sl join invoices si on si.id=sl.invoice_id and si.organization_id=sl.organization_id where sl.id=it.source_line_id and sl.organization_id=private.current_org_id()))))
    or (it.source_line_id is null and it.product_key is null and (li.item_id=it.id or lower(li.clean_name)=lower(it.canonical_name)))
   ) order by effective_date desc,inv.created_at desc,li.id desc limit 20
  ) priced
 ),'[]'::jsonb) from items it where it.organization_id=private.current_org_id() and it.id=any(p_item_ids) limit 200;
$$;
revoke all on function public.purchase_product_catalog(text,int,int) from public,anon;
revoke all on function public.product_cost_observations(uuid[]) from public,anon;
grant execute on function public.purchase_product_catalog(text,int,int),public.product_cost_observations(uuid[]) to authenticated;
create function public.validate_product_source() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.source_line_id is not null and not exists(select 1 from invoice_line_items where id=new.source_line_id and organization_id=new.organization_id) then raise exception 'Purchase source is unavailable in this workspace';end if;
 return new;
end $$;
create trigger validate_product_source before insert or update on public.items for each row execute function public.validate_product_source();
