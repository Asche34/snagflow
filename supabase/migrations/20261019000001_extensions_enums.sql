-- SnagFlow migration 0001: extensions and enums
-- Tables that depend on generated UUIDs use gen_random_uuid() (built into PG13+).
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm"; -- full-text-ish search for the snag list

create type public.project_role as enum ('manager', 'member', 'viewer');
create type public.snag_status as enum ('open', 'in_progress', 'ready_for_review', 'closed');
create type public.snag_priority as enum ('low', 'medium', 'high', 'critical');
create type public.photo_kind as enum ('issue', 'fix');
create type public.project_state as enum ('active', 'archived');
create type public.report_format as enum ('pdf', 'xlsx');
