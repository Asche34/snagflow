-- Migration 0007: workflow RPCs (assign / transition / soft delete)
-- SECURITY DEFINER, set search_path = '', owner bypasses RLS; each function
-- validates the CALLER's role explicitly (uid from auth.uid()).
-- Every workflow change writes activity_log and emits notifications (spec §6).
-- Error contract (mirrored in packages/shared TRANSITION_ERRORS): message is
-- prefixed with a stable code the UI maps to friendly copy:
--   SNAG_NOT_FOUND, SNAG_ILLEGAL_TRANSITION, SNAG_ASSIGN_FORBIDDEN,
--   SNAG_TRANSITION_FORBIDDEN, SNAG_COMMENT_REQUIRED, SNAG_FIX_PHOTO_REQUIRED,
--   SNAG_DELETED, SNAG_CLOSED_BY_OTHER.

-- ============================================================================
-- Shared plumbing
-- ============================================================================
create or replace function public.snag_notify(
  p_user_id uuid,
  p_type text,
  p_project_id uuid,
  p_snag_id uuid,
  p_payload jsonb
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, project_id, snag_id, payload)
  values (p_user_id, p_type, p_project_id, p_snag_id, p_payload);
$$;

create or replace function public.snag_activity(
  p_project_id uuid,
  p_snag_id uuid,
  p_actor_id uuid,
  p_action text,
  p_from_value text,
  p_to_value text,
  p_meta jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_log (project_id, snag_id, actor_id, action, from_value, to_value, meta)
  values (p_project_id, p_snag_id, p_actor_id, p_action, p_from_value, p_to_value, p_meta);
$$;

-- Notify every manager of a project except the acting user.
create or replace function public.notify_managers(
  p_project_id uuid,
  p_type text,
  p_snag_id uuid,
  p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, project_id, snag_id, payload)
  select m.user_id, p_type, p_project_id, p_snag_id, p_payload
  from public.project_members m
  where m.project_id = p_project_id
    and m.role = 'manager'
    and m.user_id <> auth.uid();
end;
$$;

-- ============================================================================
-- assign_snag(snag_id, assignee_id) — manager/admin. Never changes status.
-- ============================================================================
create or replace function public.assign_snag(p_snag_id uuid, p_assignee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snag_row public.snags%rowtype;
  result jsonb;
  assignee_role public.project_role;
  caller_role public.project_role;
begin
  select * into snag_row
  from public.snags
  where id = p_snag_id and deleted_at is null
  for update;

  if not found then
    raise exception 'SNAG_NOT_FOUND: snag does not exist or is deleted' using errcode = 'P0001';
  end if;

  caller_role := public.project_role(snag_row.project_id);
  if not (public.is_admin() or caller_role = 'manager') then
    raise exception 'SNAG_ASSIGN_FORBIDDEN: only managers or admins can assign snags'
      using errcode = 'P0001';
  end if;

  if p_assignee_id is not null then
    select m.role into assignee_role
    from public.project_members m
    where m.project_id = snag_row.project_id and m.user_id = p_assignee_id;

    if assignee_role is null or assignee_role = 'viewer' then
      raise exception 'SNAG_ASSIGN_FORBIDDEN: assignee must be a project member (member or manager)'
        using errcode = 'P0001';
    end if;
  end if;

  set local app.snag_rpc = '1';

  update public.snags
    set assignee_id = p_assignee_id
  where id = snag_row.id;

  perform public.snag_activity(
    snag_row.project_id, snag_row.id, auth.uid(), 'assigned',
    snag_row.assignee_id::text, p_assignee_id::text,
    jsonb_build_object('snag_number', snag_row.number)
  );

  if p_assignee_id is not null and p_assignee_id <> auth.uid() then
    perform public.snag_notify(
      p_assignee_id, 'assigned', snag_row.project_id, snag_row.id,
      jsonb_build_object('snag_number', snag_row.number, 'snippet', snag_row.title)
    );
  end if;

  select jsonb_build_object(
    'id', id, 'number', number, 'title', title, 'status', status,
    'assignee_id', assignee_id, 'updated_at', updated_at
  )
  into result from public.snags where id = snag_row.id;
  return result;
end;
$$;

-- ============================================================================
-- transition_snag(snag_id, to_status, comment)
-- Implements the §6 state machine exactly.
-- ============================================================================
create or replace function public.transition_snag(
  p_snag_id uuid,
  p_to_status public.snag_status,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snag_row public.snags%rowtype;
  project_row public.projects%rowtype;
  result jsonb;
  caller_role public.project_role;
  caller_admin boolean;
  caller_is_manager boolean;
  caller_is_assignee boolean;
  has_fix_photo boolean;
  new_rejection_count integer;
begin
  select * into snag_row from public.snags where id = p_snag_id for update;
  if not found then
    raise exception 'SNAG_NOT_FOUND: snag does not exist' using errcode = 'P0001';
  end if;
  if snag_row.deleted_at is not null then
    raise exception 'SNAG_DELETED: snag is deleted' using errcode = 'P0001';
  end if;

  select * into project_row from public.projects where id = snag_row.project_id;

  caller_admin := public.is_admin();
  caller_role := public.project_role(snag_row.project_id);
  caller_is_manager := caller_admin or caller_role = 'manager';
  caller_is_assignee := snag_row.assignee_id = auth.uid();

  -- --------------------------------------------------------------- start work
  if p_to_status = 'in_progress' and snag_row.status = 'open' then
    if not (
      caller_is_manager
      or (caller_role = 'member' and caller_is_assignee and snag_row.assignee_id is not null)
    ) then
      raise exception 'SNAG_TRANSITION_FORBIDDEN: start work requires the assignee or a manager'
        using errcode = 'P0001';
    end if;

    perform public.snag_activity(
      snag_row.project_id, snag_row.id, auth.uid(), 'status_changed',
      snag_row.status::text, 'in_progress'::text,
      jsonb_build_object('snag_number', snag_row.number)
    );

  -- ---------------------------------------------------------- request review
  elsif p_to_status = 'ready_for_review' and snag_row.status = 'in_progress' then
    if not (caller_is_manager or caller_is_assignee) then
      raise exception 'SNAG_TRANSITION_FORBIDDEN: request review requires the assignee or a manager'
        using errcode = 'P0001';
    end if;

    if project_row.require_fix_photo then
      select exists(
        select 1 from public.snag_photos
        where snag_id = snag_row.id and kind = 'fix'
      ) into has_fix_photo;
      if not has_fix_photo then
        raise exception 'SNAG_FIX_PHOTO_REQUIRED: mark ready for review needs at least one fix photo'
          using errcode = 'P0001';
      end if;
    end if;

    perform public.snag_activity(
      snag_row.project_id, snag_row.id, auth.uid(), 'status_changed',
      snag_row.status::text, 'ready_for_review'::text,
      jsonb_build_object('snag_number', snag_row.number)
    );

    perform public.notify_managers(
      snag_row.project_id, 'review_requested', snag_row.id,
      jsonb_build_object('snag_number', snag_row.number, 'snippet', snag_row.title)
    );

  -- ----------------------------------------------------------------- approve
  elsif p_to_status = 'closed' and snag_row.status = 'ready_for_review' then
    if not caller_is_manager then
      raise exception 'SNAG_TRANSITION_FORBIDDEN: only managers or admins approve and close'
        using errcode = 'P0001';
    end if;

    perform public.snag_activity(
      snag_row.project_id, snag_row.id, auth.uid(), 'status_changed',
      snag_row.status::text, 'closed'::text,
      jsonb_build_object('snag_number', snag_row.number)
    );

    -- Notify the assignee (and creator when different).
    if snag_row.assignee_id is not null and snag_row.assignee_id <> auth.uid() then
      perform public.snag_notify(
        snag_row.assignee_id, 'approved', snag_row.project_id, snag_row.id,
        jsonb_build_object('snag_number', snag_row.number, 'snippet', snag_row.title)
      );
    end if;
    if snag_row.created_by <> auth.uid() and snag_row.created_by <> snag_row.assignee_id then
      perform public.snag_notify(
        snag_row.created_by, 'approved', snag_row.project_id, snag_row.id,
        jsonb_build_object('snag_number', snag_row.number, 'snippet', snag_row.title)
      );
    end if;

  -- ------------------------------------------------------------------ reject
  elsif p_to_status = 'in_progress' and snag_row.status = 'ready_for_review' then
    if not caller_is_manager then
      raise exception 'SNAG_TRANSITION_FORBIDDEN: only managers or admins reject'
        using errcode = 'P0001';
    end if;
    if coalesce(trim(p_comment), '') = '' then
      raise exception 'SNAG_COMMENT_REQUIRED: rejecting a snag needs a comment' using errcode = 'P0001';
    end if;
    new_rejection_count := snag_row.rejection_count + 1;

    perform public.snag_activity(
      snag_row.project_id, snag_row.id, auth.uid(), 'rejected',
      snag_row.status::text, 'in_progress'::text,
      jsonb_build_object('snag_number', snag_row.number, 'comment', left(p_comment, 200))
    );

    if snag_row.assignee_id is not null and snag_row.assignee_id <> auth.uid() then
      perform public.snag_notify(
        snag_row.assignee_id, 'rejected', snag_row.project_id, snag_row.id,
        jsonb_build_object('snag_number', snag_row.number, 'snippet', p_comment)
      );
    end if;

  -- ------------------------------------------------------------------ reopen
  elsif p_to_status = 'open' and snag_row.status = 'closed' then
    if not caller_is_manager then
      raise exception 'SNAG_TRANSITION_FORBIDDEN: only managers or admins reopen closed snags'
        using errcode = 'P0001';
    end if;
    if coalesce(trim(p_comment), '') = '' then
      raise exception 'SNAG_COMMENT_REQUIRED: reopening a snag needs a comment' using errcode = 'P0001';
    end if;

    perform public.snag_activity(
      snag_row.project_id, snag_row.id, auth.uid(), 'status_changed',
      snag_row.status::text, 'open'::text,
      jsonb_build_object('snag_number', snag_row.number, 'comment', left(p_comment, 200))
    );

    perform public.notify_managers(
      snag_row.project_id, 'reopened', snag_row.id,
      jsonb_build_object('snag_number', snag_row.number, 'snippet', snag_row.title)
    );
    if snag_row.assignee_id is not null and snag_row.assignee_id <> auth.uid() then
      perform public.snag_notify(
        snag_row.assignee_id, 'reopened', snag_row.project_id, snag_row.id,
        jsonb_build_object('snag_number', snag_row.number, 'snippet', p_comment)
      );
    end if;
    if snag_row.created_by <> auth.uid() and snag_row.created_by <> snag_row.assignee_id then
      perform public.snag_notify(
        snag_row.created_by, 'reopened', snag_row.project_id, snag_row.id,
        jsonb_build_object('snag_number', snag_row.number, 'snippet', snag_row.title)
      );
    end if;

  -- --------------------------------------------------------------- illegal
  else
    raise exception 'SNAG_ILLEGAL_TRANSITION: cannot move from % to %',
      snag_row.status, p_to_status
      using errcode = 'P0001';
  end if;

  set local app.snag_rpc = '1';

  update public.snags
    set status = p_to_status,
        rejection_count = coalesce(new_rejection_count, rejection_count),
        closed_at = case
          when p_to_status = 'closed' then now()
          when snag_row.status = 'closed' then null
          else closed_at
        end,
        closed_by = case
          when p_to_status = 'closed' then auth.uid()
          when snag_row.status = 'closed' then null
          else closed_by
        end,
        -- Rejection keeps work item; reopen keeps assignee (§6).
        updated_at = now()
  where id = snag_row.id;

  select jsonb_build_object(
    'id', id, 'number', number, 'title', title, 'status', status,
    'assignee_id', assignee_id, 'rejection_count', rejection_count,
    'closed_at', closed_at, 'updated_at', updated_at
  )
  into result from public.snags where id = snag_row.id;
  return result;
end;
$$;

-- ============================================================================
-- soft_delete_snag(snag_id) — manager/admin. Soft delete keeps history.
-- ============================================================================
create or replace function public.soft_delete_snag(p_snag_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  snag_row public.snags%rowtype;
begin
  select * into snag_row from public.snags where id = p_snag_id and deleted_at is null for update;
  if not found then
    raise exception 'SNAG_NOT_FOUND: snag does not exist or is already deleted' using errcode = 'P0001';
  end if;

  if not (public.is_admin() or public.project_role(snag_row.project_id) = 'manager') then
    raise exception 'SNAG_DELETE_FORBIDDEN: only managers or admins delete snags'
      using errcode = 'P0001';
  end if;

  set local app.snag_rpc = '1';

  update public.snags
    set deleted_at = now()
  where id = snag_row.id;

  perform public.snag_activity(
    snag_row.project_id, snag_row.id, auth.uid(), 'deleted',
    null, null,
    jsonb_build_object('snag_number', snag_row.number)
  );
end;
$$;
