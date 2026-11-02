create or replace function public.save_invoice_review(p_invoice uuid,p_date date,p_lines jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare v_org text := private.current_org_id(); item jsonb;
begin
 perform 1 from invoices where id=p_invoice and organization_id=v_org and status in ('scanned','saved') for update;
 if not found then raise exception 'invoice unavailable'; end if;
 for item in select jsonb_array_elements(p_lines) loop
  update invoice_line_items set reconciliation_status=item->>'verification',confirmed=(item->>'confirmed')::boolean,note=nullif(item->>'note','')
  where id=(item->>'id')::uuid and invoice_id=p_invoice and organization_id=v_org;
  if not found then raise exception 'invoice line unavailable'; end if;
 end loop;
 update invoices set status='saved',invoice_date=p_date where id=p_invoice and organization_id=v_org;
end $$;
revoke all on function public.save_invoice_review(uuid,date,jsonb) from public,anon;
grant execute on function public.save_invoice_review(uuid,date,jsonb) to authenticated;
