# Decisions

Every non-obvious choice made while building SnagFlow. Format: **Decision** — Reason — Alternative considered.

## 2026-10-31 — Phase 3 workflow and realtime

- Treat Postgres Changes as invalidation signals and reconcile through authenticated server reads. Subscribe to project snags, exact-snag detail children and exact-user notifications. Coalesce bursts for 250ms; refresh after subscription/reconnect, foreground/online recovery and every 15 visible seconds. Existing pagination, signed photos and RLS remain authoritative; avoid duplicating server models in a client cache.
- Avoid DELETE subscriptions: Postgres Changes cannot safely apply their normal SELECT RLS/project filters to deletion payloads. Visible-page reconciliation catches photo/snags removals and revoked access with up to 15 seconds of delay; ordinary INSERT/UPDATE changes arrive live. This costs periodic reads rather than widening realtime payload visibility or altering deletion authorization.
- Await the installed SDK's initial Realtime authentication before subscribing. Real browser tests and read-only subscription inspection demonstrated anonymous joins without it; awaiting setAuth restores authenticated RLS delivery. Keep automatic token refresh and retry failed bootstrap on foreground/interval recovery.
- Preserve deliberate comment/reason/assignment drafts across refresh. Untouched assignment controls derive from current server props; edited controls retain their draft and explain remote changes. Reuse shared transition rules, existing manager queue and RPCs. Reasons remain stored by the existing backend in activity metadata (first 200 characters), with full rejection notification snippets.
- Defer workspace reconciliation while a visible modal is open, then refresh after it closes. A real response-loss deletion regression showed that replacing the deleted route under its recovery dialog could remove the user's Return to project link. Bell reads remain live inside its dialog; underlying workspace changes catch up on close.
- Bell reads latest 30 rows plus an exact unread count; individual/all read writes use the caller session and existing per-user RLS. Add a narrowly scoped after-insert comment trigger for the spec's missing creator/assignee notification emission; deduplicate recipients and exclude the actor/inactive/removed recipients.
- Execute in the clean main checkout at user-authorized base f00f298, reuse installed CLIs and preserve the local stack. An independent reviewer identified stale assignment selection and recovery feedback issues; targeted regressions cover their fixes. Fixture browser notifications/WebSockets are mocked within the fixture suite so its fake sessions never reach the real local backend. Hosted services remain untouched.

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

## Phase 1.5 notes (local-stack bring-up + AI-readiness)

- **Edge functions deferred in `config.toml`**: the spec's `push-send` function has no code yet; a `[functions.*]` entry pointing at nothing fails `supabase start`, so the entry was removed until Phase 6 creates the function.
- **`auth.identities.provider_id` must be the user id** (matching `identity_data.sub`), not the literal `'email'` — the `(provider_id, provider)` unique constraint rejected the second duplicated row otherwise (seed crashed with SQLSTATE 23505).
- **Password seeding uses `gen_salt('bf')`, not the literal `'bf'`**: pgcrypto treats a bare `'bf'` string as a DES salt, producing a 13-char hash GoTrue rejects with "crypto/bcrypt: hashedSecret too short to be a bcrypted password" (HTTP 500 on sign-in). `crypt(password, gen_salt('bf'))` emits a proper `$2a$…` bcrypt hash.
- **DB auth clients**: `supabase/tests/helpers.ts` auto-loads the gitignored `tests/test.env` (plain KEY=value; `process.env` still wins) so the suite runs offline without extra tooling.
- **AI-readiness layer** (token-efficiency restructure, this commit): `AGENTS.md` entry point, `docs/AI/*` index set, `project_manifest.json`, `.ai/index.json` (+ `scripts/ai/{update-index,check-ai-docs}.mjs`, zero-dep, offline). Decision records deliberately live at `docs/DECISIONS.md` (not duplicated under docs/AI); Node chosen over the optional Python variant since Node 20+ is guaranteed by the stack itself.

## Phase 2 notes (web core slice + Docker local stack)

- **Two Docker layers, one compose file** — the Supabase stack is owned by the Supabase CLI (`supabase start`, its own container network and published ports) and the web app is a compose service. They are not merged into one compose project: the CLI stack has no compose definition to import, and hand-porting it would fork the schema. The web container reaches the stack through `host.docker.internal` (`extra_hosts: host-gateway`). Alternative considered: a pure-compose Supabase (not supported by the CLI).
- **`NEXT_PUBLIC_*` is inlined at build time, so the server URL is a separate runtime variable** — `NEXT_PUBLIC_SUPABASE_URL` reaches the browser bundle at build time (it must: the browser cannot read runtime env), while the server container needs `http://host.docker.internal:54321` instead of `127.0.0.1`. `SUPABASE_SERVER_URL` is therefore read at runtime and falls back to the public URL for host-based dev. Both are documented in `apps/web/.env.example`.
- **Fixed session cookie name (`sb-snagflow-auth-token`)** — `@supabase/ssr` derives the cookie name from the URL host (`sb-<host>-auth-token`). With a browser on `127.0.0.1` and a server on `host.docker.internal` the derived names differ and the session splits in two. A fixed name keeps browser and server on the same cookie; the auth API only ever sees the bearer token, so the name is purely client-side.
- **Next 16 "proxy" instead of the middleware convention** — Next 16 renamed Middleware to Proxy (`src/proxy.ts`, Node runtime). The file refreshes the Supabase session cookie on every request and redirects anonymous visitors to `/login?next=…`. Alternative considered: doing the check in every page (repetitive, and a flash of protected content).
- **Cache Components shape the pages** — `cacheComponents: true` (Next 16's successor to `dynamicIO`) removes `export const dynamic`/`revalidate` and requires runtime data access to sit behind a `<Suspense>` boundary. Every dynamic view is therefore a static shell + Suspense-wrapped async island (`app/(app)/*/page.tsx` → `components/*-view.tsx`); routes report as Partial Prerender.
- **`getUser()` instead of `getClaims()`** — `getClaims()` validates against asymmetric JWKS keys, but the local stack signs with the symmetric JWT secret (HS256), so the local stack would break. `getUser()` costs one auth round-trip and works everywhere. Alternative considered: `getSession()` (client-side, unverified — rejected for authorization decisions).
- **Shared package: bundler-first imports, declarations-only build** — the package ships TypeScript sources (`main: ./src/index.ts`) and is compiled by the consumer. Turbopack does not apply the TypeScript `.js` → `.ts` rewrite for workspace packages, so the internal specifiers became extensionless (`./roles`), which matches the existing `moduleResolution: "bundler"`. The build now emits declarations only (`--emitDeclarationOnly`): a JS artifact with extensionless specifiers would be invalid Node ESM, and nothing consumes `dist` today.
- **`profiles_select` relaxed to project colleagues (migration 10)** — Phase 1 allowed reading only your own profile (or any profile as admin), so the UI could not show the name of an assignee or a team roster to ordinary members. The new policy allows reading profiles of users who share a project with you, via a `SECURITY DEFINER` helper (`shares_project_with_me`) to avoid policy recursion. Writes stay unchanged.
- **Demo account list is opt-in** — the login page shows the seeded credentials only when `NEXT_PUBLIC_DEMO_ACCOUNTS=1`; the default build keeps it off so a real deployment never advertises demo logins.
- **Docker image builds the standalone bundle** — `output: "standalone"` + `outputFileTracingRoot` (workspace root) yields a minimal runtime image (`node apps/web/server.js`); `public/` and `.next/static` are copied in explicitly, as Next does not include them in the standalone output. Alternative considered: `next start` in the image (bigger, no static-file copying done for us).
- **CI job gates must not use `hashFiles` at job level** — the `database` job used to be gated with `if: hashFiles('supabase/migrations/*.sql') != ''` so it would only start once migrations existed. On GitHub that expression made the *whole run* fail instantly with zero jobs ("This run likely failed because of a workflow file issue"), while the file itself was valid YAML. The gate was removed (migrations exist for good now); the job runs unconditionally.

## Phase 2.5 notes (E2E suite + the login bug that was actually a stale DB volume)

- **The browser login failure was a stale Supabase volume, not the UI.** The `supabase_db_snagflow` volume carried an `auth` schema years older than the `gotrue:v2.197.0` image the CLI now pulls: `auth.users` had no `banned_until` and `auth.schema_migrations` claimed to be up to date, so GoTrue never repaired itself and answered every `signInWithPassword` with HTTP 500 `Database error querying schema`. `supabase db reset` cannot fix it — it replays only *our* migrations, never the GoTrue-owned `auth` schema. Fix: `supabase stop --no-backup` (drops the volume) then `supabase start` (fresh volume → fresh auth schema). Verified: `banned_until` now present, password grant returns 200, DB suite 28/28.
- **`supabase start` right after `supabase stop` can fail** with `Conflict. The container name "/supabase_db_snagflow" is already in use` — the removal races the create. Just run `supabase start` again; it succeeds.
- **The CLI can report "supabase start is already running" while no supabase container exists** (stale state after a Docker Desktop restart). `supabase stop` then `supabase start` forces a clean recreate. `docker ps -a` is the ground truth, not the CLI.
- **Keys did not change after the volume reset** — the JWT secret is the default static one and the publishable key is still `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`. No key churn to propagate into baked images or `.env` files.
- **E2E package: Playwright against a real browser, not a headless download.** `e2e/` is a workspace package with `channel: "chrome"` (uses the locally installed Google Chrome; no browser download needed) and a `bundled` fallback for CI. `pnpm install` adds it to the lockfile; CI installs Playwright browsers with `--with-deps chromium` on the runner.
- **E2E tests are written to be robust, because the first 6-test run flaked.** Three non-product bugs were in the test file: `getByRole('heading', { name: 'Sign in' })` matched nothing (the text is plain under an `<h1>SnagFlow</h1>`); `cookie.sameSite` was asserted as `"lax"` but Playwright normalizes to `"Lax"`; and `body.innerText()` returned `""` mid-revalidation. The suite now asserts on the email field, the normalized `sameSite`, and specific sidebar links. A fourth flake — `getByRole("alert")` colliding with Next.js's route-announcer `<div role="alert">` — is fixed by scoping to `p[role="alert"]` inside the page's `<main>`.
- **`@supabase/ssr` 0.12.7 defaults `httpOnly` to false** — the cookie assertion was dropped to `name` + `path` + `sameSite`, which is what the app actually controls.
- **CI E2E job reads the local stack's keys at runtime** — the local stack generates its own keys, so the job runs `supabase status -o env`, strips the surrounding quotes, and injects `NEXT_PUBLIC_SUPABASE_*` into the build. A hardcoded placeholder would build but never authenticate. `supabase.env` is gitignored.
- **`turbo.json` ordering** — `e2e#test` depends on `web#build` (the suite runs against the built app), and `web#typecheck` still depends on `build` (they raced over `.next/types`).


## Phase 2.6 notes (verification pass: port collision, health check, turbo task keys)

- **The web app moved to port 3003.** Port 3000 on this machine is served by a *different*
  project (the `shelf.nu` app the pnpm shim used to point at). Anything that assumed 3000 —
  the compose mapping, the E2E default base URL, `.env` — silently talked to the wrong
  application. `WEB_PORT` in `.env` is now `3003`. Alternative considered: stopping the other
  app (not ours to kill).
- **`/api/health` reported `unreachable` for anonymous visitors.** The route used
  `auth.getUser()` as its reachability probe, so a healthy stack with no session cookie
  returned 503 `{"supabase":"unreachable","detail":"Auth session missing!"}` — a false alarm
  on the endpoint's most common input. Reachability is now probed against
  `/auth/v1/settings` (unauthenticated, `cache: "no-store"`, 5s timeout), and session state is
  reported separately via `getUser()` without downgrading `ok`. A health check that cries
  wolf on anonymous traffic is worse than none.
- **Turbo task keys use the package *name*, not the directory.** The E2E task was declared as
  `e2e#test`, but the package is `@snagflow/e2e`, so the block was dead config: `dependsOn`
  and `env` never applied. Corrected to `@snagflow/e2e#test` (verified with
  `turbo run --dry=json`). This is why `web#build` ordering appeared to work in one place and
  not another.
- **Turbo's strict env mode silently drops `E2E_BASE_URL`.** Undeclared env vars do not reach
  the task, so the suite fell back to `http://localhost:3000` — the *other* app — and failed
  on its login form (`link "Shelf Logo"`, `zaans@huisje.com`). `E2E_BASE_URL`, `E2E_CHANNEL`,
  `E2E_PASSWORD` and `CI` are now declared under `@snagflow/e2e#test`.
- **A wrong base URL must fail loudly, not pass quietly.** `getByLabel("Email")` matches on a
  substring and accepts any page with an email field, which is how the suite could run
  against a foreign app without complaining. Locators are now scoped to the form that
  actually contains a "Sign in" button, with `{ exact: true }` on labels.
- **Playwright artifacts are gitignored** (`e2e/test-results/`, `e2e/playwright-report/`,
  `e2e/blob-report/`). Traces and failure screenshots are build output, not source.
- **Verified, not assumed:** full forced gate `pnpm turbo run build lint typecheck test --force`
  → 15/15 tasks, 60 tests (26 shared + 28 DB + 6 E2E). Three consecutive E2E runs to confirm
  the flakiness was gone. The `Date.now()` prerender warnings seen earlier did **not** recur
  on a clean start and did not kill the container (exit 143 was a SIGTERM, not a crash).

## 2026-10-29 — Authorization review hardening

- Missing/inactive project roles fail closed in workflow RPCs. Revoke anonymous RPC access and direct execution of internal audit/notification helpers rather than relying on table RLS inside SECURITY DEFINER functions.
- Enforce the section 4 matrix at INSERT as well as UPDATE: new snags start open with no closure/rejection/deletion metadata. Members create unassigned snags; managers/admins may optionally assign an active project member/manager. This preserves the fast create form without granting members an assignment bypass.
- Require an active caller profile in project role, membership and colleague lookup helpers; retain self-profile reads for account-state handling. Photo ownership alone does not preserve writes after membership loss. Auth-session revocation and signed-URL expiry remain separate concerns.
- Keep creator-only detail editing. The photo-count trigger locks its parent as SECURITY DEFINER with an empty search path so an assignee uploading to another creator's snag still serializes against the eight-photo cap. Photo INSERT RLS remains enforced. Invoker locking was reproduced allowing nine concurrent photos; definer locking held at eight.
- Add transactional SQL authorization checks to CI alongside API tests. They exercise actual PostgreSQL rules and roll back fixtures. Local isolated PostgreSQL with auth/storage shims provides useful validation when Docker is unavailable; it is not a substitute for full Supabase/browser verification.
- Separate CI unit and browser runs, provide DB test credentials explicitly, refuse CI security-test skips, select installed bundled Chromium, and allow/hash web public build variables through Turbo. Declare lint imports directly instead of depending on incidental hoisting.

## 2026-10-29 — Fieldwork web UI

- The user selected Fieldwork and approved its design: forest navigation, orange actions, quiet neutral surfaces and existing Geist fonts. Mobile navigation uses existing destinations only; unavailable mockup controls are omitted.
- Keep loading/data/auth on the server; send serializable project summaries to a small client navigation component. Radix Dialog handles modal focus behavior; explicitly return focus to whichever top/phone trigger opened it.
- Filter the review queue by project reviewer role, while keeping aggregate status counts over visible projects. Project roles vary; global user chrome says Project team rather than implying one project role.
- Supabase Auth reads the clock while initializing sessions. An observed Next.js prerender browser error disappeared after `connection()` before server client initialization; a regression checks the browser console.
- A separate loopback-only HTTP fixture transport drives actual Next screens when Docker/Supabase is unavailable. It is never wired into production code; existing auth/API tests remain distinct. Fixture UI checks are not evidence of server authorization.
- Text enlargement reproduced a 511px layout at a 375px viewport. Wrapping action labels, explicit grid min-widths, bounded skeletons and an accessible compact sign-out control eliminate overflow; focused-control clearance is covered.

## 2026-10-29 — Web snag capture and evidence

- Extend Fieldwork with full create/edit pages rather than a cramped modal. Use existing shared Zod contracts and user-authenticated Server Actions; query edit targets directly by ID so they do not depend on the workspace's 1,000-row list limit.
- Keep a stable client UUID across uncertain create responses. Reconcile a committed create through the authorized update path on retry, preserving revised details and a manager's revised assignment. Assignment remains an RPC operation, never a direct protected-column update.
- Resize JPEG/PNG/WebP in the browser to 1600px longest edge at JPEG quality .8, with a 400px thumbnail. Preserve browser-decoded orientation and aspect ratio; use file modification time as the timestamp rather than claiming EXIF extraction.
- Upload directly to private Storage with the user's session. Derive original/thumbnail paths from stable UUIDs and the server-read snag project; validate object existence/type before registering metadata. Deterministic identities permit retry after object or metadata responses are lost without duplicate rows. Keep interrupted objects for manual retry; abandoned-object cleanup remains future work.
- Enforce the existing-plus-pending eight-photo limit in the picker and retain the authoritative concurrent DB limit. Keep per-photo preparation/upload/save states; these are stages, not invented byte percentages.
- Keep client-only capture inputs disabled until hydration. Retain typed details after validation/network failures and focus the mounted error summary; use route-specific form IDs because Next.js can retain prior pages hidden in the DOM.
- Native execution on a feature branch reuses the installed workspace. One independent final review identified retry data loss and capped edit lookup; both received real-browser regression coverage. No package dependency or database migration was added.

## 2026-10-29 — Project filters/search

- Apply typed, normalized URL filters to user-session Supabase queries before selecting a page. Project pages omit the capped global snag payload; exact counts and statistics come from project-scoped queries. Share filters via URLs rather than adding a saved-filter table.
- Add a generated English tsvector combining title and description plus a GIN index in migration 12. Use `websearch` operands directly through Supabase, never raw interpolated PostgREST syntax. Bare numbers and #numbers are exact project-local number lookups. No substring/fuzzy search or new dependency.
- Use explicit GET submission with existing Fieldwork native controls. Keep filter URLs across project sections and browser history; applying starts at page one and clearing restores default sort. Invalid/repeated values normalize safely; valid but unavailable option IDs retain their constraint and show no matches.
- Use 50-row pages, number tie-breakers, highest-priority-first enum sorting and null-last due ordering. Clamp stale pages to the last page. Due presets exclude closed work and use the existing server calendar convention; location matching is exact, not recursive.
- Work directly on main as requested, reusing the installed checkout at `6072b8f`. The sandbox requires escalated Git metadata writes and local Supabase CLI telemetry access; no hosted schema was changed. Direct installed CLIs avoid the current pnpm runner's unsolicited install behavior; RTK wraps supported compact checks.
- Independent review found no important/critical issue. Deferred minors: capture a single clock value across count/fetch around midnight, and add explicit repeated-UUID/backend-failure UI regressions. Known global metadata caps, completed capture and later phases remain out of scope.

## 2026-10-29 — Project creation and detail editing

- Follow spec §4 and the existing permission matrix/RLS: admins create, project managers/admins edit metadata/settings. §8's admin shorthand does not remove manager edit rights. No authorization/schema/dependency change.
- Use focused full-page Fieldwork forms and existing dashboard/sidebar discovery. Include name, unique code, description, client, address and require-fix-photo. Archive, membership, invitations, cover images and deletion remain separate slices.
- Query edit targets directly by UUID with current profile/membership. Re-read active access on every save; apply a strict metadata allowlist through the user's session. RLS remains authoritative. Invalidate the root layout after success to refresh project names/links everywhere.
- Stable create UUIDs reconcile lost committed responses, applying revised details only to the same creator's project while rechecking admin creation authority. Duplicate codes report field errors and never select/mutate another project by code.
- Keep forms disabled until hydration and during saves, preserve drafts after errors and focus linked summaries. Native execution reuses the installed main checkout; a fresh independent final review is read-only. RTK compact checks use installed binaries to avoid the existing pnpm auto-install mismatch.
- ROUTE-INDEX was stale (claimed only a placeholder existed). Updated its known live routes from the machine route index; no re-audit of previous capture/filter functionality.

## 2026-10-30 — Team and invitations

- Follow the existing matrix/spec §4/§7: managers/admins manage project membership; only active admins create org accounts by invitation. Managers may cancel pending project access. Allow self role/removal with confirmation; global admins retain implicit recovery access.
- Use scoped SQL RPCs for canonical confirmed-email add, role/removal and invite preparation/cancel/lookup/acceptance. Never expose a cross-project profile directory. Definer guards explicitly coalesce nullable `can()` results to false; a real non-member regression caught the SQL NULL trap before delivery.
- Keep privileged Auth email operations in an admin-checked route with a server-only runtime key. Compare CSRF Origin against canonical APP_URL because standalone/reverse-proxy internal request origins can differ. Pending Team props exclude app tokens.
- Use stable pending IDs and the default Supabase fragment-session email callback. Bind acceptance to confirmed canonical Auth email, active recipient/inviter, seven-day app token and current membership. Replay never overwrites a role or restores revoked access.
- Recover a confirmed-but-unaccepted recipient's lost session through a recovery email to the same validated pending invite; a real-browser consumed-link regression failed first and passed with the fallback. Self-role confirmation and post-error draft retention were also proven with failing regressions.
- Keep public registration disabled while the email provider remains enabled. Local/CI redirect allowlists and runtime APP_URL/service-key plumbing are explicit. No hosted configuration or external recipient was changed/contacted. Canceling project invitations does not delete Auth accounts; org user cleanup/deactivation is separate work.

## 2026-10-30 — Project archive and snag soft-delete controls

- Keep existing manager/admin rights from the shared matrix and project UPDATE RLS; use the caller session and existing hardened soft-delete RPC. No schema or permission change is needed. Spec §8's admin shorthand does not remove the manager authority established by §4 and the implemented contracts.
- Archive is a reversible lifecycle label, not a read-only/security boundary. Preserve team access, records and existing actions; remove archived projects from active sidebar/dashboard work and provide dashboard Archived projects discovery and manager/admin restore.
- Use a focused shared Fieldwork confirmation with the record name, consequences, initial Cancel focus, keyboard dismissal, hydration/pending gating and focused errors. Snag history/photos remain stored; no restore UI or permanent delete is introduced.
- Invalidate the root layout on successful mutations; replace the deleted snag/archive route with its project/dashboard destination and refresh. Do not infer successful deletion from an RLS-hidden/missing row. A lost committed response offers a fresh-document Return to project link, which discards the client cache even when the invalidation response never arrived.
- Execute inline from clean main `88b639a`, reuse installed CLIs, preserve local Supabase data and obtain one independent final review. Dedicated inactive-actor lifecycle tests remain a coverage minor; the live-role browser/DB cases, transactional authorization checks and active-profile database helpers cover the implemented authorization paths.

## 2026-10-30 — Phase 2 metadata and comments

- Keep metadata identities stable on rename/reparent. Migration 14 changes snag metadata and location parent foreign keys to statement-end NO ACTION, protecting even soft-deleted snag references and nonempty branches while permitting whole-project cascade cleanup. Avoid a new archive flag or silent reassignment. Existing manager/admin RLS from migration 11 remains authoritative.
- Reject metadata identity/project moves, invalid names/order, foreign parents and hierarchy cycles in a guarded trigger. Serialize location writes on the project row; five real concurrent opposite-move trials each reject exactly one operation without a cycle.
- Use project-scoped paginated metadata reads for management, search filters and capture selectors. Show ancestry paths in the existing Locations section beside categories. Confirm deletion with initial Cancel focus and explain historical usage; preserve the form on failed writes and offer fresh-document recovery after ambiguous responses.
- Stable client UUIDs reconcile exact metadata/comment creates after response loss. A changed draft never overwrites a previously committed create; retain it and ask the user to refresh and inspect/edit the committed record. Comments remain append-only in this UI.
- Put composition with the thread, use shared comment validation and current session RLS, and show pending/count/visibility/error/success feedback. Load comments in deterministic 500-row pages and show an explicit retry state if any read fails. Phase 2 collaboration uses manual refresh across browser sessions; realtime and notifications remain Phase 3.
- Execute natively from main `68e3a38`, reuse installed CLIs and preserve local data. Independent read-only review prompted capture/comment cap fixes, unavailable-thread feedback and post-success focus, all verified with failing-first browser regressions. Hosted services remain untouched.
