-- Narrow team/invite operations; do not expose a cross-project profile directory.
create or replace function public.add_project_member(p_project_id uuid, p_email text, p_role public.project_role)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if not coalesce(public.can('manager', p_project_id),false) then raise exception 'TEAM_PERMISSION'; end if;
  select p.id into target_id from public.profiles p join auth.users u on u.id = p.id
    where lower(u.email) = lower(btrim(p_email)) and p.is_active and u.email_confirmed_at is not null;
  if target_id is null then raise exception 'TEAM_ACCOUNT'; end if;
  insert into public.project_members(project_id,user_id,role) values(p_project_id,target_id,p_role)
    on conflict (project_id,user_id) do nothing;
  if not found then raise exception 'MEMBER_EXISTS'; end if;
  return target_id;
end; $$;

create or replace function public.set_project_member(p_project_id uuid, p_user_id uuid, p_role public.project_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.can('manager', p_project_id),false) then raise exception 'TEAM_PERMISSION'; end if;
  if p_role is null then
    delete from public.project_members where project_id=p_project_id and user_id=p_user_id;
  else
    if not exists(select 1 from public.profiles where id=p_user_id and is_active) then raise exception 'TEAM_ACCOUNT'; end if;
    update public.project_members set role=p_role where project_id=p_project_id and user_id=p_user_id;
    if not found then raise exception 'TEAM_MISSING'; end if;
  end if;
end; $$;

create or replace function public.prepare_project_invite(p_id uuid, p_project_id uuid, p_email text, p_role public.project_role)
returns table(id uuid, token uuid) language plpgsql security definer set search_path = '' as $$
declare inv public.invites%rowtype; normalized text := lower(btrim(p_email));
begin
  if not public.is_admin() then raise exception 'INVITE_PERMISSION'; end if;
  if normalized is null or length(normalized)>254 or normalized !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVITE_EMAIL'; end if;
  if not exists(select 1 from public.projects where projects.id=p_project_id) then raise exception 'INVITE_PROJECT'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project_id::text || ':' || normalized,0));
  select * into inv from public.invites i where i.id=p_id for update;
  if found then
    if inv.project_id is distinct from p_project_id or inv.email<>normalized or inv.role is distinct from p_role
      or inv.invited_by<>auth.uid() then raise exception 'INVITE_DETAILS'; end if;
    if inv.accepted_at is not null or inv.expires_at<=now() then raise exception 'INVITE_INVALID'; end if;
    return query select inv.id,inv.token; return;
  end if;
  if exists(select 1 from auth.users u where lower(u.email)=normalized and u.email_confirmed_at is not null) then raise exception 'INVITE_EXISTING'; end if;
  if exists(select 1 from public.invites i where i.project_id=p_project_id and lower(i.email)=normalized and i.accepted_at is null) then raise exception 'INVITE_PENDING'; end if;
  insert into public.invites(id,project_id,email,role,invited_by) values(p_id,p_project_id,normalized,p_role,auth.uid()) returning * into inv;
  return query select inv.id,inv.token;
end; $$;

create or replace function public.cancel_project_invite(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare inv public.invites%rowtype;
begin
  select * into inv from public.invites where id=p_id for update;
  if not found then return; end if;
  if not coalesce(public.can('manager',inv.project_id),false) then raise exception 'INVITE_PERMISSION'; end if;
  if inv.accepted_at is not null then raise exception 'INVITE_USED'; end if;
  delete from public.invites where id=p_id;
end; $$;

create or replace function public.get_my_project_invite(p_token uuid)
returns table(project_id uuid,project_name text,email text,role public.project_role,accepted boolean)
language sql stable security definer set search_path = '' as $$
  select i.project_id,p.name,i.email,i.role,i.accepted_at is not null
  from public.invites i join public.projects p on p.id=i.project_id
  join auth.users recipient on recipient.id=auth.uid() and recipient.email_confirmed_at is not null
    and lower(recipient.email)=lower(i.email)
  join public.profiles active on active.id=recipient.id and active.is_active
  join public.profiles inviter on inviter.id=i.invited_by and inviter.is_active and inviter.is_admin
  where i.token=p_token and i.expires_at>now()
    and (i.accepted_at is null or exists(select 1 from public.project_members m where m.project_id=i.project_id and m.user_id=auth.uid()));
$$;

create or replace function public.accept_project_invite(p_token uuid,p_full_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare inv public.invites%rowtype;
begin
  select * into inv from public.invites where token=p_token for update;
  if not found or not exists(select 1 from public.get_my_project_invite(p_token)) then raise exception 'INVITE_INVALID'; end if;
  -- Idempotent only while access remains. Never restore removed access or overwrite a changed role.
  if inv.accepted_at is not null then return inv.project_id; end if;
  if p_full_name is null or length(btrim(p_full_name)) not between 1 and 120 then raise exception 'INVITE_NAME'; end if;
  insert into public.project_members(project_id,user_id,role) values(inv.project_id,auth.uid(),inv.role)
    on conflict (project_id,user_id) do nothing;
  update public.profiles set full_name=btrim(p_full_name) where profiles.id=auth.uid();
  update public.invites set accepted_at=now() where id=inv.id;
  return inv.project_id;
end; $$;

revoke all on function public.add_project_member(uuid,text,public.project_role),
  public.set_project_member(uuid,uuid,public.project_role),
  public.prepare_project_invite(uuid,uuid,text,public.project_role),public.cancel_project_invite(uuid),
  public.get_my_project_invite(uuid),public.accept_project_invite(uuid,text) from public,anon;
grant execute on function public.add_project_member(uuid,text,public.project_role),
  public.set_project_member(uuid,uuid,public.project_role),
  public.prepare_project_invite(uuid,uuid,text,public.project_role),public.cancel_project_invite(uuid),
  public.get_my_project_invite(uuid),public.accept_project_invite(uuid,text) to authenticated;
notify pgrst,'reload schema';
