-- Disposable full-schema database only. All fixtures roll back.
begin;
create function pg_temp.verify(ok boolean,message text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception '%',message;end if;end $$;
insert into vendors(id,organization_id,name) values('10000000-0000-0000-0000-000000000001','org_ProductA','Test supplier'),('10000000-0000-0000-0000-000000000002','org_ProductB','Private supplier');
insert into invoices(id,organization_id,vendor_id,status,invoice_date,created_at,total) values
 ('20000000-0000-0000-0000-000000000001','org_ProductA','10000000-0000-0000-0000-000000000001','saved','2026-11-01','2026-11-01',10),
 ('20000000-0000-0000-0000-000000000002','org_ProductA','10000000-0000-0000-0000-000000000001','saved','2026-01-01','2026-11-05',9),
 ('20000000-0000-0000-0000-000000000003','org_ProductB','10000000-0000-0000-0000-000000000002','saved','2026-11-02','2026-11-02',99),
 ('20000000-0000-0000-0000-000000000004','org_ProductA','10000000-0000-0000-0000-000000000001','scanned','2026-11-03','2026-11-03',500);
insert into invoice_line_items(id,organization_id,invoice_id,raw_description,clean_name,qty,unit_of_measure,unit_price,extended_price,line_item_type) values
 ('30000000-0000-0000-0000-000000000001','org_ProductA','20000000-0000-0000-0000-000000000001','Chicken 2 x 5 LB','Chicken',1,'CS',10,10,'charge'),
 ('30000000-0000-0000-0000-000000000002','org_ProductA','20000000-0000-0000-0000-000000000002','Chicken 2 x 5 LB','Chicken',1,'CS',9,9,'charge'),
 ('30000000-0000-0000-0000-000000000003','org_ProductB','20000000-0000-0000-0000-000000000003','Private chicken','Chicken',1,'CS',99,99,'charge'),
 ('30000000-0000-0000-0000-000000000004','org_ProductA','20000000-0000-0000-0000-000000000004','Chicken 2 x 5 LB','Chicken',1,'CS',500,500,'charge'),
 ('30000000-0000-0000-0000-000000000005','org_ProductA','20000000-0000-0000-0000-000000000001','Other brand 12 OZ','Chicken',1,'EA',10,10,'charge');
create temp table original_lines as select to_jsonb(li) data from invoice_line_items li;
insert into items(id,organization_id,canonical_name,source_line_id,product_key) values
 ('40000000-0000-0000-0000-000000000001','org_ProductA','Chicken','30000000-0000-0000-0000-000000000001',public.purchase_product_key('10000000-0000-0000-0000-000000000001','Chicken 2 x 5 LB','CS')),
 ('40000000-0000-0000-0000-000000000002','org_ProductB','Private','30000000-0000-0000-0000-000000000003','private');
set local role authenticated;
set local request.jwt.claims='{"sub":"user_products_A","iss":"https://issuer.example","o":{"id":"org_ProductA","rol":"admin"}}';
set local request.headers='{}';
select pg_temp.verify((select count(*)=2 from purchase_product_catalog('chicken')),'Distinct package and brand groupings must remain separate');
select pg_temp.verify((select purchase->>'id'='30000000-0000-0000-0000-000000000001' and purchase_count=2 from purchase_product_catalog('2 x 5')),'Invoice date wins over upload date and drafts are excluded');
select pg_temp.verify((select count(*)=0 from purchase_product_catalog('%')),'Search is literal');
select pg_temp.verify((select count(*)=0 from purchase_product_catalog('private')),'Other workspace cannot be searched');
select pg_temp.verify((select count(*)=0 from product_cost_observations(array['40000000-0000-0000-0000-000000000002'::uuid])),'Foreign product IDs return no data');
select pg_temp.verify((select jsonb_array_length(observations)=2 from product_cost_observations(array['40000000-0000-0000-0000-000000000001'::uuid])),'Only compatible source group is observed');
update items set pack_quantity=5,pack_unit='lb',pack_count=2 where id='40000000-0000-0000-0000-000000000001';
select pg_temp.verify((select jsonb_array_length(observations)=1 from product_cost_observations(array['40000000-0000-0000-0000-000000000001'::uuid])),'Manual size applies to selected source only');
do $$begin
 begin
  insert into items(organization_id,canonical_name,source_line_id) values('org_ProductA','Stolen source','30000000-0000-0000-0000-000000000003');
  raise exception 'FAIL: foreign source accepted';
 exception when others then if sqlerrm <> 'Purchase source is unavailable in this workspace' then raise;end if;end;
end $$;
insert into recipes(organization_id,name,servings,prep_minutes,cook_minutes,labor_minutes,labor_rate) values('org_ProductA','Test labor',4,15,90,30,24);
select pg_temp.verify((select servings=4 and labor_minutes=30 and cook_minutes=90 and labor_rate=24 from recipes where name='Test labor'),'Labor fields persist independently');
select public.create_personal_workspace('Product test household') as personal \gset
select set_config('request.headers',json_build_object('x-sift-workspace',:'personal')::text,true);
select pg_temp.verify((select count(*)=0 from purchase_product_catalog('chicken')),'Personal account must not see Business products');
select pg_temp.verify((select count(*)=0 from product_cost_observations(array['40000000-0000-0000-0000-000000000001'::uuid])),'Personal account cannot price a Business item');
set local request.jwt.claims='{"sub":"user_products_B","iss":"https://issuer.example"}';
select pg_temp.verify(private.current_org_id() is null,'Another user cannot select the household');
reset role;
select pg_temp.verify(not exists((select data from original_lines except select to_jsonb(li) from invoice_line_items li) union all (select to_jsonb(li) from invoice_line_items li except select data from original_lines)),'Catalog updates must never rewrite invoice lines');
rollback;
