-- Never attach another administrator’s household to the billing owner’s Apple receipt.
create or replace function public.bind_workspace_billing(p_workspace text,p_type text,p_user text,p_issuer text,p_preferred_customer text) returns text
 language plpgsql security definer set search_path=public as $$
declare result text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user||':'||p_issuer,0));
 select customer_id into result from workspace_billing_links where workspace_id=p_workspace;
 if result is not null then return result; end if;
 if exists(select 1 from workspace_billing_links where owner_user_id=p_user and owner_issuer=p_issuer and account_type=p_type) then
  raise exception 'One workspace per account type is supported for purchases';
 end if;
 select customer_id into result from workspace_billing_links where owner_user_id=p_user and owner_issuer=p_issuer limit 1;
 result := coalesce(result,p_preferred_customer,p_workspace);
 perform pg_advisory_xact_lock(hashtextextended('billing-customer:'||result,0));
 if exists(select 1 from workspace_billing_links where customer_id=result and (owner_user_id<>p_user or owner_issuer<>p_issuer)) then raise exception 'Purchase identity belongs to another billing owner'; end if;
 insert into workspace_billing_links values(p_workspace,p_type,p_user,p_issuer,result);
 return result;
end $$;
revoke all on function public.bind_workspace_billing(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.bind_workspace_billing(text,text,text,text,text) to service_role;
