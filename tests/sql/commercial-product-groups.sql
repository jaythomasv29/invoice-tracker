begin;
create function pg_temp.verify(ok boolean,message text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception '%',message;end if;end $$;
insert into vendors(id,organization_id,name) values('11000000-0000-0000-0000-000000000021','org_GroupA','Supplier A'),('11000000-0000-0000-0000-000000000022','org_GroupA','Supplier B'),('11000000-0000-0000-0000-000000000023','org_GroupB','Supplier C');
insert into invoices(id,organization_id,vendor_id,status,invoice_date,total) values
('22000000-0000-0000-0000-000000000021','org_GroupA','11000000-0000-0000-0000-000000000021','saved','2026-10-09',30),
('22000000-0000-0000-0000-000000000022','org_GroupA','11000000-0000-0000-0000-000000000022','saved','2026-10-16',40),
('22000000-0000-0000-0000-000000000023','org_GroupB','11000000-0000-0000-0000-000000000023','saved','2026-10-16',20);
insert into invoice_line_items(id,organization_id,invoice_id,raw_description,clean_name,qty,unit_of_measure,extended_price,line_item_type) values
('44000000-0000-0000-0000-000000000021','org_GroupA','22000000-0000-0000-0000-000000000021','BEAN SPROUT 5LB','Bean Sprout',1,'CS',10,'charge'),
('44000000-0000-0000-0000-000000000022','org_GroupA','22000000-0000-0000-0000-000000000022','Bean sprouts 10 lb','Bean sprouts',2,'LB',20,'charge'),
('44000000-0000-0000-0000-000000000023','org_GroupA','22000000-0000-0000-0000-000000000022','Frozen bean sprouts','Frozen bean sprouts',1,'CS',15,'charge'),
('44000000-0000-0000-0000-000000000024','org_GroupB','22000000-0000-0000-0000-000000000023','Bean sprouts','Bean sprouts',1,'CS',5,'charge'),
('44000000-0000-0000-0000-000000000025','org_GroupA','22000000-0000-0000-0000-000000000021','Discount','Bean Sprout',1,'CS',-2,'credit');
set local role authenticated;
set local request.jwt.claims='{"sub":"user_group_a","iss":"https://issuer.example","o":{"id":"org_GroupA","rol":"admin"}}';
select pg_temp.verify((select count(*)=2 from purchase_product_groups()),'same product across suppliers is one group; frozen preparation remains distinct');
select pg_temp.verify((select jsonb_array_length(variants)=2 from purchase_product_groups() where group_key='product:bean sprouts'),'both supplier options retained');
select pg_temp.verify((select sum((v->>'count')::int)=2 from purchase_product_groups() cross join lateral jsonb_array_elements(variants) v where group_key='product:bean sprouts'),'credits and foreign invoices excluded');
select pg_temp.verify((select sum((v->'purchase'->>'extended_price')::numeric)=30 from purchase_product_groups() cross join lateral jsonb_array_elements(variants) v where group_key='product:bean sprouts'),'original option prices preserved');
select pg_temp.verify((select jsonb_array_length(variants)=2 from purchase_product_groups('Supplier A') where group_key='product:bean sprouts'),'supplier search retains comparison context');
select pg_temp.verify((select count(*)=1 from purchase_product_groups('BEANSPROUT') where group_key='product:bean sprouts'),'name alias search works');
select pg_temp.verify((select count(*)=1 from purchase_product_history(public.purchase_product_key('11000000-0000-0000-0000-000000000021','BEAN SPROUT 5LB','CS'))),'supplier reorder evidence remains isolated');
select pg_temp.verify((select group_key from purchase_product_groups('',1,0))<>(select group_key from purchase_product_groups('',1,1)),'pagination operates on whole groups');
select pg_temp.verify(commercial_product_name('Milk 2%')<>commercial_product_name('Milk 2'),'meaningful specifications stay distinct');
select pg_temp.verify((select count(*)=2 from invoices),'original invoice records are unchanged');
rollback;
