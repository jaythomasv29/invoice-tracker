-- Reliable business price-creep alerts.
--
-- Evidence (Thaiphoon production, Nov 2026): 0 alerts fired while 4 real
-- same-vendor increases >3% happened. Causes:
--   1. Matching keyed on the model's clean_name, which drifts between scans
--      ("Granulated Sugar" vs "Pure Cane Granulated Sugar"); the vendor's own
--      printed description / item code is stable.
--   2. Detection ran once at extraction time (status 'scanned') and compared
--      only against already-saved invoices; it never re-ran on save, line
--      edits, voids, vendor/date corrections, or deletes.
--   3. Same-day deliveries were excluded by a strict date comparison.
--
-- Fix: business alerts are now derived state, recomputed per vendor by
-- triggers whenever anything that affects a comparison changes. Household
-- (pws_) comparisons keep their own retail-identity path in Edge Functions.

alter table public.invoice_line_items add column if not exists item_code text;

-- Matching keys -------------------------------------------------------------

-- Printed description minus bracketed policy notes/mark codes, alnum only
-- (keeps CJK). "Pure Cane Granulated Sugar·C&H··#50·白糖 <MarkCode/Label>"
-- and "...Sugar.C&H..#50.白糖 <MarkCode/Label>" produce the same key.
create or replace function private.price_desc_key(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(regexp_replace(lower(regexp_replace(regexp_replace(coalesce(p, ''),
    '【[^】]*】?', '', 'g'), '<[^>]*>?', '', 'g')), '[^[:alnum:]]', '', 'g'), '');
$$;

create or replace function private.price_name_key(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(regexp_replace(lower(coalesce(p, '')), '[^[:alnum:]]', '', 'g'), '');
$$;

create or replace function private.price_code_key(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(regexp_replace(lower(coalesce(p, '')), '[^[:alnum:]]', '', 'g'), '');
$$;

-- Units that mean the same thing compare; anything else must match exactly.
-- Unknown/blank units never compare (a price without a basis isn't a price).
create or replace function private.price_unit_key(p text) returns text
language sql immutable set search_path = public as $$
  select case u
    when 'case' then 'cs' when 'cs' then 'cs' when 'cse' then 'cs' when 'cases' then 'cs'
    when 'lb' then 'lb' when 'lbs' then 'lb' when '#' then 'lb' when 'pound' then 'lb' when 'pounds' then 'lb'
    when 'ea' then 'ea' when 'each' then 'ea'
    when 'pc' then 'pc' when 'pcs' then 'pc' when 'piece' then 'pc' when 'pieces' then 'pc'
    when 'bx' then 'bx' when 'box' then 'bx'
    when 'bg' then 'bg' when 'bag' then 'bg'
    when 'dz' then 'dz' when 'doz' then 'dz' when 'dozen' then 'dz'
    else nullif(u, '') end
  from (select regexp_replace(lower(coalesce(p, '')), '[^a-z#]', '', 'g') as u) s;
$$;

-- One business alert per line item (household keeps its own partial index).
create unique index if not exists business_one_alert_per_line
  on public.price_alerts (line_item_id)
  where organization_id not like 'pws\_%' and line_item_id is not null;

-- Recompute -----------------------------------------------------------------

-- For every saved, live charge line of one vendor, find the previous purchase
-- of the same product (item code > printed description > clean name, in that
-- priority) at a compatible unit, ordered by effective date then upload time
-- (so same-day deliveries compare). Alert when the unit price rose > 3%.
-- Read state survives a recompute unless the prices themselves changed.
create or replace function private.refresh_vendor_price_alerts(p_org text, p_vendor uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_org is null or p_vendor is null or p_org like 'pws\_%' then return; end if;

  with lines as (
    select li.id, li.clean_name, li.unit_price, li.unit_of_measure,
      coalesce(i.invoice_date::timestamptz, i.created_at) as eff, li.created_at,
      private.price_code_key(li.item_code) as ckey, private.price_desc_key(li.raw_description) as dkey,
      private.price_name_key(li.clean_name) as nkey, private.price_unit_key(li.unit_of_measure) as ukey
    from invoice_line_items li
    join invoices i on i.id = li.invoice_id and i.organization_id = li.organization_id
    where li.organization_id = p_org and i.vendor_id = p_vendor and i.status = 'saved'
      and li.voided_at is null and li.line_item_type = 'charge' and li.unit_price > 0
  ), hits as (
    select l.id as line_id, l.clean_name as item_name, l.unit_of_measure as unit,
      p.unit_price as prev, l.unit_price as cur,
      round((l.unit_price - p.unit_price) / p.unit_price * 100, 2) as pct
    from lines l
    cross join lateral (
      select c.unit_price from lines c
      where c.ukey = l.ukey and c.id <> l.id
        and (c.eff, c.created_at, c.id) < (l.eff, l.created_at, l.id)
        and ((c.ckey is not null and c.ckey = l.ckey)
          or (c.dkey is not null and c.dkey = l.dkey)
          or (c.nkey is not null and c.nkey = l.nkey))
      order by
        case when c.ckey is not null and c.ckey = l.ckey then 0
             when c.dkey is not null and c.dkey = l.dkey then 1 else 2 end,
        c.eff desc, c.created_at desc, c.id desc
      limit 1
    ) p
    where l.ukey is not null and p.unit_price > 0
      and (l.unit_price - p.unit_price) / p.unit_price * 100 > 3
  ), stale as (
    -- Alerts that no longer hold (price corrected, line voided, vendor/date
    -- changed, earlier invoice deleted...). Legacy alerts without a line ref
    -- are left alone.
    delete from price_alerts a
    where a.organization_id = p_org and a.line_item_id is not null
      and (a.vendor_id = p_vendor or a.line_item_id in (select id from lines))
      and a.line_item_id not in (select line_id from hits)
    returning 1
  )
  insert into price_alerts (organization_id, vendor_id, line_item_id, item_name,
    previous_price, new_price, unit, pct_change)
  select p_org, p_vendor, h.line_id, coalesce(h.item_name, ''), h.prev, h.cur, h.unit, h.pct
  from hits h
  on conflict (line_item_id) where organization_id not like 'pws\_%' and line_item_id is not null
  do update set vendor_id = excluded.vendor_id, item_name = excluded.item_name, unit = excluded.unit,
    previous_price = excluded.previous_price, new_price = excluded.new_price, pct_change = excluded.pct_change,
    read = case when price_alerts.previous_price is distinct from excluded.previous_price
                  or price_alerts.new_price is distinct from excluded.new_price
                then false else price_alerts.read end;
end $$;

revoke all on function private.refresh_vendor_price_alerts(text, uuid) from public, anon, authenticated;

-- Triggers --------------------------------------------------------------------

create or replace function private.price_alerts_on_invoice_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'saved' then perform private.refresh_vendor_price_alerts(old.organization_id, old.vendor_id); end if;
    return old;
  end if;
  if new.status = 'saved' or old.status = 'saved' then
    perform private.refresh_vendor_price_alerts(new.organization_id, new.vendor_id);
    if old.vendor_id is distinct from new.vendor_id then
      perform private.refresh_vendor_price_alerts(old.organization_id, old.vendor_id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists price_alerts_refresh_on_invoice_update on public.invoices;
create trigger price_alerts_refresh_on_invoice_update
  after update of status, vendor_id, invoice_date on public.invoices
  for each row
  when (old.status is distinct from new.status or old.vendor_id is distinct from new.vendor_id
        or old.invoice_date is distinct from new.invoice_date)
  execute function private.price_alerts_on_invoice_change();

-- Named so it sorts after the FK cascade ("RI_ConstraintTrigger_...") and sees
-- the line items already gone.
drop trigger if exists price_alerts_refresh_on_invoice_delete on public.invoices;
create trigger price_alerts_refresh_on_invoice_delete
  after delete on public.invoices
  for each row execute function private.price_alerts_on_invoice_change();

create or replace function private.price_alerts_on_line_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; v_vendor uuid; v_status text;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  select vendor_id, status into v_vendor, v_status from invoices
   where id = r.invoice_id and organization_id = r.organization_id;
  if v_status = 'saved' then perform private.refresh_vendor_price_alerts(r.organization_id, v_vendor); end if;
  return r;
end $$;

drop trigger if exists price_alerts_refresh_on_line_update on public.invoice_line_items;
create trigger price_alerts_refresh_on_line_update
  after update of unit_price, unit_of_measure, clean_name, raw_description, item_code, voided_at, line_item_type
  on public.invoice_line_items
  for each row
  when (old.unit_price is distinct from new.unit_price or old.unit_of_measure is distinct from new.unit_of_measure
        or old.clean_name is distinct from new.clean_name or old.raw_description is distinct from new.raw_description
        or old.item_code is distinct from new.item_code or old.voided_at is distinct from new.voided_at
        or old.line_item_type is distinct from new.line_item_type)
  execute function private.price_alerts_on_line_change();

drop trigger if exists price_alerts_refresh_on_line_insert on public.invoice_line_items;
create trigger price_alerts_refresh_on_line_insert
  after insert on public.invoice_line_items
  for each row execute function private.price_alerts_on_line_change();

-- Extraction commit: also store item code and catch-weight details -------------

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
 insert into invoice_line_items(organization_id,invoice_id,raw_description,clean_name,qty,unit_of_measure,unit_price,extended_price,line_item_type,category,confidence,low_confidence_fields,reconciliation_status,retail_product,
   item_code,parsed_weight,weight_source,weight_basis,normalized_price_per_lb)
 select j.organization_id,j.resource_id,x.raw_description,x.clean_name,x.qty,x.unit_of_measure,x.unit_price,x.extended_price,x.line_item_type,x.category,x.confidence,coalesce(x.low_confidence_fields,'{}'),'pending',x.retail_product,
   nullif(trim(x.item_code),''),x.parsed_weight,coalesce(x.weight_source,'none'),x.weight_basis,x.normalized_price_per_lb
 from jsonb_to_recordset(p_lines) as x(raw_description text,clean_name text,qty numeric,unit_of_measure text,unit_price numeric,extended_price numeric,line_item_type text,category text,confidence numeric,low_confidence_fields text[],retail_product jsonb,
   item_code text,parsed_weight numeric,weight_source text,weight_basis text,normalized_price_per_lb numeric);
 update invoices set vendor_id=p_vendor,invoice_number=p_patch->>'invoice_number',invoice_date=nullif(p_patch->>'invoice_date','')::date,
 subtotal=(p_patch->>'subtotal')::numeric,tax=(p_patch->>'tax')::numeric,total=(p_patch->>'total')::numeric,
 raw_ai_response=p_patch->'raw_ai_response',status='scanned',extraction_model='sonnet_5',
 image_hashes=array(select jsonb_array_elements_text(p_patch->'image_hashes')) where id=j.resource_id;
 perform finish_ai_job(p_job,true);
end $$;
revoke all on function public.complete_invoice_extraction(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.complete_invoice_extraction(uuid,uuid,jsonb,jsonb) to service_role;

-- Backfill: compute alerts for every existing business vendor once.
do $$
declare v record;
begin
  for v in select distinct organization_id, vendor_id from invoices
           where status = 'saved' and vendor_id is not null and organization_id not like 'pws\_%'
  loop
    perform private.refresh_vendor_price_alerts(v.organization_id, v.vendor_id);
  end loop;
end $$;
