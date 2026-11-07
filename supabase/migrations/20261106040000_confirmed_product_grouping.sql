-- Confirmed display-name equivalence. Purchasing evidence is never rewritten.
create table public.product_display_groups (
 id uuid primary key default gen_random_uuid(),organization_id text not null,name text not null,
 created_at timestamptz not null default now(),unique(id,organization_id)
);
create table public.product_group_aliases (
 organization_id text not null,name_key text not null,group_id uuid not null,
 primary key(organization_id,name_key),foreign key(group_id,organization_id) references product_display_groups(id,organization_id) on delete cascade
);
create table public.product_group_actions (
 id uuid primary key default gen_random_uuid(),sequence bigint generated always as identity,
 organization_id text not null,actor_user_id text,source_name text not null,target_name text not null,
 before_assignments jsonb not null,after_group_id uuid not null,created_at timestamptz not null default now(),undone_at timestamptz
);
create index product_group_actions_workspace on public.product_group_actions(organization_id,sequence desc);
create index product_group_aliases_group on public.product_group_aliases(organization_id,group_id);
alter table public.product_display_groups enable row level security;
alter table public.product_group_aliases enable row level security;
alter table public.product_group_actions enable row level security;
create policy product_display_groups_read on public.product_display_groups for select to authenticated using(organization_id=private.current_org_id());
create policy product_group_aliases_read on public.product_group_aliases for select to authenticated using(organization_id=private.current_org_id());
create policy product_group_actions_read on public.product_group_actions for select to authenticated using(organization_id=private.current_org_id());
revoke all on public.product_display_groups,public.product_group_aliases,public.product_group_actions from public,anon,authenticated;
grant select on public.product_display_groups,public.product_group_aliases,public.product_group_actions to authenticated;
grant all on public.product_display_groups,public.product_group_aliases,public.product_group_actions to service_role;

create or replace function public.commercial_product_options()
returns table(product_key text,name_key text,purchase jsonb,purchase_count bigint)
language sql stable security invoker set search_path=public as $$
 with candidates as (
 select public.purchase_product_key(inv.vendor_id::text,li.raw_description,li.unit_of_measure) as key,li.*,inv.invoice_date,inv.created_at as uploaded_at,v.name as vendor_name,
 jsonb_build_object('id',inv.id,'vendor_id',inv.vendor_id,'invoice_date',inv.invoice_date,'created_at',inv.created_at,'vendors',jsonb_build_object('name',v.name)) as invoice_json,
 row_number() over(partition by public.purchase_product_key(inv.vendor_id::text,li.raw_description,li.unit_of_measure) order by coalesce(inv.invoice_date::timestamptz,inv.created_at) desc,inv.created_at desc,li.id desc) as rank,
 count(*) over(partition by public.purchase_product_key(inv.vendor_id::text,li.raw_description,li.unit_of_measure)) as n
 from invoice_line_items li join invoices inv on inv.id=li.invoice_id and inv.organization_id=li.organization_id
 left join vendors v on v.id=inv.vendor_id and v.organization_id=li.organization_id
 where li.organization_id=private.current_org_id() and inv.status='saved' and li.voided_at is null and li.line_item_type='charge'
 ) select key,commercial_product_name(coalesce(nullif(trim(clean_name),''),raw_description)),
 (to_jsonb(c)-'rank'-'key'-'n'-'invoice_json')||jsonb_build_object('invoices',invoice_json),n from candidates c where rank=1;
$$;
revoke all on function public.commercial_product_options() from public,anon;
grant execute on function public.commercial_product_options() to authenticated;

create or replace function public.purchase_product_group_rows()
returns table(group_key text,product_name text,variants jsonb)
language sql stable security invoker set search_path=public as $$
 with options as (
 select o.*,g.name as display_name,g.id as group_id,
 case when g.id is null then 'product:'||o.name_key else 'linked:'||g.id::text end as display_key,
 case when g.id is null then array[o.name_key] else (select array_agg(a2.name_key order by a2.name_key) from product_group_aliases a2 where a2.organization_id=private.current_org_id() and a2.group_id=g.id) end as aliases
 from commercial_product_options() o
 left join product_group_aliases a on a.organization_id=private.current_org_id() and a.name_key=o.name_key
 left join product_display_groups g on g.id=a.group_id and g.organization_id=a.organization_id
 ) select display_key,coalesce(max(display_name),min(coalesce(nullif(trim(purchase->>'clean_name'),''),purchase->>'raw_description'))),
 jsonb_agg(jsonb_build_object('key',product_key,'count',purchase_count,'purchase',purchase,'nameKey',name_key,'groupAliases',aliases) order by lower(coalesce(purchase->>'vendor_name','')),product_key)
 from options group by display_key;
$$;
revoke all on function public.purchase_product_group_rows() from public,anon;
grant execute on function public.purchase_product_group_rows() to authenticated;
create or replace function public.purchase_product_groups(p_query text default '',p_limit int default 200,p_offset int default 0)
returns table(group_key text,product_name text,variants jsonb)
language sql stable security invoker set search_path=public as $$
 select r.* from purchase_product_group_rows() r
 where nullif(trim(p_query),'') is null or position(commercial_product_name(p_query) in commercial_product_name(r.product_name))>0
 or exists(select 1 from jsonb_array_elements(r.variants) v where position(commercial_product_name(p_query) in commercial_product_name(concat_ws(' ',v->'purchase'->>'clean_name',v->'purchase'->>'raw_description',v->'purchase'->>'vendor_name')))>0)
 order by commercial_product_name(r.product_name),r.group_key limit least(greatest(p_limit,1),200) offset greatest(p_offset,0);
$$;

create or replace function public.link_purchase_product_groups(p_source text,p_target text,p_expected_source text[],p_expected_target text[])
returns uuid language plpgsql security definer set search_path=public as $$
declare v_org text:=private.current_org_id();s record;t record;source_aliases text[];target_aliases text[];all_aliases text[];before_state jsonb;target_id uuid;action_id uuid;
begin
 if v_org is null or v_org like 'pws_%' then raise exception 'Business workspace required';end if;
 if p_source=p_target then raise exception 'Choose a different product';end if;
 perform pg_advisory_xact_lock(hashtextextended('product-groups:'||v_org,0));
 select * into s from purchase_product_group_rows() where group_key=p_source;
 if not found then raise exception 'Product groups changed. Refresh and choose again.';end if;
 select * into t from purchase_product_group_rows() where group_key=p_target;
 if not found then raise exception 'Product groups changed. Refresh and choose again.';end if;
 select array_agg(value order by value) into source_aliases from jsonb_array_elements_text(s.variants->0->'groupAliases');
 select array_agg(value order by value) into target_aliases from jsonb_array_elements_text(t.variants->0->'groupAliases');
 if source_aliases is distinct from (select array_agg(distinct x order by x) from unnest(p_expected_source) x)
 or target_aliases is distinct from (select array_agg(distinct x order by x) from unnest(p_expected_target) x) then
  raise exception 'Product groups changed. Refresh and review the link again.';
 end if;
 select array_agg(distinct x order by x) into all_aliases from unnest(source_aliases||target_aliases) x;
 if cardinality(all_aliases)>1000 then raise exception 'Link fewer product names at once';end if;
 select jsonb_agg(jsonb_build_object('nameKey',x,'groupId',a.group_id) order by x) into before_state
 from unnest(all_aliases) x left join product_group_aliases a on a.organization_id=v_org and a.name_key=x;
 if p_target like 'linked:%' then target_id:=substring(p_target from 8)::uuid;
 else insert into product_display_groups(organization_id,name) values(v_org,t.product_name) returning id into target_id;end if;
 insert into product_group_aliases(organization_id,name_key,group_id) select v_org,x,target_id from unnest(all_aliases) x
 on conflict(organization_id,name_key) do update set group_id=excluded.group_id;
 insert into product_group_actions(organization_id,actor_user_id,source_name,target_name,before_assignments,after_group_id)
 values(v_org,auth.jwt()->>'sub',s.product_name,t.product_name,before_state,target_id) returning id into action_id;
 return action_id;
end $$;
revoke all on function public.link_purchase_product_groups(text,text,text[],text[]) from public,anon;
grant execute on function public.link_purchase_product_groups(text,text,text[],text[]) to authenticated;

create or replace function public.undo_purchase_product_grouping(p_action uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_org text:=private.current_org_id();a product_group_actions;r jsonb;
begin
 if v_org is null or v_org like 'pws_%' then raise exception 'Business workspace required';end if;
 perform pg_advisory_xact_lock(hashtextextended('product-groups:'||v_org,0));
 select * into a from product_group_actions where organization_id=v_org and undone_at is null order by sequence desc limit 1 for update;
 if not found or a.id<>p_action then raise exception 'Newer grouping changes exist. Refresh history before undoing.';end if;
 for r in select value from jsonb_array_elements(a.before_assignments) loop
  if not exists(select 1 from product_group_aliases where organization_id=v_org and name_key=r->>'nameKey' and group_id=a.after_group_id) then
   raise exception 'Product groups changed. Refresh history before undoing.';
  end if;
 end loop;
 for r in select value from jsonb_array_elements(a.before_assignments) loop
  if r->>'groupId' is null then delete from product_group_aliases where organization_id=v_org and name_key=r->>'nameKey';
  else update product_group_aliases set group_id=(r->>'groupId')::uuid where organization_id=v_org and name_key=r->>'nameKey';end if;
 end loop;
 update product_group_actions set undone_at=clock_timestamp() where id=a.id and organization_id=v_org;
end $$;
revoke all on function public.undo_purchase_product_grouping(uuid) from public,anon;
grant execute on function public.undo_purchase_product_grouping(uuid) to authenticated;
