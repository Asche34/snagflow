-- Migration 0008: storage buckets and object-level policies.
-- Buckets are private; clients read/write through short-lived signed URLs where
-- needed. Path convention: {project_id}/{snag_id}/{uuid}.jpg for snag-photos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('snag-photos', 'snag-photos', false, 20971520, array['image/jpeg', 'image/png', 'image/webp']),
  ('reports', 'reports', false, 52428800, array['application/pdf']),
  ('branding', 'branding', false, 1048576, array['image/png', 'image/jpeg', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Helper: the first path segment of an object maps to a project id we can
-- authorize against (snag-photos and reports buckets).
create or replace function public.storage_project_id(path text)
returns uuid
language sql
stable
as $$
  select nullif(split_part(path, '/', 1), '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- snag-photos
-- ---------------------------------------------------------------------------
-- Read: any project member (viewers included) sees their project's photos.
create policy snag_photos_read on storage.objects
  for select
  using (
    bucket_id = 'snag-photos'
    and public.can('view', public.storage_project_id(name))
  );

-- Write: members and up, only into their project folder.
create policy snag_photos_insert on storage.objects
  for insert
  with check (
    bucket_id = 'snag-photos'
    and public.can('member', public.storage_project_id(name))
  );

-- Update: managers/admins in the project, or the uploader replacing their own
-- object (e.g. the background upload queue retrying/resizing their draft).
create policy snag_photos_update on storage.objects
  for update
  using (
    bucket_id = 'snag-photos'
    and (
      public.can('manager', public.storage_project_id(name))
      or owner_id = auth.uid()::text
    )
  );

create policy snag_photos_delete on storage.objects
  for delete
  using (
    bucket_id = 'snag-photos'
    and public.can('manager', public.storage_project_id(name))
  );

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create policy reports_read on storage.objects
  for select
  using (
    bucket_id = 'reports'
    and public.can('manager', public.storage_project_id(name))
  );
-- Insert: no client policy. The report route handler writes with the
-- service-role key (which bypasses RLS), then hands back a signed URL.

-- ---------------------------------------------------------------------------
-- branding
-- ---------------------------------------------------------------------------
create policy branding_read on storage.objects
  for select
  using (bucket_id = 'branding' and auth.uid() is not null);

create policy branding_write_admin on storage.objects
  for insert
  with check (bucket_id = 'branding' and public.is_admin());

create policy branding_update_admin on storage.objects
  for update
  using (bucket_id = 'branding' and public.is_admin());

create policy branding_delete_admin on storage.objects
  for delete
  using (bucket_id = 'branding' and public.is_admin());
