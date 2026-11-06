-- Correct this invoice's vendor link without renaming a shared vendor record.
create or replace function public.edit_invoice_details(
 p_invoice uuid,p_vendor_name text,p_number text,p_date date,
 p_subtotal numeric,p_tax numeric,p_total numeric
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_org text:=private.current_org_id();v_vendor uuid;v_name text:=regexp_replace(trim(p_vendor_name),'\s+',' ','g');
begin
 if nullif(v_name,'') is null or length(v_name)>200 or length(coalesce(p_number,''))>200
  or p_date>current_date or p_subtotal is null or p_tax is null or p_total is null
  or p_subtotal::text in ('NaN','Infinity','-Infinity') or p_tax::text in ('NaN','Infinity','-Infinity')
  or p_total::text in ('NaN','Infinity','-Infinity') then raise exception 'invalid invoice details';end if;
 perform 1 from invoices where id=p_invoice and organization_id=v_org and status in ('scanned','saved') for update;
 if not found then raise exception 'invoice unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_org||':vendor:'||lower(v_name),0));
 select id into v_vendor from vendors where organization_id=v_org
  and lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(v_name) order by created_at,id limit 1;
 if v_vendor is null then
  insert into vendors(organization_id,name) values(v_org,v_name) returning id into v_vendor;
 end if;
 update invoices set vendor_id=v_vendor,invoice_number=nullif(trim(p_number),''),invoice_date=p_date,
  subtotal=round(p_subtotal,2),tax=round(p_tax,2),total=round(p_total,2)
 where id=p_invoice and organization_id=v_org;
 return v_vendor;
end $$;
revoke all on function public.edit_invoice_details(uuid,text,text,date,numeric,numeric,numeric) from public,anon;
grant execute on function public.edit_invoice_details(uuid,text,text,date,numeric,numeric,numeric) to authenticated;

-- A killed client must not leave a scan permanently locked by an abandoned job.
create or replace function public.prepare_invoice_retry(p_invoice uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_org text:=private.current_org_id();j record;
begin
 if v_org is null then raise exception 'workspace unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('ai:'||v_org,0));
 perform 1 from invoices where id=p_invoice and organization_id=v_org and status='pending';
 if not found then return false;end if;
 for j in select id,created_at from ai_jobs where resource_id=p_invoice and organization_id=v_org and kind='invoice' and status='running' loop
  if j.created_at>now()-interval '10 minutes' then return false;end if;
  perform public.finish_ai_job(j.id,false);
 end loop;
 return true;
end $$;
revoke all on function public.prepare_invoice_retry(uuid) from public,anon;
grant execute on function public.prepare_invoice_retry(uuid) to authenticated;

create or replace function public.discard_invoice_draft(p_invoice uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_org text:=private.current_org_id();
begin
 if v_org is null then raise exception 'workspace unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('ai:'||v_org,0));
 perform 1 from invoices where id=p_invoice and organization_id=v_org and status='pending' for update;
 if not found then raise exception 'draft unavailable';end if;
 if exists(select 1 from ai_jobs where resource_id=p_invoice and organization_id=v_org and status='running') then raise exception 'scan is still processing';end if;
 delete from invoices where id=p_invoice and organization_id=v_org and status='pending';
end $$;
revoke all on function public.discard_invoice_draft(uuid) from public,anon;
grant execute on function public.discard_invoice_draft(uuid) to authenticated;

-- Allow corrections before the user saves the extracted review.
-- Preserve printed catch-weight/adjusted totals and commit edits atomically.
create or replace function public.edit_invoice_line(
 p_invoice uuid,p_line uuid,p_description text,p_qty numeric,p_unit_price numeric,p_extended numeric
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_org text:=private.current_org_id();v_subtotal numeric;v_total numeric;
begin
 if nullif(trim(p_description),'') is null or p_qty is null or p_qty<=0 or p_unit_price is null or p_unit_price<0
  or p_extended is null or p_extended<0 or p_qty::text in ('NaN','Infinity','-Infinity')
  or p_unit_price::text in ('NaN','Infinity','-Infinity') or p_extended::text in ('NaN','Infinity','-Infinity') then
  raise exception 'invalid line values';
 end if;
 perform 1 from invoices where id=p_invoice and organization_id=v_org and status in ('scanned','saved') for update;
 if not found then raise exception 'invoice unavailable';end if;
 update invoice_line_items set clean_name=trim(p_description),qty=p_qty,unit_price=p_unit_price,
  extended_price=round(p_extended,2),normalized_price_per_lb=null
 where id=p_line and invoice_id=p_invoice and organization_id=v_org and voided_at is null;
 if not found then raise exception 'invoice line unavailable';end if;
 select round(coalesce(sum(extended_price),0),2) into v_subtotal from invoice_line_items
 where invoice_id=p_invoice and organization_id=v_org and voided_at is null;
 update invoices set subtotal=v_subtotal,total=round(v_subtotal+coalesce(tax,0),2)
 where id=p_invoice and organization_id=v_org returning total into v_total;
 return jsonb_build_object('subtotal',v_subtotal,'total',v_total,'extendedPrice',round(p_extended,2));
end $$;
revoke all on function public.edit_invoice_line(uuid,uuid,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.edit_invoice_line(uuid,uuid,text,numeric,numeric,numeric) to authenticated;

create or replace function public.invoice_scan_inbox(p_limit int default 100,p_offset int default 0)
returns table(id uuid,status text,vendor_name text,upload_ready boolean,phase text,job_status text)
language sql stable security definer set search_path=public as $$
 select i.id,i.status,v.name,cardinality(i.image_urls)>0,j.phase,
  case when j.status='running' and j.created_at<now()-interval '10 minutes' then 'interrupted' else j.status end
 from invoices i left join vendors v on v.id=i.vendor_id and v.organization_id=i.organization_id
 left join lateral(select a.phase,a.status,a.created_at from ai_jobs a where a.resource_id=i.id and a.organization_id=i.organization_id and a.kind='invoice' order by a.created_at desc,a.id desc limit 1) j on true
 where i.organization_id=private.current_org_id() and i.status in ('pending','scanned')
 order by i.created_at desc,i.id limit least(greatest(p_limit,1),100) offset greatest(p_offset,0);
$$;
revoke all on function public.invoice_scan_inbox(int,int) from public,anon;
grant execute on function public.invoice_scan_inbox(int,int) to authenticated;
