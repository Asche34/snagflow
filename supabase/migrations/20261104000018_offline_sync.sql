-- Phase 6: transactionally replayable mobile mutations and authorized pull sync.
-- The receipt and field-clock tables are private implementation details. Only
-- SECURITY DEFINER entry points below may write them; clients cannot forge a
-- receipt, clock, actor, or workflow state.
create table public.offline_mutation_receipts (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  project_id uuid not null references public.projects(id) on delete cascade,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.offline_mutation_receipts enable row level security;
revoke all on public.offline_mutation_receipts from anon, authenticated;

create table public.snag_field_clocks (
  snag_id uuid primary key references public.snags(id) on delete cascade,
  fields jsonb not null default '{}'::jsonb
);
alter table public.snag_field_clocks enable row level security;
revoke all on public.snag_field_clocks from anon, authenticated;

-- Track every writer, including existing web/RLS writes, so a delayed offline
-- patch cannot replace a field changed after the version the user last saw.
create function public.track_snag_field_clocks() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  key text;
  changes jsonb := '{}'::jsonb;
begin
  foreach key in array array['title','description','priority','category_id','location_id','due_date','pin_x','pin_y'] loop
    if tg_op = 'INSERT' or (to_jsonb(new)->key) is distinct from (to_jsonb(old)->key) then
      changes := changes || jsonb_build_object(key, new.updated_at);
    end if;
  end loop;
  insert into public.snag_field_clocks(snag_id, fields) values(new.id, changes)
    on conflict(snag_id) do update set fields = public.snag_field_clocks.fields || excluded.fields;
  return new;
end;
$$;
revoke all on function public.track_snag_field_clocks() from public, anon, authenticated, service_role;
insert into public.snag_field_clocks(snag_id, fields)
select s.id, jsonb_build_object(
  'title',s.updated_at,'description',s.updated_at,'priority',s.updated_at,
  'category_id',s.updated_at,'location_id',s.updated_at,'due_date',s.updated_at,
  'pin_x',s.updated_at,'pin_y',s.updated_at
) from public.snags s;
create trigger snags_field_clocks after insert or update on public.snags
  for each row execute function public.track_snag_field_clocks();

create function public.apply_offline_mutation(
  p_id uuid,
  p_project_id uuid,
  p_snag_id uuid,
  p_kind text,
  p_payload jsonb,
  p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  request jsonb;
  receipt public.offline_mutation_receipts%rowtype;
  snag public.snags%rowtype;
  patched public.snags%rowtype;
  comment_row public.comments%rowtype;
  clocks jsonb;
  patch jsonb := '{}'::jsonb;
  skipped jsonb := '[]'::jsonb;
  key text;
  allowed text[];
  output jsonb;
begin
  if p_id is null or p_project_id is null or p_snag_id is null
    or p_kind is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'OFFLINE_PAYLOAD: invalid mutation identity or payload' using errcode = '22023';
  end if;
  -- Replay must never grant access that has since been revoked. A receipt is
  -- not an authorization token. Archived projects do not accept queued writes.
  if actor is null or not exists(select 1 from public.profiles where id = actor and is_active)
    or public.can('member', p_project_id) is not true
    or not exists(select 1 from public.projects where id = p_project_id and status = 'active') then
    raise exception 'OFFLINE_FORBIDDEN: account or active project access changed; draft retained' using errcode = '42501';
  end if;
  request := jsonb_build_object('project_id',p_project_id,'snag_id',p_snag_id,
    'kind',p_kind,'payload',p_payload,'expected_updated_at',p_expected_updated_at);
  -- Also serializes duplicate in-flight requests from reconnect/foreground.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into receipt from public.offline_mutation_receipts where id = p_id;
  if found then
    if receipt.user_id <> actor or receipt.request <> request then
      raise exception 'OFFLINE_IDENTITY: mutation identity already belongs to another intent' using errcode = '23505';
    end if;
    return receipt.result;
  end if;

  allowed := case p_kind
    when 'create' then array['title','description','priority','category_id','location_id','due_date','pin_x','pin_y','assignee_id']
    when 'edit' then array['title','description','priority','category_id','location_id','due_date','pin_x','pin_y']
    when 'comment' then array['body']
    when 'transition' then array['to_status','comment']
    when 'assign' then array['assignee_id']
    else null end;
  if allowed is null or exists(select 1 from jsonb_object_keys(p_payload) k where not (k = any(allowed))) then
    raise exception 'OFFLINE_PAYLOAD: unsupported mutation or protected fields' using errcode = '22023';
  end if;

  if p_kind = 'create' then
    -- The snag id is the stable client id, so local links/dependencies survive
    -- reconnect without an id remapping race. A separate operation id records
    -- the exact create receipt; details are never changed by a create replay.
    select * into snag from public.snags where id = p_snag_id or client_id = p_snag_id for update;
    if found then
      raise exception 'OFFLINE_IDENTITY: snag identity exists without this create receipt' using errcode = '23505';
    end if;
    if length(trim(coalesce(p_payload->>'title',''))) not between 1 and 200 then
      raise exception 'OFFLINE_PAYLOAD: enter a title of 1 to 200 characters' using errcode = '22023';
    end if;
    patched := jsonb_populate_record(null::public.snags, p_payload);
    if (patched.location_id is not null and not exists(select 1 from public.locations where id = patched.location_id and project_id = p_project_id))
      or (patched.category_id is not null and not exists(select 1 from public.categories where id = patched.category_id and project_id = p_project_id)) then
      raise exception 'OFFLINE_PAYLOAD: location or category no longer belongs to this project' using errcode = '23514';
    end if;
    insert into public.snags(id,client_id,project_id,number,title,description,priority,
      category_id,location_id,due_date,pin_x,pin_y,created_by)
    values(p_snag_id,p_snag_id,p_project_id,0,patched.title,patched.description,
      coalesce(patched.priority,'medium'),patched.category_id,patched.location_id,
      patched.due_date,patched.pin_x,patched.pin_y,actor) returning * into snag;
    if patched.assignee_id is not null then
      perform public.assign_snag(snag.id,patched.assignee_id);
    end if;
  else
    select * into snag from public.snags where id = p_snag_id and project_id = p_project_id and deleted_at is null for update;
    if not found then
      raise exception 'OFFLINE_UNAVAILABLE: snag was removed or is unavailable; draft retained' using errcode = 'P0001';
    end if;
    if p_kind in ('edit','transition','assign') and p_expected_updated_at is null then
      raise exception 'OFFLINE_CONFLICT: refresh the server version before retrying this intent' using errcode = 'P0001';
    end if;
    if p_kind in ('transition','assign') and snag.updated_at <> p_expected_updated_at then
      raise exception 'OFFLINE_CONFLICT: this snag changed; review current status and assignment before retrying' using errcode = 'P0001';
    end if;

    case p_kind
      when 'edit' then
        if (public.can('manager',p_project_id) or
          (public.project_role(p_project_id) = 'member' and snag.created_by = actor and snag.status <> 'closed')) is not true then
          raise exception 'OFFLINE_FORBIDDEN: detail-edit permission changed; draft retained' using errcode = '42501';
        end if;
        select fields into clocks from public.snag_field_clocks where snag_id = snag.id;
        for key in select jsonb_object_keys(p_payload) order by 1 loop
          if coalesce((clocks->>key)::timestamptz, snag.updated_at) > p_expected_updated_at then
            skipped := skipped || jsonb_build_array(key);
          else
            patch := patch || jsonb_build_object(key,p_payload->key);
          end if;
        end loop;
        patched := jsonb_populate_record(snag,patch);
        if length(trim(coalesce(patched.title,''))) not between 1 and 200 then
          raise exception 'OFFLINE_PAYLOAD: enter a title of 1 to 200 characters' using errcode = '22023';
        end if;
        if (patched.location_id is not null and not exists(select 1 from public.locations where id = patched.location_id and project_id = p_project_id))
          or (patched.category_id is not null and not exists(select 1 from public.categories where id = patched.category_id and project_id = p_project_id)) then
          raise exception 'OFFLINE_PAYLOAD: location or category no longer belongs to this project' using errcode = '23514';
        end if;
        if patch <> '{}'::jsonb then
          update public.snags set title=patched.title,description=patched.description,
            priority=patched.priority,category_id=patched.category_id,location_id=patched.location_id,
            due_date=patched.due_date,pin_x=patched.pin_x,pin_y=patched.pin_y where id=snag.id;
        end if;
      when 'comment' then
        if length(trim(coalesce(p_payload->>'body',''))) not between 1 and 5000 then
          raise exception 'OFFLINE_PAYLOAD: enter a comment of 1 to 5000 characters' using errcode = '22023';
        end if;
        insert into public.comments(id,snag_id,author_id,body)
          values(p_id,snag.id,actor,p_payload->>'body') returning * into comment_row;
      when 'assign' then
        if not (p_payload ? 'assignee_id') then
          raise exception 'OFFLINE_PAYLOAD: choose an assignee or explicitly unassign' using errcode = '22023';
        end if;
        perform public.assign_snag(snag.id,(p_payload->>'assignee_id')::uuid);
      when 'transition' then
        if coalesce(p_payload->>'to_status','') = '' then
          raise exception 'OFFLINE_PAYLOAD: choose a target status' using errcode = '22023';
        end if;
        perform public.transition_snag(snag.id,(p_payload->>'to_status')::public.snag_status,p_payload->>'comment');
    end case;
  end if;
  select * into snag from public.snags where id = p_snag_id;
  output := jsonb_build_object('snag',to_jsonb(snag),'skipped_fields',skipped);
  if p_kind = 'comment' then output := output || jsonb_build_object('comment',to_jsonb(comment_row)); end if;
  insert into public.offline_mutation_receipts(id,user_id,project_id,request,result)
    values(p_id,actor,p_project_id,request,output);
  return output;
end;
$$;
revoke all on function public.apply_offline_mutation(uuid,uuid,uuid,text,jsonb,timestamptz) from public,anon;
grant execute on function public.apply_offline_mutation(uuid,uuid,uuid,text,jsonb,timestamptz) to authenticated;

-- Bounded full reconciliation is deliberate: existing updated_at uses
-- transaction time, not commit time. A transaction begun before the prior pull
-- can commit after it with an older timestamp; a strict timestamp delta would
-- permanently miss it. Full authorized arrays + ids avoid that loss and also
-- reconcile hard deletions. p_since/synced_at retain the cursor API for a later
-- commit-aware change feed; clients must not assume the arrays are only deltas.
create function public.mobile_sync_snapshot(p_project_id uuid,p_since timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  boundary timestamptz := statement_timestamp();
  result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_active)
    or public.can('view',p_project_id) is not true then
    raise exception 'OFFLINE_FORBIDDEN: project access changed; cached project must be removed' using errcode='42501';
  end if;
  if not exists(select 1 from public.projects where id=p_project_id and status='active') then
    raise exception 'OFFLINE_UNAVAILABLE: project is archived or unavailable' using errcode='P0001';
  end if;
  if (select count(*) from public.snags where project_id=p_project_id) > 20000 then
    raise exception 'OFFLINE_TOO_LARGE: project exceeds the 20000-snag offline limit' using errcode='54000';
  end if;
  if (select count(*) from public.snag_photos p join public.snags s on s.id=p.snag_id where s.project_id=p_project_id and s.deleted_at is null) > 20000
    or (select count(*) from public.comments c join public.snags s on s.id=c.snag_id where s.project_id=p_project_id and s.deleted_at is null) > 20000
    or (select count(*) from public.activity_log where project_id=p_project_id) > 20000
    or (select count(*) from public.locations where project_id=p_project_id) > 20000
    or (select count(*) from public.categories where project_id=p_project_id) > 20000
    or (select count(*) from public.project_members where project_id=p_project_id) > 20000 then
    raise exception 'OFFLINE_TOO_LARGE: a project table exceeds the 20000-row offline limit' using errcode='54000';
  end if;
  select jsonb_build_object(
    'synced_at',boundary,
    'full',true,
    'project',(select to_jsonb(p) from public.projects p where p.id=p_project_id),
    'members',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('profiles',
      jsonb_build_object('id',p.id,'full_name',p.full_name,'email',p.email,'is_active',p.is_active)))
      from public.project_members m join public.profiles p on p.id=m.user_id where m.project_id=p_project_id),'[]'::jsonb),
    'locations',coalesce((select jsonb_agg(to_jsonb(l)) from public.locations l where l.project_id=p_project_id),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(to_jsonb(c)) from public.categories c where c.project_id=p_project_id),'[]'::jsonb),
    'snags',coalesce((select jsonb_agg(to_jsonb(s)) from public.snags s where s.project_id=p_project_id),'[]'::jsonb),
    'photos',coalesce((select jsonb_agg(to_jsonb(p)) from public.snag_photos p join public.snags s on s.id=p.snag_id
      where s.project_id=p_project_id and s.deleted_at is null),'[]'::jsonb),
    'comments',coalesce((select jsonb_agg(to_jsonb(c)) from public.comments c join public.snags s on s.id=c.snag_id
      where s.project_id=p_project_id and s.deleted_at is null),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(a)) from public.activity_log a where a.project_id=p_project_id),'[]'::jsonb),
    'snag_ids',coalesce((select jsonb_agg(id) from public.snags where project_id=p_project_id),'[]'::jsonb),
    'photo_ids',coalesce((select jsonb_agg(p.id) from public.snag_photos p join public.snags s on s.id=p.snag_id where s.project_id=p_project_id and s.deleted_at is null),'[]'::jsonb),
    'comment_ids',coalesce((select jsonb_agg(c.id) from public.comments c join public.snags s on s.id=c.snag_id where s.project_id=p_project_id and s.deleted_at is null),'[]'::jsonb),
    'activity_ids',coalesce((select jsonb_agg(id) from public.activity_log where project_id=p_project_id),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.mobile_sync_snapshot(uuid,timestamptz) from public,anon;
grant execute on function public.mobile_sync_snapshot(uuid,timestamptz) to authenticated;
