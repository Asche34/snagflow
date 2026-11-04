-- Phase 6 push: disabled until an operator explicitly authorizes deployment delivery.
create table public.push_delivery_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into public.push_delivery_config(singleton) values (true);
alter table public.push_delivery_config enable row level security;
create policy push_delivery_config_read on public.push_delivery_config for select to authenticated using (true);

alter table public.push_tokens add column deployment_key text;
alter table public.push_tokens add column installation_id uuid;
alter table public.push_tokens add column expires_at timestamptz not null default now();
create unique index push_tokens_installation_idx on public.push_tokens(installation_id) where installation_id is not null;
drop policy push_tokens_all_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens for select to authenticated using (user_id = auth.uid());
create policy push_tokens_delete_own on public.push_tokens for delete to authenticated using (user_id = auth.uid());
-- Client inserts cannot create push events or rewrite a persisted notification's recipient/content.
drop policy notifications_insert on public.notifications;
revoke insert, update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;

create or replace function public.register_push_token(p_token text, p_platform text, p_deployment_key text, p_installation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id = auth.uid() and is_active) then
    raise exception 'PUSH_ACCOUNT_UNAVAILABLE' using errcode = '42501';
  end if;
  if not p_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{1,200}\]$'
     or p_platform not in ('android','ios') or p_deployment_key is null or length(p_deployment_key) not between 16 and 160 or p_installation_id is null then
    raise exception 'PUSH_INVALID_REGISTRATION' using errcode = '22023';
  end if;
  -- Token possession and this installation's random device secret transfer ownership on account switch.
  perform pg_advisory_xact_lock(hashtextextended(p_token, 0));
  delete from public.push_tokens where token = p_token or installation_id = p_installation_id;
  insert into public.push_tokens(user_id, token, platform, last_seen_at, deployment_key, installation_id, expires_at)
    values(auth.uid(), p_token, p_platform, now(), p_deployment_key, p_installation_id, now() + interval '24 hours');
end $$;
revoke all on function public.register_push_token(text,text,text,uuid) from public, anon;
grant execute on function public.register_push_token(text,text,text,uuid) to authenticated;

create or replace function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

create table public.push_deliveries (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  token text not null,
  status text not null check(status in ('sending','sent','delivered','failed','uncertain','retry')),
  ticket text,
  attempts integer not null default 1,
  next_attempt_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(notification_id, token)
);
alter table public.push_deliveries enable row level security;
-- No client policies; service-role worker only. This table never appears in the mobile mirror.

create or replace function public.push_authorized_notification(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', n.id, 'userId', n.user_id, 'projectId', n.project_id, 'snagId', n.snag_id)
  from public.notifications n
  join public.profiles u on u.id = n.user_id and u.is_active
  join public.projects p on p.id = n.project_id and p.status = 'active'
  join public.snags s on s.id = n.snag_id and s.project_id = n.project_id and s.deleted_at is null
  where n.id = p_id and n.type in ('assigned','review_requested','approved','rejected','comment','reopened')
    and (u.is_admin or exists(select 1 from public.project_members m where m.project_id = n.project_id and m.user_id = n.user_id));
$$;
revoke all on function public.push_authorized_notification(uuid) from public, anon, authenticated;
grant execute on function public.push_authorized_notification(uuid) to service_role;

create or replace function public.claim_push_delivery(p_notification_id uuid, p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed boolean;
begin
  if not exists(select 1 from public.push_delivery_config where enabled)
    or public.push_authorized_notification(p_notification_id) is null
    or not exists(select 1 from public.push_tokens t join public.notifications n on n.id = p_notification_id and n.user_id = t.user_id where t.token = p_token and t.expires_at > now() and t.deployment_key is not null) then return false; end if;
  insert into public.push_deliveries(notification_id, token, status) values(p_notification_id, p_token, 'sending')
    on conflict(notification_id, token) do update set status = 'sending', attempts = public.push_deliveries.attempts + 1, updated_at = now()
      where public.push_deliveries.status = 'retry' and public.push_deliveries.next_attempt_at <= now() and public.push_deliveries.attempts < 6
    returning true into claimed;
  return coalesce(claimed, false);
end $$;
revoke all on function public.claim_push_delivery(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_push_delivery(uuid,text) to service_role;

create or replace function public.finish_push_delivery(p_notification_id uuid,p_token text,p_status text,p_ticket text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('sent','delivered','failed','uncertain','retry') then raise exception 'PUSH_INVALID_STATUS'; end if;
  update public.push_deliveries set status = p_status, ticket = coalesce(p_ticket,ticket), updated_at = now(),
    next_attempt_at = now() + make_interval(secs => least(3600, (30 * power(2, attempts))::integer))
    where notification_id = p_notification_id and token = p_token;
end $$;
revoke all on function public.finish_push_delivery(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.finish_push_delivery(uuid,text,text,text) to service_role;

-- A delayed receipt must not revoke a token that has since been renewed or transferred.
create or replace function public.remove_push_delivery_token(p_notification_id uuid,p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_tokens t using public.push_deliveries d, public.notifications n
  where d.notification_id = p_notification_id and d.token = p_token and n.id = d.notification_id
    and t.token = p_token and t.user_id = n.user_id and t.last_seen_at <= d.updated_at;
$$;
revoke all on function public.remove_push_delivery_token(uuid,text) from public, anon, authenticated;
grant execute on function public.remove_push_delivery_token(uuid,text) to service_role;
