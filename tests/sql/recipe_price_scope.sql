-- Fixtures live only in the disposable local database.
begin;
insert into items values ('00000000-0000-0000-0000-000000000001','org_a','Garlic'),('00000000-0000-0000-0000-000000000002','org_b','Garlic');
insert into invoices values ('10000000-0000-0000-0000-000000000001','org_a','saved','2026-11-02','2026-11-02'),('10000000-0000-0000-0000-000000000002','org_b','saved','2026-11-02','2026-11-02');
insert into invoice_line_items(id,organization_id,invoice_id,item_id,clean_name,raw_description,qty,unit_of_measure,extended_price,line_item_type) values
('20000000-0000-0000-0000-000000000001','org_a','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Garlic','Garlic',5,'LB',18,'charge'),
('20000000-0000-0000-0000-000000000002','org_b','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Garlic','Garlic',5,'LB',180,'charge');
select set_config('test.org','org_a',true);
set local role authenticated;
do $$ declare c numeric;n int; begin
 select cost_per_gram,sample_size into c,n from resolve_item_cost_per_gram('00000000-0000-0000-0000-000000000001');
 if c<>round((3.6/453.59237)::numeric,6) or n<>1 then raise exception 'wrong scoped cost';end if;
 if exists(select 1 from resolve_item_cost_per_gram('00000000-0000-0000-0000-000000000002')) then raise exception 'cross restaurant access';end if;
 if exists(select 1 from invoice_line_items where normalized_price_per_lb is not null) then raise exception 'read mutated invoices';end if;
end $$;
reset role;
-- Old invoices imported later must not displace more recent purchasing prices.
insert into invoices values ('10000000-0000-0000-0000-000000000003','org_a','saved','2026-07-15','2027-01-01');
insert into invoice_line_items(id,organization_id,invoice_id,item_id,clean_name,raw_description,qty,unit_of_measure,extended_price,line_item_type) values
('20000000-0000-0000-0000-000000000003','org_a','10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Garlic','Garlic',5,'LB',500,'charge');
set local role authenticated;
do $$ declare d timestamptz;begin
 select as_of into d from resolve_item_cost_per_gram('00000000-0000-0000-0000-000000000001');
 if d::date<>'2026-11-02'::date then raise exception 'upload date treated as purchase date';end if;
end $$;
rollback;
