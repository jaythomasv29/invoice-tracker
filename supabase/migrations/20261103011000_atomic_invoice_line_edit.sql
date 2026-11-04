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
 perform 1 from invoices where id=p_invoice and organization_id=v_org and status='saved' for update;
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
