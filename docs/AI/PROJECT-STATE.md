# PROJECT-STATE — the truth about where the project is

Update this file after every notable change. No history here (see CHANGELOG.md).

| Field                | Value |
| -------------------- | ----- |
| Version              | 0.1.0 |
| DB schema version    | migration `20261019000010_profiles_team_read.sql` |
| Phase (spec §15)     | **2 — web core in progress.** Phases 0–1 complete. |
| Last delivered       | Phase 2 slice: Supabase auth (login/session/sign-out), role-aware dashboard, project page (snags/locations/team), snag detail with role-gated transitions, Docker image + compose wiring for the local stack |
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

## Features in progress

- Phase 2 remainder: snag create/edit forms, photo upload, list filters, assignment UI, project CRUD, team management, invite flow

## Features remaining (order per spec §15)

- Phase 2 remainder: snag CRUD + photos, comments UI polish, filters, team management (Next.js)
- Phase 3: workflow UI gating, review queue, reject/reopen UX, notifications bell, Realtime
- Phase 4: image markup (react-konva) + PDF/Excel reports (@react-pdf/renderer, exceljs) + revisions
- Phase 5: mobile app on hosted Supabase (auth, camera flow, review flow)
- Phase 6: offline sync (expo-sqlite mirror, outbox, photo queue), push notifications (Edge Function)
- Phase 7: PWA, dark mode, EAS profiles, E2E (Playwright)
- Edge function `push-send` (spec §12) — not yet created

## Tests current

- shared: 26 unit tests green (`pnpm --filter @snagflow/shared test`)
- DB: 28 tests **verified green locally** against the running stack; also green in CI
- gate: `pnpm turbo run build lint typecheck test` — 12/12 tasks green, 54 tests total
- note: DB suites share one database — `supabase.cmd db reset` before a full gate run locally
- web: typecheck + lint + `next build` green (Cache Components, Partial Prerender routes)

## Running locally (Windows + Docker Desktop WSL2)

1. `supabase.cmd start` then `supabase.cmd db reset` (API on 54321, Studio on 54323)
2. `docker compose up --build` (web app on 3000, talks to the stack via `host.docker.internal`)
3. Sign in with a seeded account (password `Password123!`) — the login page lists them

## Blockers

- none open.

## Next step recommended

Continue Phase 2: snag create/edit forms with photo upload, list filters, assignment UI and
project/team management. See FEATURE-INDEX.md "planned" section.
