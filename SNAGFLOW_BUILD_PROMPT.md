# SnagFlow: Build Prompt

You are building **SnagFlow** (working name, easy to rename): a collaborative snagging / punch-list / defect-tracking platform for a construction and engineering department. It is a web app plus a mobile app on one Supabase backend. It is inspired by BuildReport Pro, SnagBricks and AuditBricks (Android apps by Appculus), but adds what those apps lack: **shared projects, real-time collaboration on the same snag list, project roles, and a manager review/assignment workflow.**

Read this whole document before writing code. Work phase by phase (section 15).

---

## 0. How to work

- Work through the phases in order. At the end of each phase: run lint, typecheck and tests, fix failures, commit with a clear message, then continue to the next phase.
- Make reasonable decisions yourself and record each in `docs/DECISIONS.md` (decision, reason, alternative). Stop and ask me only if you are blocked on credentials, accounts or something that cannot be inferred.
- Keep a `README.md` current: setup, env vars, how to run web, mobile, and database locally, how to deploy.
- TypeScript everywhere, strict mode. No `any` unless commented why.
- Never expose the Supabase service-role key to a client bundle. All authorization is enforced in Postgres (RLS, triggers, RPC), never only in the UI.
- Write tests for permissions and the status workflow first-class (section 14).

## 1. Context and constraints

- **Users:** an internal team (managers, site engineers, supervisors). No public signup, no billing, no subscriptions. Invite-only.
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime, Edge Functions). Already decided.
- **Must be hosted** and reachable from any browser, and also usable as a **mobile app** (iOS/Android) for site work with a camera and often poor connectivity.
- Single organization (one company), but keep tables clean so multi-org could be added later.

## 2. Tech stack

- **Monorepo:** pnpm workspaces + Turborepo.
  - `apps/web`: Next.js (App Router, latest stable), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, react-hook-form + zod, `@supabase/ssr`.
  - `apps/mobile`: Expo (React Native, Expo Router), TypeScript, `supabase-js`, `expo-sqlite`, `expo-camera`/`expo-image-picker`, `expo-file-system`, `expo-notifications`, `expo-secure-store`, `@shopify/react-native-skia` for image markup.
  - `packages/shared`: zod schemas, generated DB types (`supabase gen types`), enums, permission helpers, status-transition map. Used by both apps.
  - `supabase/`: migrations, `seed.sql`, edge functions, tests.
- **Web markup:** `react-konva`. **PDF:** `@react-pdf/renderer` in a Next.js route handler (Node runtime). **Excel:** `exceljs`.
- The web app is also an installable **PWA** (manifest + service worker for app shell caching; data is online-only on web).
- CI: GitHub Actions running lint, typecheck, unit tests, and a Supabase migration/RLS test job.

## 3. Repository layout

```
snagflow/
  apps/web/            Next.js app
  apps/mobile/         Expo app
  packages/shared/     types, zod schemas, permissions, workflow map
  supabase/
    migrations/        timestamped SQL
    functions/         edge functions (push, cleanup)
    tests/             RLS / workflow tests
    seed.sql
  docs/DECISIONS.md
  .github/workflows/
  README.md
```

## 4. Roles and permissions

Two layers:

1. **Organization level:** `profiles.is_admin` (boolean). Admins manage users, create projects, and can do everything in every project.
2. **Project level:** `project_members.role` is one of `manager | member | viewer`. A person can be manager on one project and member on another.

| Action | Admin | Manager | Member | Viewer |
|---|---|---|---|---|
| Invite/deactivate users, create projects | ✔ | | | |
| Edit project, locations, categories, settings | ✔ | ✔ | | |
| Add/remove project members, change roles | ✔ | ✔ | | |
| View project, snags, photos, comments, activity | ✔ | ✔ | ✔ | ✔ |
| Create snag, add issue photos | ✔ | ✔ | ✔ | |
| Edit snag details (title, description, priority, due date, location, category) | ✔ | ✔ | creator only, while not closed | |
| Assign / reassign snag | ✔ | ✔ | | |
| Start work (open → in_progress) | ✔ | ✔ | assignee | |
| Mark ready for review (add fix photos) | ✔ | ✔ | assignee | |
| Approve and close | ✔ | ✔ | | |
| Reject back to assignee (comment required) | ✔ | ✔ | | |
| Reopen a closed snag | ✔ | ✔ | | |
| Comment | ✔ | ✔ | ✔ | |
| Soft-delete snag | ✔ | ✔ | | |
| Generate / download reports | ✔ | ✔ | | |

Put this matrix in `packages/shared` as data and use the same source for UI gating. The database remains the source of truth.

## 5. Data model (Postgres)

Enums: `project_role('manager','member','viewer')`, `snag_status('open','in_progress','ready_for_review','closed')`, `snag_priority('low','medium','high','critical')`, `photo_kind('issue','fix')`.

Tables (all with `created_at timestamptz default now()`; mutable tables also `updated_at` maintained by trigger):

- **profiles**: `id uuid pk references auth.users`, `full_name`, `email`, `avatar_url`, `is_admin bool default false`, `is_active bool default true`.
- **org_settings** (single row): `company_name`, `logo_path`, `terminology text default 'snag'` (one of snag | punch | defect | issue, used for UI labels and reports), `date_format`, `default_report_theme`.
- **projects**: `id`, `name`, `code`, `description`, `client_name`, `address`, `cover_image_path`, `status ('active','archived')`, `require_fix_photo bool default true`, `snag_counter int default 0`, `created_by`.
- **project_members**: `project_id`, `user_id`, `role project_role`, primary key `(project_id, user_id)`.
- **invites**: `id`, `email`, `project_id nullable`, `role`, `token`, `expires_at`, `accepted_at`, `invited_by`.
- **locations**: `id`, `project_id`, `parent_id nullable` (building → floor → room), `name`, `sort_order`, `plan_path nullable` (drawing image).
- **categories**: `id`, `project_id`, `name` (custom per project, seeded with defaults such as Electrical, Plumbing, Finishes, Structural, Safety).
- **snags**: `id uuid`, `client_id uuid unique` (idempotency key for offline creates), `project_id`, `number int` (per-project sequential, `unique(project_id, number)`, assigned server-side from `projects.snag_counter` under row lock), `title`, `description`, `status`, `priority`, `category_id`, `location_id`, `assignee_id`, `created_by`, `due_date`, `pin_x`, `pin_y` (optional position on the location plan), `rejection_count int default 0`, `closed_at`, `closed_by`, `deleted_at`.
- **snag_photos**: `id`, `snag_id`, `kind photo_kind`, `storage_path` (original), `annotated_path nullable`, `annotation_json jsonb nullable`, `thumb_path`, `width`, `height`, `taken_at`, `uploaded_by`, `sort_order`. Max **8 photos per snag** enforced by trigger.
- **comments**: `id`, `snag_id`, `author_id`, `body`.
- **activity_log** (append-only, written by triggers/RPC only): `id`, `project_id`, `snag_id nullable`, `actor_id`, `action` (created, edited, assigned, status_changed, rejected, commented, photo_added, member_added, ...), `from_value`, `to_value`, `meta jsonb`.
- **notifications**: `id`, `user_id`, `type`, `project_id`, `snag_id`, `payload jsonb`, `read_at`.
- **push_tokens**: `user_id`, `token`, `platform`, `last_seen_at`.
- **reports**: `id`, `project_id`, `revision int` (per-project, increments), `format ('pdf','xlsx')`, `theme`, `filters jsonb`, `options jsonb`, `storage_path`, `created_by`.

Add sensible indexes: `snags(project_id, status)`, `snags(assignee_id, status)`, `snags(project_id, updated_at)`, `activity_log(snag_id, created_at)`, `notifications(user_id, read_at)`.

## 6. Snag workflow (state machine)

```
open ──(assign)──► open (assignee set)
open ──► in_progress          by assignee or manager
in_progress ──► ready_for_review   by assignee (needs ≥1 fix photo if project.require_fix_photo)
ready_for_review ──► closed        by manager (approve)
ready_for_review ──► in_progress   by manager (reject; comment required; rejection_count++)
closed ──► open                    by manager (reopen; comment required)
```

- Assignment does not change status. "Unassigned" = `assignee_id is null`. Only members of the project (not viewers) can be assignees.
- Enforce transitions **server-side**: Postgres RPC functions `assign_snag(snag_id, assignee_id)` and `transition_snag(snag_id, to_status, comment)` (SECURITY DEFINER, `set search_path = ''`, they check the caller's role), plus a `BEFORE UPDATE` trigger on `snags` that blocks direct changes to `status`, `assignee_id`, `closed_*`, `rejection_count`, `number`, `project_id` unless done through those functions. Invalid transitions raise a clear error code the UI maps to a message.
- Each transition writes `activity_log` and creates `notifications` (assignment → assignee; ready for review → project managers; reject/approve → assignee; new comment → assignee and creator).
- The transition map lives in `packages/shared` and is reused for button visibility.

## 7. Security: RLS and storage

- Enable RLS on **every** table. Helper functions (SECURITY DEFINER, stable): `is_admin()`, `is_project_member(pid)`, `project_role(pid)`, `is_project_manager(pid)`.
- Policies follow the matrix in section 4. Examples: members see only projects they belong to; admins see all; `activity_log` has SELECT policy for members and **no** INSERT/UPDATE/DELETE policy for clients; `comments` insert requires member or higher and `author_id = auth.uid()`.
- **Storage** private buckets: `snag-photos`, `reports`, `branding`. Object path convention `{project_id}/{snag_id}/{uuid}.jpg`. Storage RLS reads the first path segment as the project id and checks membership. Serve via short-lived signed URLs.
- Invite flow runs server-side (Next.js route handler using the service-role key, admin-checked). Disable public signup in Supabase Auth settings.
- Validate all route-handler input with zod. Rate-limit the report endpoint. Never log tokens or signed URLs.

## 8. Web app features

Layout: left sidebar (projects, "My snags", notifications), top bar (search, user menu). Responsive down to tablet width.

1. **Auth:** email+password and magic link, forgot password, invite acceptance page.
2. **Dashboard** (role-aware):
   - Manager: **Review queue** (ready_for_review), overdue, unassigned, counts by status and by assignee, per-project progress.
   - Member: **My snags** grouped by due date and status.
3. **Projects:** list with progress bars; create/edit/archive (admin); project page tabs: **Snags · Locations · Team · Reports · Activity · Settings**.
4. **Snag list:** table and card views, filters (status, priority, assignee, location, category, due date, "created by me"), full-text search, sort, saved filter via URL query string. Bulk actions for managers (assign, change priority, export).
5. **Snag detail:** photos (issue and fix, side by side), markup, comments thread, activity timeline, assignee picker, status action buttons shown according to role and state, due date, priority, location, category.
6. **Create snag** (fast path): title, photos, location, priority, assignee optional. A "Save & add another" button.
7. **Team:** add existing users to project with a role, change role, remove, invite by email (admin or manager).
8. **Locations:** nested tree editor, reorder, optional plan image upload. Stretch: drop a pin on the plan to set `pin_x/pin_y` and show pins on the plan view.
9. **Real-time:** Supabase Realtime on `snags`, `comments`, `snag_photos` filtered by project; list and detail update live and show "updated by X" toasts. Handle reconnects.
10. **Notifications:** bell with unread count, mark as read, links to snag.
11. **Settings (admin):** company name/logo, terminology (snag/punch/defect/issue), date format, user management (invite, deactivate, make admin).
12. **Accessibility and UX:** keyboard accessible, dark mode, empty states, loading skeletons, optimistic updates with rollback on error, strings in a single i18n layer (English only for now).

## 9. Photos and markup

- Capture or pick up to 8 photos per snag. Client-side: resize to max 1600px longest edge, JPEG quality ~0.8, strip nothing needed but preserve orientation correctly (fix landscape/portrait rotation issues; do not force a square crop). Generate a 400px thumbnail. Record `taken_at`.
- Markup tools: freehand pen, arrow, circle/rectangle, text, measurement label, colour picker, undo/redo, move/delete objects. Save **both** the original and a flattened annotated JPEG, and the vector `annotation_json` so markup can be re-edited.
- Upload to Storage with retries; show per-photo progress.

## 10. Reports

Generated server-side (Next.js route handler, Node runtime, authenticated with the caller's Supabase JWT; verify the caller is manager/admin of the project). Mobile calls the same endpoint.

- **Formats:** PDF and Excel (.xlsx).
- **Content options (toggles):** cover page (company logo, project name/code/client/address, date, prepared by, summary counts by status and priority, signature block), include photos, include annotated vs original, photo size (small / medium / large / one per page), include comments, include timestamps (on/off), include fix photos, group by (location / assignee / status / category), sort by (number / priority / due date).
- **Filters:** status, assignee, location, category, priority, date range ("exclude closed before date X").
- **Themes:** at least three: *Classic* (table with thumbnails), *Compact* (dense, small photos), *Photo-first* (large photos, one snag per block).
- Use the organization's company name and terminology (e.g. "Punch List Report").
- Save every generated report in the `reports` bucket and `reports` table with an incrementing **revision** per project, and list them in the Reports tab (download, regenerate with the same options).
- Handle large projects: stream or batch photos, downscale for the PDF, set `maxDuration`, and fail with a readable error rather than timing out silently.
- Excel: one row per snag with all fields, a hyperlink column to the snag in the web app, and a summary sheet.

## 11. Mobile app features (Expo)

Same auth and role model. Focus on fast site use:

1. Login (email/password, magic link deep link), biometric unlock optional.
2. **Home:** "Assigned to me", "Ready for review" (managers), recent projects.
3. Project → snag list with filters and search; snag detail with all actions available to the role.
4. **Camera-first create flow:** take photo → markup → title/priority/location/assignee → save. Support continuous capture (take several photos in a row and create one snag per photo, fill details later).
5. Fix flow for assignees: open assigned snag → start work → take fix photo → mark ready for review.
6. Manager review flow: swipe/tap to approve or reject with required comment.
7. Push notifications (Expo push) for assignment, review requested, approved/rejected, comments; tapping opens the snag.
8. Generate and share a PDF/Excel report from the phone (calls the web report endpoint, opens the native share sheet).

### Offline-first sync (important)

Site basements and plant rooms have no signal. The mobile app must work fully offline for projects the user belongs to.

- Local `expo-sqlite` mirror of: projects, members, locations, categories, snags, comments, photo metadata (only for projects the user belongs to).
- **Outbox** table of pending mutations (create snag, edit, comment, transition, assign), each with a client-generated UUID (`snags.client_id`) so replays are idempotent.
- **Photo upload queue:** photos stored in the app file system, uploaded in the background with retry/backoff; the UI shows pending/uploading/failed state.
- **Pull sync:** per table `updated_at > last_sync_at` (include soft-deleted rows via `deleted_at`), plus Realtime while the app is in the foreground. Run on app start, foreground, connectivity regained, and pull-to-refresh.
- **Conflicts:** last-write-wins per field for plain fields (by server `updated_at`). Status/assignment changes go through the RPCs; if the server rejects one (e.g. already closed by someone else), keep the local intent in a "needs attention" list with a clear message and let the user retry or discard.
- Snag `number` is assigned by the server on sync; show "pending" until then.
- Always show sync status (online/offline, queued items count, last synced).

## 12. Notifications

- In-app notifications from the `notifications` table via Realtime on web and mobile.
- Push: a database webhook or a Supabase Edge Function triggered on `notifications` insert, which sends through the Expo push API to the user's `push_tokens`. Remove tokens that return `DeviceNotRegistered`.
- Optional (stretch): daily email digest of overdue and in-review items.

## 13. Hosting and deployment

- **Supabase:** hosted project. Manage schema only through migrations (`supabase db push`). Provide `supabase/seed.sql` with a demo org, 1 admin, 1 manager, 2 members, 1 viewer, a sample project with locations and 15 snags in various states.
- **Web:** deploy to Vercel (document env vars). Also support self-hosting with `output: 'standalone'` and a `Dockerfile` + `docker-compose.yml` for the web app, since this is internal.
- **Mobile:** EAS Build profiles for development, preview (internal distribution) and production; EAS Update for OTA JS updates; document TestFlight and Google Play internal testing steps.
- `.env.example` for each app, for example: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `NEXT_PUBLIC_APP_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUSH_ACCESS_TOKEN` (optional).
- GitHub Actions: on PR run lint + typecheck + tests + migration check; on main deploy web preview/production and run `supabase db push` with a protected secret.

## 14. Testing and quality

- **Database tests** (pgTAP or a vitest script using supabase-js with seeded test users): prove that a non-member cannot read a project's data or photos; a viewer cannot write; a member cannot assign, close or reject; a member cannot change status of a snag assigned to someone else; every invalid state transition fails; `snag.number` is sequential under concurrent inserts; the photo limit of 8 holds; activity log cannot be written by clients.
- **Unit tests** for the shared permission helpers and transition map.
- **E2E (Playwright)** for the golden path: manager creates project, adds member, member creates a snag with a photo, manager assigns, assignee works it to ready-for-review, manager rejects, assignee resubmits, manager approves, manager generates a PDF.
- Lint (ESLint), Prettier, `tsc --noEmit` in CI. Aim for no console errors in the browser during the E2E run.

## 15. Phases and acceptance criteria

**Phase 0: Scaffold.** Monorepo, tooling, CI, Supabase local setup, README. *Done when:* `pnpm dev` runs web, `supabase start` works, CI is green.

**Phase 1: Database, auth, security.** Full schema, enums, triggers, helper functions, RLS, storage buckets and policies, RPCs (`assign_snag`, `transition_snag`), seed data, invite flow, generated types in `packages/shared`. *Done when:* all DB tests in section 14 pass.

**Phase 2: Web core.** Auth, dashboard shell, projects, team management, locations, categories, snag CRUD with multi-photo upload, comments, activity timeline, filters and search. *Done when:* a member and a manager can collaborate on the same project in two browsers.

**Phase 3: Workflow and realtime.** Assignment, status actions, manager review queue, reject-with-comment, notifications bell, Realtime updates. *Done when:* the full workflow in section 6 works in the UI with correct role gating.

**Phase 4: Markup and reports.** Annotation editor on web, PDF + Excel report generation with themes, options, filters, revisions. *Done when:* a 100-snag project with photos exports a PDF without timeout and the three themes render correctly.

**Phase 5: Mobile online mode.** Expo app with auth, project and snag screens, camera flow, markup, assigned-to-me, manager review. *Done when:* all key flows work on a physical device against the hosted Supabase.

**Phase 6: Offline and push.** SQLite mirror, outbox, photo queue, sync and conflict handling, push notifications. *Done when:* airplane-mode create/edit/transition followed by reconnect syncs correctly with no duplicates, including a deliberate conflict case.

**Phase 7: Polish and ship.** PWA install, dark mode, empty/error states, performance pass (lists virtualized, images lazy and thumbnailed), Docker self-host option, EAS profiles, deployment docs, E2E suite. *Done when:* README lets a new developer deploy everything from scratch.

## 16. Out of scope (do not build unless asked)

Billing/subscriptions, public signup, multi-organization tenancy, AI features, custom checklist/inspection templates, BIM/CAD integration. Keep the schema flexible so these can be added later.

## 17. Definition of done

- All phases complete, CI green, DB/RLS tests passing, E2E passing.
- No secrets committed; `.env.example` files present.
- `docs/DECISIONS.md` lists every non-obvious choice.
- Seeded demo data lets me log in as admin, manager, member and viewer and see each role behave correctly.

Begin with Phase 0 now. Before writing code, briefly restate your plan for Phases 0 and 1 in `docs/DECISIONS.md`, then proceed.
