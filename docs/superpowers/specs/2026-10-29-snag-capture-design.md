# Snag capture design

## Intent and authority
Extend the approved Fieldwork web workspace so site members can create/edit snags with issue photos and assignees can supply fix evidence. SNAGFLOW_BUILD_PROMPT.md sections 0, 4–9 and 14 govern this work. The user delegated reasonable decisions in section 0 and asked to continue; no new product direction is requested.

## Approach
Use full create/edit pages rather than a modal: better phone space, validation and direct navigation. Reuse the existing server actions, shared Zod schemas, RLS and Fieldwork primitives. Upload resized images directly to private Storage with the caller's session rather than sending large files through Server Actions. Native inline execution minimizes repeated agent context; one independent final review follows.

## Behavior
- Project members/managers/admins get New snag; viewers get no write controls and direct URLs remain forbidden.
- New page: title, description, priority, location, category, due date; managers may assign an active project member/manager. Save and Save & add another. Stable client UUID prevents duplicate creations on retry.
- Edit page uses creator-only/member and manager/admin permissions. Assignment on existing snags uses the existing manager RPC, separately from detail updates.
- Photos can be selected during create or added on detail, with issue/fix kind. Maximum eight existing plus selected photos; JPEG/PNG/WebP input capped at 20 MiB each. Browser decodes orientation, scales longest edge to 1600, produces JPEG quality .8 and a 400px thumbnail. Capture timestamp uses file modification time, not an invented EXIF claim.
- Per-photo preparation/upload/save status and manual retry. A saved snag is retained if upload fails; the form retains the same snag/client identity and queue. No duplicate snag or metadata on retry. Completed photos stay completed.
- Server validates all mutation input, authenticates every action, checks project-local location/category/assignee references, and uses user RLS. Metadata paths must match the actual snag's project and photo UUID; original/thumbnail objects must exist before metadata insertion. A metadata failure leaves retryable objects at the same private paths, not silently lost work.
- Detail displays actual issue/fix photos through short-lived signed URLs, with descriptive accessible text and unavailable-image fallback. Existing workflow/comment actions stay functional.
- Preserve Fieldwork colors, Geist, 44px controls, mobile reflow, labels, focused error summaries and inline validation; retain values after failure. No new dependencies.

## Boundaries
No mobile/offline, markup, reports, project/team CRUD, realtime or photo deletion in this slice. No service-role key in app code. Existing database permissions and eight-photo trigger remain authoritative. New schema migration only if a reproduced integrity issue requires it.

## Acceptance
Real-browser member create with photo, creator edit, Save & add another, manager assignment, assignee fix photo/review flow, viewer/no-other-creator edit restrictions, multi-photo partial failure/retry without duplicate records, real signed image rendering, 375px keyboard/reflow and file-limit validation. Existing auth, UI, shared and database regressions must remain green.
