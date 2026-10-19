# ROUTE-INDEX

Currently the web app has no API routes and one page; the DB is the API (PostgREST + RPCs).
Phase 2+ fills the web column; `node scripts/ai/update-index.mjs` re-scans app dirs.
Project API/pages planned in Phase 2 come from `SNAGFLOW_BUILD_PROMPT.md` §8 — listed below as PLANNED only.

## Web pages (App Router)

| URL | Handler | Auth | File | Status |
| --- | ------- | ---- | ---- | ------ |
| `/` | Home placeholder | public | `apps/web/src/app/page.tsx` | live (placeholder) |
| `/login` · `/dashboard` · `/projects` · `/projects/[id]` · `/snags/[id]` · `/team` · `/settings` | PLANNED | members | — | Phase 2 |
| `/queue` (review queue) · `/reports` | PLANNED | manager/admin | — | Phase 3–4 |

## Web API routes

| Method | URL | Handler | Auth | File | Status |
| ------ | --- | ------- | ---- | ---- | ------ |
| — | — | — | — | — | none yet (Phase 2 starts SSR data via RLS clients) |
| POST `/api/reports/[snagReportId]` | PLANNED | manager/admin | `apps/web/src/app/api/` | Phase 4 (PDF/Excel generation) |

## Mobile routes (Expo Router)

| Path | Handler | Auth | File | Status |
| ---- | ------- | ---- | ---- | ------ |
| `/` | Home placeholder | public | `apps/mobile/src/app/index.tsx` | live (placeholder) |
| auth tabs / project / snag flows | PLANNED | members | `apps/mobile/src/app/` | Phase 5 |

## Backend RPC endpoints (PostgREST)

| Method | URL | Function | Auth | Source | Status |
| ------ | --- | -------- | ---- | ------ | ------ |
| POST | `/rest/v1/rpc/assign_snag` | assign member | member/manager/admin | `supabase/migrations/20261019000007_workflow_rpc.sql` | live |
| POST | `/rest/v1/rpc/transition_snag` | status transition | per-transition matrix | same | live |
| POST | `/rest/v1/rpc/soft_delete_snag` | soft delete | member/manager/admin | same | live |
