-- Run against a disposable database with all migrations applied. No production data.
begin;
set local role authenticated;
set local request.jwt.claims='{"sub":"user_personal_test_A","iss":"https://issuer-a.example","o":{"id":"org_TestBusiness","rol":"admin"}}';
set local request.headers='{}';
select public.create_personal_workspace('Test household') as workspace \gset
select public.create_personal_workspace('Does not create a second household')=:'workspace' as idempotent \gset
\if :idempotent
\else
 \quit 1
\endif
select set_config('request.headers',json_build_object('x-sift-workspace',:'workspace')::text,true);
select public.current_org_id()=:'workspace' as selected_owner \gset
\if :selected_owner
\else
 \quit 2
\endif
insert into vendors(organization_id,name) values(:'workspace','Test household store');
select id as vendor from vendors where organization_id=:'workspace' limit 1 \gset
insert into invoices(organization_id,vendor_id,status,total) values(:'workspace',:'vendor','saved',4) returning id as receipt \gset
insert into invoice_line_items(organization_id,invoice_id,raw_description,clean_name,qty,unit_of_measure,unit_price,extended_price,retail_product)
 values(:'workspace',:'receipt','Test product','Test product',1,'EA',4,4,'{"store_sku":"1001","identity_confident":true}') returning id as line \gset
insert into price_alerts(organization_id,vendor_id,line_item_id,item_name,previous_price,new_price,unit,pct_change)
 values(:'workspace',:'vendor',:'line','Test product',3,4,'EA',33.33);
select public.edit_invoice_line(:'receipt',:'line','Corrected product',2,4,8);
select (select retail_product is null from invoice_line_items where id=:'line') and not exists(select 1 from price_alerts where line_item_id=:'line') as corrections_invalidate_comparisons \gset
\if :corrections_invalidate_comparisons
\else
 \quit 10
\endif
select set_config('request.headers','{"x-sift-workspace":"org_OtherBusiness"}',true);
select public.current_org_id() is null as wrong_org_rejected \gset
\if :wrong_org_rejected
\else
 \quit 3
\endif
set local request.headers='{}';
select public.current_org_id()='org_TestBusiness' as legacy_compatible \gset
\if :legacy_compatible
\else
 \quit 4
\endif
select set_config('request.headers',json_build_object('x-sift-workspace',:'workspace')::text,true);
set local request.jwt.claims='{"sub":"user_personal_test_B","iss":"https://issuer-a.example"}';
select public.current_org_id() is null and (select count(*)=0 from vendors) and (select count(*)=0 from personal_workspaces) as other_user_rejected \gset
\if :other_user_rejected
\else
 \quit 5
\endif
set local request.jwt.claims='{"sub":"user_personal_test_A","iss":"https://issuer-b.example"}';
select public.current_org_id() is null as other_issuer_rejected \gset
\if :other_issuer_rejected
\else
 \quit 6
\endif
reset role;
select not has_table_privilege('authenticated','personal_workspaces','update') and not has_table_privilege('authenticated','workspace_billing_links','select') and not has_function_privilege('authenticated','public.bind_workspace_billing(text,text,text,text,text)','execute') as plan_tampering_rejected \gset
\if :plan_tampering_rejected
\else
 \quit 7
\endif
select public.bind_workspace_billing('org_TestBusiness','business','user_personal_test_A','https://issuer-a.example','org_TestBusiness');
select public.bind_workspace_billing(:'workspace','personal','user_personal_test_A','https://issuer-a.example',:'workspace')='org_TestBusiness' as restore_identity_shared \gset
\if :restore_identity_shared
\else
 \quit 8
\endif
do $$begin
 begin
  perform public.bind_workspace_billing('pws_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','personal','user_personal_test_B','https://issuer-a.example','org_TestBusiness');
  raise exception 'FAIL: another owner was attached to the same billing customer';
 exception when others then
  if sqlerrm <> 'Purchase identity belongs to another billing owner' then raise; end if;
 end;
end $$;
insert into account_deletions(user_id,organization_ids) values('user_personal_test_A',array[:'workspace']);
set local role authenticated;
set local request.jwt.claims='{"sub":"user_personal_test_A","iss":"https://issuer-a.example"}';
select public.current_org_id() is null and (select count(*)=0 from personal_workspaces) as deletion_revokes_access \gset
\if :deletion_revokes_access
\else
 \quit 9
\endif
rollback;
