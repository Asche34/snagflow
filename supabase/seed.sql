-- SnagFlow demo seed. Run via `supabase db reset` (applies migrations + seed).
-- Local/demo credentials ONLY — change everything in a real deployment.
--
--   admin@snagflow.test    Password123!   (admin)
--   manager@snagflow.test  Password123!   (manager)
--   member1@snagflow.test  Password123!   (member)
--   member2@snagflow.test  Password123!   (member)
--   viewer@snagflow.test   Password123!   (viewer)

begin;

-- ============================================================================
-- Auth users (local stack: seeded directly; production uses invite flow)
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, invited_at, confirmation_token, recovery_token,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, email_change, email_change_token_new, confirmation_sent_at
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'admin@snagflow.test', crypt('Password123!'::text, 'bf'::text),
   now(), now(), '', '', now(),
   jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
   jsonb_build_object('full_name', 'Ada Admin'), now(), now(), '', '', now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'manager@snagflow.test', crypt('Password123!'::text, 'bf'::text),
   now(), now(), '', '', now(),
   jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
   jsonb_build_object('full_name', 'Morgan Manager'), now(), now(), '', '', now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'member1@snagflow.test', crypt('Password123!'::text, 'bf'::text),
   now(), now(), '', '', now(),
   jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
   jsonb_build_object('full_name', 'Milo Member'), now(), now(), '', '', now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444',
   'authenticated', 'authenticated', 'member2@snagflow.test', crypt('Password123!'::text, 'bf'::text),
   now(), now(), '', '', now(),
   jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
   jsonb_build_object('full_name', 'Nina Member'), now(), now(), '', '', now()),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555',
   'authenticated', 'authenticated', 'viewer@snagflow.test', crypt('Password123!'::text, 'bf'::text),
   now(), now(), '', '', now(),
   jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
   jsonb_build_object('full_name', 'Vic Viewer'), now(), now(), '', '', now())
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, last_sign_in_at, created_at, updated_at, provider)
values
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'email',
   jsonb_build_object('sub', '11111111-1111-4111-8111-111111111111', 'email', 'admin@snagflow.test', 'email_verified', true),
   now(), now(), now(), 'email'),
  (gen_random_uuid(), '22222222-2222-4222-8222-222222222222', 'email',
   jsonb_build_object('sub', '22222222-2222-4222-8222-222222222222', 'email', 'manager@snagflow.test', 'email_verified', true),
   now(), now(), now(), 'email'),
  (gen_random_uuid(), '33333333-3333-4333-8333-333333333333', 'email',
   jsonb_build_object('sub', '33333333-3333-4333-8333-333333333333', 'email', 'member1@snagflow.test', 'email_verified', true),
   now(), now(), now(), 'email'),
  (gen_random_uuid(), '44444444-4444-4444-8444-444444444444', 'email',
   jsonb_build_object('sub', '44444444-4444-4444-8444-444444444444', 'email', 'member2@snagflow.test', 'email_verified', true),
   now(), now(), now(), 'email'),
  (gen_random_uuid(), '55555555-5555-4555-8555-555555555555', 'email',
   jsonb_build_object('sub', '55555555-5555-4555-8555-555555555555', 'email', 'viewer@snagflow.test', 'email_verified', true),
   now(), now(), now(), 'email')
on conflict (id) do nothing;

-- Profiles already exist because the on_auth_user_created trigger fired above;
-- touch  them to make sure admins have the flag.
update public.profiles set is_admin = true where id = '11111111-1111-4111-8111-111111111111';

-- ============================================================================
-- Org settings (single row)
-- ============================================================================
insert into public.org_settings (id, company_name, terminology)
values (1, 'Northfield Engineering', 'snag')
on conflict (id) do nothing;

-- ============================================================================
-- Demo project
-- ============================================================================
insert into public.projects (id, name, code, description, client_name, address, created_by)
values (
  '10101010-1010-4101-8101-101010101010',
  'Riverside Health Hub — Stage 2',
  'RHH-S2',
  'Two-level hospital extension: 4 theatres, recovery ward, CSSD.',
  'Riverside Hospital Trust',
  '14 Barkers Rd, Kew VIC 3101',
  '11111111-1111-4111-8111-111111111111'
)
on conflict (id) do nothing;

insert into public.project_members (project_id, user_id, role) values
  ('10101010-1010-4101-8101-101010101010', '11111111-1111-4111-8111-111111111111', 'manager'),  -- admin also acts as manager here
  ('10101010-1010-4101-8101-101010101010', '22222222-2222-4222-8222-222222222222', 'manager'),
  ('10101010-1010-4101-8101-101010101010', '33333333-3333-4333-8333-333333333333', 'member'),
  ('10101010-1010-4101-8101-101010101010', '44444444-4444-4444-8444-444444444444', 'member'),
  ('10101010-1010-4101-8101-101010101010', '55555555-5555-4555-8555-555555555555', 'viewer')
on conflict do nothing;

-- Second project for the manager/member1 pair (multi-project memberships).
insert into public.projects (id, name, code, created_by)
values ('20202020-2020-4202-8202-202020202020', 'Westgate Plant Room', 'WPR', '11111111-1111-4111-8111-111111111111')
on conflict (id) do nothing;

insert into public.project_members (project_id, user_id, role) values
  ('20202020-2020-4202-8202-202020202020', '22222222-2222-4222-8222-222222222222', 'manager'),
  ('20202020-2020-4202-8202-202020202020', '33333333-3333-4333-8333-333333333333', 'member')
on conflict do nothing;

-- Locations: building -> level -> room
insert into public.locations (id, project_id, parent_id, name, sort_order) values
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a01', '10101010-1010-4101-8101-101010101010', null, 'Main Building', 0),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a02', '10101010-1010-4101-8101-101010101010', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a01', 'Level 1', 0),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a03', '10101010-1010-4101-8101-101010101010', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a01', 'Level 2', 1),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a04', '10101010-1010-4101-8101-101010101010', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a02', 'Theatre 1', 0),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a05', '10101010-1010-4101-8101-101010101010', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a02', 'Recovery Ward', 1),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a06', '10101010-1010-4101-8101-101010101010', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a03', 'CSSD', 0),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a07', '10101010-1010-4101-8101-101010101010', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a03', 'Plant Room', 1)
on conflict do nothing;

insert into public.categories (id, project_id, name) values
  ('0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c01', '10101010-1010-4101-8101-101010101010', 'Electrical'),
  ('0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c02', '10101010-1010-4101-8101-101010101010', 'Plumbing'),
  ('0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c03', '10101010-1010-4101-8101-101010101010', 'Finishes'),
  ('0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c04', '10101010-1010-4101-8101-101010101010', 'Structural'),
  ('0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c05', '10101010-1010-4101-8101-101010101010', 'Safety'),
  ('0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c06', '20202020-2020-4202-8202-202020202020', 'Electrical')
on conflict do nothing;

-- ============================================================================
-- 15 snags in varied states
-- numbers are assigned server-side by the trigger; keep client_id null-safe so
-- the counter logic runs for each row.
-- ============================================================================
insert into public.snags (
  id, client_id, project_id, number, title, description, status, priority,
  category_id, location_id, assignee_id, due_date, rejection_count,
  closed_at, closed_by, created_by, created_at
) values
  -- open, unassigned, overdue, critical
  ('12010101-0101-4101-8101-000000000001', '12010101-0101-4101-8101-000000000001',
   '10101010-1010-4101-8101-101010101010', 1, 'Exposed wiring above Theatre 1 ceiling',
   'Live conduit unclipped near access hatch; cable ties missing.', 'open', 'critical',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c01', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a04',
   null, current_date - 4, 0, null, null, '33333333-3333-4333-8333-333333333333', now() - interval '6 days'),

  -- open, assigned to member1, high
  ('12010101-0101-4101-8101-000000000002', '12010101-0101-4101-8101-000000000002',
   '10101010-1010-4101-8101-101010101010', 2, 'Leaking valve under Recovery Ward sink',
   'Slow drip; substrate staying damp.', 'open', 'high',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c02', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a05',
   '33333333-3333-4333-8333-333333333333', current_date + 2, 0, null, null, '22222222-2222-4222-8222-222222222222', now() - interval '5 days'),

  -- open, assigned to member2, medium
  ('12010101-0101-4101-8101-000000000003', '12010101-0101-4101-8101-000000000003',
   '10101010-1010-4101-8101-101010101010', 3, 'Skirting gap, Level 2 corridor east',
   '120 mm gap where frame meets plaster; needs scribing.', 'open', 'medium',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c03', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a03',
   '44444444-4444-4444-8444-444444444444', current_date + 7, 0, null, null, '33333333-3333-4333-8333-333333333333', now() - interval '5 days'),

  -- open, unassigned, low (cosmetic)
  ('12010101-0101-4101-8101-000000000004', '12010101-0101-4101-8101-000000000004',
   '10101010-1010-4101-8101-101010101010', 4, 'Paint scuff on CSSD entry door',
   'Pallet transfer scuff, 40 cm wide.', 'open', 'low',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c03', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a06',
   null, current_date + 10, 0, null, null, '22222222-2222-4222-8222-222222222222', now() - interval '4 days'),

  -- open, assigned, flagged with overdue date
  ('12010101-0101-4101-8101-000000000005', '12010101-0101-4101-8101-000000000005',
   '10101010-1010-4101-8101-101010101010', 5, 'Missing exit signage above Plant Room door',
   'No AC/DC sign installed; required for egress compliance.', 'open', 'high',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c05', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a07',
   '44444444-4444-4444-8444-444444444444', current_date - 1, 0, null, null, '33333333-3333-4333-8333-333333333333', now() - interval '4 days'),

  -- in_progress, member1 working, critical
  ('12010101-0101-4101-8101-000000000006', '12010101-0101-4101-8101-000000000006',
   '10101010-1010-4101-8101-101010101010', 6, 'Cracked roof sheet above Theatre 1',
   'Sheet lifted, day-gap visible; water entry risk during rain.', 'in_progress', 'critical',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c04', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a04',
   '33333333-3333-4333-8333-333333333333', current_date, 0, null, null, '22222222-2222-4222-8222-222222222222', now() - interval '3 days'),

  -- in_progress, member2, medium
  ('12010101-0101-4101-8101-000000000007', '12010101-0101-4101-8101-000000000007',
   '10101010-1010-4101-8101-101010101010', 7, 'Door closer, Recovery Ward Bay 4',
   'Closes too fast; ADA check needed.', 'in_progress', 'medium',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c03', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a05',
   '44444444-4444-4444-8444-444444444444', current_date + 3, 0, null, null, '33333333-3333-4333-8333-333333333333', now() - interval '3 days'),

  -- ready_for_review, submitted by member1
  ('12010101-0101-4101-8101-000000000008', '12010101-0101-4101-8101-000000000008',
   '10101010-1010-4101-8101-101010101010', 8, 'Corridor signage level 1 lighting',
   'Installed dual-face exit sign; awaiting manager verification.', 'ready_for_review', 'high',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c01', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a02',
   '33333333-3333-4333-8333-333333333333', current_date + 1, 0, null, null, '33333333-3333-4333-8333-333333333333', now() - interval '2 days'),

  -- ready_for_review, resubmitted after rejection
  ('12010101-0101-4101-8101-000000000009', '12010101-0101-4101-8101-000000000009',
   '10101010-1010-4101-8101-101010101010', 9, 'Plant Room cooling fan bearing',
   'Bearing replaced with correct twin-row type.', 'ready_for_review', 'high',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c02', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a07',
   '44444444-4444-4444-8444-444444444444', current_date, 1, null, null, '44444444-4444-4444-8444-444444444444', now() - interval '8 days'),

  -- closed
  ('12010101-0101-4101-8101-00000000000a', '12010101-0101-4101-8101-00000000000a',
   '10101010-1010-4101-8101-101010101010', 10, 'Level 1 fire extinguisher bracket loose',
   'Bracket anchored into slab; signed off.', 'closed', 'medium',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c05', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a02',
   '33333333-3333-4333-8333-333333333333', current_date - 7, 0,
   now() - interval '3 days', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', now() - interval '10 days'),
  ('12010101-0101-4101-8101-00000000000b', '12010101-0101-4101-8101-00000000000b',
   '10101010-1010-4101-8101-101010101010', 11, 'Theatre 1 door seal gaps',
   'New EPDM seal installed.', 'closed', 'high',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c04', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a04',
   '44444444-4444-4444-8444-444444444444', current_date - 5, 0,
   now() - interval '2 days', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', now() - interval '9 days'),
  ('12010101-0101-4101-8101-00000000000c', '12010101-0101-4101-8101-00000000000c',
   '10101010-1010-4101-8101-101010101010', 12, 'Recovery Ward floor tile chips',
   'Seven tiles replaced; grout cured.', 'closed', 'low',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c03', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a05',
   '33333333-3333-4333-8333-333333333333', current_date - 3, 0,
   now() - interval '1 day', '22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', now() - interval '7 days'),

  -- reopened (closed -> open after quality check concern)
  ('12010101-0101-4101-8101-00000000000d', '12010101-0101-4101-8101-00000000000d',
   '10101010-1010-4101-8101-101010101010', 13, 'CSSD pass-through hatch alignment',
   'Hatch still binds 3 mm at left rail even after adjustment.', 'open', 'high',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c04', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a06',
   '33333333-3333-4333-8333-333333333333', current_date + 5, 1, null, null, '33333333-3333-4333-8333-333333333333', now() - interval '12 days'),

  -- Level-2 pair
  ('12010101-0101-4101-8101-00000000000e', '12010101-0101-4101-8101-00000000000e',
   '10101010-1010-4101-8101-101010101010', 14, 'Level 2 corridor light dimmer miswire',
   'Dimmer wired across both phases; flicker on dim.', 'open', 'medium',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c01', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a03',
   null, current_date + 6, 0, null, null, '22222222-2222-4222-8222-222222222222', now() - interval '2 days'),
  ('12010101-0101-4101-8101-00000000000f', '12010101-0101-4101-8101-00000000000f',
   '10101010-1010-4101-8101-101010101010', 15, 'Westgate-affected panel recall (level 2)',
   'Cross-project recall: keep an eye on TPS 201 panel batch.', 'open', 'low',
   '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c01', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a03',
   null, null, 0, null, null, '22222222-2222-4222-8222-222222222222', now() - interval '1 day')
on conflict do nothing;

-- Sample comments (a few interchanges)
insert into public.comments (snag_id, author_id, body, created_at) values
  ('12010101-0101-4101-8101-000000000002', '22222222-2222-4222-8222-222222222222', 'Meet the plumber at 2pm; valve under the sink may only need re-crimping.', now() - interval '4 days'),
  ('12010101-0101-4101-8101-000000000006', '33333333-3333-4333-8333-333333333333', 'Roofing contractor confirmed for Thursday morning.', now() - interval '2 days'),
  ('12010101-0101-4101-8101-000000000009', '22222222-2222-4222-8222-222222222222', 'Bearing spec looks wrong, resubmit with manufacturer sheet.', now() - interval '7 days'),
  ('12010101-0101-4101-8101-000000000009', '44444444-4444-4444-8444-444444444444', 'Resubmitted with 6205-2RS datasheet attached to fix photos.', now() - interval '1 day'),
  ('12010101-0101-4101-8101-00000000000d', '22222222-2222-4222-8222-222222222222', 'Reopened: hatch binds after auto-close cycle; please re-shim rails.', now() - interval '2 days')
on conflict do nothing;

-- Activity trail for a couple of snags so the timeline is not empty on first run
insert into public.activity_log (project_id, snag_id, actor_id, action, from_value, to_value, meta, created_at) values
  ('10101010-1010-4101-8101-101010101010', '12010101-0101-4101-8101-000000000002', '22222222-2222-4222-8222-222222222222', 'assigned', null, '33333333-3333-4333-8333-333333333333', jsonb_build_object('snag_number', 2), now() - interval '4 days'),
  ('10101010-1010-4101-8101-101010101010', '12010101-0101-4101-8101-000000000006', '33333333-3333-4333-8333-333333333333', 'status_changed', 'open', 'in_progress', jsonb_build_object('snag_number', 6), now() - interval '2 days'),
  ('10101010-1010-4101-8101-101010101010', '12010101-0101-4101-8101-000000000009', '22222222-2222-4222-8222-222222222222', 'rejected', 'ready_for_review', 'in_progress', jsonb_build_object('snag_number', 9), now() - interval '7 days'),
  ('10101010-1010-4101-8101-101010101010', '12010101-0101-4101-8101-000000000009', '44444444-4444-4444-8444-444444444444', 'status_changed', 'in_progress', 'ready_for_review', jsonb_build_object('snag_number', 9), now() - interval '1 day'),
  ('10101010-1010-4101-8101-101010101010', '12010101-0101-4101-8101-00000000000d', '22222222-2222-4222-8222-222222222222', 'status_changed', 'closed', 'open', jsonb_build_object('snag_number', 13), now() - interval '2 days')
on conflict do nothing;

commit;
