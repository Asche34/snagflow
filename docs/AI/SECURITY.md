# SECURITY

Model: zero-trust clients. Postgres is the enforcing authority.

| Layer            | Mechanism                                                                 | Source |
| ---------------- | ------------------------------------------------------------------------- | ------ |
| AuthN            | Supabase Auth (email+password now; magic link Phase 2), no public signup   | BR-AUTH-001 |
| Role claims      | `app_role` synced into JWT on profile change (auth hook trigger)           | `20261019000005_security.sql` |
| AuthZ            | RLS on every public table, policies use SECURITY DEFINER helpers           | `0005` + `0006` |
| Workflow writes  | guard trigger blocks direct writes to workflow fields; RPC-only            | `0005::guard_snag_update`, `0007` |
| Storage          | private buckets, path-membership policies                                  | `0008` |
| Admin flag       | only `profiles.is_admin` (set via seed/admin flows); never client-writable  | policies in `0006` |
| Service role key | server code only (CI/reports later); never in client bundles                | — |
| Secrets          | `.env*` gitignored; `.env.example` documents names only                    | README |

Attack-surface notes:

- All RPCs check caller identity not `auth.uid()` args passed by client.
- `public.can()` mirrors `packages/shared/src/permissions.ts` (test both sides).
- Notifications/activity are written by SECURITY DEFINER helpers only.
- After schema changes run full DB suite (`TESTING.md`) — isolation tests assert cross-project denial.

Known gaps (by design at this phase): rate limiting, audit of failed logins, CSP — revisit in Phase 7 hardening (see KNOWN-ISSUES.md).
