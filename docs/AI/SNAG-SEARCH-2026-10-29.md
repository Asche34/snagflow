# Project snag filters/search — 2026-10-29

## Delivered

- Fieldwork GET filter form: status, priority, assignee (person/me/unassigned), exact
  location, category, due preset and created by me. Filters combine with AND.
- English web-style full-text search across combined title/description, including
  stemming and words split across both fields. Bare numbers and #numbers select the
  exact project snag number. Search operands never enter raw PostgREST filter grammar.
- Number ascending/descending, highest priority, soonest due (null last), recently
  created; deterministic project number tie-breakers. Fifty-row server pages with exact
  result counts, previous/next links and stale-page clamping.
- URLs retain filters through project sections, refresh and browser history. Apply
  starts at page one; Clear resets filters and sort. Malformed/repeated scalar values
  normalize safely; unavailable valid option IDs constrain results rather than widening them.
- Whole-project exact statistics independent of filtering and the 1,000-row workspace cap.
  Explicit failed-query text is separate from successful zero matches.
- Migration 12: generated `snags.search_document` English tsvector plus GIN index;
  generated shared types refreshed. Existing RLS/authorization contracts remain unchanged.

## Verification

| Check | Result |
| --- | --- |
| Production standalone app, real Chrome and Supabase | 30 passed: six auth, eight filters/search, sixteen capture/workflow |
| Existing Fieldwork fixture browser suite | Eight passed |
| Shared units | 37 passed |
| Real Supabase API/RLS/workflow/integrity | 29 passed |
| Transactional SQL authorization assertions | 25 passed |
| Production web build | Passed |
| Web/shared/E2E/DB-test package lint and type checks | Passed |
| Shared declaration build | Passed |

The 129 checks are targeted verification, not the full mobile/monorepo gate. New real
browser cases cover combined filters, cross-field search, stemming, numbers, punctuation,
date boundaries and closed exclusions, status/assignee/unavailable options, pagination,
malformed/repeated status parameters, URL restore, RLS, phone/enlarged-text reflow and
search beyond 1,000 rows. The large-project case asserts the exact 1,058-row project count
while displaying one filtered result. Fixtures are disposable and cleaned after the suite.

The initial browser regression failed on the absent search control before implementation.
The first complete regression run exposed hidden-page locator collisions in the existing
capture test: Next retains the project filter controls hidden when opening capture. Scoped
that test to accessible/visible capture controls, then all 30 browser tests passed against
the final standalone production build. No capture implementation changed.

Inspected final 375px and 1440px screenshots; enlarged phone text and focused-control
clearance pass. Screenshots/logs remain ignored under `e2e/test-results/`,
`e2e/.playwright/search-ui-results/` and `.superpowers/search-*.log`.
Native zoom and physical-device testing were not established.

Package-defined shared lint (`eslint src`) passes. An extra broader `eslint .` invocation
also inspected pre-existing test code and reported three type-import style violations in
`packages/shared/tests/permissions.test.ts`; that file was left outside this feature's scope.

## Independent review and limits

A fresh read-only reviewer examined the scoped implementation, migration, types, design,
plan and tests. No critical or important issue found. Deferred minors:

- Capture one request-time clock value for count and row queries. A request straddling
  server midnight can currently count one due-date window and fetch the next window.
- Add explicit repeated-UUID and backend-query-failure rendering regressions. These paths
  were reviewed by inspection; current automated checks cover repeated statuses and
  malformed UUIDs, plus empty-result rendering.

Search is English full-text, not substring/fuzzy search. Due presets use the existing web
server calendar convention; upcoming includes today through seven calendar days ahead.
Location filtering is exact, not recursive. Global metadata limits outside this project
snag query, project/team management, soft-delete controls, bulk actions, saved-filter
entities, Realtime and later phases remain separate work.

## Execution and deployment

- Continued from `6072b8f` on main in the installed checkout as requested; routine scope
  and implementation decisions were made autonomously. Native PowerShell ledger replaced
  Bash task scripts on Windows. No worktree or dependency installation was needed.
- RTK wrapped compact checks. Where it retained only a failure tail, direct installed
  CLIs plus ignored full logs supplied diagnostics. The current pnpm command runner tried
  an unsolicited dependency reinstall; installed equivalent binaries were used instead.
- Applied migration 12 only to local Supabase and regenerated types there (also restoring
  the previously omitted existing `shares_project_with_me` generated function signature).
  Hosted migration/application deployment was not performed: apply migration 12 before
  deploying this web build to a hosted backend.
- Refreshed state, feature/database indexes, manifest and machine index. The local app
  runs from the final standalone bundle on `http://127.0.0.1:3003`.
