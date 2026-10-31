-- Postgres Changes remains subject to each subscriber's SELECT RLS.
do $$
declare relation_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach relation_name in array array['snags', 'comments', 'snag_photos', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', relation_name);
    end if;
  end loop;
end $$;

-- Notify distinct, still-authorized creator/assignee recipients on new comments.
-- Workflow rejection/reopen reasons remain in the existing audit/notification payloads.
create function public.notify_snag_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target public.snags%rowtype;
begin
  select * into target from public.snags where id = new.snag_id and deleted_at is null;
  if not found then return new; end if;
  insert into public.notifications (user_id, type, project_id, snag_id, payload)
  select distinct recipient.id, 'comment', target.project_id, target.id,
    jsonb_build_object('actor', new.author_id, 'snippet', left(new.body, 160))
  from public.profiles recipient
  where recipient.id in (target.created_by, target.assignee_id)
    and recipient.id <> new.author_id and recipient.is_active
    and (recipient.is_admin or exists (
      select 1 from public.project_members membership
      where membership.project_id = target.project_id and membership.user_id = recipient.id
    ));
  return new;
end $$;
revoke all on function public.notify_snag_comment() from public, anon, authenticated;
create trigger comments_notify after insert on public.comments
for each row execute function public.notify_snag_comment();
