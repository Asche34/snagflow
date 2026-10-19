# UI-INDEX

## Web (`apps/web`, Next.js 16 App Router)

| Page | URL | Files | Module | API used | Permission | Status |
| ---- | --- | ----- | ------ | -------- | ---------- | ------ |
| Home (placeholder) | `/` | `apps/web/src/app/page.tsx` (+ `layout.tsx`, `globals.css`) | MOD-WEB | — | public | live placeholder |

Shared components: `apps/web/src/components/ui/*` (button, badge, card, dialog, dropdown-menu, input, select, separator, skeleton, tabs, textarea, avatar).
Helpers: `apps/web/src/lib/utils.ts::cn`.

| Planned page | URL | Phase | Permission (gating via `packages/shared/src/permissions.ts`) |
| ------------ | --- | ----- | ------------------------------------------------------------- |
| Login/magic-link | `/login` | 2 | public |
| Dashboard | `/dashboard` | 2 | signed-in |
| Projects list/detail | `/projects`, `/projects/[id]` | 2 | member-of or admin |
| Snag list + detail + create | `/projects/[id]/snags…`, `/snags/[id]` | 2 | per action matrix |
| Team management | `/projects/[id]/team` | 2 | manager/admin (users: admin) |
| Review queue, notifications | `/queue`, bell | 3 | manager/admin |
| Settings, reports | `/settings`, `/reports` | 4 | admin |

## Mobile (`apps/mobile`, Expo Router)

| Screen | Route | Files | Status |
| ------ | ----- | ----- | ------ |
| Home (placeholder) | `/` | `apps/mobile/src/app/index.tsx` (+ `_layout.tsx`) | live placeholder |

Phase 5 adds auth/camera/review flows under `apps/mobile/src/app/`.
