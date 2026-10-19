# 00-START-HERE

Read this, then `PROJECT-STATE.md`, then only what you need.

| Item     | Value                                                              |
| -------- | ------------------------------------------------------------------ |
| Project  | SnagFlow — collaborative snag/punch-list/defect tracking           |
| Version  | 0.1.0                                                              |
| State    | Phase 2 next (web core). Phases 0–1 complete.                       |
| Stack    | Next.js 16 · Expo SDK 58 · packages/shared (TS) · Supabase         |
| Arch     | 2 frontends → one Postgres (RLS) ← tiny TS contract lib. No server runtime yet. |
| Modules  | MOD-WEB (placeholder) · MOD-MOBILE (placeholder) · MOD-SHARED (real) · MOD-DATABASE (real) |
| DB       | Local stack via `supabase start`; schema = 8 migrations in `supabase/migrations/` |
| Tests    | `pnpm turbo run build lint typecheck test` (+ DB suite needs env, see TESTING.md) |
| Commands | AGENTS.md §Commands                                                |
| Worklog  | CHANGELOG.md + docs/DECISIONS.md                                   |

Current work: none active. Next recommended: **Phase 2 — web core (auth, dashboard, projects, snag CRUD, team, realtime basics)** per `SNAGFLOW_BUILD_PROMPT.md` §15.

Last delivered: Phase 1 + local-stack bring-up (seed/auth fixes, migration `0009_actor_defaults`,
DB suite 28/28 green, real `db-types.ts` generated) + AI-docs layer.

Next docs to consult (only when needed): PROJECT-STATE.md → FEATURE-INDEX.md/BUSINESS-RULES.md → targeted source files.
