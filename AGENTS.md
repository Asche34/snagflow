# AGENTS.md — SnagFlow entry point for AI agents

AI agents: START HERE. Follow the reading order and rules below.

## What this project is

SnagFlow: collaborative snag / punch-list / defect tracking for construction teams.
One Supabase backend serving a Next.js web app and an Expo mobile app.
Full functional spec: `SNAGFLOW_BUILD_PROMPT.md` (authoritative for intended scope).

## Stack

| Layer     | Tech                                                                 |
| --------- | -------------------------------------------------------------------- |
| Web app   | Next.js 16 App Router, TypeScript strict, Tailwind v4 (`apps/web`)   |
| Mobile    | Expo SDK 58, Expo Router, TypeScript (`apps/mobile`)                 |
| Shared    | TypeScript lib: permissions, workflow map, zod schemas (`packages/shared`) |
| Backend   | Supabase: Postgres (RLS), Auth, Storage, Realtime, Edge Functions (`supabase/`) |
| Tests     | Vitest (shared + DB), Playwright planned Phase 7                      |
| Tooling   | pnpm 9 workspaces + Turborepo; Node >= 20; Supabase CLI + Docker      |

## Where things live (short map — full map: docs/AI/REPOSITORY-MAP.md)

```
apps/web/src/app/          web pages (currently: placeholder home)
apps/mobile/src/app/       mobile screens (currently: placeholder home)
packages/shared/src/       permissions.ts | workflow.ts | schemas.ts | roles.ts | terminology.ts
supabase/migrations/       numbered SQL only — schema changes NEVER elsewhere
supabase/tests/            DB/RLS/workflow tests (supabase-js)
docs/DECISIONS.md          decision log (add an entry for every non-obvious choice)
docs/AI/                   indexes & state — read on demand only
project_manifest.json      machine-readable map
.ai/index.json             machine-readable feature/route/db/test index
scripts/ai/                index generators & doc validators (offline, zero-dep)
```

## Reading order for a new task (REQUIRED)

1. `AGENTS.md` (this file)
2. `docs/AI/PROJECT-STATE.md` — current phase, blockers, next step
3. Identify module: `docs/AI/MODULE-INDEX.md` → feature: `docs/AI/FEATURE-INDEX.md`
4. Open ONLY the files listed for that feature/module (typically 3–10)
5. Modify → test → update `docs/AI/PROJECT-STATE.md` (and indexes only if structure changed)

**Never analyze the entire repository when the index identifies the files concerned.**
**Never re-audit the repo on every request.**

## Request classification (do this first, every time)

Classify: BUG | FEATURE | UI | DATABASE | DOC | SECURITY | REFACTOR
→ find MODULE-ID (`docs/AI/MODULE-INDEX.md`) → FEATURE-ID if any (`docs/AI/FEATURE-INDEX.md`)
→ build a minimal CONTEXT SET (files you will touch) → load only those files.

## Commands

```powershell
pnpm install                              # setup
pnpm dev                                  # web dev server (:3000)
pnpm turbo run build lint typecheck test # full quality gate (fast, cached)
pnpm --filter @snagflow/shared test      # permission/workflow unit tests

supabase start                            # local stack (needs Docker Desktop running)
supabase db reset                         # applies migrations + seed.sql
pnpm db:gen-types                         # regenerate packages/shared/src/db-types.ts
supabase status                           # local URLs + keys

pnpm --filter @snagflow/db-tests test     # DB/RLS tests (needs SUPABASE_* env, see TESTING.md)
node scripts/ai/update-index.mjs          # regenerate derivable indexes
node scripts/ai/check-ai-docs.mjs         # validate AI docs & JSON indexes
```

Windows quirk: in a fresh shell, `supabase.cmd` may not see `docker.exe`. Fix:
`$env:Path = "C:\Program Files\Docker\Docker\resources\bin;" + $env:Path`.
PowerShell run policy blocks `.ps1` shims — use `pnpm.cmd` / `supabase.cmd`.

## Modification rules (hard)

- TypeScript strict everywhere; `any` requires a written justification comment.
- Authorization is enforced in Postgres (RLS/triggers/RPCs). The UI only gates; it never trusts.
- Permission matrix + status transitions live ONLY in `packages/shared` (UI gating) and are mirrored
  server-side (see "sync contracts" below). Never duplicate the rules elsewhere.
- Schema changes: add a migration file in `supabase/migrations/`, never hand-edit producing objects.
- Secrets: never commit `.env*` values; service-role key in server code only, never in client bundles.
- Update `docs/AI/PROJECT-STATE.md` after shipping; append `docs/DECISIONS.md` for non-obvious choices.
- Run lint + typecheck + tests of the touched packages before declaring done.

## Sync contracts (must stay in sync — check when touching either side)

| Contract                                        | Side A                                   | Side B                                    |
| ----------------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| Status transitions                              | `packages/shared/src/workflow.ts`        | `supabase/migrations/20261019000007_workflow_rpc.sql` |
| Permission matrix                               | `packages/shared/src/permissions.ts`     | policies in `20261019000005/6` + `can()` helper |
| Input validation                                | `packages/shared/src/schemas.ts` (zod)   | DB CHECKs + plan conventions              |
| DB types                                        | `packages/shared/src/db-types.ts` (generated) | migrations (regenerate after changes) |
| Seeded users/ids                                | `supabase/seed.sql`                      | `supabase/tests/helpers.ts::UIDS`         |
| Error code prefixes                             | `packages/shared/src/workflow.ts::TRANSITION_ERRORS` | RPC `raise` messages     |

## Sub-directory AGENTS.md files (tool-injected; do not delete)

`apps/web/AGENTS.md` and `apps/mobile/AGENTS.md` are injected by Next/Expo tooling and warn
about version-specific conventions (Next 16 file conventions, Expo SDK 58 API drift).
They apply IN ADDITION to this file when working in those apps.

## Current state (summary — truth: docs/AI/PROJECT-STATE.md)

Phases 0 (scaffold) and 1 (database/auth/security) are complete: schema, RLS, workflow RPCs,
storage, seed, DB test suite, full quality gate green. Phase 2 (web core: auth, dashboard,
projects, snag CRUD, team, realtime basics) is the recommended next step.
Terminal-stage phase definitions live in `SNAGFLOW_BUILD_PROMPT.md` §15.

## Trust hierarchy

1. executed code 2. migrations/schema 3. tests 4. `project_manifest.json`
5. `docs/AI/PROJECT-STATE.md` 6. module docs 7. changelog/git history.
If docs and code disagree: code+tests win; then flag the stale doc.
