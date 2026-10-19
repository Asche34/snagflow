# API-INDEX

There is no custom REST layer yet; clients talk to Supabase directly.
Three callable DB functions exist — they are the workflow API.

| Function | Input | Output/errors | Who | Source |
| -------- | ----- | ------------- | --- | ------ |
| `assign_snag(snag_id, assignee_id)` | uuid ids | updated snag row, or exception with code `40001…` | member+ | `20261019000007_workflow_rpc.sql::assign_snag` |
| `transition_snag(snag_id, to_status, comment?)` | uuid, valid target per `workflow.ts` map, comment for reject/reopen | updated row or `TRANSITION_*` error | matrix | same |
| `soft_delete_snag(snag_id)` | uuid | deleted_at stamped | member+ (own project) | same |

Error codes: `packages/shared/src/workflow.ts::TRANSITION_ERRORS` (prefixes `38001–38004`) — mirrored by RPC `raise`s (sync contract).

Table REST endpoints (`/rest/v1/*`) are covered by RLS; row-visible per policies.
Storage endpoints: `supabase/migrations/20261019000008_storage.sql` (buckets: `snag-photos`, `report-thumbnails`).

Generated typed access comes from `pnpm db:gen-types` → `packages/shared/src/db-types.ts`.
