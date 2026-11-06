-- Presentation groups only: invoice identity, supplier offers and recipe links stay intact.
create or replace function public.commercial_product_name(p_name text)
returns text language sql immutable set search_path=public as $$
 select trim(regexp_replace(regexp_replace(lower(coalesce(p_name,'')),'\mbean[[:space:]-]*sprouts?\M','bean sprouts','g'),'[[:space:]]+',' ','g'));
$$;
create or replace function public.purchase_product_groups(p_query text default '',p_limit int default 200,p_offset int default 0)
returns table(group_key text,product_name text,variants jsonb)
language sql stable security invoker set search_path=public as $$
 with candidates as (
 select public.purchase_product_key(inv.vendor_id::text,li.raw_description,li.unit_of_measure) as key,li.*,
  inv.invoice_date,inv.created_at as uploaded_at,v.name as vendor_name,
  jsonb_build_object('id',inv.id,'vendor_id',inv.vendor_id,'invoice_date',inv.invoice_date,'created_at',inv.created_at,'vendors',jsonb_build_object('name',v.name)) as invoice_json,
  row_number() over(partition by public.purchase_product_key(inv.vendor_id::text,li.raw_description,li.unit_of_measure) order by coalesce(inv.invoice_date::timestamptz,inv.created_at) desc,inv.created_at desc,li.id desc) as rank,
  count(*) over(partition by public.purchase_product_key(inv.vendor_id::text,li.raw_description,li.unit_of_measure)) as n
 from invoice_line_items li join invoices inv on inv.id=li.invoice_id and inv.organization_id=li.organization_id
 left join vendors v on v.id=inv.vendor_id and v.organization_id=li.organization_id
 where li.organization_id=private.current_org_id() and inv.status='saved' and li.voided_at is null and li.line_item_type='charge'
 ), latest as (
 select c.*,public.commercial_product_name(coalesce(nullif(trim(clean_name),''),raw_description)) as name_key from candidates c where rank=1
 )
 select 'product:'||name_key,min(coalesce(nullif(trim(clean_name),''),raw_description)),
  jsonb_agg(jsonb_build_object('key',key,'count',n,'purchase',(to_jsonb(latest)-'rank'-'key'-'n'-'invoice_json'-'name_key')||jsonb_build_object('invoices',invoice_json)) order by lower(coalesce(vendor_name,'')),key)
 from latest group by name_key
 having nullif(trim(p_query),'') is null or bool_or(position(public.commercial_product_name(p_query) in public.commercial_product_name(concat_ws(' ',clean_name,raw_description,vendor_name)))>0)
 order by name_key limit least(greatest(p_limit,1),200) offset greatest(p_offset,0);
$$;
revoke all on function public.purchase_product_groups(text,int,int) from public,anon;
grant execute on function public.purchase_product_groups(text,int,int) to authenticated;
