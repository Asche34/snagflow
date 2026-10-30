# CHANGELOG

History lives here + git log; current state lives in `docs/AI/PROJECT-STATE.md`; future in `SNAGFLOW_BUILD_PROMPT.md` §15.

## 2026-10-30 — Phase 2 web core complete locally

- Project location/category management with confirmed unused deletion, preserved historical snag references, database hierarchy safeguards and complete project-scoped selectors (migration 14, local only).
- Thread-local comment composition with validation, draft retention, safe lost-response retry, complete paginated reads and explicit unavailable/retry feedback.
- 180 targeted checks passed; independent review findings resolved. Two-session member/manager collaboration verified with manual refresh. Hosted deployment remains pending; next is Phase 3 realtime/notifications/workflow polish. Handoff: `docs/AI/PHASE2-COMPLETE-2026-10-30.md`.

## Unreleased — AI-readiness restructure + local-stack bring-up

- AGENTS.md entry point, `docs/AI/` index set, `project_manifest.json`, `.ai/index.json`,
  `scripts/ai/{update-index,check-ai-docs}.mjs`, CHANGELOG.md. No functional behavior changed
  beyond fixes needed to run the stack/tests locally:
  - `supabase/config.toml`: dropped not-yet-existing `push-send` function entry (start failed).
  - `supabase/seed.sql`: provider_id must be the user id (unique constraint), bcrypt via `gen_salt('bf')`
    (a literal `'bf'` salt produced a DES hash GoTrue rejected), and the level-2 snags moved to
    PROJECT_B so both projects carry demo data.
  - NEW migration `20261019000009_actor_defaults.sql`: stamp `created_by`/`author_id` from the JWT —
    member inserts previously violated the `snags`/`comments` insert policies.
  - `supabase/tests/helpers.ts`: loads the gitignored `tests/test.env`.
  - `supabase/tests/*.test.ts`: corrected expectations (PostgREST 0-rows-success semantics, seeded
    ids matching reality).

## 2026-10-19 — Phase 1: database, auth, security (`a7b518f`)

- 8 migrations: enums/extensions, core/snags/collab tables, security helpers + guard triggers,
  RLS policies, workflow RPCs (`assign_snag`/`transition_snag`/`soft_delete_snag`), storage buckets.
- `supabase/seed.sql`: demo org + 5 role users + 2 projects + 15 snags (password `Password123!`).
- DB test suite `@snagflow/db-tests` (28 tests) + shared units (26 tests, green CI gate).

## 2026-10-19 — Phase 0: monorepo scaffold (`2e5364e`)

- pnpm + Turborepo, Next.js 16 web app, Expo SDK 58 mobile app, `packages/shared`,
  CI workflow, README, env examples, UI primitives.
