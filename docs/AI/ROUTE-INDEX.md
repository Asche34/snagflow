# ROUTE-INDEX

Web pages use authenticated Supabase RLS clients and Server Actions; the DB exposes PostgREST/RPCs.
Machine pointers: `.ai/index.json::routes`; `node scripts/ai/update-index.mjs` re-scans app dirs.

## Web pages (App Router)

| URL | Handler | Auth | File | Status |
| --- | ------- | ---- | ---- | ------ |
| `/` | Home placeholder | public | `apps/web/src/app/page.tsx` | live (placeholder) |
| `/login` | Sign in | public | `apps/web/src/app/login/page.tsx` | live |
| `/invite/[token]` | Email-session-bound invite acceptance/setup | public shell; confirmed matching user for acceptance | `apps/web/src/app/invite/[token]/page.tsx` | live |
| `/dashboard` | Role-aware workspace and project list | user | `apps/web/src/app/(app)/dashboard/page.tsx` | live |
| `/projects/[projectId]` | Snags/search, locations, team | project access | `apps/web/src/app/(app)/projects/[projectId]/page.tsx` | live |
| `/projects/new` | Create project | active admin | `apps/web/src/app/(app)/projects/new/page.tsx` | live |
| `/projects/[projectId]/edit` | Edit project details/settings | active project manager/admin | `apps/web/src/app/(app)/projects/[projectId]/edit/page.tsx` | live |
| `/projects/[projectId]/snags/new` | Create snag | member/manager/admin | `apps/web/src/app/(app)/projects/[projectId]/snags/new/page.tsx` | live |
| `/snags/[snagId]` | Snag detail/workflow/photos | project access | `apps/web/src/app/(app)/snags/[snagId]/page.tsx` | live |
| `/snags/[snagId]/edit` | Edit snag details | creator with edit permission or manager/admin | `apps/web/src/app/(app)/snags/[snagId]/edit/page.tsx` | live |
| `/projects` · `/team` · `/settings` | PLANNED standalone pages | role dependent | — | Phase 2+ |
| `/queue` (review queue) · `/reports` | PLANNED | manager/admin | — | Phase 3–4 |

## Web API routes

| Method | URL | Handler | Auth | File | Status |
| ------ | --- | ------- | ---- | ---- | ------ |
| GET | `/api/health` | reachability | public | `apps/web/src/app/api/health/route.ts` | live |
| POST | `/api/invitations` | prepare/send or retry project invitation | active admin + canonical Origin | `apps/web/src/app/api/invitations/route.ts` | live |
| GET/POST | `/api/reports` | history/generate | caller cookie or bearer; manager/admin | `apps/web/src/app/api/reports/route.ts` | live |
| GET | `/api/reports/[reportId]` | private download signing | caller cookie or bearer; manager/admin | `apps/web/src/app/api/reports/[reportId]/route.ts` | live |

## Mobile routes (Expo Router)

| Path | Handler | Auth | File | Status |
| ---- | ------- | ---- | ---- | ------ |
| `/` | assigned work/review/projects | active account | `apps/mobile/src/app/index.tsx` | implemented locally |
| `/login` | password / PKCE link | public | `apps/mobile/src/app/login.tsx` | implemented locally |
| `/auth/callback` | exact PKCE exchange | callback validation | `apps/mobile/src/app/auth/callback.tsx` | implemented locally |
| `/projects/[id]` | project/search | project RLS | `apps/mobile/src/app/projects/[id].tsx` | implemented locally |
| `/projects/[id]/capture` | camera/create | member+ | `apps/mobile/src/app/projects/[id]/capture.tsx` | implemented locally |
| `/projects/[id]/reports` | generate/share/history | manager/admin | `apps/mobile/src/app/projects/[id]/reports.tsx` | implemented locally |
| `/snags/[id]` | detail/photos/workflow | per-action shared gating + RLS/RPC | `apps/mobile/src/app/snags/[id].tsx` | implemented locally |
| `/notifications` | personal updates | own-user RLS | `apps/mobile/src/app/notifications.tsx` | implemented locally |

## Backend RPC endpoints (PostgREST)

| Method | URL | Function | Auth | Source | Status |
| ------ | --- | -------- | ---- | ------ | ------ |
| POST | `/rest/v1/rpc/assign_snag` | assign member | manager/admin | `supabase/migrations/20261019000007_workflow_rpc.sql` | live |
| POST | `/rest/v1/rpc/transition_snag` | status transition | per-transition matrix | same | live |
| POST | `/rest/v1/rpc/soft_delete_snag` | soft delete | manager/admin | same | live |
