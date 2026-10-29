# PROJECT-STATE — the truth about where the project is

Update this file after every notable change. No history here (see CHANGELOG.md).

| Field                | Value |
| -------------------- | ----- |
| Version              | 0.1.0 |
| DB schema version    | migration `20261029000011_authorization_hardening.sql` (applied and verified locally; hosted application pending) |
| Phase (spec §15)     | **2 — web core in progress.** Phases 0–1 complete. |
| Last delivered       | Phase 2 slice + E2E suite: Supabase auth (login/session/sign-out), role-aware dashboard, project page (snags/locations/team), snag detail with role-gated transitions, Docker image + compose wiring, and a **Playwright E2E suite (6 tests, real browser)** covering the auth golden path |
| AI-docs restructure  | DONE (self-contained indexes under docs/AI/, .ai/index.json, scripts/ai/) |

## Features complete

- Monorepo scaffold + CI + quality gate (Phase 0)
- Full DB schema, RLS on all tables, security helpers, guard triggers (Phase 1)
- Workflow RPCs `assign_snag` / `transition_snag` / `soft_delete_snag` w/ activity + notifications (Phase 1)
- Storage buckets + path-membership policies (Phase 1)
- Seed: 5 role users × 2 projects × 15 snags (Phase 1)
- Unit tests (shared: 28) + DB test suite (29, verified against local Supabase) (Phase 1)
- Web auth: sign-in, session refresh (Next 16 proxy), sign-out, protected routes (Phase 2)
- Web dashboard: role-aware stats, review queue, my snags, overdue, project progress (Phase 2)
- Web project page: snags (status filter), locations tree, team roster (Phase 2)
- Web snag detail: meta, description, comments, activity trail, role-gated status transitions (Phase 2)
- Docker: `apps/web/Dockerfile` (standalone bundle) + `docker-compose.yml` against the local Supabase stack (Phase 2)
- DB: colleagues' profiles are readable inside shared projects (migration 10) — needed for names in every list
- **E2E: `e2e/` workspace package** — Playwright driven against a **real Chrome**, 6 tests: anonymous redirect, manager sign-in, session cookie, wrong password, sign-out, viewer RLS scoping (Phase 2)

## Features in progress

- Phase 2 remainder: snag create/edit forms, photo upload, list filters, assignment UI, project CRUD, team management, invite flow

## Features remaining (order per spec §15)

- Phase 2 remainder: snag CRUD + photos, comments UI polish, filters, team management (Next.js)
- Phase 3: workflow UI gating, review queue, reject/reopen UX, notifications bell, Realtime
- Phase 4: image markup (react-konva) + PDF/Excel reports (@react-pdf/renderer, exceljs) + revisions
- Phase 5: mobile app on hosted Supabase (auth, camera flow, review flow)
- Phase 6: offline sync (expo-sqlite mirror, outbox, photo queue), push notifications (Edge Function)
- Phase 7: PWA, dark mode, EAS profiles, E2E (Playwright) — **the E2E suite now exists; expand it to the full §14 golden path**
- Edge function `push-send` (spec §12) — not yet created

## Tests current

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

Continue Phase 2: snag create/edit forms with photo upload, list filters, assignment UI and
project/team management. See FEATURE-INDEX.md "planned" section.
