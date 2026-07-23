-- Private storage bucket for dish/recipe photos, mirroring invoice-images.
-- Path convention: {organization_id}/{recipe_id}/{filename}; the first segment
-- must match the caller's org (same tenant-isolation rule as everywhere else).

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', false)
on conflict (id) do nothing;

create policy "recipe_images_tenant_isolation" on storage.objects
  for all
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = private.current_org_id()
  )
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = private.current_org_id()
  );
