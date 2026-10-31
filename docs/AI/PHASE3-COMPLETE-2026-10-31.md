# Phase 3 workflow and realtime — 2026-10-31

## Delivered

- Project/dashboard snag lists and the open snag's comments/photos reconcile from authenticated Supabase Postgres Changes. Bursts coalesce for 250ms. Subscription/reconnection, foreground/online recovery and a 15-second visible-page interval re-read authoritative data without replacing mounted comment/reason drafts. Channels/listeners/timers clean up on route changes/unmount. Connection feedback distinguishes connected, reconnecting and offline states. Named authors appear in update notices when comment/photo/workflow audit data identifies them; unaudited plain edits use a generic project update notice.
- Await Realtime authentication before subscribing. The installed SDK otherwise joins before its initial token lookup finishes: real browser frames and read-only local subscription inspection demonstrated anonymous claims and correctly suppressed RLS events. Awaiting setAuth produces authenticated claims and actual comment events, verified separately from interval refresh.
- The personal bell reads the latest 30 notification rows plus an exact unread count. It supports live updates, snag links, individual/all read actions, loading/empty/read/write-error states and recovery. Its Radix dialog supports Escape/focus return, bounded scrolling and phone widths. Writes and reads use the current user session and existing per-user RLS.
- Migration 15 enables the four-table publication and adds missing comment notifications for distinct, active and still-authorized creator/assignee recipients, excluding the author. Existing assignment/transition notifications and RPCs are reused. No shared workflow/permission or row/RPC type contract changed.
- Existing manager assignment/status controls and dashboard review queue now reconcile live. Reject/reopen reasons have retained controlled drafts, required validation, pending locks, focused failure feedback and visible audit reasons. Untouched assignment selections follow remote reassignments; deliberate drafts remain with a remote-change hint. Status actions invalidate the layout so project/dashboard queues refresh after success.

## Verification

| Check | Final result |
| --- | --- |
| Real Chrome / standalone production / real local Supabase | 69 passed |
| Fieldwork fixture UI against production build | Nine passed |
| Real DB API/RLS/workflow/integrity/team/lifecycle | 49 passed |
| Shared units | 39 passed |
| Transactional SQL authorization | 25 passed, rolled back |
| Production build; configured web/shared/DB-test/E2E lint/typechecks | Passed |
| Generated local DB type equivalence; AI docs/index; whitespace and credential scan | Passed |

Total: **191 targeted checks**, not the full mobile/monorepo gate. Final full browser run:
`.superpowers/phase3-release.log` (69 passed in 4.6 minutes). Fixture run:
`.superpowers/phase3-fixture-release.log` (nine passed). Modal recovery red/green evidence:
`.superpowers/phase3-dialog-red.log` and `.superpowers/phase3-dialog-green.log`.

- Eight new real-browser cases cover actual comment WebSocket frames, two sessions, offline catch-up/draft retention, list edits, photo insertion/removal, hard/soft deletion, removed membership, live bell privacy/read state, notification read/write failures and recovery, remote assignment draft reconciliation, failed rejection focus/draft retention, phone/enlarged-text/reduced-motion layout and the reject/resubmit/approve/reopen loop with a live dashboard queue.
- Three new real DB cases cover comment recipient deduplication/self-exclusion, private notification reads/read-state writes and reassignment denial, and removed-recipient exclusion.
- Final aggregate results and evidence are recorded in PROJECT-STATE. Logs remain ignored under `.superpowers/phase3-*`; browser artifacts have distinct directories under `e2e/.playwright/`. Generated local DB types match the committed types after normalizing line endings and the generator's initial blank line.
- The fixture suite mocks its browser notification and WebSocket traffic so fake fixture tokens never reach the real backend. Its server reads still use the fixture transport; real auth/RLS/realtime behavior is tested separately against local Supabase.

## Independent review and corrections

- A fresh-context read-only reviewer found a stale uncontrolled assignment selector after remote updates, potentially reversing another manager's reassignment. The selector now derives pristine values from server props and retains intentional edits; a two-session regression passes.
- Reviewer recovery findings were corrected: online recovery clears the offline state even if the socket survives; successful reads clear read-error alerts while preserving failed-write feedback. Browser regressions cover reconnect and read/write recovery.
- The reviewer also independently diagnosed anonymous subscription claims while publication/replication were healthy. The initial-auth fix restores real authenticated event delivery. Existing RLS and the new comment trigger passed review; no unresolved material finding remains after these corrections and verification.
- The first full regression run identified an old global status locator made ambiguous by the connection live region and a new test reading DB state before reopen completed. Assertions now target the intended status and await the completed workflow; product behavior did not require changes for those failures.
- Broader regressions also caught a live refresh replacing a deleted detail beneath its response-loss recovery dialog. Workspace reconciliation now defers while a visible dialog is open and applies when the dialog closes. The existing lost-response deletion regression explicitly fires a foreground recovery signal across the coalescing window. Existing team-revocation coverage now checks live removal of unauthorized controls instead of expecting a stale form to remain mounted. A standalone restart initially omitted existing server-only invitation settings; these were restored privately and invitation regressions rerun.
- Independent review of the modal correction found no blocker. One minor remains: a refresh already in flight before a dialog opens can still resolve beneath it; the guard defers new refreshes while it is open. A delayed-RSC variant of this edge case is deferred coverage.

## Local operations and limits

- Migration `20261031000015_realtime_notifications.sql` is applied locally and recorded in the migration ledger. The local database was not reset; existing data remains. Only the local Realtime container was restarted during diagnosis. No hosted service, dependency, credential or invitation-runtime setting changed.
- The standalone production app remains at `http://127.0.0.1:3003`. Stop standalone servers before rebuilding on Windows. Native installed CLIs were reused when pnpm attempted package-manager installation; the fixture server was started with the installed Next CLI. No dependency reinstall was needed.
- Postgres Changes DELETE events do not provide normal SELECT RLS/filter guarantees. No DELETE subscription is used; removals and lost access reconcile on foreground/catch-up or within 15 visible seconds. Hidden/offline pages catch up on return. This interval also provides degraded service when a socket is unavailable; it is not an offline write queue.
- Workflow reason history follows the existing RPC: audit metadata retains its first 200 characters, while rejection notifications contain the full snippet. Plain create/edit/photo audit coverage remains separate work, so some update notices cannot name an actor. Bell history displays only the latest 30 updates; unread count and all-read operate across the user's full history.
- Prior handoff limits remain: inactive-user archive/delete dedicated regressions; three pre-existing broader shared-test import-style lint errors outside configured `eslint src`; existing global workspace caps; upload cleanup; native zoom/physical devices; full mobile/monorepo gate. These are not newly verified by Phase 3.
- Hosted migrations through 15 and invitation APP_URL/server-only key/Auth redirects/SMTP remain a separate deployment task. Follow `docs/AI/TEAM-INVITES-2026-10-30.md` before any explicitly authorized hosted deployment.

Next recommended: Phase 4 image markup, PDF/Excel reports and revisions per the build prompt.
