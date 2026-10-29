# TESTING

Quality gate: `pnpm turbo run build lint typecheck test` (all packages, cached).

| Suite | Command | Directory | Needs | What it proves |
| ----- | ------- | --------- | ----- | -------------- |
| Shared units | `pnpm --filter @snagflow/shared test` | `packages/shared/tests` | node | permission matrix, transition map behavior (37 tests) |
| DB suites | `pnpm --filter @snagflow/db-tests test` | `supabase/tests` (rls_isolation, rls_write, workflow, integrity) | running stack + env | RLS rules, workflow RPCs, constraints (29 tests) |
| Type gen | `pnpm db:gen-types` | → `packages/shared/src/db-types.ts` | running stack | types match schema |
| Web E2E | `pnpm --filter @snagflow/e2e test` | `e2e/tests/auth.spec.ts`, `e2e/tests/snags.spec.ts` | real Supabase + running web app + Chrome/Chromium | auth/visibility plus real capture, edit, assignment, private image, workflow, retry, permission and hydration checks |
| UI-only browser checks | `pnpm --filter @snagflow/e2e test:ui` | `e2e/tests/fieldwork.spec.ts` | locked web deps + Chrome (or `E2E_CHANNEL=bundled`) | actual app presentation/navigation using loopback fixture responses; not server authorization |

## Running DB tests locally

SQL authorization regressions run independently of the API suites against a
migrated local database. They create their own fixtures and roll them back:

```powershell
psql.exe '-X' '--set=ON_ERROR_STOP=1' '--dbname=postgresql://postgres:postgres@127.0.0.1:54322/postgres' '--file=supabase/tests/sql/authorization.sql'
```

CI runs this SQL suite in the database job. The API suite refuses to skip when
`CI` is set and its required credentials are absent. Local API tests still skip
when the stack credentials are missing; skipped tests are not verified passes.


1. Docker Desktop running; fresh shells need:
   `$env:Path = "C:\Program Files\Docker\Docker\resources\bin;" + $env:Path`
2. `supabase start` (first time) / `supabase.cmd db reset` (fresh migrations+seed)
3. Copy the three values from `supabase.cmd status` into `supabase/tests/test.env`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

`test.env` is gitignored. Tests `skipIf` env is missing (loud skip ≠ pass).
CI runs the DB suite automatically with its own local stack.

The verified Windows workspace now has ignored `apps/web/.env.local` and
`supabase/tests/test.env` configured for the real local backend. The official
CLI 2.122.0 binary is cached at `.superpowers/tools/supabase/package/bin/supabase.exe`.
Its local startup used `SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io` and
`start -x studio,postgres-meta,imgproxy,edge-runtime,logflare,vector,supavisor`
after ECR rate limits and stalled Docker pulls. Docker access requires an
unrestricted shell on this workstation. No hosted credentials are involved.

## Matrix

| Module / area | Tests |
| ------------- | ----- |
| permissions (MOD-SHARED) | `packages/shared/tests/permissions.test.ts` |
| workflow map (MOD-SHARED) | `packages/shared/tests/workflow.test.ts` |
| RLS isolation | `supabase/tests/rls_isolation.test.ts` |
| RLS writes / guard | `supabase/tests/rls_write.test.ts` |
| project create/edit authority | `supabase/tests/projects.test.ts` |
| workflow RPCs | `supabase/tests/workflow.test.ts` |
| numbering / photo cap / idempotency | `supabase/tests/integrity.test.ts` |
| web | production build/typecheck plus separate real-auth and UI-only Playwright suites |
| web project creation/editing | `e2e/tests/projects.spec.ts` (real backend, disposable project fixtures) |
| mobile | typecheck (Expo scaffold; later phase) |

## Capture browser fixtures

`e2e/tests/snags.spec.ts` uses the real app and backend. Fixture setup reads local
`supabase/tests/test.env` (or the CI-generated root `supabase.env`) and creates its
own project with seeded role users. Cleanup removes its Storage objects and
cascades its relational fixtures; service credentials are confined to the test
process. Browser mutations use the signed-in user's cookies and RLS.

The suite exercises private image bytes/dimensions, upload and committed-response
failures, membership loss, foreign-project references, delayed-JavaScript input
readiness, and an edit target beyond 1,000 visible snags. Its large-list fixture
is isolated and deleted at the end. Do not run two Playwright commands using the
same output directory concurrently. Run the real web suite before the separate
UI fixture suite. Stop a running standalone server before rebuilding on Windows
if it holds the standalone output directory open.
