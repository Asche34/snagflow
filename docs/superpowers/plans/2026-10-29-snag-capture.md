# Snag capture implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver authenticated web snag creation/editing, assignment and private issue/fix photos.
**Architecture:** Full-page forms use typed server actions with shared Zod/RLS; a browser photo queue processes and uploads files directly to private Storage. Server actions register verified photo objects; server-rendered galleries sign paths.
**Tech Stack:** Existing Next.js 16, React 19, Supabase SSR, Zod, Tailwind/Radix and Playwright; no added dependencies.
**Spec:** docs/superpowers/specs/2026-10-29-snag-capture-design.md

## Global constraints
Use Fieldwork design and existing strict TypeScript. No service-role app access. Eight photos per snag; input JPEG/PNG/WebP <=20 MiB, 1600px original/400px thumbnail JPEG quality .8. Every mutation authenticates and validates. Retain partial work and stable identity on retry.

## Review focus
- Foreign project IDs must not attach location/category/assignee or mismatched storage paths.
- Network failures after snag/object/metadata persistence must not duplicate records.
- Lost membership between page load and save must reject writes.
- Selected photos plus existing photos must not exceed eight, including concurrent sessions.
- Phone layouts, enlarged text and keyboard error handling must stay usable.

### Task 1: Create/edit and assignment
**Files:** create apps/web/src/app/(app)/snags/actions.ts, components/snag-form.tsx, components/snag-form-page.tsx, projects/[projectId]/snags/new/page.tsx, snags/[snagId]/edit/page.tsx, components/snag-assignment.tsx; modify project-view.tsx and snag-view.tsx. Tests: e2e/tests/snags.spec.ts.
**Interfaces:** saveSnag(input: unknown): Promise<{snagId?: string; error?: string; fieldErrors?: Record<string,string[]>}>; assignSnag(previousState, FormData) returns ActionState. Form page supplies project-scoped options and server-authorized initial Snag.
- [ ] Write real browser create/edit/another/assignment/viewer tests; run against old app to observe missing controls.
- [ ] Implement typed shared-schema actions, authenticated project/reference checks and idempotent creation; full-page accessible form with inline errors.
- [ ] Wire authorized project New snag and detail Edit/assignment; preserve existing routes.
- [ ] Run new browser tests and web lint/typecheck; commit deliverable.

### Task 2: Photo queue and gallery
**Files:** create lib/supabase/browser.ts, lib/photos.ts, components/photo-picker.tsx, components/snag-photos.tsx; extend snags/actions.ts and snag-form.tsx; modify snag-view.tsx. Tests: extend e2e/tests/snags.spec.ts.
**Interfaces:** preparePhoto(file: File) produces original/thumbnail Blob, dimensions and timestamp; uploadSnagPhoto(projectId,snagId,item,onStatus) returns result with stable item UUID. registerSnagPhoto(input: unknown) authenticates, verifies matching object paths/existence and inserts idempotently. PhotoPicker exposes queue through controlled props and retains statuses/errors for retry.
- [ ] Write real-browser create-with-photo, fix-photo/review, partial upload retry, invalid type/count and real image checks; observe failure first.
- [ ] Implement browser image processing, direct authenticated uploads with deterministic original/thumb paths, per-photo state, manual retry, existing+queued cap and idempotent metadata action.
- [ ] Add signed image gallery and issue/fix uploader on detail. Integrate queue with create form without resetting partial success.
- [ ] Run full capture E2E and existing auth/UI suites plus web lint/typecheck/build; commit.

### Task 3: Verification and delivery
**Files:** update README.md, docs/AI/PROJECT-STATE.md, FEATURE-INDEX.md, TESTING.md, docs/DECISIONS.md and generated indexes as needed.
- [ ] Run shared and real DB suites, SQL25, capture/auth browser suites and existing fixture UI checks; inspect phone screenshot and browser console.
- [ ] Obtain one independent whole-branch review with design/plan and actual test evidence; fix important findings with regression tests.
- [ ] Update docs with delivered scope, limitations and exact evidence. Commit and integrate using the user's established main/push preference only after checks pass.
