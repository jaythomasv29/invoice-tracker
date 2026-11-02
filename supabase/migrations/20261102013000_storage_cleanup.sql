create table public.storage_deletion_queue (
 id uuid primary key default gen_random_uuid(),
 bucket text not null,
 paths text[] not null,
 created_at timestamptz not null default now()
);
alter table public.storage_deletion_queue enable row level security;
revoke all on public.storage_deletion_queue from anon,authenticated;
create function public.queue_invoice_image_deletion() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into storage_deletion_queue(bucket,paths)
 values('invoice-images',array(select p from unnest(old.image_urls) p where p like old.organization_id||'/'||old.id::text||'/%'));
 return old;
end $$;
create trigger queue_invoice_image_deletion after delete on public.invoices for each row execute function public.queue_invoice_image_deletion();
