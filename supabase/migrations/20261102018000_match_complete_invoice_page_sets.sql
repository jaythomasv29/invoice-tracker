-- A shared terms page alone must not block an otherwise different invoice.
create or replace function public.complete_invoice_extraction(p_job uuid,p_vendor uuid,p_patch jsonb,p_lines jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare j ai_jobs; v_duplicate uuid;
begin
 select * into j from ai_jobs where id=p_job and kind='invoice' and status='running' for update;
 if not found then raise exception 'no active job'; end if;
 perform pg_advisory_xact_lock(hashtextextended('invoice-commit:'||j.organization_id,0));
 perform 1 from invoices where id=j.resource_id and organization_id=j.organization_id and status='pending' for update;
 if not found then raise exception 'invoice no longer pending'; end if;
 if not exists(select 1 from vendors where id=p_vendor and organization_id=j.organization_id) then raise exception 'invalid vendor'; end if;
 -- Serialize final commits so simultaneous uploads cannot both pass a precheck.
 select i.id into v_duplicate from invoices i join vendors v on v.id=i.vendor_id
 where i.organization_id=j.organization_id and i.id<>j.resource_id and i.status in ('scanned','saved') and (
  (jsonb_array_length(coalesce(p_patch->'image_hashes','[]'::jsonb))>0
   and i.image_hashes @> array(select jsonb_array_elements_text(p_patch->'image_hashes'))
   and i.image_hashes <@ array(select jsonb_array_elements_text(p_patch->'image_hashes')))
  or (
   nullif(regexp_replace(lower(p_patch->>'invoice_number'),'[^[:alnum:]]','','g'),'') is not null
   and regexp_replace(lower(i.invoice_number),'[^[:alnum:]]','','g')=regexp_replace(lower(p_patch->>'invoice_number'),'[^[:alnum:]]','','g')
   and (i.invoice_date is null or nullif(p_patch->>'invoice_date','') is null or i.invoice_date=(p_patch->>'invoice_date')::date)
   and regexp_replace(lower(v.name),'[^[:alnum:]]','','g')=(select regexp_replace(lower(name),'[^[:alnum:]]','','g') from vendors where id=p_vendor)
  )
 ) order by i.created_at limit 1;
 if v_duplicate is not null then raise exception 'duplicate invoice:%',v_duplicate; end if;
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
