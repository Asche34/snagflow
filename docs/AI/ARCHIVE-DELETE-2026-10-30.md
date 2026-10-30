# Project archive and snag soft-delete — 2026-10-30

## Delivered

- Project managers/admins can archive and restore from the project workspace. Confirmation
  names the project and explains the consequences. Archived projects disappear from active
  sidebar links, dashboard counts and work queues; dashboard Archived projects retains discovery.
  Direct project/snags access, team membership and existing editing/workflow rights are retained.
  Archive is a lifecycle label, not a database-enforced read-only state.
- Project managers/admins can confirm Delete snag from the detail Actions card. The existing
  RPC locks the row, checks current active authority, stamps deleted_at and appends one audit.
  Lists, counts, detail/edit routes and related comment/photo reads obey existing RLS. History
  and stored photos are retained; the app has no restore or permanent-delete control.
- Mutations use the user's session, UUID validation and explicit allowlists. Archive changes
  only status; delete derives its navigation project from the visible snag. Zero affected project
  rows are an error. Missing/deleted/inaccessible snags never imply confirmed deletion.
- Confirmations use existing Fieldwork tokens, Radix focus trapping, initial Cancel focus,
  keyboard cancellation, hydration/pending gating, duplicate-submit locking and focused errors.
  Success invalidates the root layout and replaces the route with a refreshed destination.
  An ambiguous delete result offers a fresh-document Return to project link, clearing any
  client route cache that missed a committed response's invalidation headers.

## Verification

| Check | Final result |
| --- | --- |
| Real Chrome / standalone production / real local Supabase | 52 passed (six new lifecycle cases) |
| Fieldwork fixture UI suite against final production build | Eight passed |
| Real DB API/RLS/workflow/integrity/team/lifecycle suite | 42 passed (four new lifecycle cases) |
| Shared units | 39 passed |
| Transactional SQL authorization assertions | 25 passed, transaction rolled back |
| Web production build; web/shared/DB-test/E2E lint and typecheck | Passed |
| Shared declaration build; AI docs/index validation; diff whitespace | Passed |

These 166 checks are targeted verification, not the full mobile/monorepo gate.
Final logs: `.superpowers/lifecycle-all-final.log`, `.superpowers/lifecycle-ui-final.log`,
`.superpowers/lifecycle-build-final.log` and `.superpowers/lifecycle-authorization.log`.

- New DB lifecycle cases exercise member/viewer/outsider denial, manager archive/admin restore
  without record/access loss, revoked-manager denial and audited soft deletion retaining comments
  while hiding snag/comment rows even from the admin caller.
- New real Chrome cases exercise cancel/Escape/initial focus, archive/restore navigation and
  review-queue refresh, member/viewer controls, stale-role archive/delete failure, deletion/list
  refresh and unavailable routes, phone/enlarged text, transport retry and lost committed response.
- Post-commit response loss is simulated by forwarding the real Server Action, awaiting its
  response and then aborting delivery. Retry reports the ambiguity; recovery loads a new document,
  the project list stays fresh, browser Back does not expose the deleted detail and audit count is one.
- Screenshots at 1440px and enlarged-text 375px were inspected. Logs remain ignored under
  `.superpowers/`; screenshots and Playwright artifacts remain under `e2e/.playwright/`.

## Test-first and independent review

- Baseline browser archive case failed on the absent Archive project control. Four real DB cases
  passed before UI implementation, establishing that existing authorization already met the contract.
- Independent read-only review found one P2 recovery concern: after a committed response was lost,
  a client Link could retain a cache that missed invalidation. Ordinary recovery and Back assertions
  passed with current Next defaults; the explicit document-replacement regression failed before
  replacing the client Link with a fresh document link. The final run verifies that change.
- Initial full-suite runs overlapped Playwright artifact directories, producing two ENOENT trace
  teardown failures (due-date filters and phone lifecycle case). Final runs use separate output
  directories. The fixture UI config's pnpm runner also could not start; a hidden standalone app
  on port 3005 reused the installed build and allowed the existing fixture suite to run.
- Deferred review minor: dedicated inactive-user archive/delete cases. The inactive-profile DB
  helpers were inspected; existing transactional SQL asserts inactive read/assignment denial,
  and new lifecycle DB/browser cases assert live-role revocation. No authority rule was changed.
- UI/UX Pro Max built-in confirmation, destructive emphasis, touch and focus guidance was used.
  The Python search runtime is unavailable; this is reference guidance, not a claimed database match.

## Deployment and handoff

- No migration, dependency, generated DB-type or credential change. Local Supabase remains on
  migration 13, with data preserved; no reset, hosted mutation or external email delivery occurred.
- Hosted migrations and invitation APP_URL/service-key/redirect/SMTP settings remain pending;
  follow `TEAM-INVITES-2026-10-30.md` before deployment. This feature adds no runtime setting.
- Local standalone production app remains at `http://127.0.0.1:3003`.
- Native zoom/physical devices, hosted behavior and full mobile/monorepo gate are not established.
  Existing global workspace metadata limits remain outside this slice.
- Next: project location/category editing, then remaining comment polish.
