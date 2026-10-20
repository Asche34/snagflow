-- ============================================================================
-- Profiles: allow project colleagues to read each other.
--
-- Phase 1 shipped `profiles_select` as "own profile or admin", which is too
-- narrow for Phase 2: the snag list, dashboard and team tab all need the
-- names of the people who share a project with the signed-in user (assignee,
-- creator, team roster). Without this a member sees raw UUIDs.
--
-- The rule stays project-scoped: a user may read the profile of anyone who is
-- a member of a project they are also a member of. Nothing is exposed to
-- non-members, and writes are unchanged (guard_profile_update + RLS).
-- ============================================================================

create or replace function public.shares_project_with_me(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target
  );
$$;

revoke all on function public.shares_project_with_me(uuid) from public;
grant execute on function public.shares_project_with_me(uuid) to authenticated;

drop policy profiles_select on public.profiles;

create policy profiles_select on public.profiles
for select using (
  id = auth.uid()
  or public.is_admin()
  or public.shares_project_with_me(id)
);
