alter table public.ai_jobs add column phase text not null default 'checking';
create or replace function public.invoice_processing_status(p_invoice uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('phase',case when i.status in ('scanned','saved') then 'complete' else coalesce(j.phase,'checking') end,'status',j.status)
 from public.invoices i left join lateral (
  select phase,status from public.ai_jobs where resource_id=i.id and organization_id=i.organization_id and kind='invoice' order by created_at desc limit 1
 ) j on true where i.id=p_invoice and i.organization_id=private.current_org_id();
$$;
revoke all on function public.invoice_processing_status(uuid) from public,anon;
grant execute on function public.invoice_processing_status(uuid) to authenticated;
