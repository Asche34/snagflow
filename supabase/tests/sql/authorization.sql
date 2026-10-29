-- Run against a migrated local Supabase DB as postgres. Fixtures roll back.
-- psql -X -v ON_ERROR_STOP=1 "$DB_URL" -f supabase/tests/sql/authorization.sql
begin;
create temporary table review_results (name text, passed boolean);
grant all on review_results to authenticated, anon;

create function pg_temp.check_result(label text, passed boolean) returns void
language sql as $$ insert into review_results values (label, coalesce(passed, false)); $$;

create function pg_temp.expect_denied(label text, command text, error_pattern text default null)
returns void language plpgsql as $$
declare denied boolean := false;
begin
  begin
    execute command;
  exception when others then
    denied := error_pattern is null or sqlerrm like '%' || error_pattern || '%';
  end;
  perform pg_temp.check_result(label, denied);
end;
$$;

-- Stable test-only ids, independent of the application seed.
insert into auth.users (id, email) values
 ('90000000-0000-4000-8000-000000000001', 'review-admin@snagflow.test'),
 ('90000000-0000-4000-8000-000000000002', 'review-manager@snagflow.test'),
 ('90000000-0000-4000-8000-000000000003', 'review-member@snagflow.test'),
 ('90000000-0000-4000-8000-000000000004', 'review-outsider@snagflow.test'),
 ('90000000-0000-4000-8000-000000000005', 'review-viewer@snagflow.test');
update public.profiles set is_admin = true where email = 'review-admin@snagflow.test';
insert into public.projects (id, name, code, created_by, require_fix_photo) values
 ('91000000-0000-4000-8000-000000000001', 'Review project', 'AUTH-REVIEW', '90000000-0000-4000-8000-000000000001', false);
insert into public.project_members (project_id, user_id, role) values
 ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'manager'),
 ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000003', 'member'),
 ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000005', 'viewer');
insert into public.snags (id, project_id, title, created_by, assignee_id) values
 ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'Review snag', '90000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000003');
insert into public.locations (id, project_id, name) values
 ('93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'Original location');
insert into public.categories (id, project_id, name) values
 ('94000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'Original category');

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000004';
select pg_temp.check_result('outsider cannot read project', not exists (select 1 from public.projects where code = 'AUTH-REVIEW'));
select pg_temp.expect_denied('outsider cannot assign', $$select public.assign_snag('92000000-0000-4000-8000-000000000001', null)$$, 'SNAG_ASSIGN_FORBIDDEN');
select pg_temp.expect_denied('outsider cannot start work', $$select public.transition_snag('92000000-0000-4000-8000-000000000001', 'in_progress')$$, 'SNAG_TRANSITION_FORBIDDEN');
select pg_temp.expect_denied('outsider cannot delete', $$select public.soft_delete_snag('92000000-0000-4000-8000-000000000001')$$, 'SNAG_DELETE_FORBIDDEN');
-- Failed authorization must have no side effects, even when the RPC returns data.
reset role;
set local app.snag_rpc = '1';
update public.snags set status = 'ready_for_review', deleted_at = null, assignee_id = '90000000-0000-4000-8000-000000000003' where id = '92000000-0000-4000-8000-000000000001';
set local app.snag_rpc = '';
set local role authenticated;
select pg_temp.expect_denied('outsider cannot approve', $$select public.transition_snag('92000000-0000-4000-8000-000000000001', 'closed')$$, 'SNAG_TRANSITION_FORBIDDEN');

set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000005';
select pg_temp.expect_denied('viewer cannot forge audit', $$select public.snag_activity('91000000-0000-4000-8000-000000000001', null, '90000000-0000-4000-8000-000000000001', 'forged', null, null)$$, 'permission denied');
select pg_temp.expect_denied('viewer cannot forge notifications', $$select public.snag_notify('90000000-0000-4000-8000-000000000001', 'forged', null, null, '{}')$$, 'permission denied');
select pg_temp.expect_denied('viewer cannot notify managers', $$select public.notify_managers('91000000-0000-4000-8000-000000000001', 'forged', null, '{}')$$, 'permission denied');

set local role anon;
set local request.jwt.claim.sub = '';
select pg_temp.expect_denied('anonymous cannot forge audit', $$select public.snag_activity('91000000-0000-4000-8000-000000000001', null, '90000000-0000-4000-8000-000000000001', 'forged', null, null)$$, 'permission denied');
select pg_temp.expect_denied('anonymous cannot invoke workflow', $$select public.assign_snag('92000000-0000-4000-8000-000000000001', null)$$, 'permission denied');

reset role;
set local app.snag_rpc = '1';
update public.snags set status = 'open', closed_at = null, closed_by = null where id = '92000000-0000-4000-8000-000000000001';
set local app.snag_rpc = '';
set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000003';
select pg_temp.expect_denied('member cannot insert closed snag', $$insert into public.snags (project_id, title, status, closed_at) values ('91000000-0000-4000-8000-000000000001', 'Forged close', 'closed', now())$$);
select pg_temp.expect_denied('member cannot assign at creation', $$insert into public.snags (project_id, title, assignee_id) values ('91000000-0000-4000-8000-000000000001', 'Forged assignment', '90000000-0000-4000-8000-000000000005')$$);
select pg_temp.expect_denied('member cannot insert rejection metadata', $$insert into public.snags (project_id, title, rejection_count) values ('91000000-0000-4000-8000-000000000001', 'Forged rejections', 5)$$);
insert into public.snags (project_id, title) values ('91000000-0000-4000-8000-000000000001', 'Legitimate member create');
select pg_temp.check_result('member can create normally', exists (select 1 from public.snags where title = 'Legitimate member create' and status = 'open' and assignee_id is null));
update public.snags set title = 'Unauthorized edit' where id = '92000000-0000-4000-8000-000000000001';
select pg_temp.check_result('assignee cannot edit another creator details', exists (select 1 from public.snags where id = '92000000-0000-4000-8000-000000000001' and title = 'Review snag'));
update public.snags set title = 'Creator edit' where title = 'Legitimate member create';
select pg_temp.check_result('creator can edit own details', exists (select 1 from public.snags where title = 'Creator edit'));
select pg_temp.expect_denied('member cannot create locations', $$insert into public.locations (project_id, name) values ('91000000-0000-4000-8000-000000000001', 'Unauthorized location')$$);
select pg_temp.expect_denied('member cannot create categories', $$insert into public.categories (project_id, name) values ('91000000-0000-4000-8000-000000000001', 'Unauthorized category')$$);
update public.locations set name = 'Unauthorized rename' where id = '93000000-0000-4000-8000-000000000001';
update public.categories set name = 'Unauthorized rename' where id = '94000000-0000-4000-8000-000000000001';
select pg_temp.check_result('member cannot rename locations', exists (select 1 from public.locations where name = 'Original location'));
select pg_temp.check_result('member cannot rename categories', exists (select 1 from public.categories where name = 'Original category'));

-- Positive controls: RPCs still work and can call their now-private helpers.
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000002';
select public.assign_snag('92000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000003');
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000003';
select public.transition_snag('92000000-0000-4000-8000-000000000001', 'in_progress');
select public.transition_snag('92000000-0000-4000-8000-000000000001', 'ready_for_review');
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000002';
select public.transition_snag('92000000-0000-4000-8000-000000000001', 'closed');
select pg_temp.check_result('manager can approve', exists (select 1 from public.snags where id = '92000000-0000-4000-8000-000000000001' and closed_by = auth.uid()));
select pg_temp.check_result('RPC writes audit', exists (select 1 from public.activity_log where snag_id = '92000000-0000-4000-8000-000000000001' and action = 'assigned'));

reset role;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';
update public.profiles set is_active = false where id = '90000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000002';
select pg_temp.check_result('inactive manager cannot read project', not exists (select 1 from public.projects where code = 'AUTH-REVIEW'));
select pg_temp.check_result('inactive manager cannot read colleagues', not exists (select 1 from public.profiles where id = '90000000-0000-4000-8000-000000000003'));
select pg_temp.expect_denied('inactive manager cannot assign', $$select public.assign_snag('92000000-0000-4000-8000-000000000001', null)$$, 'SNAG_ASSIGN_FORBIDDEN');

reset role;
table review_results;
do $$
begin
  if exists (select 1 from review_results where not passed) then
    raise exception 'Authorization regression failures: %', (select string_agg(name, ', ') from review_results where not passed);
  end if;
end;
$$;
rollback;
