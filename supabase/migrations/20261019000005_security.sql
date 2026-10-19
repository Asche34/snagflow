-- Migration 0005: auth integration, security helpers, guard triggers, RLS.
-- Security posture (spec sections 4, 6, 7):
--  * RLS enabled on every table; helpers are SECURITY DEFINER + STABLE.
--  * Workflow fields are ONLY mutable through assign_snag/transition_snag RPCs;
--    a BEFORE UPDATE trigger makes direct edits of those columns impossible.
--  * activity_log has SELECT-only policies for clients (append-only).
--  * SECURITY DEFINER functions run as the (superuser) owner and therefore
--    bypass RLS on the tables they read; we do NOT force RLS on tables so these
--    helpers compose cleanly.

-- ============================================================================
-- Auth -> profiles automatic row
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users with an account created directly in SQL (seed) skip the trigger; run
-- its logic manually for such rows when seeding (seed.sql handles that).

-- ============================================================================
-- Security helper functions (STABLE, SECURITY DEFINER, empty search_path)
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin
      and is_active
  );
$$;

create or replace function public.project_role(pid uuid)
returns public.project_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.project_members m
  where m.user_id = auth.uid()
    and m.project_id = pid
  limit 1;
$$;

create or replace function public.is_project_member(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members
    where user_id = auth.uid() and project_id = pid
  );
$$;

create or replace function public.is_project_manager(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.project_role(pid) = 'manager', false);
$$;

-- True if the caller is an admin, a project manager, allowed by any member role
-- (viewers included), depending on the requested minimum.
create or replace function public.can(PNAME text, pid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return true;
  end if;
  case PNAME
    when 'view' then
      return public.is_project_member(pid);
    when 'member' then
      return public.project_role(pid) in ('member', 'manager');
    when 'manager' then
      return public.project_role(pid) = 'manager';
    else
      return false;
  end case;
end;
$$;

-- ============================================================================
-- snags guard trigger: workflow fields change only via RPCs
-- ============================================================================
create or replace function public.guard_snag_update()
returns trigger
language plpgsql
as $$
begin
  -- transition_snag / assign_snag set this transaction-locally; their writes
  -- update exactly the fields they are allowed to manage.
  if current_setting('app.snag_rpc', true) = '1' then
    return new;
  end if;

  if new.project_id is distinct from old.project_id
     or new.number is distinct from old.number
     or new.client_id is distinct from old.client_id
     or new.status is distinct from old.status
     or new.assignee_id is distinct from old.assignee_id
     or new.closed_at is distinct from old.closed_at
     or new.closed_by is distinct from old.closed_by
     or new.rejection_count is distinct from old.rejection_count
     or new.deleted_at is distinct from old.deleted_at
  then
    raise exception 'SNAG_PROTECTED_FIELD: workflow fields change through assign_snag/transition_snag only'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger guard_snag_update
  before update on public.snags
  for each row execute function public.guard_snag_update();

-- profile self-service: non-admin users cannot promote themselves
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  if new.id = auth.uid()
     and not public.is_admin()
     and (new.is_admin is distinct from old.is_admin
          or new.is_active is distinct from old.is_active
          or new.email is distinct from old.email)
  then
    raise exception 'PROFILE_FORBIDDEN_FIELD: only admins manage roles and account state'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.org_settings enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.invites enable row level security;
alter table public.locations enable row level security;
alter table public.categories enable row level security;
alter table public.snags enable row level security;
alter table public.snag_photos enable row level security;
alter table public.comments enable row level security;
alter table public.activity_log enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.reports enable row level security;

-- profiles: self OR admin. Insert/delete is admin-only (service role) and
-- handled by the on_auth_user_created trigger / admin route handlers.
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- org_settings: everyone reads (terminology used app-wide), admin writes.
create policy org_settings_select on public.org_settings
  for select using (auth.uid() is not null);

create policy org_settings_update_admin on public.org_settings
  for update using (public.is_admin());

-- projects
create policy projects_select on public.projects
  for select using (public.is_admin() or public.is_project_member(id));

create policy projects_insert_admin on public.projects
  for insert with check (public.is_admin());

create policy projects_update_manager on public.projects
  for update using (public.is_admin() or public.is_project_manager(id));

create policy project_members_select on public.project_members
  for select using (public.is_admin() or public.is_project_member(project_id));

-- Administrators may add a user to a project; managers may add within their
-- own project (spec section 4).
create policy project_members_insert on public.project_members
  for insert with check (public.can('manager', project_id));

create policy project_members_update on public.project_members
  for update using (public.can('manager', project_id));

create policy project_members_delete on public.project_members
  for delete using (public.can('manager', project_id));
