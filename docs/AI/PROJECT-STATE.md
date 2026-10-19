# PROJECT-STATE — the truth about where the project is

Update this file after every notable change. No history here (see CHANGELOG.md).

| Field                | Value |
| -------------------- | ----- |
| Version              | 0.1.0 |
| DB schema version    | migration `20261019000009_actor_defaults.sql` |
| Phase (spec §15)     | **2 — web core is next.** Phases 0–1 complete. |
| Last delivered       | Phase 1.5: local-stack bring-up (seed/auth fixes, migration 0009 actor stamping, DB suite green) + AI-readiness documentation layer |
| AI-docs restructure  | DONE (self-contained indexes under docs/AI/, .ai/index.json, scripts/ai/) |

## Features complete

- Monorepo scaffold + CI + quality gate (Phase 0)
- Full DB schema, RLS on all tables, security helpers, guard triggers (Phase 1)
- Workflow RPCs `assign_snag` / `transition_snag` / `soft_delete_snag` w/ activity + notifications (Phase 1)
- Storage buckets + path-membership policies (Phase 1)
- Seed: 5 role users × 2 projects × 15 snags (Phase 1)
- Unit tests (shared: 26) + DB test suite (28, needs running stack) (Phase 1)

## Features in progress

- none active

## Features remaining (order per spec §15)

- Phase 2: web core — auth, dashboard, projects, team, locations, snag CRUD + photos, comments, filters (Next.js)
- Phase 3: workflow UI gating, review queue, reject/reopen UX, notifications bell, Realtime
- Phase 4: image markup (react-konva) + PDF/Excel reports (@react-pdf/renderer, exceljs) + revisions
- Phase 5: mobile app on hosted Supabase (auth, camera flow, review flow)
- Phase 6: offline sync (expo-sqlite mirror, outbox, photo queue), push notifications (Edge Function)
- Phase 7: PWA, dark mode, Docker self-host, EAS profiles, E2E (Playwright)
- Edge function `push-send` (spec §12) — not yet created

## Tests current

- shared: 26 unit tests green (`pnpm --filter @snagflow/shared test`)
- DB: 28 tests **verified green locally** against the running stack (first full local run); also green in CI
- gate: `pnpm turbo run build lint typecheck test` — 12/12 tasks green, 54 tests total
- note: DB suites share one database — `supabase.cmd db reset` before a full gate run locally

## Blockers

- none open.

## Next step recommended

Start Phase 2: auth pages + Supabase clients (`@supabase/ssr`), dashboard shell, projects CRUD,
team management, snag list/detail/create. See FEATURE-INDEX.md "planned" section.
