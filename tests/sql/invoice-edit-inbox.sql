begin;
create function pg_temp.verify(ok boolean,message text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception '%',message;end if;end $$;
insert into vendors(id,organization_id,name) values('11000000-0000-0000-0000-000000000011','org_EditA','<UNKNOWN>'),('11000000-0000-0000-0000-000000000012','org_EditA','Local Market'),('11000000-0000-0000-0000-000000000013','org_EditB','Local Market');
insert into invoices(id,organization_id,vendor_id,status,invoice_date,total,image_urls) values
('22000000-0000-0000-0000-000000000011','org_EditA','11000000-0000-0000-0000-000000000011','scanned','2026-10-09',30,array['a.jpg']),
('22000000-0000-0000-0000-000000000012','org_EditA','11000000-0000-0000-0000-000000000011','saved','2026-10-09',30,array['b.jpg']),
('22000000-0000-0000-0000-000000000013','org_EditB','11000000-0000-0000-0000-000000000013','pending',null,0,array['c.jpg']),
('22000000-0000-0000-0000-000000000014','org_EditA',null,'pending',null,0,array['d.jpg']),
('22000000-0000-0000-0000-000000000015','org_EditA',null,'pending',null,0,array['e.jpg']);
insert into extraction_usage(organization_id,month_start,used) values('org_EditA',date_trunc('month',now())::date,2);
insert into ai_jobs(id,organization_id,resource_id,kind,month_start,created_at) values
('33000000-0000-0000-0000-000000000014','org_EditA','22000000-0000-0000-0000-000000000014','invoice',date_trunc('month',now())::date,now()),
('33000000-0000-0000-0000-000000000015','org_EditA','22000000-0000-0000-0000-000000000015','invoice',date_trunc('month',now())::date,now()-interval '11 minutes');
set local role authenticated;
set local request.jwt.claims='{"sub":"user_edit_a","iss":"https://issuer.example","o":{"id":"org_EditA","rol":"admin"}}';
select pg_temp.verify(edit_invoice_details('22000000-0000-0000-0000-000000000011',' local   market ','CORRECTED','2026-10-10',25,2,27)='11000000-0000-0000-0000-000000000012'::uuid,'reuse same workspace vendor');
select pg_temp.verify((select vendor_id='11000000-0000-0000-0000-000000000011'::uuid from invoices where id='22000000-0000-0000-0000-000000000012'),'other invoice stays linked to original vendor');
select pg_temp.verify((select name='<UNKNOWN>' from vendors where id='11000000-0000-0000-0000-000000000011'),'original shared vendor is not renamed');
select pg_temp.verify((select invoice_number='CORRECTED' and invoice_date='2026-10-10' and total=27 and tax=2 from invoices where id='22000000-0000-0000-0000-000000000011'),'details saved atomically');
insert into invoice_line_items(id,organization_id,invoice_id,raw_description,qty,unit_price,extended_price) values('44000000-0000-0000-0000-000000000011','org_EditA','22000000-0000-0000-0000-000000000011','Misread item',1,25,25);
select pg_temp.verify((edit_invoice_line('22000000-0000-0000-0000-000000000011','44000000-0000-0000-0000-000000000011','Corrected item',2,10,20)->>'total')::numeric=22,'line corrections are allowed before final review save');
do $$begin begin perform edit_invoice_details('22000000-0000-0000-0000-000000000013','Wrong tenant','X',null,1,0,1);raise exception 'tenant edit succeeded';exception when others then if sqlerrm='tenant edit succeeded' then raise;end if;end;end$$;
select pg_temp.verify((select count(*)=3 from invoice_scan_inbox()),'inbox excludes other tenants and saved invoices');
select pg_temp.verify((select job_status='running' from invoice_scan_inbox() where id='22000000-0000-0000-0000-000000000014'),'active job exposed');
select pg_temp.verify((select job_status='interrupted' from invoice_scan_inbox() where id='22000000-0000-0000-0000-000000000015'),'stale job can recover');
select pg_temp.verify(not prepare_invoice_retry('22000000-0000-0000-0000-000000000014'),'active job cannot restart');
select pg_temp.verify(prepare_invoice_retry('22000000-0000-0000-0000-000000000015'),'stale job releases retry');
select pg_temp.verify(not prepare_invoice_retry('22000000-0000-0000-0000-000000000013'),'foreign job cannot restart');
do $$begin begin perform discard_invoice_draft('22000000-0000-0000-0000-000000000014');raise exception 'active discard succeeded';exception when others then if sqlerrm='active discard succeeded' then raise;end if;end;end$$;
select discard_invoice_draft('22000000-0000-0000-0000-000000000015');
select pg_temp.verify((select count(*)=2 from invoice_scan_inbox()),'interrupted draft can be discarded');
reset role;
select pg_temp.verify((select used=1 from extraction_usage where organization_id='org_EditA'),'stale attempt refunded exactly once');
select pg_temp.verify((select count(*)=0 from vendors where organization_id='org_EditA' and name='Wrong tenant'),'failed edit did not create vendor');
rollback;
