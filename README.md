# SnagFlow

SnagFlow is a collaborative snag, punch-list, and defect tracker for construction and engineering teams. It gives site teams, contractors, and project managers a shared record of what needs fixing, who is responsible, and what has been reviewed and closed.

Work is organized by project, location, category, priority, and due date. The intended field workflow connects issue evidence, assigned corrective work, review, and an auditable history across a web workspace and a future mobile app.

**Current status:** version 0.1.0, under active development. The web workspace supports snag capture, editing, photos, assignment, and review; project/team management and live updates are still being built. The Expo mobile app is a scaffold.

## How it works

The snag lifecycle is:

```text
Open → In progress → Ready for review → Closed
```

Assignment is separate from status. Managers can reject work back to the assignee or reopen a closed snag, with a required comment. Project settings can require a fix photo before review.

| Role    | Responsibility                                                        |
| ------- | --------------------------------------------------------------------- |
| Admin   | Organization-wide access and administration                           |
| Manager | Manage work and review submissions within their projects              |
| Member  | Create snags, edit their own snag details, and work on assigned snags |
| Viewer  | Read the projects and records they are allowed to see                 |

Permissions are enforced in PostgreSQL through row-level security, triggers, and workflow functions. Hiding a UI action is not the authorization boundary.

## Available today

- Email/password sign-in, session refresh, protected pages, and sign-out.
- Role-aware dashboard with status counts, review queue, assigned work, overdue items, and project progress.
- Project pages with snag lists, status filtering, location trees, and team rosters.
- Snag creation and creator/manager editing, with project-local details and “Save & add another.”
- Manager assignment/reassignment and snag detail pages with comments, activity history, and permitted workflow transitions.
- Private issue/fix photo uploads, image resizing, thumbnails, per-photo status, and retry without duplicate snags or photo records.
- The Fieldwork visual system: forest navigation, orange actions, responsive layouts, mobile project navigation, keyboard focus handling, and readable status indicators.
- Database support for snag creation, assignment, workflow validation, private file storage, audit events, and notification records.
- Seeded demo data, automated authorization/workflow tests, and browser regression coverage.

### Still to build

- Project/team management, invitations, and richer filtering.
- Live updates and the notifications interface.
- Photo markup, PDF/Excel reports, and revision handling.
- Mobile field capture, offline synchronization, and push notifications.

Database support for an operation does not mean its web or mobile interface is complete. See [project state](docs/AI/PROJECT-STATE.md) for delivery details and [the build specification](SNAGFLOW_BUILD_PROMPT.md) for the intended scope.

## Stack and repository

| Area             | Technology / location                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| Web              | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Radix UI — `apps/web` |
| Mobile scaffold  | Expo SDK 58, Expo Router, React Native — `apps/mobile`                             |
| Shared contracts | Types, Zod schemas, permissions, and workflow rules — `packages/shared`            |
| Backend          | Supabase PostgreSQL 17, Auth, Storage, and Realtime — `supabase`                   |
| Tests            | Vitest and SQL authorization checks; Playwright in `e2e`                           |
| Tooling          | pnpm workspaces, Turborepo, GitHub Actions                                         |

Schema changes live in `supabase/migrations`. Client contracts live in `packages/shared`; database authorization remains authoritative.

## Run locally

### Prerequisites

- Node.js 24 is the verified development version.
- pnpm 9.15.9, as declared in `package.json`.
- Docker Desktop or a compatible running Docker engine.
- A working `supabase` CLI command. Local integration checks used CLI 2.122.0; follow the [official installation instructions](https://supabase.com/docs/guides/local-development/cli/getting-started).

The commands below assume the CLI is available on PATH. With a project-scoped CLI installation, use its package runner instead. On Windows, use `pnpm.cmd` when PowerShell blocks the `.ps1` shim.

### 1. Install and start the backend

```sh
git clone https://github.com/Asche34/snagflow.git
cd snagflow
pnpm install
supabase start
supabase status -o env
```

The first start downloads service images and initializes the local database from the migrations and seed. The repository already contains Supabase configuration; no `supabase init` is needed.

For an existing local database, apply newer migrations with `supabase migration up --local`. To recreate a disposable demo database, `supabase db reset --local` reapplies migrations and seed, replacing its local data.

### 2. Configure the web app

Create `apps/web/.env.local` with the local API URL and `ANON_KEY` from `supabase status -o env`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-local-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3003
NEXT_PUBLIC_DEMO_ACCOUNTS=1
```

The demo flag displays the seeded accounts on the login page. Use it for local development. Service-role credentials belong only in trusted server/test environments, never in `NEXT_PUBLIC_*` variables. Local environment files are gitignored.

### 3. Start the web app

```sh
pnpm --filter web dev --port 3003
```

Open [SnagFlow on port 3003](http://localhost:3003). This README uses port 3003 consistently; Next.js otherwise defaults to 3000.

| Local service                 | Address                                                   |
| ----------------------------- | --------------------------------------------------------- |
| Web app                       | http://localhost:3003                                     |
| Supabase API/Auth/Storage     | http://127.0.0.1:54321                                    |
| PostgreSQL                    | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Supabase Studio, when started | http://127.0.0.1:54323                                    |

Stop the web process with Ctrl+C and the backend with `supabase stop`.

### Demo accounts

The seed creates two projects, locations, categories, and 15 snags. All five local accounts use **`Password123!`**:

| Email                   | Role    |
| ----------------------- | ------- |
| `admin@snagflow.test`   | Admin   |
| `manager@snagflow.test` | Manager |
| `member1@snagflow.test` | Member  |
| `member2@snagflow.test` | Member  |
| `viewer@snagflow.test`  | Viewer  |

These credentials are for the local seeded demo.

### Optional: containerized web app

Start Supabase first, copy `.env.example` to `.env` at the repository root, and fill in the local anon key. Then run:

```sh
docker compose up --build
```

With the supplied `.env.example` values, the web app is on port 3003. `WEB_PORT` controls the host port. The container reaches Supabase through `host.docker.internal`; the browser uses `127.0.0.1`. Stop the web container with `docker compose down`.

## Verification

Run checks from the repository root:

```sh
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter @snagflow/shared test
pnpm --filter @snagflow/db-tests test
```

Database tests require a running local stack and the following values in the ignored `supabase/tests/test.env` file:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=replace-with-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=replace-with-local-service-role-key
```

Run real-auth browser tests against the running app. In PowerShell:

```powershell
$env:E2E_BASE_URL = 'http://localhost:3003'
pnpm --filter @snagflow/e2e test
```

The browser suites use installed Google Chrome by default. For Playwright-managed Chromium, install it with `pnpm --filter @snagflow/e2e exec playwright install chromium` and set `E2E_CHANNEL=bundled`.

Verification recorded on **2026-10-29**: 37 shared unit tests, 29 real Supabase API/RLS/workflow tests, 25 SQL authorization checks, 22 real browser checks (six auth and 16 capture/workflow), and eight separate UI fixture tests passed. Eight additional ad hoc real Storage API smoke checks passed. The web production build and relevant lint/type checks passed. This is targeted verification, not a claim that all planned features or the full mobile/monorepo gate are complete.

See [testing instructions](docs/AI/TESTING.md) for SQL checks and the separate UI fixture suite, and [the security review](docs/AI/REVIEW-2026-10-29.md) for authorization findings and fixes.

## Contributing and project documentation

- [Project state](docs/AI/PROJECT-STATE.md): implemented work, remaining scope, and verification evidence.
- [Build specification](SNAGFLOW_BUILD_PROMPT.md): intended product requirements.
- [Design and implementation decisions](docs/DECISIONS.md).
- [Fieldwork UI report](docs/AI/FIELDWORK-UI-2026-10-29.md).
- [Agent instructions](AGENTS.md): start here when working on the repository with an AI coding agent.

The web app emits a standalone build and includes a Dockerfile for self-hosting. Hosted Supabase configuration, production rollout, and mobile distribution remain separate deployment work; the local verification above did not deploy a release.
