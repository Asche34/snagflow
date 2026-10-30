# DATABASE-INDEX

Migrations (append-only, apply in order — details in-file):

| Migration | Creates |
| --------- | ------- |
| `20261019000001_extensions_enums.sql` | extensions; enums: `app_role`, `snag_status`, `snag_priority`, `report_theme` |
| `20261019000002_core_tables.sql` | `profiles`, `org_settings`, `projects`, `project_members`, `invitations`, `locations`, `categories` |
| `20261019000003_snags_tables.sql` | `snags`, `snag_photos`, `comments` + `assign_snag_number` + `enforce_photo_limit` |
| `20261019000004_collab_tables.sql` | `activity_log`, `notifications`, `push_tokens`, `reports`(+`snag_report_items`? — see file) |
| `20261019000005_security.sql` | SECURITY DEFINER helpers (`profile`, `project_access`, `can`…), role→JWT trigger, `guard_snag_update` |
| `20261019000006_rls_policies.sql` | RLS enablement + policies for all tables |
| `20261019000007_workflow_rpc.sql` | `assign_snag`, `transition_snag`, `soft_delete_snag` + activity/notifications helpers |
| `20261019000008_storage.sql` | buckets + storage policies |
| `20261019000009_actor_defaults.sql` | BEFORE INSERT triggers stamping `created_by`/`author_id` with `auth.uid()` when absent (makes member inserts satisfy the RLS WITH CHECK) |
| `20261019000010_profiles_team_read.sql` | shared-project colleague profile visibility |
| `20261029000011_authorization_hardening.sql` | active-access guards, authorization/RPC hardening and concurrent photo-cap enforcement |
| `20261029000012_snag_search.sql` | generated `snags.search_document` English tsvector (title + description), GIN index; RLS remains authoritative |
| `20261029000013_team_invitations.sql` | canonical-email member add, scoped role/removal, admin invite preparation, project cancellation, recipient-bound lookup/atomic acceptance; authenticated execution only |
| `20261030000014_project_metadata.sql` | preserve historical snag references and child locations on deletion; immutable metadata identity/project, validated names/order, same-project acyclic hierarchy with serialized parent writes; existing RLS unchanged |

## Table cards

| Table | Role | PK | Key relations | Owner module | Migration |
| ----- | ---- | -- | ------------- | ------------ | --------- |
| `profiles` | per-user metadata (name, admin flag) | id (=auth.users) | 1—N `project_members` | MOD-DATABASE | 0002 |
| `org_settings` | singleton branding/naming/report defaults | id | referenced by reports | MOD-DATABASE | 0002 |
| `projects` | job sites | id | 1—N members/snags; carries `snag_counter` for numbering | MOD-DATABASE | 0002 |
| `project_members` | role per project | id | FK project/profile; unique(project,profile) | MOD-DATABASE | 0002 |
| `invitations` | invite-only signup tokens | id | FK project/by | MOD-DATABASE | 0002 |
| `locations` | zones per project | id | FK project; FK snags.location_id | MOD-DATABASE | 0002 |
| `categories` | defect categories | id | FK snags.category_id | MOD-DATABASE | 0002 |
| `snags` | defect records | id | FK project, location, category, created_by, assignee, `client_id` unique | MOD-DATABASE | 0003 |
| `snag_photos` | photo rows | id | FK snag; `storage_path`; ≤8 trigger | MOD-DATABASE | 0003 |
| `comments` | immutable remarks | id | FK snag, author | MOD-DATABASE | 0003 |
| `activity_log` | append-only audit | id | FK snag, actor | MOD-DATABASE | 0004 |
| `notifications` | per-user inbox | id | FK profile, snag | MOD-DATABASE | 0004 |
| `push_tokens` | expo tokens | id | FK profile | MOD-DATABASE | 0004 |
| `reports` | generated report revisions | id | FK project, generated_by; theme | MOD-DATABASE | 0004 |

## Relations that matter

`projects ┬< project_members >─ profiles` (visibility = membership; admin bypass)
`projects ┬< snags ┬< snag_photos / comments / activity_log / notifications`
`snags.location_id → locations · snags.category_id → categories`
`projects.snag_counter` feeds `snags.number` (locked increment — do NOT bypass).

After any schema change: `pnpm db:gen-types` + rerun `supabase/tests`.
