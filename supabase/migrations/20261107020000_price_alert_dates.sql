-- Price alerts carry the delivery dates they compare.
--
-- detected_at is when the comparison ran — after the 20261107010000 backfill
-- every alert read "Nov 7", and the free-tier "increases this month" teaser
-- counted years-old increases as this month's. The UI now dates an alert by
-- the invoice it came from (price_date) and groups repeat increases of one
-- product into a single price-creep story (previous_price_date → price_date).

alter table public.price_alerts
  add column if not exists price_date date,
  add column if not exists previous_price_date date;

create index if not exists price_alerts_org_price_date on public.price_alerts (organization_id, price_date desc);

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
      p.unit_price as prev, l.unit_price as cur, l.eff::date as cur_date, p.eff::date as prev_date,
      round((l.unit_price - p.unit_price) / p.unit_price * 100, 2) as pct
    from lines l
    cross join lateral (
      select c.unit_price, c.eff from lines c
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
    previous_price, new_price, unit, pct_change, price_date, previous_price_date)
  select p_org, p_vendor, h.line_id, coalesce(h.item_name, ''), h.prev, h.cur, h.unit, h.pct, h.cur_date, h.prev_date
  from hits h
  on conflict (line_item_id) where organization_id not like 'pws\_%' and line_item_id is not null
  do update set vendor_id = excluded.vendor_id, item_name = excluded.item_name, unit = excluded.unit,
    previous_price = excluded.previous_price, new_price = excluded.new_price, pct_change = excluded.pct_change,
    price_date = excluded.price_date, previous_price_date = excluded.previous_price_date,
    read = case when price_alerts.previous_price is distinct from excluded.previous_price
                  or price_alerts.new_price is distinct from excluded.new_price
                then false else price_alerts.read end;
end $$;

revoke all on function private.refresh_vendor_price_alerts(text, uuid) from public, anon, authenticated;

do $$
declare v record;
begin
  for v in select distinct organization_id, vendor_id from invoices
           where status = 'saved' and vendor_id is not null and organization_id not like 'pws\_%'
  loop
    perform private.refresh_vendor_price_alerts(v.organization_id, v.vendor_id);
  end loop;
end $$;
