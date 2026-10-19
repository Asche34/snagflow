-- Migration 0003: snags, photos, comments (the issue domain)

create table public.snags (
  id uuid primary key default gen_random_uuid(),
  -- Idempotency key for offline creates: mobile outbox replays reuse client_id;
  -- the server-side uniqueness makes replays return the original row.
  client_id uuid not null unique default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Per-project sequential number, assigned server-side in assign_snag_number().
  number integer not null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 5000),
  status public.snag_status not null default 'open',
  priority public.snag_priority not null default 'medium',
  category_id uuid references public.categories (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  -- Optional pin on the location plan image, normalized 0..1
  pin_x numeric(10, 6) check (pin_x between 0 and 1),
  pin_y numeric(10, 6) check (pin_y between 0 and 1),
  rejection_count integer not null default 0,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  created_by uuid references public.profiles (id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number),
  -- A snag cannot be closed without closed_at; update paths keep these in sync.
  check (status <> 'closed' or closed_at is not null)
);

create trigger snags_updated_at
  before update on public.snags
  for each row execute function public.set_updated_at();

-- Per-project sequential numbers: lock the project row, take counter+1.
create or replace function public.assign_snag_number()
returns trigger
language plpgsql
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

create trigger snags_assign_number
  before insert on public.snags
  for each row execute function public.assign_snag_number();

-- Photos ----------------------------------------------------------------------
create table public.snag_photos (
  id uuid primary key default gen_random_uuid(),
  snag_id uuid not null references public.snags (id) on delete cascade,
  kind public.photo_kind not null default 'issue',
  storage_path text not null, -- original
  annotated_path text, -- flattened annotated JPEG (markup)
  annotation_json jsonb, -- vector markup so annotations can be re-edited
  thumb_path text,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  taken_at timestamptz not null default now(),
  uploaded_by uuid not null references public.profiles (id),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index snag_photos_snag_idx on public.snag_photos (snag_id, sort_order);
create index snag_photos_storage_path_idx on public.snag_photos (storage_path);

create trigger snag_photos_updated_at
  before update on public.snag_photos
  for each row execute function public.set_updated_at();

-- Max 8 photos per snag (spec section 5). Serialized by row-locking the snag so
-- concurrent inserts from two browsers cannot race past the cap.
create or replace function public.enforce_photo_limit()
returns trigger
language plpgsql
as $$
declare
  photo_count integer;
begin
  -- Lock the snag row so concurrent photo inserts serialize.
  perform 1 from public.snags where id = new.snag_id for update;

  select count(*) into photo_count
  from public.snag_photos
  where snag_id = new.snag_id;

  if photo_count >= 8 then
    raise exception 'SNAG_PHOTO_LIMIT_REACHED: a snag can have at most 8 photos'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger snag_photos_limit
  before insert on public.snag_photos
  for each row execute function public.enforce_photo_limit();

-- Comments --------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  snag_id uuid not null references public.snags (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index comments_snag_idx on public.comments (snag_id, created_at);
