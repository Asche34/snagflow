# UI-INDEX

Web branding: `apps/web/src/components/brand-mark.tsx` consumes canonical S/check paths from `apps/web/src/lib/brand.ts`. Login and workspace navigation use the white/orange mark on green. Six downloadable SVGs live in apps/web/public/branding/; `scripts/branding/export.mjs` regenerates these and browser/Apple icons. PDF footers and Excel summaries use the same geometry independently of company logos. See FEAT-BRANDING.

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
| Auth/session | `/login`, `/auth/callback` | `apps/mobile/src/app/login.tsx`, `apps/mobile/src/app/auth/callback.tsx`, `apps/mobile/src/providers/auth.tsx` | implemented locally |
| Assigned work/review/projects | `/` | `apps/mobile/src/app/index.tsx` | implemented locally |
| Project, capture, reports | `/projects/[id]` and children | `apps/mobile/src/app/projects/` | implemented locally |
| Snag collaboration | `/snags/[id]` | `apps/mobile/src/app/snags/[id].tsx` | implemented locally |
| Personal updates | `/notifications` | `apps/mobile/src/app/notifications.tsx` | implemented locally |

Fieldwork native screens reuse shared permissions/workflow/validation. Hosted/physical-device acceptance remains pending. Browser preview uses original photos; native Skia markup is Android/iOS only.

Login now includes App URL/Connect, verified connection feedback, disabled credentials for unconnected URL edits and remembered server configuration. Connection setup remains available without mobile build-time backend values; see `docs/AI/MOBILE-APP-URL-LAN-2026-11-02.md`.
