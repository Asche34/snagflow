# Project team and invitations — 2026-10-30

## Delivered

- Project Team tab: manager/admin exact-email add of an active confirmed account, project
  role changes, confirmed removal, and explicit confirmation before changing one's own role.
  Members/viewers retain a read-only roster. Self-removal is allowed; org admins retain
  implicit recovery access to every project.
- Active admins send new-account invitations by email, following spec §4/§7 and existing
  `org:manage-users`. Managers manage existing accounts and can cancel their project invites;
  §8's invitation shorthand does not expand org account-creation authority.
- Pending email/role/expiry list, creator-admin retry and manager/admin cancellation. Stable
  invitation UUIDs reuse pending preparation without silently changing email/role/creator.
  Duplicate pending invitations and existing confirmed accounts receive actionable errors.
- Public `/invite/[token]` handles the default Supabase email session callback, removes session
  fragments from the URL, validates the confirmed recipient email, and collects name/password.
  SQL atomically inserts project membership and consumes the app invite. Expired/canceled/
  wrong-user/no-longer-authorized invites grant no access. Accepted replay never overwrites
  a changed role or restores removed membership.
- If the Auth link was consumed but the browser session was lost before setup, Retry send
  sends a recovery link back to the same pending app invite. The recipient can then set a
  password and join without requiring the consumed original link or creating another account.
- Migration 13 adds six narrowly scoped authenticated RPCs. Existing RLS/permission matrix
  remains authoritative. Member add resolves canonical confirmed Auth email without exposing
  a global profile directory. All nullable manager permission checks explicitly deny NULL.
- Server-only service credentials are used solely for the privileged Auth email operation.
  Team props select non-secret invite metadata explicitly. API CSRF compares Origin with the
  configured public APP_URL, rather than a standalone/reverse-proxy internal request URL.

Fieldwork native controls, visible labels, hydration gating, pending feedback, error focus and
responsive layout are preserved. Denied team edits retain their draft rather than refreshing
away the form; partial delivery errors still refresh pending invitation metadata.

## Verification

| Check | Result |
| --- | --- |
| Real Chrome / standalone production app / real local Supabase | 46 passed (nine new team/invite cases) |
| Fieldwork fixture UI suite | Eight passed |
| Shared units | 39 passed (two new contract cases) |
| Real database API/RLS/workflow/integrity/team lifecycle | 38 passed (six new team cases) |
| Transactional SQL authorization assertions | 25 passed |
| Web production build; web/shared/DB-test/E2E lint and typecheck | Passed |
| Shared declaration build and Docker compose interpolation validation | Passed |
| Browser service-key literal scan | Zero matches across 22 JavaScript files |

These 156 checks are targeted verification, not the full mobile/monorepo gate. Local Mailpit
on port 54324 captured real Auth invite/recovery emails. Browser tests followed those actual
links, established the recipient session, chose a password, joined as viewer, signed out and
signed in with the new password. No real external recipient was contacted. Disposable project
and Auth-user fixtures are cleaned; the DB acceptance test preserves the seeded profile name.

New regressions demonstrate role/foreign-project denial, canonical-email add, duplicate
membership safety, role changes/removal, pending preparation/retry/cancellation, confirmed
email binding, expiry/inviter authority and accepted replay after role change/removal. Browser
cases additionally cover live-role revocation with draft retention after RSC settlement,
consumed-link/session-loss recovery, self-role confirmation, direct public-signup rejection,
and 375px/1440px/enlarged-phone-text reflow. Final screenshots were inspected. Native zoom,
physical devices, hosted SMTP delivery and a production Docker image run were not established.

Logs/screenshots remain ignored in `.superpowers/team-*.log`, `e2e/test-results/` and
`e2e/.playwright/team-ui-final/`. No credentials or captured email URLs are committed.

## Test-first findings and independent review

- DB baseline lacked the new RPCs. Initial implementation then failed the non-member test:
  `can()` can return NULL, and `IF NOT NULL` does not deny. Coalescing nullable permission
  results to false fixed the new RPCs. Existing RLS was not bypassed by this finding.
- Browser baseline lacked Team management controls; shared baseline lacked the new schemas.
- Local email-provider configuration initially disabled password login. Retained email login
  (`auth.email.enable_signup=true`) while `auth.enable_signup=false` blocks public registration.
  Direct Auth signup now proves rejection; login/invite tests prove email authentication works.
- Standalone internal request origin differed from the public browser origin. Using trusted
  APP_URL for CSRF fixed real same-origin invitation delivery; arbitrary origins remain denied.
- Fresh independent review found a recovery gap after a consumed Auth link/session loss.
  A real-browser test failed at resend (`email_exists` from Auth), then passed after the
  same-pending-invite recovery-email fallback. Self-role confirmation also failed before
  implementation and passes afterward. No critical authorization bypass remained.
- A strengthened revocation test exposed a post-error refresh erasing the draft; restricting
  refresh to success/partial delivery made it pass after network settlement. The raw signup
  response uses numeric `code` plus string `error_code`; corrected the test's field selection.

Deferred review coverage minors: dedicated delivery-failure retry and lost accepted-response
browser cases, self-removal and expired-token browser cases. SQL covers cancellation/expiry,
role/removal authority and idempotent consumed-token behavior. Prior feature internals and
existing workspace metadata limits were outside this review.

## Deployment and limits

1. Apply all pending migrations through `20261029000013_team_invitations.sql` before deploying
   this web build. Migration 13 was applied locally and generated types refreshed. No hosted
   schema or Auth configuration was changed.
2. Supply `SUPABASE_SERVICE_ROLE_KEY` only to the server runtime, and set `APP_URL` to the
   canonical browser origin (HTTPS in hosted environments). Do not use a service key as a
   build argument or `NEXT_PUBLIC_*` value. Compose passes the runtime key and derives its
   default APP_URL from WEB_PORT; CI supplies the local key and canonical URL to its server.
3. Enable the email/password provider, disable public signup, and allow `${APP_URL}/invite/**`
   in Supabase Auth redirects. Local config permits the existing development/CI ports 3003
   and 3000. Configure hosted email delivery/SMTP for the intended recipients.
4. Keep the standard ConfirmationURL-based invite/recovery templates, or preserve the same
   implicit session callback semantics. The acceptance client consumes fragment sessions;
   arbitrary custom `token_hash`-only templates need a corresponding confirmation handler.
   Reference: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
   and [inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail).

Auth email tokens have their own validity period; the app invite lasts seven days. Expired app
invitations can be canceled/replaced. Password setup and membership acceptance span Auth and
Postgres; cancellation during setup can leave an account/password without project membership.
Canceling a pending project invitation does not delete the Auth account. Org user deactivation,
abandoned invited-account cleanup and team/invite audit events remain later work. Pending
delivery failures are reported as unconfirmed and can be retried subject to Auth/provider limits.

Execution reused main `cd0a3b5`, existing installed dependencies and native PowerShell/RTK
with Superpowers TDD and one fresh final reviewer. UI/UX Pro Max bundled form guidance was
used because the Python search runtime is unavailable. Local stack restart preserved data.
Final local standalone application remains available on `http://127.0.0.1:3003`.

Next: project archive and snag soft-delete controls, then location/category editing.
