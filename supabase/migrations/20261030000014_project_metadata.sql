-- Preserve snag history (including soft-deleted rows) and location branches.
-- NO ACTION checks at statement end still permit whole-project cascade cleanup.
alter table public.snags drop constraint snags_location_id_fkey;
alter table public.snags add constraint snags_location_id_fkey
  foreign key (location_id) references public.locations(id) on delete no action;
alter table public.snags drop constraint snags_category_id_fkey;
alter table public.snags add constraint snags_category_id_fkey
  foreign key (category_id) references public.categories(id) on delete no action;
alter table public.locations drop constraint locations_parent_id_fkey;
alter table public.locations add constraint locations_parent_id_fkey
  foreign key (parent_id) references public.locations(id) on delete no action;

create function public.guard_project_metadata() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  invalid_parent boolean;
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.project_id <> old.project_id) then
    raise exception 'METADATA_IDENTITY: identity and project cannot change' using errcode = '23514';
  end if;
  if length(trim(new.name)) < 1 or length(new.name) > (case when tg_table_name = 'locations' then 120 else 60 end) then
    raise exception 'METADATA_NAME: enter a name within the allowed length' using errcode = '23514';
  end if;
  if tg_table_name = 'locations' then
    if new.sort_order < 0 then
      raise exception 'METADATA_ORDER: order must be nonnegative' using errcode = '23514';
    end if;
    -- Serialize hierarchy writes per project; subsequent queries take a fresh
    -- READ COMMITTED snapshot after the lock, including concurrent parent moves.
    perform 1 from public.projects where id = new.project_id for update;
    if new.parent_id is not null then
      if not exists (select 1 from public.locations where id = new.parent_id and project_id = new.project_id) then
        raise exception 'METADATA_PARENT: parent must belong to this project' using errcode = '23514';
      end if;
      with recursive ancestors as (
        select id, parent_id from public.locations where id = new.parent_id
        union
        select l.id, l.parent_id from public.locations l join ancestors a on l.id = a.parent_id
      ) select exists(select 1 from ancestors where id = new.id) into invalid_parent;
      if invalid_parent then
        raise exception 'METADATA_CYCLE: a location cannot be its own ancestor' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_project_metadata() from public, anon, authenticated;
create trigger locations_integrity before insert or update on public.locations
  for each row execute function public.guard_project_metadata();
create trigger categories_integrity before insert or update on public.categories
  for each row execute function public.guard_project_metadata();
