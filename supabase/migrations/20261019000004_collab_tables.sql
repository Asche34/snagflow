-- Migration 0004: collaboration tables (activity, notifications, push, reports)

-- Activity log: append-only. Clients get SELECT only (members); inserts happen
-- exclusively in triggers/RPCs (no INSERT policy for clients in migration 0005).
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  snag_id uuid references public.snags (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  action text not null, -- created | edited | assigned | status_changed | rejected | commented | photo_added | member_added | ...
  from_value text,
  to_value text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_snag_idx on public.activity_log (snag_id, created_at);
create index activity_log_project_idx on public.activity_log (project_id, created_at desc);

-- Notifications ----------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null, -- assigned | review_requested | approved | rejected | comment | mentioned
  project_id uuid references public.projects (id) on delete cascade,
  snag_id uuid references public.snags (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb, -- e.g. {"snippet": "...", "actor": "Jane"}
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, read_at, created_at desc);

-- Push tokens --------------------------------------------------------------------
create table public.push_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- Reports ----------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  revision integer not null,
  format public.report_format not null,
  theme text not null default 'classic'
    check (theme in ('classic', 'compact', 'photo_first')),
  filters jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  storage_path text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (project_id, revision)
);

create index reports_project_idx on public.reports (project_id, revision desc);
