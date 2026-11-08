# Phase 6 offline database contract — 2026-11-04

Migration `20261104000018_offline_sync.sql` is applied and recorded **locally only**, on the preserved Supabase stack. No reset, hosted operation, or migration of existing objects outside numbered SQL was performed.

## Mutation contract

`apply_offline_mutation(p_id uuid, p_project_id uuid, p_snag_id uuid, p_kind text, p_payload jsonb, p_expected_updated_at timestamptz default null)` returns `{ snag, skipped_fields, comment? }`.

- `p_id` is an immutable operation identity. Replays return the exact transactional receipt after checking current active-account, project membership/write permission, and active-project status. A different owner or request using the same identity fails with `OFFLINE_IDENTITY`. An advisory transaction lock serializes simultaneous replays; rollback leaves neither a receipt nor a partial mutation.
- Create uses `snags.id = snags.client_id = p_snag_id`, retaining local routes/photo dependencies without remapping. Replaying create never edits its details. The database assigns the snag number. An optional initial assignee is applied through `assign_snag` in the same transaction.
- Plain create/edit fields use database names: `title`, `description`, `priority`, `category_id`, `location_id`, `due_date`, `pin_x`, `pin_y`. Create also accepts `assignee_id`; unknown/protected keys fail. Project-local category/location membership is checked again on the server.
- Edit requires a server `p_expected_updated_at` and **only changed fields**. Private per-field server clocks track all writers, including existing web writes. Fields changed after that base are preserved and named in `skipped_fields`; other changed fields merge. The caller still needs current creator/manager/admin detail-edit permission.
- Comment payload is `{ body }`; `comments.id = p_id`. Receipt transactionality prevents duplicate comments/notifications after a lost response.
- Assign payload is `{ assignee_id }`, including explicit null to unassign. Transition payload is `{ to_status, comment? }`. Both require an exact acknowledged server version and call existing authorized workflow RPCs. A stale version produces `OFFLINE_CONFLICT`; the client retains the intent for review/retry/discard. No client workflow or permission rule replaces database enforcement.
- New private tables have RLS and no authenticated/anonymous access. Only the definer RPC and clock trigger use them.

## Pull contract and decision

`mobile_sync_snapshot(p_project_id uuid, p_since timestamptz default null)` returns `{ full: true, synced_at, project, members, locations, categories, snags, photos, comments, activity, snag_ids, photo_ids, comment_ids, activity_ids }`.

Every array is a complete currently authorized project snapshot. Members embed only the profile fields already used by the mobile roster (`id`, `full_name`, `email`, `is_active`). Snags include soft-deleted tombstones. Child photos/comments exclude deleted parents; authoritative id arrays reconcile hard deletions. Current account/project access is checked on every pull; an archived/unavailable project is rejected. A table exceeding 20,000 project rows fails explicitly with `OFFLINE_TOO_LARGE`, without truncating or advancing a client cursor.

**Decision:** retain the spec's timestamp cursor interface but use full reconciliation for this release. Existing `updated_at` is transaction time rather than commit time: a transaction can start/update before one pull and commit afterward with an older timestamp. Strict `updated_at > last_sync_at` permanently loses that update. Full bounded snapshots safely catch it on the next pull and reconcile hard deletions, without invasive locks/rewrites of completed workflow RPCs. The cost is additional read/transfer work. A future commit-aware change feed can optimize the same API; callers must not assume arrays contain only deltas.

## Verification

- The first run against the running preserved stack failed all eight initial cases for missing RPCs (`PGRST202`), before applying migration 18.
- Final `node node_modules/vitest/vitest.mjs run tests/offline.test.ts` from `supabase/`: **10/10 passed**. Covers committed create/comment/workflow replay, simultaneous assignment replay, operation ownership/fingerprint collisions, viewer/other-project denial, revoked membership before receipt replay, creator-only edits, cross-project metadata rejection, stale status/assignment conflict, per-field merging, tombstones and complete metadata.
- Supabase test-package typecheck and scoped ESLint passed.
- `node supabase/tests/offline-late-commit.mjs`: **passed** against the local stack. A controlled transaction updates a disposable snag before the first pull, commits afterward, and has `updated_at < first.synced_at`; the second pull retrieves it. The probe failed as expected against a temporary timestamp-only local function, then passed after restoring the full snapshot in `finally`. Fixtures were removed; existing local rows remained.
- Regenerated `packages/shared/src/db-types.ts` through local Supabase CLI 2.122.0 into a temporary file, checked size and required RPC names before replacement. It also contains the locally applied push migration 19 types. CLI: `.superpowers/tools/supabase/package/bin/supabase.exe`; Docker resources must be in PATH.

The API suite is retained in `supabase/tests/offline.test.ts`. The local concurrency probe uses Docker/psql without credentials and supports `DOCKER_BIN` and `OFFLINE_DB_CONTAINER` overrides. This record proves database behavior; it does not claim native offline acceptance, hosted migration, or live push delivery.
