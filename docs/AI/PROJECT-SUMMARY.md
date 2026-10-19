# PROJECT-SUMMARY — business context

## Purpose

Construction/engineering teams run site inspections where defects ("snags") must be
captured (photo + location + category), assigned to a responsible engineer, fixed
(photo proof), then reviewed and closed by a manager. SnagFlow digitizes that loop
and replaces single-user Android apps (BuildReport Pro / SnagBricks / AuditBricks
class) with a shared, real-time, role-aware platform.

## Users (single org, invite-only — no public signup)

| Role    | Capabilities (matrix: packages/shared/src/permissions.ts)                |
| ------- | ------------------------------------------------------------------------ |
| Admin   | manage users (invite/deactivate/admin flag), create/manage any project    |
| Manager | edit project, manage members, assign snags, approve/close, reject, reopen |
| Member  | create snags, work assigned snags (start → fix photos → ready for review) |
| Viewer  | read-only access to assigned projects                                     |

## Core workflows

1. **Create**: title + photos (≤8) + location + category + priority (member+)
2. **Assign**: manager/admin picks a member (status unchanged)
3. **Work**: assignee starts (open→in_progress), adds fix photo(s), asks review
4. **Review**: manager approves (→closed) or rejects with required comment (→in_progress, rejection_count++)
5. **Reopen**: manager, comment required (closed→open)
6. **Report** (planned Phase 4): PDF/Excel with themes/photo options/filters, saved per revision

## Modules

- MOD-SHARED: single source of truth for roles/permissions/status machine (UI gating)
- MOD-DATABASE: Supabase Postgres — the enforcing authority (RLS, triggers, RPCs)
- MOD-WEB (Phase 2+): workspace app — dashboard, project pages, snag lists
- MOD-MOBILE (Phase 5+): site app — camera-first flows, offline outbox

## Integrations

- Supabase Auth (email+password, magic link), Storage (private buckets, signed URLs),
  Realtime (Phase 3), Expo push (Phase 6, edge function `push-send` planned),
  PDF/Excel generation (Phase 4, server-side route handler).

## Constraints

- Internal tool: no billing, no public signup, moderators = admins invite people.
- Often poor connectivity on site (Phase 6 offline-first is a hard requirement).
- Hosted web + installable app; keep multi-org option open but single-org now.
