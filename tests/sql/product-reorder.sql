-- Disposable full-schema database. All fixture writes roll back.
begin;
create function pg_temp.verify(ok boolean,message text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception '%',message;end if;end $$;
insert into vendors(id,organization_id,name) values('11000000-0000-0000-0000-000000000001','org_ReorderA','Supplier A'),('11000000-0000-0000-0000-000000000002','org_ReorderB','Supplier B');
insert into invoices(id,organization_id,vendor_id,status,invoice_date,total) values
('22000000-0000-0000-0000-000000000001','org_ReorderA','11000000-0000-0000-0000-000000000001','saved','2026-10-09',30),
('22000000-0000-0000-0000-000000000002','org_ReorderA','11000000-0000-0000-0000-000000000001','saved','2026-10-16',30),
('22000000-0000-0000-0000-000000000003','org_ReorderA','11000000-0000-0000-0000-000000000001','scanned','2026-10-23',30),
('22000000-0000-0000-0000-000000000004','org_ReorderB','11000000-0000-0000-0000-000000000002','saved','2026-10-30',999);
insert into invoice_line_items(organization_id,invoice_id,raw_description,clean_name,qty,unit_of_measure,extended_price,line_item_type,voided_at) values
('org_ReorderA','22000000-0000-0000-0000-000000000001','Tomatoes 25 LB','Tomatoes',2,'CS',30,'charge',null),
('org_ReorderA','22000000-0000-0000-0000-000000000002','Tomatoes 25 LB','Tomatoes',2,'CS',30,'charge',null),
('org_ReorderA','22000000-0000-0000-0000-000000000002','Tomatoes 25 LB','Tomatoes',2,'CS',30,'charge',now()),
('org_ReorderA','22000000-0000-0000-0000-000000000002','Tomatoes 25 LB','Tomatoes',2,'CS',-30,'credit',null),
('org_ReorderA','22000000-0000-0000-0000-000000000003','Tomatoes 25 LB','Tomatoes',2,'CS',30,'charge',null),
('org_ReorderB','22000000-0000-0000-0000-000000000004','Tomatoes 25 LB','Tomatoes',99,'CS',999,'charge',null);
set local role authenticated;
set local request.jwt.claims='{"sub":"user_reorder_a","iss":"https://issuer.example","o":{"id":"org_ReorderA","rol":"admin"}}';
set local request.headers='{}';
select pg_temp.verify((select count(*)=2 from purchase_product_history(purchase_product_key('11000000-0000-0000-0000-000000000001','Tomatoes 25 LB','CS'))),'History excludes drafts, credits and voids');
select pg_temp.verify((select count(*)=0 from purchase_product_history(purchase_product_key('11000000-0000-0000-0000-000000000002','Tomatoes 25 LB','CS'))),'Another workspace cannot be read by key');
select pg_temp.verify((select count(*)=1 from purchase_product_history(purchase_product_key('11000000-0000-0000-0000-000000000001','Tomatoes 25 LB','CS'),1,1)),'History pagination is usable');
select pg_temp.verify(not has_function_privilege('authenticated','reserve_product_insight(text,text)','EXECUTE'),'Clients cannot reserve model work with arbitrary workspace IDs');
select pg_temp.verify(not has_table_privilege('authenticated','product_insight_jobs','SELECT'),'Clients cannot read insight cache across workspaces');
reset role;
set local role service_role;
select pg_temp.verify((reserve_product_insight('org_ReorderA',repeat('a',64))->>'allowed')::boolean,'First AI reservation succeeds');
select pg_temp.verify(reserve_product_insight('org_ReorderA',repeat('a',64))->>'code'='AI_BUSY','Concurrent duplicate is held');
update product_insight_jobs set status='complete',result='{"summary":"Fixture"}' where organization_id='org_ReorderA';
select pg_temp.verify(reserve_product_insight('org_ReorderA',repeat('a',64))->'cached'->>'summary'='Fixture','Unchanged evidence is cached');
select pg_temp.verify((select count(*)=1 from product_insight_jobs where organization_id='org_ReorderA'),'Cached reviews do not consume another attempt');
insert into product_insight_jobs(organization_id,request_hash,status) select 'org_Limit',md5(i::text)||md5(i::text),'failed' from generate_series(1,10) i;
select pg_temp.verify(reserve_product_insight('org_Limit',repeat('b',64))->>'code'='AI_RATE_LIMIT','Daily budget is enforced for failed attempts too');
insert into product_insight_jobs(organization_id,request_hash,status,created_at) select 'org_Monthly',md5(i::text)||md5(i::text),'failed',greatest(date_trunc('month',now()),now()-interval '2 days') from generate_series(1,60) i;
select pg_temp.verify(reserve_product_insight('org_Monthly',repeat('d',64))->>'code'='AI_RATE_LIMIT','Monthly budget is enforced');
reset role;
insert into account_deletions(user_id,organization_ids) values('deleted_reorder_fixture',array['org_ReorderGone']);
set local role service_role;
select pg_temp.verify(reserve_product_insight('org_ReorderGone',repeat('c',64))->>'code'='DELETION_PENDING','Deletion tombstones prevent new insight work');
rollback;
