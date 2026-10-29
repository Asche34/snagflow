# Project Details Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans, native execution and one independent final review.

**Goal:** Admin project creation and authorized project detail/settings editing.
**Architecture:** Shared-schema validated user-session Server Action, direct project lookup,
shared client form with stable create identity and Fieldwork page wrapper. Existing DB RLS.
**Tech Stack:** Next 16, TypeScript strict, Zod, Supabase, native Fieldwork controls, Playwright/Vitest.
**Spec:** `docs/superpowers/specs/2026-10-29-project-details-design.md`

## Constraints and review focus

- No dependency, schema or permission change; admin creates and managers edit their own project.
- Access revocation between load/save must reject the write without losing the draft.
- Duplicate codes must not mutate the other project; uncertain create retries must not duplicate.
- Hidden retained pages must not collide with form labels/IDs; no pre-hydration data entry.
- Edit lookup and authorization must not depend on capped workspace payloads.

## Task 1: Create/edit pages and mutation

Files: create `e2e/tests/projects.spec.ts`, `supabase/tests/projects.test.ts`,
`apps/web/src/app/(app)/projects/actions.ts`, project new/edit page routes,
`apps/web/src/components/project-form.tsx`, `project-form-page.tsx`.
Modify project-view, dashboard-view and workspace-navigation for authorized entry points.

Interfaces: `saveProject(input: unknown): Promise<SaveProjectResult>` accepting full
ProjectCreateSchema fields, stable `clientId` for creates or `projectId` for edits;
returns projectId/error/fieldErrors. Wrapper loads project/profile/membership directly.

- [x] Add disposable browser fixtures/tests and real project RLS tests; run baseline RED.
- [x] Implement action, form and route wrappers with existing shared schema and UI controls.
- [x] Add entry points, revalidate layout on successful save, verify tests GREEN.

## Task 2: Verify and deliver

- [x] Verify retry changes, duplicate-code safety, revoked access, role gates and responsive
  form; run complete real browser/shared/DB/Fieldwork suites and touched-package quality gates.
- [x] Request independent final review and fix important findings with reproductions.
- [x] Update state, feature/route/test indexes, decisions and delivery report; final integration is commit/push main
  and verify remote SHA.

## Ledger

- Clean baseline main `504e7d6`; reuse installed checkout per existing workflow.
- Native PowerShell ledger and installed CLIs; RTK compact supported checks. Python search
  runtime unavailable in this environment; UI/UX bundled form rules used as fallback.
- Pre-flight: Task 2 consumes Task 1's action and routes; no interface conflict.
- Ruling: no archive/team UI in this slice; existing project list remains dashboard/sidebar.
- Ruling: spec §4/shared matrix/executed RLS retain project manager editing despite §8's admin shorthand; no permission change.
- Task 1: missing New project entry point RED; seven new browser cases GREEN. New DB authority checks 3/3 pass.
- Task 2: complete production browser suite 37/37, Fieldwork fixture suite 8/8, DB 32/32, SQL25/25, shared37/37; production build and touched package checks pass. Documentation/whitespace validated at delivery.
- Final review: project_review fresh read-only agent; no critical/important findings.
- Final: minor (deferred): inactive/revoked-admin save regressions; active/current-role logic inspected.
- Final: minor (deferred): changed-code uncertain-create regression; UUID lookup inspected and changed-name retry passes.
- Final: minor (deferred): dedicated delayed-hydration and capped edit-lookup cases; disabled fields/direct reads inspected.
