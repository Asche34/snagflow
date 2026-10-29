# Web snag capture — 2026-10-29

## Delivered

- Project New snag route: `/projects/[projectId]/snags/new`.
- Authorized edit route: `/snags/[snagId]/edit`, fetching its target directly under RLS.
- Title/description, priority, due date and project-local location/category controls; manager-only initial assignment and existing-snag reassignment/unassignment through the RPC.
- Save & add another; focused/linked field errors; typed values retained after failures; route-specific IDs and controls gated until hydration.
- Private issue/fix uploads with eight-photo selection limits, browser orientation/aspect preservation, 1600px JPEG output, 400px thumbnails, per-photo stages and manual retry. Timestamp is file modification time, not extracted EXIF.
- Real signed image gallery and a fix-evidence path through manager review/approval.
- Stable snag/photo identities reconcile interrupted responses in the current page without duplicate records. A retry of a committed create applies revised authorized details and manager assignment.

No dependency or database migration was added. Database RLS, guard triggers, workflow RPCs and the concurrent eight-photo cap remain authoritative. App mutations use the caller's session; service-role credentials are confined to disposable test fixtures.

## Verification

| Check | Result |
| --- | --- |
| Shared units | 37 passed |
| Real Supabase API/RLS/workflow/integrity | 29 passed |
| Transactional SQL authorization assertions | 25 passed |
| Production web browser tests | 22 passed: 6 auth + 16 capture/workflow |
| Existing Fieldwork fixture UI browser tests | 8 passed |
| Web production build | Passed against real local Supabase |
| Web/shared/DB-test/E2E lint and type checks | Passed |
| AI docs and Git whitespace checks | Passed |

The 121 automated checks above are targeted verification; the full mobile/monorepo gate was not rerun. Browser tests clean their own project and Storage objects; integrity tests now clean their dedicated project too.

Real browser regressions demonstrate foreign-project option rejection, revoked access after form load, stable retry after interrupted Storage and committed metadata responses, safe pre-hydration input behavior, preservation of changed drafts after lost create responses, and direct edit past the 1,000-row global workspace response cap. Core features were watched fail before implementation. Shared photo-contract cases failed before the schema was added.

Desktop (1440px), phone (375px) and enlarged-text production screenshots were inspected. The focused save button was checked clear of the fixed phone navigation. Screenshots remain in ignored `.superpowers/snag-capture-final/`. Native browser zoom and physical-device testing were not established.

## Independent review

The independent reviewer found two important issues: changed draft details discarded after a committed create response was lost, and editing an item omitted by the global 1,000-row workspace result. Both were reproduced with failing real-browser tests and fixed in one pass. The final whole web suite passed, including member and manager retry cases. The manager case also verifies revised assignment.

Deferred minor: if signing succeeds but the browser's subsequent thumbnail request fails, the browser currently presents a failed image; refreshing retries it. The existing unavailable-photo text covers signing/object-unavailable failures. A client image fallback is a later polish task.

## Decisions and limits

- Continued in the installed checkout on a dedicated feature branch, following the user's existing delegation and integration preference. This avoids duplicate dependency setup; it does not isolate concurrent edits to the same checkout.
- Executed natively with one independent final review to limit repeated context. PowerShell maintains the plan ledger because the bundled Bash helpers do not run reliably in this sandbox.
- Kept photo registration validation in `packages/shared` so future clients can reuse the contract. Extended the plan file list accordingly.
- Retained deterministic private object paths on metadata failure for retry. Abandoned-upload garbage collection is still needed; unfinished file queues are memory-only and do not survive reload.
- Non-workflow create/edit/photo audit events remain future work. Assignment and status transitions retain their existing audit trail.
- Remaining Phase 2 work includes rich filters/search, soft-delete controls, project/team management and invitations. Realtime, markup, reports, mobile/offline and push are later work.
