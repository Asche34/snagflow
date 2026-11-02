-- Phase 4: immutable photo sources, optimistic markup saves and private report revisions.
-- All writes run as the caller through narrowly authorized RPCs; no service key required.
revoke update on public.snag_photos from anon, authenticated;

create or replace function public.save_photo_annotation(
  p_photo_id uuid, p_expected_updated_at timestamptz,
  p_annotated_path text, p_annotation_json jsonb
) returns public.snag_photos
language plpgsql security definer set search_path = '' as $$
declare
  photo public.snag_photos%rowtype;
  pid uuid;
begin
  select p.* into photo from public.snag_photos p where p.id = p_photo_id for update;
  select s.project_id into pid from public.snags s where s.id = photo.snag_id and s.deleted_at is null;
  if auth.uid() is null or pid is null or not (
    coalesce(public.can('manager', pid), false)
    or (photo.uploaded_by = auth.uid() and coalesce(public.can('member', pid), false))
  ) then raise exception 'ANNOTATION_FORBIDDEN: photo editing access is required'; end if;
  -- Exact committed retries succeed without overwriting a newer version.
  if photo.annotated_path = p_annotated_path and photo.annotation_json = p_annotation_json then return photo; end if;
  if p_expected_updated_at is null or photo.updated_at <> p_expected_updated_at then
    raise exception 'ANNOTATION_CONFLICT: another edit was saved; reload before replacing it';
  end if;
  if p_annotated_path is null or p_annotated_path !~ (
    '^' || pid::text || '/' || photo.snag_id::text || '/[0-9a-fA-F-]{36}\.jpg$'
  ) or p_annotated_path = photo.storage_path or p_annotated_path = photo.thumb_path then
    raise exception 'ANNOTATION_PATH: a separate image in this photo folder is required';
  end if;
  if p_annotation_json is null or jsonb_typeof(p_annotation_json) <> 'object'
    or p_annotation_json->>'version' is distinct from '1'
    or p_annotation_json->>'width' is distinct from photo.width::text
    or p_annotation_json->>'height' is distinct from photo.height::text
    or jsonb_typeof(p_annotation_json->'objects') is distinct from 'array'
    or octet_length(p_annotation_json::text) > 524288 then
    raise exception 'ANNOTATION_DOCUMENT: invalid or oversized annotation document';
  end if;
  if jsonb_array_length(p_annotation_json->'objects') > 200 then
    raise exception 'ANNOTATION_DOCUMENT: no more than 200 objects are allowed';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'snag-photos' and o.name = p_annotated_path
      and o.metadata->>'mimetype' = 'image/jpeg'
      and (o.metadata->>'size')::bigint between 1 and 20971520) then
    raise exception 'ANNOTATION_IMAGE: upload the JPEG before saving';
  end if;
  update public.snag_photos set annotated_path = p_annotated_path, annotation_json = p_annotation_json
    where id = photo.id returning * into photo;
  insert into public.activity_log(project_id,snag_id,actor_id,action,meta)
    values(pid,photo.snag_id,auth.uid(),'photo_annotated',jsonb_build_object('photo_id',photo.id));
  return photo;
end;
$$;
revoke all on function public.save_photo_annotation(uuid,timestamptz,text,jsonb) from public,anon;
grant execute on function public.save_photo_annotation(uuid,timestamptz,text,jsonb) to authenticated;

-- Persistent rate limit works across processes, restarts and cookie/bearer callers.
create table public.report_generation_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_at timestamptz not null default clock_timestamp()
);
create index report_generation_requests_user_time on public.report_generation_requests(user_id,requested_at);
alter table public.report_generation_requests enable row level security;
revoke all on public.report_generation_requests from anon,authenticated;
create or replace function public.claim_report_generation(p_project_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(public.can('manager',p_project_id),false) then
    raise exception 'REPORT_FORBIDDEN: manager access is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('report-rate:' || auth.uid()::text,0));
  delete from public.report_generation_requests where user_id = auth.uid() and requested_at < clock_timestamp() - interval '1 minute';
  if (select count(*) from public.report_generation_requests where user_id = auth.uid()) >= 5 then
    raise exception 'REPORT_RATE_LIMIT: wait a minute before generating another report';
  end if;
  insert into public.report_generation_requests(user_id,project_id) values(auth.uid(),p_project_id);
end;
$$;
revoke all on function public.claim_report_generation(uuid) from public,anon;
grant execute on function public.claim_report_generation(uuid) to authenticated;

update storage.buckets set allowed_mime_types = array[
  'application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
] where id = 'reports';
create policy reports_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'reports' and public.can('manager',public.storage_project_id(name))
);
-- Cleanup only unregistered uploads; saved revision bytes cannot be replaced/deleted by clients.
create policy reports_cleanup on storage.objects for delete to authenticated using (
  bucket_id = 'reports' and public.can('manager',public.storage_project_id(name))
  and not exists (select 1 from public.reports r where r.storage_path = name)
);

create or replace function public.save_report(
  p_id uuid,p_project_id uuid,p_format public.report_format,p_theme text,
  p_filters jsonb,p_options jsonb,p_storage_path text
) returns public.reports language plpgsql security definer set search_path = '' as $$
declare
  report public.reports%rowtype;
  next_revision integer;
begin
  if auth.uid() is null or not coalesce(public.can('manager',p_project_id),false) then
    raise exception 'REPORT_FORBIDDEN: manager access is required';
  end if;
  -- Serialize only final registration, not the expensive rendering/upload.
  perform 1 from public.projects where id = p_project_id for update;
  select * into report from public.reports where id = p_id;
  if found then
    if report.project_id = p_project_id and report.created_by = auth.uid()
      and report.format = p_format and report.theme = p_theme and report.filters = p_filters
      and report.options = p_options and report.storage_path = p_storage_path then return report; end if;
    raise exception 'REPORT_IDENTITY: this report identity already holds different content';
  end if;
  if p_storage_path is null or p_storage_path <> p_project_id::text || '/' || p_id::text || '.' || p_format::text then
    raise exception 'REPORT_PATH: invalid project report path';
  end if;
  if p_theme is null or p_theme not in ('classic','compact','photo_first')
    or p_filters is null or jsonb_typeof(p_filters) <> 'object' or octet_length(p_filters::text) > 16384
    or p_options is null or jsonb_typeof(p_options) <> 'object' or octet_length(p_options::text) > 16384 then
    raise exception 'REPORT_OPTIONS: invalid report options';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'reports' and o.name = p_storage_path
    and o.metadata->>'mimetype' = case p_format when 'pdf' then 'application/pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' end
    and (o.metadata->>'size')::bigint between 1 and 52428800) then
    raise exception 'REPORT_FILE: upload the report before registering it';
  end if;
  select coalesce(max(revision),0)+1 into next_revision from public.reports where project_id = p_project_id;
  insert into public.reports(id,project_id,revision,format,theme,filters,options,storage_path,created_by)
    values(p_id,p_project_id,next_revision,p_format,p_theme,p_filters,p_options,p_storage_path,auth.uid()) returning * into report;
  return report;
end;
$$;
revoke all on function public.save_report(uuid,uuid,public.report_format,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.save_report(uuid,uuid,public.report_format,text,jsonb,jsonb,text) to authenticated;
notify pgrst,'reload schema';
