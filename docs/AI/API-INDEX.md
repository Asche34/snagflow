# API-INDEX

There is no custom REST layer yet; clients talk to Supabase directly.
The workflow functions below are one slice of the API; team/invitation RPCs and the invitation route are indexed in FEATURE-INDEX.

| Function | Input | Output/errors | Who | Source |
| -------- | ----- | ------------- | --- | ------ |
| `assign_snag(snag_id, assignee_id)` | uuid ids | updated snag row, or exception with code `40001…` | member+ | `20261019000007_workflow_rpc.sql::assign_snag` |
| `transition_snag(snag_id, to_status, comment?)` | uuid, valid target per `workflow.ts` map, comment for reject/reopen | updated row or `TRANSITION_*` error | matrix | same |
| `soft_delete_snag(snag_id)` | uuid | deleted_at stamped; history retained and deletion audited | active project manager/admin | `20261029000011_authorization_hardening.sql::soft_delete_snag` |

Error codes: `packages/shared/src/workflow.ts::TRANSITION_ERRORS` (prefixes `38001–38004`) — mirrored by RPC `raise`s (sync contract).

Table REST endpoints (`/rest/v1/*`) are covered by RLS; row-visible per policies.
Storage endpoints: `supabase/migrations/20261019000008_storage.sql` (buckets: `snag-photos`, `report-thumbnails`).

Generated typed access comes from `pnpm db:gen-types` → `packages/shared/src/db-types.ts`.

Web lifecycle server actions: `apps/web/src/app/(app)/lifecycle-actions.ts::setProjectArchived,deleteSnag`.
Both use the caller's session. Archive/restore updates only project status through existing RLS;
delete resolves the project under RLS and calls the existing RPC. Successful mutations invalidate
the root layout. Missing/deleted/inaccessible snags remain an ambiguous error, never false success.
