# Project archive and snag soft-delete implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution, then one independent final reviewer.

**Goal:** Deliver confirmed project archive and snag soft-delete controls with database authorization and refreshed navigation.

**Architecture:** Reuse project UPDATE RLS and the existing `soft_delete_snag` RPC through user-session server actions. Use a shared Fieldwork confirmation dialog. Archive is a project lifecycle label, not an authorization change: retain direct project access, offer restore, exclude archived projects from active navigation/dashboard work and expose an archived list.

**Tech Stack:** Existing Next 16, React, Radix Dialog, Supabase, Playwright and Vitest installations.

**Spec:** User request and `SNAGFLOW_BUILD_PROMPT.md` sections 4, 7, 8 and 15. Existing shared permission matrix governs manager/admin authority.

## Global constraints

- Preserve Fieldwork styling and existing permissions; database-enforced authorization.
- Reuse installed dependencies; preserve local data; no reset or hosted changes.
- Work inline from clean main `88b639a`, as requested, using installed equivalent CLIs.
- Credentials remain in ignored local files/environment; never print them.

## Review focus

- Stale role or deactivated user must fail at mutation time.
- Archive is reversible and does not delete snags or revoke membership.
- Lost responses/repeated clicks must not report an uncommitted success or duplicate deletion audit.
- Deleted detail/edit links and browser back must not reveal stale snag content.
- Dialog focus, cancel/Escape, pending/error states and phone/enlarged text must remain usable.

## Task 1: Lifecycle controls

**Files:** `apps/web/src/app/(app)/projects/actions.ts`, new `apps/web/src/app/(app)/lifecycle-actions.ts`, new `apps/web/src/components/lifecycle-control.tsx`, `project-view.tsx`, `snag-view.tsx`, `dashboard-view.tsx`, `app-sidebar.tsx`; `supabase/tests/lifecycle.test.ts`, `e2e/tests/lifecycle.spec.ts`.

**Interfaces:** Server actions `setProjectArchived(projectId: string, archived: boolean)` and `deleteSnag(snagId: string)` return `{ error?: string; destination?: string }`. Success invalidates root layout; browser replaces destination and refreshes. Confirmation receives title, description, label and action callback. No new permission rules or migration.

- [x] Add real DB regressions for manager/admin archive/restore, member/viewer/outsider denial, revoked-manager denial and audited soft deletion retaining related rows but hiding them via RLS. Dedicated inactive lifecycle checks remain deferred (review coverage minor); active-profile helpers and existing SQL checks were inspected.
- [x] Add browser regressions for cancel/confirm, role gates, archive/restore navigation and queue refresh, stale authority, delete/list refresh, unavailable detail, responsive keyboard dialog and transport recovery.
- [x] Run browser tests against baseline; expect absent archive/delete controls. Run DB tests to establish existing backend behavior.
- [x] Implement validated session-bound actions and accessible confirmations; integrate indexed views.
- [x] Verify production build and complete targeted DB/shared/browser/UI suites using installed CLIs. Final: 166 checks passed, no skipped backend checks.

## Task 2: Review and delivery

- [x] Obtain an independent review of changes from `88b639a`; fix substantive findings with failing regression tests first. One P2 recovery cache concern addressed by fresh-document navigation; its document-replacement regression failed before the fix and the full 52-browser suite passed afterward.
- [x] Update project state, feature/machine indexes, decisions and dated handoff with exact evidence and deployment limits.
- [x] Validate docs, lint/typecheck touched packages and inspect diff/secrets. Commit and main push are the authorized delivery step; final commit identity and remote verification are recorded in Git and the session result.

Pre-flight: Task 2 consumes Task 1's implementation and test evidence; no interface conflict. User has authorized routine decisions, inline implementation, independent review, commit and main push, so no additional design/plan approval is requested.

Final minor (deferred): dedicated inactive-user archive/delete regressions; database active-profile enforcement is unchanged and inspected. Final review's sole P2 is fixed; no declined substantive finding remains. Native execution used the clean installed main checkout to preserve the user's requested runner/data setup; no worktree or dependency installation.
