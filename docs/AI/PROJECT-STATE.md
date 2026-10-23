# PROJECT-STATE — the truth about where the project is

Update this file after every notable change. No history here (see CHANGELOG.md).

| Field                | Value |
| -------------------- | ----- |
| Version              | 0.1.0 |
| DB schema version    | migration `20261019000010_profiles_team_read.sql` |
| Phase (spec §15)     | **2 — web core in progress.** Phases 0–1 complete. |
| Last delivered       | Phase 2 slice + E2E suite: Supabase auth (login/session/sign-out), role-aware dashboard, project page (snags/locations/team), snag detail with role-gated transitions, Docker image + compose wiring, and a **Playwright E2E suite (6 tests, real browser)** covering the auth golden path |
| AI-docs restructure  | DONE (self-contained indexes under docs/AI/, .ai/index.json, scripts/ai/) |

## Features complete

- Monorepo scaffold + CI + quality gate (Phase 0)
- Full DB schema, RLS on all tables, security helpers, guard triggers (Phase 1)
- Workflow RPCs `assign_snag` / `transition_snag` / `soft_delete_snag` w/ activity + notifications (Phase 1)
- Storage buckets + path-membership policies (Phase 1)
- Seed: 5 role users × 2 projects × 15 snags (Phase 1)
- Unit tests (shared: 26) + DB test suite (28, needs running stack) (Phase 1)
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
