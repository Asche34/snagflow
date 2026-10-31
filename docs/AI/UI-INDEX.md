# UI-INDEX

## Web (`apps/web`, Next.js 16 App Router)

| Page | URL | Files | Module | API used | Permission | Status |
| ---- | --- | ----- | ------ | -------- | ---------- | ------ |
| Home (placeholder) | `/` | `apps/web/src/app/page.tsx` (+ `layout.tsx`, `globals.css`) | MOD-WEB | — | public | live placeholder |

Shared components: `apps/web/src/components/ui/*` (button, badge, card, dialog, dropdown-menu, input, select, separator, skeleton, tabs, textarea, avatar).
Helpers: `apps/web/src/lib/utils.ts::cn`.

Phase 3 is delivered in the existing workspace: personal notifications bell in the topbar,
live project/dashboard/detail refresh, reconnect feedback, required reject/reopen reasons and
visible audit reasons. The review queue remains on `/dashboard`; no separate `/queue` route
was introduced. See `docs/AI/PHASE3-COMPLETE-2026-10-31.md` and the feature index.

Current lifecycle controls: `apps/web/src/components/lifecycle-control.tsx`, integrated in
project and snag views. Manager/admin archive/restore and delete use Fieldwork Radix confirmations,
initial Cancel focus, hydration/pending gating and focused errors. Dashboard Archived projects
provides retained project access; active navigation/queues omit archived projects. See
`docs/AI/ARCHIVE-DELETE-2026-10-30.md` and the feature index for delivered route coverage.

| Planned page | URL | Phase | Permission (gating via `packages/shared/src/permissions.ts`) |
| ------------ | --- | ----- | ------------------------------------------------------------- |
| Login/magic-link | `/login` | 2 | public |
| Dashboard | `/dashboard` | 2 | signed-in |
| Projects list/detail | `/projects`, `/projects/[id]` | 2 | member-of or admin |
| Snag list + detail + create | `/projects/[id]/snags…`, `/snags/[id]` | 2 | per action matrix |
| Team management | `/projects/[id]/team` | 2 | manager/admin (users: admin) |
| Settings, reports | `/settings`, `/reports` | 4 | admin |

## Mobile (`apps/mobile`, Expo Router)

| Screen | Route | Files | Status |
| ------ | ----- | ----- | ------ |
| Home (placeholder) | `/` | `apps/mobile/src/app/index.tsx` (+ `_layout.tsx`) | live placeholder |

Phase 5 adds auth/camera/review flows under `apps/mobile/src/app/`.
