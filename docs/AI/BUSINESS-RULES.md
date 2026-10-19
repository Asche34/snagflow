# BUSINESS-RULES (observed in code/tests only — nothing here is invented)

Rules enforced in Postgres are the source of truth; `packages/shared` mirrors them for UI gating.

## Workflow (BR-WORKFLOW)

- **BR-WORKFLOW-001** Status changes follow the transition map only; flows: open→in_progress→ready_for_review→closed; rejected: ready_for_review→in_progress (count++, comment required); reopen: closed→open (comment required).
  Impl: `packages/shared/src/workflow.ts::SNAG_TRANSITIONS` · Server: `20261019000007_workflow_rpc.sql::transition_snag` · Tests: `supabase/tests/workflow.test.ts`
- **BR-WORKFLOW-002** Reject and reopen REQUIRE a comment; approve closes; assignment never changes status.
  Impl: same RPC · Tests: `supabase/tests/workflow.test.ts::reject requires comment / reopen requires comment`
- **BR-WORKFLOW-003** Only the assignee can perform assignee-only transitions (start, mark ready).
  Impl: RPC checks · Tests: workflow.test.ts

## Snags (BR-SNAG)

- **BR-SNAG-001** Numbers are sequential per project (SN-1…) assigned server-side; clients never set them.
  Impl: `20261019000003_snags_tables.sql::assign_snag_number` (row lock on project) · Tests: `supabase/tests/integrity.test.ts`
- **BR-SNAG-002** Max 8 photos per snag. Impl: `enforce_photo_limit` trigger · Tests: integrity.test.ts
- **BR-SNAG-003** Offline replay is idempotent via unique `client_id`. Tests: integrity.test.ts
- **BR-SNAG-004** Deletion is soft (deleted_at); hard deletes not exposed. Impl: `soft_delete_snag` RPC.
- **BR-SNAG-005** Client-created snags/comments/photos are stamped server-side with the caller's id (`created_by`/`author_id`/`uploaded_by`) via BEFORE INSERT triggers; forged identities are rejected by the insert policies.
  Impl: `20261019000009_actor_defaults.sql` · Tests: `supabase/tests/rls_write.test.ts`

## Authorization (BR-AUTHZ)

- **BR-AUTHZ-001** Every table has RLS; visibility = project membership; admins bypass membership checks.
  Impl: `20261019000005_security.sql` (helpers + `public.can`) + `20261019000006_rls_policies.sql` · Tests: `rls_isolation.test.ts`, `rls_write.test.ts`
- **BR-AUTHZ-002** Workflow-touching columns (status, assignee, fix fields, review fields) are not directly writable; a guard trigger strips/rejects them — workflow fields change only via RPCs.
  Impl: `20261019000005_security.sql::guard_snag_update` · Tests: `rls_write.test.ts::workflow fields`
- **BR-AUTHZ-003** Role matrix: viewer read-only; member creates + works own snags; manager assigns/edits project/approves/rejects/reopens; admin does all + manages users.
  Impl: `packages/shared/src/permissions.ts::canAct` + policy matrix · Tests: `packages/shared/tests/permissions.test.ts`

## Auth (BR-AUTH)

- **BR-AUTH-001** Invite-only: no public signup; users are created by admins (invitations table, Phase 2 flow).
- **BR-AUTH-002** Profile rows are auto-created when auth users appear (trigger, `20261019000005_security.sql`). Seed relies on it.

## Data & storage (BR-ACTIVITY, BR-STORAGE, BR-COMMENT, BR-ORG)

- **BR-ACTIVITY-001** `activity_log` is append-only; clients cannot insert/update.
- **BR-COMMENT-001** Comments are immutable (no update policy).
- **BR-STORAGE-001** Buckets are private; object path must be `{project_id}/{snag_id}/{uuid}.{ext}` under `snag-photos`; policies verify path ownership. `report-thumbnails` similar.
- **BR-ORG-001** Single org row (`org_settings`, id=1); custom category/labels mirror in `terminology.ts` for reports (Phase 4).
