-- Corrections must never reuse an AI-derived net price or identity after editing.
create function public.invalidate_edited_retail_comparison() returns trigger language plpgsql set search_path=public as $$
begin
 if new.organization_id like 'pws_%' and (new.clean_name is distinct from old.clean_name or new.qty is distinct from old.qty or new.unit_price is distinct from old.unit_price or new.extended_price is distinct from old.extended_price or new.unit_of_measure is distinct from old.unit_of_measure) then
  new.retail_product := null;
 end if;
 return new;
end $$;
create trigger invalidate_edited_retail_comparison before update on public.invoice_line_items for each row execute function public.invalidate_edited_retail_comparison();
create unique index household_one_alert_per_line on public.price_alerts(line_item_id) where organization_id like 'pws_%';
create function public.remove_corrected_household_alert() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.organization_id like 'pws_%' and (new.retail_product is distinct from old.retail_product or new.voided_at is distinct from old.voided_at) then
  delete from price_alerts where line_item_id=new.id and organization_id=new.organization_id;
 end if;
 return new;
end $$;
create trigger remove_corrected_household_alert after update on public.invoice_line_items for each row execute function public.remove_corrected_household_alert();
