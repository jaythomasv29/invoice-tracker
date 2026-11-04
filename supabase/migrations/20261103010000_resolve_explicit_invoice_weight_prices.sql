-- Resolve explicit weight pricing for legacy/extracted lines without rewriting
-- invoices. Ambiguous case/each sizes remain unknown rather than guessed.
create or replace function public.explicit_invoice_price_per_lb(
 p_description text, p_qty numeric, p_unit text, p_extended numeric
) returns numeric language plpgsql immutable set search_path=public as $$
declare m text[]; pounds numeric; u text := upper(trim(coalesce(p_unit,'')));
begin
 if p_extended is null or p_extended<=0 or p_qty is null or p_qty<=0 then return null; end if;
 -- Catch weight labels explicitly state the total weight, not a case size.
 m := regexp_match(upper(coalesce(p_description,'')), 'IN TOTAL[[:space:]]*:[[:space:]]*([0-9]+[.]?[0-9]*)[[:space:]]*LBS?');
 if m is not null and m[1]::numeric>0 then return p_extended/m[1]::numeric; end if;
 if u in ('LB','LBS','POUND','POUNDS') then pounds:=p_qty;
 elsif u in ('OZ','OUNCE','OUNCES') then pounds:=p_qty/16;
 elsif u in ('KG','KGS') then pounds:=p_qty*2.20462262185;
 elsif u in ('G','GRAM','GRAMS') then pounds:=p_qty/453.59237;
 elsif u in ('CS','CASE','BX','BOX','BAG') then
  -- An explicit N x weight pack, e.g. 12X2 LBS or 24X19.6 OZ.
  m:=regexp_match(upper(coalesce(p_description,'')), '([0-9]+)[[:space:]]*[X×][[:space:]]*([0-9]+[.]?[0-9]*)[[:space:]]*(LBS?|OZ|KG)([^A-Z]|$)');
  if m is null then return null; end if;
  pounds:=p_qty*m[1]::numeric*m[2]::numeric;
  if m[3]='OZ' then pounds:=pounds/16;
  elsif m[3]='KG' then pounds:=pounds*2.20462262185; end if;
 else return null;
 end if;
 if pounds>0 then return p_extended/pounds; end if;
 return null;
end $$;
revoke all on function public.explicit_invoice_price_per_lb(text,numeric,text,numeric) from public,anon;
grant execute on function public.explicit_invoice_price_per_lb(text,numeric,text,numeric) to authenticated,service_role;

create or replace function public.resolve_item_cost_per_gram(p_item_id uuid)
returns table(cost_per_gram numeric,sample_size int,as_of timestamptz)
language plpgsql stable security invoker set search_path=public as $$
declare v_org text:=private.current_org_id();v_name text;
begin
 select canonical_name into v_name from public.items where id=p_item_id and organization_id=v_org;
 if v_name is null then return; end if;
 return query with priced as (
  select coalesce(li.normalized_price_per_lb,
   public.explicit_invoice_price_per_lb(li.raw_description,li.qty,li.unit_of_measure,li.extended_price)) as ppl,
   coalesce(inv.invoice_date::timestamptz,inv.created_at) as effective_date,inv.created_at
  from public.invoice_line_items li join public.invoices inv on inv.id=li.invoice_id
  where li.organization_id=v_org and inv.organization_id=v_org and inv.status='saved'
   and li.line_item_type='charge' and li.voided_at is null
   and (li.item_id=p_item_id or lower(li.clean_name)=lower(v_name))
 ), recent as (
  select * from priced where ppl>0 order by effective_date desc,created_at desc limit 3
 ) select round((avg(ppl)/453.59237)::numeric,6),count(*)::int,max(effective_date) from recent having count(*)>0;
end $$;
