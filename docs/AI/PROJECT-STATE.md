# PROJECT-STATE — the truth about where the project is

Update this file after every notable change. No history here (see CHANGELOG.md).

| Field                | Value |
| -------------------- | ----- |
| Version              | 0.1.0 |
| DB schema version    | migration `20261029000013_team_invitations.sql` (applied and verified locally; hosted application pending) |
| Phase (spec §15)     | **2 — web core in progress.** Phases 0–1 complete. |
| Last delivered | Confirmed project archive/restore and snag soft-delete controls; active navigation/dashboard refresh and lost-response recovery |
| AI-docs restructure  | DONE (self-contained indexes under docs/AI/, .ai/index.json, scripts/ai/) |

## Features complete

- Monorepo scaffold + CI + quality gate (Phase 0)
- Full DB schema, RLS on all tables, security helpers, guard triggers (Phase 1)
- Workflow RPCs `assign_snag` / `transition_snag` / `soft_delete_snag` w/ activity + notifications (Phase 1)
- Storage buckets + path-membership policies (Phase 1)
- Seed: 5 role users × 2 projects × 15 snags (Phase 1)
- Unit tests (shared: 37) + DB test suite (29, verified against local Supabase) (Phase 1)
- Web auth: sign-in, session refresh (Next 16 proxy), sign-out, protected routes (Phase 2)
- Web dashboard: role-aware stats, review queue, my snags, overdue, project progress (Phase 2)
- Web project page: snags (status filter), locations tree, team roster (Phase 2)
- Web project search: status/priority/assignee/location/category/due/creator filters, English full-text across title/description, exact #number search, sorting and 50-row pages; URLs survive sections, refresh and browser history (Phase 2)
- Web project management: admin New project, manager/admin Edit project, shared-schema validated details and fix-photo setting, stable-create retry, live access checks and layout/navigation refresh (Phase 2)
- Web lifecycle: manager/admin project archive/restore, archived-project discovery, active dashboard/navigation refresh, confirmed audited snag soft-delete and fresh-document recovery after an ambiguous response (Phase 2)
- Web team: manager/admin exact-email existing-account add, role editing, confirmed removal/self-role changes, read-only member/viewer roster; project-scoped authenticated RPCs (Phase 2)
- Invitations: active-admin email delivery, pending retry/cancel, public email/session-bound name/password acceptance, expired/canceled/used-token protection and consumed-link/session-loss recovery (Phase 2)
- Web snag detail: metadata, comments, workflow activity, role-gated status transitions, manager assignment and real private issue/fix photos (Phase 2)
- Web capture: project-scoped create/edit forms, Save & add another, stable retry identity, validated active access and 1,000-row-independent edit lookup (Phase 2)
- Photo capture: eight-photo picker, 1600px JPEG/400px thumbnails, per-photo stages, interrupted-upload/committed-response retry and short-lived signed gallery (Phase 2)
- Docker: `apps/web/Dockerfile` (standalone bundle) + `docker-compose.yml` against the local Supabase stack (Phase 2)
- DB: colleagues' profiles are readable inside shared projects (migration 10) — needed for names in every list
- **E2E: `e2e/` workspace package** — Playwright driven against a **real Chrome**, 6 tests: anonymous redirect, manager sign-in, session cookie, wrong password, sign-out, viewer RLS scoping (Phase 2)

## Features in progress

- Phase 2 remainder: location/category editing and comment polish

## Features remaining (order per spec §15)

- Phase 2 remainder: location/category editing and comments UI polish (Next.js)
- Phase 3: workflow UI gating, review queue, reject/reopen UX, notifications bell, Realtime
- Phase 4: image markup (react-konva) + PDF/Excel reports (@react-pdf/renderer, exceljs) + revisions
- Phase 5: mobile app on hosted Supabase (auth, camera flow, review flow)
- Phase 6: offline sync (expo-sqlite mirror, outbox, photo queue), push notifications (Edge Function)
- Phase 7: PWA, dark mode, EAS profiles, E2E (Playwright) — **the E2E suite now exists; expand it to the full §14 golden path**
- Edge function `push-send` (spec §12) — not yet created

## Tests current

### Project archive and snag soft-delete — 2026-10-30

- Reuses existing project UPDATE RLS and migration 11's fail-closed `soft_delete_snag`; no migration, permission or dependency change. Archive preserves records and access, removes work from active dashboard/navigation, and is reversible through Archived projects.
- Six real-browser cases cover confirmation/cancel, restore, role gating, live role revocation, refreshed project lists/queues, unavailable deleted routes, phone/enlarged text, pre-commit network failure and post-commit response-loss recovery. Four additional real DB cases cover archive/restore/isolation, revoked authority and retained deletion history with a single audit event.
- Final targeted verification: 166 checks passed (52 real-browser, eight fixture UI, 42 real DB, 39 shared and 25 transactional SQL); production build, web/shared/DB-test/E2E lint/typecheck, shared declarations and AI docs/index checks passed. Full mobile/monorepo gate was not run.
- One independent review identified the need to discard client route caches after an ambiguous delete response. Recovery uses fresh document navigation; the regression verifies a new document, refreshed list, browser Back and one deletion audit. Dedicated inactive-actor archive/delete coverage is a deferred review minor; existing SQL checks and backend active-profile helpers were inspected.
- Detailed verification and deployment limits: `docs/AI/ARCHIVE-DELETE-2026-10-30.md`. Migration 13 and invitation runtime/SMTP/redirect configuration remain pending on hosted Supabase.

### Team and invitations — 2026-10-30

- Migration 13 adds narrowly scoped team/invite RPCs. Actor checks fail closed for nullable `can()` results; invite acceptance binds the confirmed canonical Auth email, app token, expiry and active inviter authority. Used tokens never restore removed access or overwrite a changed role.
- Nine real-browser cases cover membership controls/role gates/revocation, local captured email, password setup, viewer access, cancellation, recovery after consuming a link and losing session, self-role confirmation, public-signup denial and responsive layout.
- Shared contracts add two unit cases; DB lifecycle adds six cases. Delivery/deployment evidence: `docs/AI/TEAM-INVITES-2026-10-30.md`.
- Local email/password login remains enabled while public registration is disabled. New runtime settings: server-only service key and canonical APP_URL; hosted redirects/SMTP and migration 13 must be configured before deployment. No hosted backend or real external recipient was changed/contacted.

### Project creation/editing — 2026-10-29

- Added `/projects/new` for active admins and `/projects/[projectId]/edit` for active admins/project managers, using existing shared schemas/permissions and user-session database RLS. No migration, dependency or permission change.
- Seven real browser cases cover admin create/navigation refresh, manager edit, role-denied routes, invalid/duplicate-code draft retention, revoked access, lost committed create response with revised details, and phone/enlarged-text layout.
- Three additional real DB checks verify project create/edit/isolation authority. Full evidence and independent review: `docs/AI/PROJECT-DETAILS-2026-10-29.md`.
- Archive/team/invitations remain separate work. Additional inactive/admin-revoked, changed-code retry, delayed-hydration and capped-lookup assertions are deferred review test-coverage minors; these code paths were inspected.

### Project filters/search — 2026-10-29

- Migration 12 adds a generated combined English search vector and GIN index. DB types regenerated; existing authorization functions are unchanged. Applied to local Supabase only.
- Eight real browser cases exercise combined filters, title/description stemming, number lookup, due boundaries, URL/history/section restoration, malformed options, RLS, responsive controls and lookup beyond 1,000 rows with exact independent statistics.
- Full final verification and independent review: `docs/AI/SNAG-SEARCH-2026-10-29.md`.
- Next.js retains prior pages hidden: the capture regression now locates visible controls rather than matching hidden filter labels. Capture behavior is unchanged.
- Limits: search is English full-text rather than substring matching; location matching is exact; due presets use the server calendar. Rare midnight count/fetch boundary drift and additional repeated-UUID/backend-failure UI assertions are deferred review minors.

README refreshed on 2026-10-29 with the construction defect-tracking purpose,
implemented versus planned capabilities, verified stack, working local web/DB
configuration, demo roles, and separate test-suite requirements. Removed missing
environment-template references and misleading mobile/deployment completion claims.

### Web capture verification — 2026-10-29

- Production build passed against real local Supabase. All 22 real browser checks passed (six auth and 16 capture/workflow cases), including creator editing, manager assignment, issue/fix uploads, image dimensions, partial failure, lost committed responses, revoked access and direct edit beyond the 1,000-row workspace cap.
- The production input-hydration race was reproduced with delayed JavaScript, then fixed and verified. Typed details survive validation/network errors; error focus and route-specific form labels are covered.
- Shared: 37 tests passed; real database API suite: 29 passed; transactional SQL authorization suite: 25 passed. No new migration or dependency was required.
- Independent review identified lost-response edit loss and capped edit lookup. Both were reproduced with failing real-browser tests and fixed; manager retry also reconciles revised assignment through the existing RPC.
- Existing Fieldwork fixture browser suite: all eight passed. Detailed capture report: `docs/AI/SNAG-CAPTURE-2026-10-29.md`.
- Capture forms were checked at 375px and enlarged text. Upload progress describes stages rather than byte percentages. Photo timestamps use file modification time; this is not EXIF timestamp extraction.
- Limits: abandoned private upload cleanup remains future work; a thumbnail transport failure after successful signing currently relies on browser refresh. Non-workflow create/edit/photo audit events still need implementation. Mobile/offline, markup, rich filters and project/team management remain separate work.

### Real backend verification — 2026-10-29

- Fresh local Supabase stack started with CLI 2.122.0 and PostgreSQL 17; all 11 migrations and demo seed applied successfully. No hosted database was changed.
- All 29 API/RLS/workflow/integrity tests and all 25 transactional SQL authorization checks passed against the real stack. Shared unit tests: 28 passed.
- Eight additional real Storage API smoke checks passed: member upload, viewer byte-for-byte download, viewer/outsider/anonymous restrictions, removed-uploader replacement rejection, and manager deletion. Disposable fixtures were cleaned up; these checks are an ad hoc verification, not a committed test suite.
- Web production build passed with the real local backend configuration; all six real-browser authentication/project-isolation tests passed against that build on `http://127.0.0.1:3003`.
- Earlier Docker/download blockers are resolved. The local stack omits Studio, image transformations, Edge runtime, analytics and pooler; those services and the remaining product flows have not been verified here. Native browser zoom remains unverified.

RTK 1.1.0 is installed locally for compact command output. Use `scripts/rtk.ps1`
through PowerShell as documented in AGENTS.md; history/recovery files stay in
ignored `.superpowers/rtk/`. A project-local Codex Bash hook is registered;
PowerShell output compression uses the explicit wrapper.

### Fieldwork UI — 2026-10-29

- Approved Fieldwork visual system implemented across the existing web login, dashboard, project and snag screens. Mobile project navigation, active states, skip link, readable statuses/forms and long-title wrapping are delivered.
- Review queue now respects the current user's role per project. Request-time Supabase initialization fixes the reproduced Next.js prerender clock error.
- UI-only browser suite and local fixture transport added, separate from real Supabase auth/security tests. Covers 375/768/1024/1440px layouts, keyboard focus, reduced motion and enlarged text/fixed-nav clearance.
- Web dependency installation works. Production build, real Supabase API/Storage checks and real-auth browser verification are available; see the newer verification record above.
- Detailed implementation and verification record: `docs/AI/FIELDWORK-UI-2026-10-29.md`.

### Review verification — 2026-10-29

- Authorization hardening: 25 SQL checks passed on an isolated PostgreSQL 16 instance with minimal Supabase auth/storage schema shims. The original implementation failed 20 of these checks.
- Shared: 28 tests passed; shared, DB-test, and E2E packages passed lint and typecheck.
- Concurrent photo cap reproduced at 9 with invoker locking, then held at 8 with the corrected definer locking. Durable API regression added to `supabase/tests/integrity.test.ts`.
- The isolated review initially could not run full Supabase checks. That blocker is resolved by the real-backend verification above; the full monorepo/mobile gate has not been rerun.
- Review details: `docs/AI/REVIEW-2026-10-29.md`. CI now supplies DB credentials, refuses missing-env security-test skips, separates unit tests from E2E, selects bundled Chromium, and preserves web build configuration through Turbo.

### Prior agent's verification (historical; not rerun in full during this review)

- shared: 26 unit tests green (`pnpm --filter @snagflow/shared test`)
- DB: 28 tests **verified green locally** against the running stack; also green in CI
- E2E: 6 tests **verified green in a real browser** (`pnpm --filter @snagflow/e2e test`)
- gate: `pnpm turbo run build lint typecheck test` — 15/15 tasks green, 26 shared + 28 DB + 6 E2E = 60 tests
- note: DB suites share one database — `supabase.cmd db reset` before a full gate run locally
- note: **E2E must be told where the app is.** `E2E_BASE_URL` defaults to `http://localhost:3000`,
  which on this machine serves a *different* project; the local compose app is on **3003**.
  Turbo runs tasks in strict env mode, so `E2E_BASE_URL` is declared in `turbo.json` under
  `@snagflow/e2e#test` — without that declaration it is silently dropped and the suite tests
  the wrong app.
- web: typecheck + lint + `next build` green (Cache Components, Partial Prerender routes)

## Running locally (Windows + Docker Desktop WSL2)

1. `supabase.cmd start` then `supabase.cmd db reset` (API on 54321, Studio on 54323)
2. `docker compose up --build` (web app on **3003** — `WEB_PORT` in `.env` — via `host.docker.internal`)
3. Sign in with a seeded account (password `Password123!`) — the login page lists them
4. Browser tests: `E2E_BASE_URL=http://localhost:3003 pnpm --filter @snagflow/e2e test`

## Blockers

- none open.

## Next step recommended

Continue Phase 2: location/category editing, then remaining comment polish. Latest handoff: `ARCHIVE-DELETE-2026-10-30.md`; invitation deployment requirements remain in `TEAM-INVITES-2026-10-30.md`.
