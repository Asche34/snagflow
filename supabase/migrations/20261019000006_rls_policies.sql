-- Migration 0006: remaining RLS policies (domain + collaboration tables).

-- invites: read by admins and (for project-scoped invites) project managers.
-- Mutations happen only through the server-side invite route handler (service
-- role key), so no INSERT/UPDATE/DELETE policy exists for clients.
create policy invites_select on public.invites
  for select using (
    public.is_admin()
    or (project_id is not null and public.can('manager', project_id))
  );

-- locations
create policy locations_select on public.locations
  for select using (public.can('view', project_id));

create policy locations_insert on public.locations
  for insert with check (public.can('member', project_id));

create policy locations_update on public.locations
  for update using (public.can('member', project_id));

create policy locations_delete on public.locations
  for delete using (public.can('manager', project_id));

-- categories
create policy categories_select on public.categories
  for select using (public.can('view', project_id));

create policy categories_insert on public.categories
  for insert with check (public.can('member', project_id));

create policy categories_update on public.categories
  for update using (public.can('member', project_id));

create policy categories_delete on public.categories
  for delete using (public.can('manager', project_id));

-- snags. Detail edits stay possible directly (they must be, to keep the app
-- snappy and offline-friendly); protected workflow columns are guarded in
-- migration 0005. Member rule from the matrix: creator while not closed, or
-- while assigned to them (fix workflow touches their snag's fields).
create policy snags_select on public.snags
  for select using (public.can('view', project_id) and deleted_at is null);

create policy snags_insert on public.snags
  for insert with check (public.can('member', project_id) and created_by = auth.uid());

create policy snags_update on public.snags
  for update using (
    -- admins and managers may edit details of any snag in the project
    public.can('manager', project_id)
    -- members: own snags while not closed, or snags assigned to them
    or (
      public.project_role(project_id) = 'member'
      and (
        (created_by = auth.uid() and status <> 'closed')
        or (assignee_id = auth.uid() and status <> 'closed')
      )
      and deleted_at is null
    )
  );

create policy snags_delete on public.snags
  for delete using (public.can('manager', project_id)); -- soft delete via RPC; hard delete admin/manager only

-- snag_photos
create policy snag_photos_select on public.snag_photos
  for select using (
    exists (
      select 1 from public.snags s
      where s.id = snag_id and public.can('view', s.project_id) and s.deleted_at is null
    )
  );

create policy snag_photos_insert on public.snag_photos
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.snags s
      where s.id = snag_id
        and public.can('member', s.project_id)
        and s.deleted_at is null
    )
  );

create policy snag_photos_update on public.snag_photos
  for update using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.snags s
      where s.id = snag_id and public.can('manager', s.project_id)
    )
  );

create policy snag_photos_delete on public.snag_photos
  for delete using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.snags s
      where s.id = snag_id and public.can('manager', s.project_id)
    )
  );

-- comments
create policy comments_select on public.comments
  for select using (
    exists (
      select 1 from public.snags s
      where s.id = snag_id and public.can('view', s.project_id) and s.deleted_at is null
    )
  );

create policy comments_insert on public.comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.snags s
      where s.id = snag_id
        and public.can('member', s.project_id)
        and s.deleted_at is null
    )
  );

-- no UPDATE/DELETE policies: comments are immutable (activity trail integrity).

-- activity_log: SELECT for project members; writes come from triggers/RPCs
-- (SECURITY DEFINER bypasses RLS). No client write policies on purpose.
create policy activity_log_select on public.activity_log
  for select using (public.can('view', project_id));

-- notifications: strictly per-user.
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());

create policy notifications_insert on public.notifications
  for insert with check (user_id = auth.uid()); -- RPCs write via definer anyway

create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());

create policy notifications_delete on public.notifications
  for delete using (user_id = auth.uid());

-- push_tokens: strictly per-user.
create policy push_tokens_all_own on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reports: managers/admins read; generation happens server-side (service role).
create policy reports_select on public.reports
  for select using (public.can('manager', project_id));
