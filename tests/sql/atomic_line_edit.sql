begin;
alter table invoices add constraint reject_test_total check (subtotal<>99);
insert into invoices(id,organization_id,status,invoice_date,created_at,tax,total) values('30000000-0000-0000-0000-000000000001','org_a','saved',current_date,now(),0,120.53);
insert into invoice_line_items(id,organization_id,invoice_id,qty,unit_price,extended_price,line_item_type) values('40000000-0000-0000-0000-000000000001','org_a','30000000-0000-0000-0000-000000000001',1,13.65,120.53,'charge');
select set_config('test.org','org_a',true);set local role authenticated;
do $$ declare r jsonb;begin
 r:=edit_invoice_line('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Duck',1,13.65,120.53);
 if (r->>'total')::numeric<>120.53 then raise exception 'catch weight total lost';end if;
 begin
 perform edit_invoice_line('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000099','bad',1,1,1);
 raise exception 'missing line accepted';
 exception when others then if sqlerrm='missing line accepted' then raise;end if;end;
 begin
 perform edit_invoice_line('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Rollback',1,99,99);
 raise exception 'failed totals update accepted';
 exception when check_violation then null;end;
 if (select extended_price from invoice_line_items where id='40000000-0000-0000-0000-000000000001')<>120.53 then raise exception 'partial line edit persisted';end if;
 if (select total from invoices where id='30000000-0000-0000-0000-000000000001')<>120.53 then raise exception 'failed edit mutated totals';end if;
end $$;
select set_config('test.org','org_b',true);
do $$ begin
 begin
 perform edit_invoice_line('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','bad',1,1,1);
 raise exception 'cross tenant edit accepted';
 exception when others then if sqlerrm='cross tenant edit accepted' then raise;end if;end;
end $$;
rollback;
