# FEATURE-INDEX

Machine version: `.ai/index.json::features`. Statuses: **done** = delivered & tested; planned = spec §15, not started.

## DELIVERED

### FEAT-PERM-MATRIX (done)
Permission matrix + helpers. Impl: `packages/shared/src/permissions.ts::canAct,canEditSnagDetails,canWorkOnSnag,isReviewer`
DB mirror: `supabase/migrations/20261019000005_security.sql::public.can` — Tests: `packages/shared/tests/permissions.test.ts`
Business rules: `docs/AI/BUSINESS-RULES.md` (BR-AUTHZ-*). Dependencies: roles.ts.

### FEAT-SNAG-WORKFLOW (done)
Status state machine. Impl: `packages/shared/src/workflow.ts::SNAG_TRANSITIONS`
Server side: `supabase/migrations/20261019000007_workflow_rpc.sql::transition_snag` — Tests: `supabase/tests/workflow.test.ts`
Rules: BR-WORKFLOW-001/002 (reject & reopen comments required). Deps: permissions, guard trigger, activity, notifications.

### FEAT-SNAG-ASSIGN (done)
Assign member/manager to snag. Impl: `supabase/migrations/20261019000007_workflow_rpc.sql::assign_snag`
Tests: `supabase/tests/workflow.test.ts`. Feature uniqueness: `snags.client_id`.

### FEAT-SNAG-CRUD (done, DB level)
Create/read/update/soft-delete snags. Impl: `supabase/migrations/20261019000003_snags_tables.sql` + guard `20261019000005_security.sql::guard_snag_update` + `soft_delete_snag`
Tests: `supabase/tests/rls_write.test.ts`. UI built in Phase 2.

### FEAT-SNAG-NUMBERING (done)
Sequential per-project numbers, concurrency-safe. Impl: `20261019000003_snags_tables.sql::assign_snag_number`
Tests: `supabase/tests/integrity.test.ts`. Rule: BR-SNAG-001.

### FEAT-IDEMPOTENCY-OFFLINE (done, groundwork)
Unique `client_id` permits replayed offline writes. Impl: `20261019000003_snags_tables.sql`. Tests: `integrity.test.ts`. Groundwork for Phase 6.

### FEAT-PHOTO-CAP (done)
≤ 8 photos per snag. Impl: `20261019000003_snags_tables.sql::enforce_photo_limit`. Tests: `integrity.test.ts`. Rule: BR-SNAG-002.

### FEAT-RLS-AUTHZ (done)
RLS on every table. Impl: `20261019000005_security.sql` + `20261019000006_rls_policies.sql`
Tests: `supabase/tests/rls_isolation.test.ts`, `rls_write.test.ts`. Rule: BR-AUTHZ-001.

### FEAT-STORAGE (done)
Private buckets `snag-photos`, `report-thumbnails` + path-membership policies. Impl: `20261019000008_storage.sql`. Rule: BR-STORAGE-001.

### FEAT-NOTIFICATIONS-DB (done, DB layer)
Recipients notified on assign/transition. Impl: `20261019000007_workflow_rpc.sql::snag_notify,notify_managers` → `notifications` (`20261019000004_collab_tables.sql`). Tests: `workflow.test.ts`. UI surfacing: Phase 3.

### FEAT-ACTIVITY-LOG (done)
Append-only audit per snag. Impl: `20261019000007_workflow_rpc.sql::snag_activity` → `activity_log` (`20261019000004_collab_tables.sql`). Rule: BR-ACTIVITY-001.

### FEAT-ORG-SETTINGS (done, schema)
Org-wide naming/theme/report config. Impl: `20261019000002_core_tables.sql::org_settings` + UI mirror `packages/shared/src/terminology.ts`. Report generation itself: Phase 4.

### FEAT-UI-PRIMITIVES (done)
Button/Card/Dialog/Input/Select/Textarea/Tabs/Badge/Skeleton/Avatar/Separator/DropdownMenu:
`apps/web/src/components/ui/*`. Consumers: Phase 2 screens.

### FEAT-SEED (done)
Demo org, 5 users (one per role; admin: `admin@snagflow.test`), 2 projects, 15 snags: `supabase/seed.sql` (login password in README). IDs mirrored in `supabase/tests/helpers.ts::UIDS`.

### FEAT-WEB-AUTH (done, web)
Email + password sign-in, session refresh, sign-out. Impl: `apps/web/src/lib/supabase/server.ts`, `apps/web/src/lib/supabase/cookie-name.ts`, `apps/web/src/proxy.ts` (Next 16 "proxy" — the successor of the old middleware convention), `apps/web/src/app/login/*`
Server side: GoTrue through `@supabase/ssr`; the session lives in a cookie, RLS decides the data scope, no page renders without a session (the proxy redirects to `/login`).

### FEAT-WEB-DASH (done, web)
Role-aware dashboard: status counts, review queue (reviewers only), my snags, overdue, project progress.
Impl: `apps/web/src/components/dashboard-view.tsx`, `apps/web/src/app/(app)/dashboard/page.tsx`

### FEAT-WEB-PROJECT (partial, web)
Project page with Snags / Locations / Team tabs, exact project statistics and URL-backed filters/search. Impl: `apps/web/src/components/project-view.tsx`, `apps/web/src/app/(app)/projects/[projectId]/page.tsx`
Create/edit: `/projects/new` (admin), `/projects/[projectId]/edit` (project manager/admin).
Location/category management is delivered below. Activity/reports tabs remain later-phase work.

### FEAT-WEB-PROJECT-DETAILS (done, web)
Admin creates projects; project managers/admins edit name/code/description/client/address and require-fix-photo setting. Stable-UUID create retry, validation/duplicate errors retain draft, fresh active/access checks on save and layout/navigation refresh.
Impl: `apps/web/src/components/project-form.tsx`, `apps/web/src/components/project-form-page.tsx`, `apps/web/src/app/(app)/projects/actions.ts`; route files below `projects/new` and `projects/[projectId]/edit`.
Contracts: `packages/shared/src/schemas.ts::ProjectCreateSchema`, `permissions.ts::canAct`; existing project RLS in migration 5.
Tests: `e2e/tests/projects.spec.ts`, `supabase/tests/projects.test.ts`. Delivery: `docs/AI/PROJECT-DETAILS-2026-10-29.md`.

### FEAT-WEB-SNAG-UI (partial, web)
Snag detail: metadata, description, real signed issue/fix photos, comment thread, activity trail, manager assignment and role-gated status transitions.
Impl: `apps/web/src/components/snag-view.tsx`, `apps/web/src/components/snag-actions.tsx`, `apps/web/src/app/(app)/snags/[snagId]/*`
Create/edit: project-scoped full-page forms with shared validation, retry identity and Save & add another.
Photos: client JPEG resizing/thumbnails, private uploads, retry queue and authenticated metadata registration.
Impl: `apps/web/src/components/snag-form.tsx`, `snag-form-page.tsx`, `photo-picker.tsx`, `snag-photo-upload.tsx`, `snag-photos.tsx`; `apps/web/src/lib/photos.ts`; `apps/web/src/app/(app)/snags/actions.ts`, `photo-actions.ts`.
Tests: `e2e/tests/snags.spec.ts`, `packages/shared/tests/photos.test.ts`.
Remaining: photo markup.

### FEAT-WEB-LIFECYCLE (done, web)
Confirmed manager/admin project archive/restore and snag soft-delete. Archived projects leave active navigation/dashboard work but retain data and access through the dashboard archived list. Soft deletion retains history, removes list/count/detail visibility under RLS, and returns to the refreshed project. Ambiguous deletion recovery loads a fresh document to discard missed client invalidation.
Impl: `apps/web/src/app/(app)/lifecycle-actions.ts`, `apps/web/src/components/lifecycle-control.tsx`, `project-view.tsx`, `snag-view.tsx`, `dashboard-view.tsx`, `app-sidebar.tsx`.
Contracts: existing `permissions.ts::canAct`, project UPDATE RLS (migration 5), `soft_delete_snag` (hardened in migration 11). No new migration.
Tests: `supabase/tests/lifecycle.test.ts`, `e2e/tests/lifecycle.spec.ts`. Delivery: `docs/AI/ARCHIVE-DELETE-2026-10-30.md`.

### FEAT-WEB-SNAG-SEARCH (done, web)
Project status/priority/assignee/location/category/due/creator filters, combined title/description full-text and exact number search, stable sorting, 50-row server pages and exact project-wide counts under RLS.
Impl: `apps/web/src/lib/snag-filters.ts`, `apps/web/src/lib/project-snags.ts`, `apps/web/src/components/snag-filters.tsx`, `apps/web/src/components/project-view.tsx`.
DB: `supabase/migrations/20261029000012_snag_search.sql`; generated types: `packages/shared/src/db-types.ts`.
Tests: `e2e/tests/filters.spec.ts`. Delivery/limits: `docs/AI/SNAG-SEARCH-2026-10-29.md`.

### FEAT-DOCKER-LOCAL (done)
Container image for the web app (multi-stage, `output: 'standalone'`) plus compose wiring to the local Supabase stack.
Impl: `apps/web/Dockerfile`, `docker-compose.yml`, `.dockerignore`

### FEAT-WEB-TEAM-MGMT (done, web)
Manager/admin project team add-by-canonical-email, role editing, confirmed removal/self-role changes; member/viewer read-only roster.
Impl: `apps/web/src/components/team-view.tsx`, `team-manager.tsx`, `apps/web/src/app/(app)/projects/team-actions.ts`, `apps/web/src/lib/team-errors.ts`.
DB: migration `20261029000013_team_invitations.sql::add_project_member,set_project_member`. Shared: `ProjectMemberAddSchema`, `ProjectMemberChangeSchema`.
Tests: `supabase/tests/team.test.ts`, `packages/shared/tests/team.test.ts`, `e2e/tests/team.spec.ts`.

### FEAT-WEB-INVITES (done, web)
Active admins invite new accounts by email. Pending retry/cancel, recipient setup and atomic project acceptance, confirmed-email binding and consumed-link recovery. Managers may cancel their project invitations; org account creation remains admin-only.
Impl: `apps/web/src/app/api/invitations/route.ts`, `apps/web/src/lib/supabase/admin.ts`, `apps/web/src/app/invite/actions.ts`, `apps/web/src/app/invite/[token]/page.tsx`, `apps/web/src/components/invitation-form.tsx`.
DB: migration 13 invitation functions; shared `ProjectInviteSendSchema`, `ProjectInviteAcceptSchema`. Tests: team suites above.
Deployment/limits: `docs/AI/TEAM-INVITES-2026-10-30.md`.

### FEAT-WEB-METADATA (done, web)
Manager/admin project location create/rename/reparent/order and category create/rename; confirmed unused-record deletion. Read-only member/viewer lists, stable create retry, draft-preserving failures and refreshed selectors/navigation.
Impl: `apps/web/src/components/project-metadata.tsx`, `apps/web/src/app/(app)/projects/metadata-actions.ts`, `apps/web/src/lib/project-metadata.ts`; consumed by project view and snag form page.
DB: migration `20261030000014_project_metadata.sql` protects historical references, immutable identity/project and acyclic same-project hierarchy. Existing migration 11 manager/admin RLS is unchanged.
Tests: `supabase/tests/metadata.test.ts`, `e2e/tests/metadata.spec.ts`. Delivery: `docs/AI/PHASE2-COMPLETE-2026-10-30.md`.

### FEAT-WEB-COMMENTS (done, web)
Thread-local member/manager composer, shared validation, character count, focused feedback, draft retention and stable-UUID response-loss recovery. Project RLS remains authoritative; thread reads paginate beyond the backend cap and distinguish unavailable reads from empty threads.
Impl: `apps/web/src/components/comment-form.tsx`, `snag-view.tsx`, `apps/web/src/app/(app)/snags/[snagId]/actions.ts`, `apps/web/src/lib/data.ts`.
Tests: `e2e/tests/metadata.spec.ts`, `e2e/tests/fieldwork.spec.ts`. Cross-session collaboration uses explicit refresh; realtime remains Phase 3.

## PLANNED (spec §15 — do not build before prior phases)

- FEAT-WORKFLOW-UI / FEAT-REALTIME / FEAT-NOTIF-UI — Phase 3
- FEAT-MARKUP / FEAT-REPORTS — Phase 4
- FEAT-MOBILE — Phase 5 · FEAT-OFFLINE-SYNC — Phase 6 · FEAT-PWA/PUSH-FN/E2E — Phase 7
