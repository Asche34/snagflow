# Project creation/editing — 2026-10-29

## Delivered

- `/projects/new`: active admins create a project with name, unique code, description,
  client name, address and require-fix-photo setting. Entry points in the dashboard's
  project card and desktop/phone project navigation; works without existing memberships.
- `/projects/[projectId]/edit`: active project managers/admins edit those details.
  Edit project appears on authorized project pages. Target/profile/membership are loaded
  directly under RLS rather than found in a capped workspace list.
- Existing shared ProjectCreateSchema validates and trims inputs. Server Action rechecks
  the active profile/current role for each save, uses an explicit field allowlist and the
  caller's Supabase session. Existing RLS remains authoritative; no service key in app code.
- Stable create UUID reconciles uncertain committed responses. Retry applies revised details
  to the same creator's project while still requiring admin creation authority. Duplicate
  codes report inline/linked errors without selecting or overwriting another project by code.
- Fieldwork forms retain drafts on errors, focus error summaries, use route-specific IDs,
  wait for hydration and disable inputs while saving. Successful saves invalidate the root
  layout so names and project links refresh across navigation and the dashboard.

No dependency, migration, database type or shared permission/schema change was required.
The §4 role matrix and executed RLS govern manager editing; §8's admin shorthand was not
used to remove existing manager rights. Archive, team membership, invitations, cover images
and deletion remain separate slices.

## Verification

| Check | Result |
| --- | --- |
| Standalone production app / real Chrome / real Supabase | 37 passed: six auth, eight filters, seven project details, sixteen capture/workflow |
| Existing Fieldwork fixture browser suite | Eight passed |
| Shared units | 37 passed |
| Real DB API/RLS/workflow/integrity/project authority | 32 passed (three new project checks) |
| Transactional SQL authorization assertions | 25 passed |
| Web production build, web/E2E/DB-test lint and typecheck | Passed |

The 139 automated checks are targeted verification; the full mobile/monorepo gate was not
rerun. New browser cases cover admin creation and navigation refresh, manager editing and
fix-photo setting persistence, member/viewer/manager creation denial, edit denial, invalid
code and duplicate-code draft retention, focus, manager-role revocation after form load,
lost committed create response with revised name, and phone/enlarged-text layout.
DB tests verify admin creation, manager edits, member/viewer denial and unrelated-manager
isolation through real user sessions. Service credentials only prepare/clean test fixtures.

Baseline browser test failed at the missing New project entry point before implementation.
The first seven-case run exposed two test selector collisions with Next's own route-announcer
alert. Scoping assertions to the named project form resolved them; the complete 37-case
real-backend suite then passed against the production standalone bundle. A strict TS check
also caught array-destructuring uncertainty in the new DB test; explicit Promise tuple inputs
resolved it. No product workaround was needed for either test issue.

Inspected final 375px/1440px form screenshots. Tests establish no page overflow at those
widths or enlarged phone text, and focused save controls clear the fixed phone navigation.
Screenshots remain ignored under `e2e/test-results/`; UI regression output is under
`e2e/.playwright/projects-ui-results/`. Full logs: `.superpowers/projects-*.log` and
`.superpowers/project-build.log`. Native zoom/physical-device behavior was not established.

## Independent review and deferred coverage

Fresh read-only reviewer found no critical or important defect. Deferred minor assertions:

- Profile deactivation and revoked admin-create authority after form load (manager-to-viewer
  revocation is covered; active/current-role checks were inspected).
- Changed project code after a lost create response (revised-name reconciliation is covered;
  UUID-based lookup and update were inspected).
- Dedicated delayed-hydration and beyond-workspace-cap edit-lookup regressions (disabled
  fieldset and direct UUID query were inspected).

Archive/team/invitations, existing global metadata caps and previous filter/capture internals
were outside the review scope. Existing global lists retain their known workspace limits;
this change does not claim a new uncapped project directory.

## Execution and next step

Continued from `504e7d6` on main in the installed checkout under the user's routine-autonomy
and commit/push preference. Used Superpowers planning/TDD/native execution/final review and
UI/UX Pro Max bundled form/accessibility guidance (Python search runtime unavailable).
PowerShell ledger replaces Bash helpers; RTK wraps compact supported checks and installed
CLIs avoid the existing pnpm unsolicited dependency-reinstall behavior.

Refreshed state, feature/route/test indexes, manifest, decisions and README capability claims.
ROUTE-INDEX's obsolete placeholder-only description was corrected using known machine route
pointers. No hosted backend or deployment was changed. Migration 12 from the prior search
delivery still needs applying before hosted deployment. Final local production app runs on
`http://127.0.0.1:3003`.

Next: team membership/role controls and invitations, followed by archive/soft-delete controls.
