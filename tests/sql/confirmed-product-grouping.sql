begin;
create function pg_temp.verify(ok boolean,message text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception '%',message;end if;end $$;
create function pg_temp.rejects(stmt text,prefix text) returns void language plpgsql as $$begin begin execute stmt;exception when others then if position(prefix in sqlerrm)=1 then return;end if;raise;end;raise exception 'Expected rejection: %',prefix;end$$;
insert into vendors(id,organization_id,name) values('11000000-0000-0000-0000-000000000031','org_LinkA','Supplier A'),('11000000-0000-0000-0000-000000000032','org_LinkA','Supplier B');
insert into invoices(id,organization_id,vendor_id,status,invoice_date,total) values
('22000000-0000-0000-0000-000000000031','org_LinkA','11000000-0000-0000-0000-000000000031','saved','2026-10-09',10),
('22000000-0000-0000-0000-000000000032','org_LinkA','11000000-0000-0000-0000-000000000032','saved','2026-10-10',20);
insert into invoice_line_items(id,organization_id,invoice_id,raw_description,clean_name,qty,unit_of_measure,extended_price,line_item_type) values
('44000000-0000-0000-0000-000000000031','org_LinkA','22000000-0000-0000-0000-000000000031','MUNG BEAN SPROUT 5LB','Mung bean sprouts',1,'CS',10,'charge'),
('44000000-0000-0000-0000-000000000032','org_LinkA','22000000-0000-0000-0000-000000000032','BEAN SPROUT 10LB','Bean sprouts',1,'CS',20,'charge'),
('44000000-0000-0000-0000-000000000033','org_LinkA','22000000-0000-0000-0000-000000000032','Mung sprouts 5LB','Mung sprouts',1,'CS',15,'charge');
set local role authenticated;
set local request.jwt.claims='{"sub":"user_link_a","iss":"https://issuer.example","o":{"id":"org_LinkA","rol":"admin"}}';
select pg_temp.verify((select count(*)=3 from purchase_product_groups()),'different names stay separate until confirmed');
select set_config('test.link1',link_purchase_product_groups('product:mung bean sprouts','product:bean sprouts',array['mung bean sprouts'],array['bean sprouts'])::text,true);
select set_config('test.group1',(select group_key from purchase_product_groups() where group_key like 'linked:%'),true);
select pg_temp.verify((select count(*)=2 from purchase_product_groups()),'confirmed names form one group');
select pg_temp.verify((select jsonb_array_length(variants)=2 from purchase_product_groups() where group_key=current_setting('test.group1')),'supplier options stay intact');
select pg_temp.verify((select count(*)=1 from purchase_product_groups('mung bean')),'original name remains searchable');
select pg_temp.verify((select sum((v->'purchase'->>'extended_price')::numeric)=30 from purchase_product_groups() cross join lateral jsonb_array_elements(variants) v where group_key=current_setting('test.group1')),'prices are not combined or rewritten');
select pg_temp.verify((select count(*)=1 from purchase_product_history(purchase_product_key('11000000-0000-0000-0000-000000000031','MUNG BEAN SPROUT 5LB','CS'))),'supplier reorder history remains isolated');
select pg_temp.rejects($q$select link_purchase_product_groups('product:mung bean sprouts','product:mung sprouts',array['mung bean sprouts'],array['mung sprouts'])$q$,'Product groups changed.');
select pg_temp.rejects(format($q$select link_purchase_product_groups(%L,'product:mung sprouts',array['mung bean sprouts'],array['mung sprouts'])$q$,current_setting('test.group1')),'Product groups changed.');
select pg_temp.verify(not has_table_privilege('authenticated','public.product_group_aliases','INSERT'),'clients cannot bypass confirmation RPC');
select pg_temp.verify(not has_table_privilege('authenticated','public.product_group_actions','UPDATE'),'history cannot be edited directly');
-- A later purchase under a confirmed name follows the same link, without rewriting its evidence.
insert into invoice_line_items(id,organization_id,invoice_id,raw_description,clean_name,qty,unit_of_measure,extended_price,line_item_type) values
('44000000-0000-0000-0000-000000000034','org_LinkA','22000000-0000-0000-0000-000000000031','MUNG BEAN SPROUT NEW PACK','Mung bean sprouts',1,'CS',12,'charge');
select pg_temp.verify((select jsonb_array_length(variants)=3 from purchase_product_groups() where group_key=current_setting('test.group1')),'future same-name purchases follow confirmed link');
select set_config('test.link2',link_purchase_product_groups(current_setting('test.group1'),'product:mung sprouts',array['bean sprouts','mung bean sprouts'],array['mung sprouts'])::text,true);
select pg_temp.verify((select count(*)=1 from purchase_product_groups()),'already linked groups can be joined');
select pg_temp.rejects(format('select undo_purchase_product_grouping(%L::uuid)',current_setting('test.link1')),'Newer grouping changes exist.');
select undo_purchase_product_grouping(current_setting('test.link2')::uuid);
select pg_temp.verify((select count(*)=2 from purchase_product_groups()),'undo restores prior manual and automatic groups');
select pg_temp.verify((select jsonb_array_length(variants)=3 from purchase_product_groups() where group_key=current_setting('test.group1')),'undo preserves the earlier confirmed group');
set local request.jwt.claims='{"sub":"user_link_b","iss":"https://issuer.example","o":{"id":"org_LinkB","rol":"admin"}}';
select pg_temp.verify((select count(*)=0 from product_group_actions),'other workspaces cannot read grouping history');
select pg_temp.verify((select count(*)=0 from product_group_aliases),'other workspaces cannot read aliases');
select pg_temp.rejects(format('select undo_purchase_product_grouping(%L::uuid)',current_setting('test.link1')),'Newer grouping changes exist.');
select pg_temp.rejects(format($q$select link_purchase_product_groups(%L,'product:mung sprouts',array['bean sprouts','mung bean sprouts'],array['mung sprouts'])$q$,current_setting('test.group1')),'Product groups changed.');
set local request.jwt.claims='{"sub":"user_link_a","iss":"https://issuer.example","o":{"id":"org_LinkA","rol":"admin"}}';
select undo_purchase_product_grouping(current_setting('test.link1')::uuid);
select pg_temp.verify((select count(*)=3 from purchase_product_groups()),'undo original link restores all names');
select pg_temp.verify((select count(*)=0 from product_group_aliases),'original automatic grouping restored');
select pg_temp.verify((select count(*)=2 from product_group_actions where undone_at is not null),'undo audit remains available');
select pg_temp.verify((select count(*)=2 and sum(total)=30 from invoices),'invoice totals unchanged throughout');
reset role;
set local role service_role;
update product_group_actions set actor_user_id=null where actor_user_id='user_link_a';
select pg_temp.verify((select count(*)=0 from product_group_actions where actor_user_id='user_link_a'),'author identifiers can be cleared during account deletion');
delete from product_group_actions where organization_id='org_LinkA';
delete from product_group_aliases where organization_id='org_LinkA';
delete from product_display_groups where organization_id='org_LinkA';
select pg_temp.verify((select count(*)=0 from product_display_groups where organization_id='org_LinkA'),'workspace grouping records can be removed during account deletion');
rollback;
