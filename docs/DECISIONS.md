# Decisions

Every non-obvious choice made while building SnagFlow. Format: **Decision** — Reason — Alternative considered.

---

## Environment decisions (made before Phase 0 code)

- **Global pnpm shim was monkey-patched (fixed)** — `C:\Users\IT\AppData\Roaming\npm\pnpm.cmd` contained a hard-coded `cd C:\Users\IT\Documents\shelf.nu` that redirected *every* pnpm invocation on this machine into an unrelated project. The injected `cd` line was removed so the shim behaves normally again. If pnpm ever targets the wrong directory again, check that file.
- **`pnpm dlx` cwd quirk** — `create-next-app`/`create-expo-app` via `pnpm dlx` sometimes execute in an unpredictable directory (possibly related to the shim issue above). Workaround: always pass **absolute** paths to scaffolders.
- **Execution-policy workaround** — PowerShell execution policy blocks `.ps1` shims (pnpm.ps1, npm.ps1); we invoke `pnpm.cmd` / `npm.cmd` (the Windows `.cmd` wrappers) instead. No package-level impact. Alternative: changing the machine's execution policy (too invasive).
- **Repo-local git identity** — no global `user.name`/`user.email` was configured, so a repo-local placeholder (`SnagFlow Dev <dev@snagflow.local>`) is set. Change with `git config user.name "You"` before pushing. Alternative: asking the operator (would block Phase 0's "commit per phase" requirement).
- **Docker not installed** — `supabase start` (local stack for migrations, RLS tests, Realtime) requires Docker. Scaffolding, schema, policies, RPCs, seed and test code will be written regardless; running them locally waits for Docker Desktop (or a hosted Supabase project). Tracked as an open blocker — see README.

---

## Phase 0 plan (restated before coding, per the build prompt)

**Goal:** a buildable monorepo with a running web dev server, working CI, clean tooling baseline.

1. **Monorepo layout:** pnpm workspaces (v9.15.9) + Turborepo (v2.x). `apps/web` (Next.js), `apps/mobile` (Expo), `packages/shared` (zod schemas, permission matrix, status-transition map, shared TS types). No Nx / Lerna.
2. **Web scaffold:** `create-next-app` for apps/web on the current stable App Router (Next 16.4.x) with TS strict, Tailwind v4, ESLint. Deps layered on afterwards: `@supabase/ssr`, `@TanStack query`, `react-hook-form`, `zod`, `react-konva` (markup), `@react-pdf/renderer` + `exceljs` (reports).
3. **Mobile scaffold:** `create-expo-app` (Expo Router, TypeScript) for apps/mobile, pinned to the current Expo SDK; supabase-js client + expo-secure-store adapter wired in Phase 5.
4. **Supabase directory:** `supabase/` with `config.toml`, `migrations/` (timestamped SQL), `seed.sql`, `functions/`, `tests/`. CLI installed as a devDependency-equivalent global; no schema changes outside migrations.
5. **Shared package:** pure TypeScript, `exports` map, consumed by both apps via workspace protocol. Contains the **single source of truth** for the permission matrix (spec §4) and status-transition map (spec §6), plus zod schemas; the DB always remains the real authority.
6. **CI:** GitHub Actions — pnpm install → turbo lint/typecheck/test on PRs; supabase migration-apply + DB-test job uses the CLI in CI where Docker is available (the GH runner provides it, unlike this machine).
7. **Acceptance:** `pnpm dev` runs web, `pnpm lint|typecheck|test` pass everywhere, CI config committed (green pending a remote), README explains setup/envars/deploy.

## Phase 0 notes (decisions made while building it)

- **TypeScript 5.8.3, not TS 7** — TS 7 (7.0.2) is already published and `tsc` flags it as available; we stay on 5.x (the version `create-next-app` resolves) for stability across Expo/Next/link configs. Revisit once the ecosystem (expo/tsconfig, typescript-eslint) supports 7 comfortably.
- **zod v3, not v4** — v3 remains the best-supported path for `@hookform/resolvers` and keeps a single zod version across web + mobile + shared. Revisit with SDK updates.
- **Expo template demo screens replaced** — the SDK-58 template's decorative demo (AnimatedIcon, AppTabs, themed-* components, welcome screens) is deleted and replaced by minimal placeholder `_layout.tsx`/`index.tsx`; the real navigation/auth stack is a Phase 5 concern. Template files shipped with type errors against `@expo/ui` web typings (function-slot `ref` contracts) and would not typecheck as-is.
- **ESLint** — flat config everywhere; `packages/shared` uses `typescript-eslint` recommended + strict no-`any`; mobile uses `eslint-config-expo` (installed as a real devDependency rather than letting `expo lint` hot-install it every run).
- **Native `<select>`** styled as a UI primitive instead of Radix Select — keyboard and screen-reader behaviour for free (supports the accessibility requirement in spec §8.12), less surface to maintain.
- **`ui/` primitives** — Radix Dialog + DropdownMenu, local Tabs/Avatar implementations; no dep on `shadcn` CLI registry yet so ownership stays explicit.
- **CI supabase job is conditional** — `hashFiles('supabase/migrations/*.sql')` gates the migration/RLS job; it activates automatically when Phase 1 migrations land.
- **`AGENTS.md` files kept** — Next/Expo inject agent-guidance files that teach version-specific API drift (Next 16 conventions, Expo SDK 58). Committed so that rule stays effective for future agent sessions.



## Phase 1 plan (restated before coding)

**Goal:** the full schema with strict server-side authority — RLS everywhere, workflow enforced by RPCs, seeded demo org, DB tests.

1. **Enums first:** `project_role`, `snag_status`, `snag_priority`, `photo_kind`, project/report status value specs exactly as in spec §5.
2. **Helper functions** (SECURITY DEFINER, `SET search_path = ''`, `STABLE`): `is_admin()`, `is_project_member(pid)`, `project_role(pid)`, `is_project_manager(pid)`.
3. **Tables per spec §5**, all with `created_at`; mutable tables get `updated_at` via triggers. `snags.number` per-project sequential with `unique(project_id, number)`; assigned server-side via `project.snache_counter` row-locking in the insert path; `snags.client_id` is the idempotency key for offline creates. Max 8 photos/snag enforced by trigger.
4. **RLS on every table** following the §4 matrix; `activity_log` is appender-only (SELECT for members; **no** client INSERT/UPDATE/DELETE policy at all); comments require member-or-higher and `author_id = auth.uid()`.
5. **Workflow RPCs** `assign_snag(snag_id, assignee_id)` and `transition_snag(snag_id, to_status, comment)` — SECURITY DEFINER; validate caller’s role server-side; each writes `activity_log` and `notifications`; the §6 state machine (including “fix photo required before ready_for_review” when `projects.require_fix_photo`, “comment required” on reject/reopen) is enforced *server-side*, plus a `BEFORE UPDATE` on `snags` that rejects direct client edits to `status`, `assignee_id`, `closed_*`, `rejection_count`, `number`, `project_id`.
6. **Storage:** private buckets `snag-photos`, `reports`, `branding`; path convention `{project_id}/{snag_id}/{uuid}.jpg`; object policies parse the first path segment as the project id and check membership; clients get short-lived signed URLs only.
7. **Invite flow:** server-side only (service-role key in an admin-checked route handler); public signup disabled at the project settings level.
8. **Seed data:** demo org, 1 admin, 1 manager, 2 members, 1 viewer, one sample project (locations/categories/15 snags in varied states). *_Demo passwords live only in README/seed comments, not in code logic.*
9. **Types:** `supabase gen types` generates DB types into `packages/shared` (source-controlled after each migration change).
10. **DB tests** (supabase/tests/*.test.ts via supabase-js + a local/hosted stack): non-member isolation, viewer read-only, member can’t assign/close/reject, member can’t tamper with others’ snags, invalid transitions rejected, concurrency-safe `number` sequencing, 8-photo cap, activity_log writes rejected. *Runs are gated on Docker being present here (or a hosted project).*

### Deferred / open questions (need the operator)

- A GitHub remote to push CI status to, and whether to wire up hosted Supabase credentials now or stay on local-stack only for now.
- Whether Docker Desktop should be installed on this machine so that DB/RLS tests can run locally.

## Phase 1 notes (implemented as planned above)

- **Workflow authority lives in one place**: RPCs (`assign_snag`, `transition_snag`, `soft_delete_snag`) + a `BEFORE UPDATE` guard trigger on `snags` that rejects *any* direct client write to `status`, `assignee_id`, `number`, `client_id`, `project_id`, `closed_*`, `rejection_count`, `deleted_at`. RPCs set a transaction-local `app.snag_rpc` setting to pass through their own controlled writes. Plain-field detail edits (title, description, priority, due date, category, location, pins) remain direct RLS-gated updates so the UI stays snappy and offline-friendly.
- **Error contract**: Postgres raises messages prefixed with stable codes — `SNAG_NOT_FOUND`, `SNAG_ILLEGAL_TRANSITION`, `SNAG_ASSIGN_FORBIDDEN`, `SNAG_TRANSITION_FORBIDDEN`, `SNAG_COMMENT_REQUIRED`, `SNAG_FIX_PHOTO_REQUIRED`, `SNAG_DELETED`, `SNAG_PHOTO_LIMIT_REACHED`, `SNAG_PROTECTED_FIELD` — mirrored by `TRANSITION_ERRORS` in `packages/shared`.
- **`can(role, project_id)` helper** centralizes the minimum-role check ('view' | 'member' | 'manager') + admin short-circuit; every policy reuses it.
- **Numbers**: `snag_number` counts with `FOR UPDATE` row lock on the project row → concurrency-safe per-project sequences with a unique `(project_id, number)` index; direct inserts with a fabricated number still flow through the trigger counter (numbers are server-owned).
- **Idempotency**: `snags.client_id` is unique — offline/outbox replays fail softly on conflict and are treated as success by the sync layer (provable in DB tests).
- **Comments** are immutable (no UPDATE/DELETE policies); activity_log is appender-only (no INSERT policy for clients — writes happen only inside SECURITY DEFINER functions).
- **Storage**: private buckets `snag-photos`/`reports`/`branding`; policies parse the first path segment as project id and re-check membership; the photo update policy allows the object's own uploader (`owner_id`) or a project manager; report uploads have *no* client policy (route handler writes with the service role).
- **profiles self-service guard trigger** blocks non-admins from flipping `is_admin`/`is_active`/`email` on their own row.
- **Seed** creates auth rows + identities directly (local-only; production users come exclusively through the admin invite route). Demo passwords documented in the seed header.
- **DB tests** (`supabase/tests`, package `@snagflow/db-tests`) cover: non-member isolation, viewer read-only, member cannot assign/close/reject/delete, member cannot start work on a snag assigned to someone else, illegal transitions rejected, reject & reopen require comments, comment/assignment/review notifications fire, activity trail exists, concurrency-safe numbering, client_id replay safety, the 8-photo cap, and comment immutability. They **skip loudly** when `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are unset (i.e. no Docker locally) — same env contract runs them in CI.
- **`supabase/` is a workspace package** (`@snagflow/db-tests`) so Turbo owns its lint/typecheck/test tasks like every other package.
