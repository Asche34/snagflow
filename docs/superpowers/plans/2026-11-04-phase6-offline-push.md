# Phase 6 Offline and Push Implementation Plan

> **For agentic workers:** Use executing-plans for the mobile integration, with independent database and push workers under dispatching-parallel-agents. Track evidence here and in the Phase 6 handoff.

**Goal:** Preserve field capture through lost connectivity and restart, safely replay it once, and provide opt-in authorized Expo push.

**Architecture:** Keep the existing screens, schemas, RLS and photo annotation pipeline. Add a deployment/account-scoped SQLite repository with snapshots, durable drafts, outbox and document-directory files. Server mutation receipts make workflow retries transactional; changed plain fields merge using server timestamps. Pull sync reconciles authoritative access and deletions. Push delivery is locally implemented and disabled until explicitly configured/deployed.

**Tech Stack:** Expo SDK 58, expo-sqlite, expo-file-system, expo-network, expo-notifications, Supabase Postgres/RPC and Edge Functions.

**Spec:** SNAGFLOW_BUILD_PROMPT.md §§11,12,15; user request dated 2026-11-04.

## Global Constraints

- Preserve Medium optional priority, Projects-first navigation, full-screen optional photo review, filter behavior and branding work.
- Preserve existing data: additive numbered migrations only; never reset Supabase.
- No main push, Vercel deployment, hosted Supabase modification or live push delivery.
- Queue and local files belong to one deployment/account/project; fresh server authorization on every replay.
- Phase 7 remains out of scope. Physical acceptance is reported only for cases actually confirmed.

## Review Focus

- A committed response can be lost after any network request: retry must not duplicate snags, comments, photos or workflow events.
- Account/deployment changes can occur during a request: no subsequent request or result may reach the replacement session.
- App process can die during file copy/upload/outbox execution: recovery must retain immutable bytes and identities.
- Removed membership, deleted snags and archived projects must reconcile without leaking cached records or silently losing queued intent.
- Conflicting status/assignment changes require visible retry/discard; changed plain fields must not overwrite unrelated newer fields.

### Task 1: Offline database contracts

Files: migration18, supabase/tests/offline*. Tests first: duplicate replay, fingerprint mismatch, revoked access, workflow conflict, field merge, sync tombstones. Implement transactional receipts and authorized snapshot pull. Apply locally without reset and regenerate types.

### Task 2: Durable mobile store and sync engine

Files: apps/mobile/src/lib/offline/*, tests/offline*. Native SQLite plus browser test adapter; isolated snapshots, drafts/outbox/files; ordered replay, recovery, retry/backoff and attention. Tests first: reopen store, interrupted write/upload, retries, account/deployment isolation and conflict retention.

### Task 3: Existing mobile screens

Files: auth provider, data/mutations adapters, capture/detail/photos/forms, sync provider/status route, root/home. Durable capture autosave, local reads/optimistic overlay, background foreground/connectivity reconciliation, pending numbers, photo status and retry/discard. Preserve existing UX defaults. Verify browser online regressions and offline/restart/reconnect cases against preserved local data.

### Task 4: Push

Files: migration19, push-send, mobile push provider/settings and tests. Test token ownership/lifecycle, authenticated persisted recipients, disabled delivery, receipt cleanup and safe tap navigation. No real push delivery.

### Task 5: Verification and APK

Run touched-package lint/typecheck/tests, local DB and focused browser checks, Android/web export. Review the diff. Update PROJECT-STATE, field handoff, indexes and DECISIONS. Increment from current1.0.3/code4 without overwriting branding. Inspect release archive for secrets, build EAS preview, observe result and deliver actual APK. Hosted activation and physical Phase6 acceptance remain separately pending.

## Execution ledger

- Release blocker update: actual1.0.4/code5 USB crash reproduced; incompatible precompiled SQLite58.0.15 registration ABI confirmed against runtime0.2.5. Source-build SQLite through supported Expo autolinking; prepare1.0.5/code6 native rebuild, then retain-data phone login/restart verification.90 units/typecheck/lint pass again. Repack98666 finished before cancellation; do not deliver it as a fix.

- Initial Git status clean at d4d58fb (the user's earlier dirty changes are now committed). Local branch codex/phase6-offline-push created; no push.
- User expressly delegates routine design/implementation decisions; follow existing architecture without an extra approval round.
- Android1.0.2/code3 installed and worked on user's phone; installation failure resolved. Broader acceptance remains unconfirmed.
- Task 1 complete: additive local migrations 18/19, generated types, 70/70 full DB checks; no reset/hosted changes.
- Task 2 complete: actual SQLite persistence and recovery tests; captured account/deployment JWTs and identity checks; acknowledged-data preservation.
- Task 3 complete: durable field/photo drafts, pending evidence, visible conflicts; 17/17 browser checks including existing online behavior and legacy-server fallback.
- Task 4 complete locally: disabled-by-default push, scoped opt-in/lifecycle/navigation and authorized receipts; native credentials and hosted activation remain external.
- Review fixes verified: ambiguous replay identity, binder race, private draft purge, acknowledged comment/photo retention, stale edit/workflow base, pending fix evidence, continuous photo-batch identity, account switch during upload/draft persistence, legacy-server mutation compatibility and legacy markup account pinning.
- Task 5 in progress: 83 units, 8 mobile API checks, 90 shared/report checks, configured lint/typechecks, Android/web exports and archive scan pass. Queued EAS builds canceled to include compatibility and reproduced cache revision corrections; final APK/native result still required.
- Ruling: full bounded snapshots replace strict timestamp deltas for this release, preventing late-commit loss without global workflow locks; cost is transfer volume and a 20,000-row/table limit.
- Deferred minor: conservative private-media retention has no orphan-file garbage collector or disk quota yet. Uploads resume on foreground/restart; no claim of execution while force-closed.
- Task 5 blocker confirmed by installed SDK probe: expired access token + offline refresh yields null SDK session (stored secure session retained), preventing local identity/queue restoration. AuthProvider/runtime correction and a sixth browser regression are in progress with offline_db/offline_e2e workers. Superseded EAS build 7e775789 was canceled during native compilation; final source/build still required. No other product source changes are planned while this correction is verified.
- Expiry correction verified: 89 mobile units, typecheck/lint, actual installed-SDK cooldown/recovery, and sixth browser expiry/reconnect case pass. Local identity requires retryable refresh failure, matching cached active profile and originating secure namespace; fresh server JWT remains mandatory. Explicit logout resets/fences the old secure namespace. Fresh push-lifecycle review found one duplicate cleanup race; fixed by leaving the single awaited cleanup with installConnection. Full browser consolidation and final APK build remain.
- Final consolidated browser suite 18/18 passed (exit0), including completed logout/project synchronization preconditions; artifacts `e2e/.playwright/phase6-browser-release-final`. Final source committed as 4b77363 and EAS build b5689550-dab9-49db-9613-16e038595284 submitted for Android1.0.4/code5. Only native cloud result/artifact and final handoff status remain; no further product changes planned.
- Native base b5689550 FINISHED. A direct cold-start push probe then reproduced premature OS response cleanup on initial installConnection(previousKey=null). Guarded prior-client cleanup; startup/deployment/logout regression RED→GREEN, full90 mobile units/types/scoped lint pass. JS-only correction has identical native fingerprint3d7a13e86fd5a435272f95ed7935b0b2537910cc; manual signed internal repack is prepared without native recompilation, GitHub trigger, OTA update or deployment. Final repack result remains required.
