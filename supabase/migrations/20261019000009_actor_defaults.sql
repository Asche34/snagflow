-- Migration 0009: stamp the caller's identity on client-created rows.
--
-- Root cause found by the first local DB test run: `created_by` / `author_id`
-- are declared in migration 0003 without defaults, while the insert policies
-- (migration 0006) require `created_by = auth.uid()` / `author_id = auth.uid()`.
-- A legitimate member insert that does not send the column therefore failed
-- WITH CHECK with "new row violates row-level security policy".
-- Resolution: BEFORE INSERT triggers default the missing identity to the
-- caller's JWT (`auth.uid()`). Clients may still send it explicitly, but a
-- forged `created_by` remains rejected by the policy itself.

create or replace function public.snag_stamp_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger snag_stamp_actor
  before insert on public.snags
  for each row execute function public.snag_stamp_actor();

create or replace function public.comment_stamp_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.author_id is null then
    new.author_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger comment_stamp_author
  before insert on public.comments
  for each row execute function public.comment_stamp_author();

create or replace function public.snag_photo_stamp_uploader()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.uploaded_by is null then
    new.uploaded_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger snag_photo_stamp_uploader
  before insert on public.snag_photos
  for each row execute function public.snag_photo_stamp_uploader();

-- ============================================================================
-- assign_snag_number must always see the project row. It previously ran as
-- INVOKER: `SELECT ... FOR UPDATE` is gated by the UPDATE policy on projects
-- (manager-only), so a member insert found no row and produced NULL number
-- (masked until migration 0009, whose created_by stamp let inserts reach the
-- constraint check). Numbering is server-owned — make the trigger SECURITY
-- DEFINER so it bypasses RLS and keeps its row lock.
create or replace function public.assign_snag_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number integer;
begin
  select snag_counter + 1
  into next_number
  from public.projects
  where id = new.project_id
  for update;

  new.number := next_number;

  update public.projects
    set snag_counter = next_number
  where id = new.project_id;

  return new;
end;
$$;
