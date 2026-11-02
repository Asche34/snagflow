# Mobile online implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

**Goal:** Implement spec §15 Phase 5 and the online portions of §11, with hosted/device acceptance explicitly pending.
**Architecture:** Native Expo Router screens call Supabase with the user's session and existing typed shared contracts. Native Skia markup uses the same versioned vector document and private immutable originals/flattened revisions as web. No new authorization rules or database schema.
**Tech Stack:** Installed Expo SDK 58, React Native 0.88, TypeScript, Supabase, shared Zod/permissions/workflow; Expo SDK-compatible camera/image preparation/session storage/share modules.
**Spec:** `SNAGFLOW_BUILD_PROMPT.md` §§4,6,7,9–11,15; `docs/AI/PHASE4-COMPLETE-2026-11-02.md`.

## Global constraints

- Preserve local data; never reset Supabase. Hosted mutations require separate explicit authorization.
- Fieldwork colours, readable labelled controls, 48dp targets, safe areas, scrollable forms and native feedback.
- Shared schemas/permission/workflow/annotation contracts stay authoritative for client intent; RLS/RPCs enforce writes.
- Online only. No SQLite/outbox/background sync/push/EAS release profiles.
- Reuse existing CLIs; restore missing locked mobile dependencies and install only required SDK-compatible native modules.
- Existing web server is healthy at 127.0.0.1:3003. Avoid a rebuild unless web changes require it.
- User explicitly delegated routine design choices and requested commit/push to main; execute in the clean existing checkout and obtain independent final review.

## Review focus

- Session/account changes must clear private screen data; callbacks must reject unintended origins and signup.
- A lost response after a create/photo/comment must reconcile its stable identity without duplication or lost edits.
- Access revocation and foreground refresh must remove inaccessible records; drafts survive recoverable errors.
- Markup must retain original pixel geometry and original bytes, with bounded vectors, immutable flattened bytes and optimistic conflicts.
- Partial continuous capture must retain unfinished items and never imply queued offline persistence.

### Task 1: Baseline, auth and native shell
Files: `apps/mobile/package.json`, `app.json`, `.env.example`, `src/lib/{supabase,auth,session-storage}.ts*`, `src/components/ui.tsx`, `src/app/{_layout,index,login,auth/callback}.tsx`, `tests/`.
Interfaces: authenticated typed Supabase singleton; auth context with session/profile; shared Fieldwork primitives.
- [x] Establish and record inherited lint/typecheck failures before implementation; restore locked modules.
- [x] Write failing tests for callback origin/token handling and secure storage round trips, then implement and verify.
- [x] Implement invite-only password/magic-link auth, callback, refresh lifecycle, signout and guarded navigation.

### Task 2: Project/home/detail collaboration
Files: `src/lib/{data,mutations,use-resource}.ts*`, `src/app/projects/[id].tsx`, `src/app/snags/[id].tsx`, home screen, `src/components/{snag-form,workflow,photos}.tsx`, tests.
Interfaces: paginated RLS data reads; stable create/comment identity; shared-schema writes; workflow RPCs.
- [x] Write failing tests for stable response-loss retry, paginated reads, filters and workflow intent; implement and verify.
- [x] Build assigned/review/project lists, filters/search, detail metadata/comments/activity, edit/assign/delete and all shared-map transitions.
- [x] Refresh on focus/foreground/pull and authenticated Realtime; explicit errors and removal handling.

### Task 3: Camera, private photos and markup
Files: `src/lib/{photos,markup}.ts`, `src/components/{capture,markup-editor}.tsx`, `src/app/projects/[id]/capture.tsx`, tests.
Interfaces: prepared original <=1600px and thumb <=400px JPEG; stable private upload paths; shared AnnotationDocument; save_photo_annotation RPC.
- [x] Write failing tests for sizing, geometry/history and immutable retries; implement and verify.
- [x] Implement camera/library permission handling, eight-photo cap, per-photo upload stages, retry and fix photos.
- [x] Implement six markup tools, colours/history/move/delete, flattened JPEG+vectors and conflict recovery; camera-first and continuous capture one snag/photo.

### Task 4: Reports, verification and delivery
Files: mobile report UI/client, tests, `README.md`, `docs/DECISIONS.md`, AI handoff/state/indexes.
- [x] Verify report bearer API integration and native PDF/Excel sharing; live personal notifications without push.
- [x] Run mobile lint/typecheck/tests and native platform bundle exports; run shared/DB/web configured regression checks with isolated browser artifacts.
- [x] Independent review, reproduce/fix material findings and rerun affected checks.
- [x] Document exact hosted deployment/device checklist, evidence and inherited limitations; regenerate/validate indexes.
- [ ] Commit and push main, report actual verification and remaining hosted/physical acceptance.

## Baseline / execution ledger

- Clean main at f0e2c5e; web login HTTP 200 on 3003.
- Inherited mobile baseline: missing apps/mobile/node_modules, missing expo/tsconfig.base, missing Expo Router/RN declarations and JSX errors. No mobile tests existed. Package-manager fallback is pnpm 11.25.0; explicit config flags disable automatic dependency installation during checks. Locked mobile restore is in progress.
- Design ruling: native implementation rather than embedding web, as required by camera-first site use; routine choices delegated by the user, so no additional design approval gate. Hosted/device access requested asynchronously.

## Delivery ledger

- Tasks 1–3 implemented and verified. Scoped auth/reports and markup/photo implementers worked in separate files; a fresh independent reviewer checked the whole feature and final test/config additions. Routine design choices and working in the clean main checkout followed the user's explicit execution instructions.
- Task 4 verification: 299 checks pass (41 mobile pure, eight mobile API, five mobile browser, 81 web browser, nine fixture UI, 55 DB, 75 shared/output, 25 rolled-back SQL). Configured build/lint/typecheck passed; final Android/iOS exports passed. Native renderer/camera/share and hosted acceptance remain unperformed, as requested.
- Review corrections were reproduced and verified: transport/profile refresh draft retention, confirmed-access clearing, changed create assignment, changed committed-comment receipts, archived-project scoping, live edit permissions and report denial clearing. Oversized number search now yields an empty lookup instead of a database integer error.
- Hosted/device access identifiers remain unprovided after the user requested and received an explanation; local work continued. No hosted configuration/migration or external email was changed. Exact deployment checklist and physical acceptance matrix are in the Phase 5 handoff.
- Integration follows the user's authorized commit/push to main after final staged-file checks; physical-device acceptance is not represented as complete.
