-- Migration 0002: core tables (org, projects, members, invites, locations, categories)
-- All timestamps are timestamptz. created_at default now(); mutable tables get
-- updated_at via the set_updated_at trigger (applied in each migration).

-- Updated-at maintenance -----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Profiles -------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  avatar_url text,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Org settings (single row; seeded) -------------------------------------------
create table public.org_settings (
  id integer primary key default 1 check (id = 1), -- singleton
  company_name text not null default 'SnagFlow',
  logo_path text,
  terminology text not null default 'snag'
    check (terminology in ('snag', 'punch', 'defect', 'issue')),
  date_format text not null default 'yyyy-MM-dd',
  default_report_theme text not null default 'classic'
    check (default_report_theme in ('classic', 'compact', 'photo_first')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger org_settings_updated_at
  before update on public.org_settings
  for each row execute function public.set_updated_at();

-- Projects --------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  description text,
  client_name text,
  address text,
  cover_image_path text,
  status public.project_state not null default 'active',
  require_fix_photo boolean not null default true,
  snag_counter integer not null default 0, -- Oracle-style counter; bumped under FOR UPDATE row lock
  created_by uuid references public.profiles (id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Project members -------------------------------------------------------------
-- PK (project_id, user_id): a user holds exactly one role per project, but can
-- be manager on one project and member on another.
create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_role not null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_idx on public.project_members (user_id);

-- Invites (admin/manager generated via server route handler) -------------------
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  project_id uuid references public.projects (id) on delete cascade,
  role public.project_role not null default 'member',
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index invites_pending_email_project_uniq
  on public.invites (coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(email))
  where accepted_at is null;

-- Locations (building -> floor -> room tree) -----------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  parent_id uuid references public.locations (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  plan_path text, -- optional drawing image
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_project_idx on public.locations (project_id, parent_id, sort_order);

create trigger locations_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- Categories (per project; seeded with defaults in seed.sql) ---------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);
