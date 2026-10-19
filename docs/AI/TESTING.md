# TESTING

Quality gate: `pnpm turbo run build lint typecheck test` (all packages, cached).

| Suite | Command | Directory | Needs | What it proves |
| ----- | ------- | --------- | ----- | -------------- |
| Shared units | `pnpm --filter @snagflow/shared test` | `packages/shared/tests` | node | permission matrix, transition map behavior (26 tests) |
| DB suites | `pnpm --filter @snagflow/db-tests test` | `supabase/tests` (rls_isolation, rls_write, workflow, integrity) | running stack + env | RLS rules, workflow RPCs, constraints (28 tests) |
| Type gen | `pnpm db:gen-types` | → `packages/shared/src/db-types.ts` | running stack | types match schema |
| E2E (Playwright) | — | — | — | planned Phase 7 |

## Running DB tests locally

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

## Matrix

| Module / area | Tests |
| ------------- | ----- |
| permissions (MOD-SHARED) | `packages/shared/tests/permissions.test.ts` |
| workflow map (MOD-SHARED) | `packages/shared/tests/workflow.test.ts` |
| RLS isolation | `supabase/tests/rls_isolation.test.ts` |
| RLS writes / guard | `supabase/tests/rls_write.test.ts` |
| workflow RPCs | `supabase/tests/workflow.test.ts` |
| numbering / photo cap / idempotency | `supabase/tests/integrity.test.ts` |
| web/mobile | turbo build/typecheck (apps, current placeholders) — Playwright Phase 7 |
