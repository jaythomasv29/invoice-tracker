\set ON_ERROR_STOP on
begin;
-- Test-only role grants emulate Supabase's service-role privileges.
grant all on all tables in schema public to service_role;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"user_test","o":{"id":"org_test"}}',false);
select public.set_ai_consent(true);
do $$ begin
 if not exists(select 1 from public.ai_consents where user_id='user_test' and withdrawn_at is null) then raise exception 'consent missing'; end if;
 if has_table_privilege('authenticated','public.extraction_usage','UPDATE') then raise exception 'client may tamper with quota'; end if;
 if has_function_privilege('authenticated','public.release_extraction_slot()','EXECUTE') then raise exception 'client may release quota'; end if;
 if has_function_privilege('authenticated','public.begin_ai_job(text,uuid,text,int)','EXECUTE') then raise exception 'client may choose quota'; end if;
end $$;
select public.set_ai_consent(false);
reset role;
set role service_role;
do $$ declare j jsonb; j2 jsonb; v_resource uuid:=gen_random_uuid(); v_used int; begin
 j:=public.begin_ai_job('org_test',v_resource,'invoice',1);
 if not (j->>'allowed')::boolean then raise exception 'first reservation denied'; end if;
 j2:=public.begin_ai_job('org_test',v_resource,'invoice',1);
 if j2->>'code'<>'AI_BUSY' then raise exception 'concurrent resource was not locked'; end if;
 j2:=public.begin_ai_job('org_test',gen_random_uuid(),'invoice',1);
 if j2->>'code'<>'FREE_LIMIT_REACHED' then raise exception 'cap not enforced'; end if;
 perform public.finish_ai_job((j->>'id')::uuid,false);
 perform public.finish_ai_job((j->>'id')::uuid,false);
 select used into v_used from extraction_usage where organization_id='org_test';
 if v_used<>0 then raise exception 'release is not idempotent'; end if;
 j:=public.begin_ai_job('org_test',gen_random_uuid(),'invoice',1);
 perform public.finish_ai_job((j->>'id')::uuid,true);
 select used into v_used from extraction_usage where organization_id='org_test';
 if v_used<>1 then raise exception 'successful scan did not retain usage'; end if;
end $$;
reset role;
insert into account_deletions(user_id,organization_ids) values('user_test',array['org_test']);
set role authenticated;
select set_config('request.jwt.claims','{"sub":"user_test","o":{"id":"org_test"}}',false);
do $$ begin
 if private.current_org_id() is not null then raise exception 'deleting identity still has org access'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"user_other","o":{"id":"org_test"}}',false);
do $$ begin
 if private.current_org_id() is not null then raise exception 'deleting organization still accessible'; end if;
end $$;
rollback;
-- Atomic extraction and review cannot leave half-written or duplicate records.
begin;
grant all on all tables in schema public to authenticated,service_role;
insert into vendors(id,organization_id,name) values('11111111-1111-4111-8111-111111111111','org_atomic','Test vendor');
insert into invoices(id,organization_id) values('22222222-2222-4222-8222-222222222222','org_atomic');
set role service_role;
do $$ declare j jsonb; begin
 j:=begin_ai_job('org_atomic','22222222-2222-4222-8222-222222222222','invoice',10);
 perform complete_invoice_extraction((j->>'id')::uuid,'11111111-1111-4111-8111-111111111111',
 '{"invoice_date":"2026-11-01","subtotal":10,"tax":0,"total":10,"raw_ai_response":{},"image_hashes":[]}',
 '[{"raw_description":"Test item","clean_name":"Test item","qty":1,"unit_of_measure":"each","unit_price":10,"extended_price":10,"line_item_type":"charge","category":"produce","confidence":1}]');
 if (select status from invoices where id='22222222-2222-4222-8222-222222222222')<>'scanned' then raise exception 'atomic extraction failed'; end if;
 if (select count(*) from invoice_line_items where invoice_id='22222222-2222-4222-8222-222222222222')<>1 then raise exception 'line count mismatch'; end if;
 begin
  perform complete_invoice_extraction((j->>'id')::uuid,'11111111-1111-4111-8111-111111111111','{}','[]');
  raise exception 'duplicate completion was accepted';
 exception when raise_exception then if sqlerrm<>'no active job' then raise; end if;
 end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"user_atomic","o":{"id":"org_atomic"}}',false);
do $$ begin
 begin
  perform save_invoice_review('22222222-2222-4222-8222-222222222222','2026-11-01','[{"id":"33333333-3333-4333-8333-333333333333","verification":"pending","confirmed":true}]');
  raise exception 'foreign review line was accepted';
 exception when raise_exception then if sqlerrm<>'invoice line unavailable' then raise; end if;
 end;
 if (select status from invoices where id='22222222-2222-4222-8222-222222222222')<>'scanned' then raise exception 'failed save changed status'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"user_other","o":{"id":"org_other"}}',false);
do $$ begin
 if exists(select 1 from invoices where id='22222222-2222-4222-8222-222222222222') then raise exception 'tenant leak'; end if;
end $$;
rollback;
