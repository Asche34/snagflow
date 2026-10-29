# SnagFlow Fieldwork UI redesign

Status: approved by the user on 2026-10-29.

## Intent

Make the existing construction defect-tracking web app easier to scan at a desk and use on site. Managers should immediately see review work; members should find assigned snags quickly. The user selected **A · Fieldwork** in the interactive mockups on 2026-10-29.

This is a redesign of the delivered web screens, using the existing Next.js, React, Tailwind, Radix and Lucide stack. Expo implementation remains a later phase. Earlier authorization fixes remain intact and are not part of this change.

## Approaches considered

- **Fieldwork — selected:** dark forest navigation, warm orange actions, light neutral workspace. Strong separation between navigation and working content; fits construction operations. Requires independently checking light-on-dark navigation contrast.
- **Clearview:** white navigation, blue actions, cool surfaces. Familiar office-app appearance with softer separation. The user chose Fieldwork instead.

The mockups establish the visual direction. Their illustrative data and planned controls do not imply that missing product features are implemented.

## Goals and boundaries

- Unify layout, typography, colors, status treatments, forms, loading and empty states across login, dashboard, project Snags/Locations/Team tabs and snag detail/actions.
- Restore project navigation below tablet width; the current sidebar disappears without a replacement.
- Preserve actual data, authentication, URL-based filters/tabs, existing role gating, and workflow RPC behavior.
- Do not add snag creation/editing, photo uploads, notifications, reports, invitations, project/team management, or new backend behavior in this redesign. Do not render controls for unavailable actions.
- Avoid unreadable density, clipped titles, color-only status meanings, inaccessible mobile menus, and decorative content that displaces real work.

## Visual system

These exact tokens are the implementation proposal, inferred from the selected mockup rather than individually chosen by the user:

| Role                              | Color                 |
| --------------------------------- | --------------------- |
| Navigation surface / text         | `#192d25` / `#e9f0e7` |
| Navigation active surface         | `#30463a`             |
| Workspace background              | `#f6f7f4`             |
| Card surface / main text          | `#ffffff` / `#202b26` |
| Secondary text                    | `#58675e`             |
| Primary action / text             | `#c2410c` / `#ffffff` |
| Subtle orange surface             | `#fff1e8`             |
| Borders                           | `#d4dcd2`             |
| Keyboard focus on light surfaces  | `#1d4ed8`             |
| Keyboard focus on dark navigation | `#facc15`             |

Use semantic CSS variables rather than raw colors scattered through components. Status colors are separate from the orange action color: open uses neutral slate, in progress blue, ready for review amber, closed green. Critical/overdue uses deep red. Every status retains its full readable label; counts and progress include text equivalents.

Use the already-loaded **Geist Sans**, connected to Tailwind's sans font token and body, with Geist Mono for snag numbers/project codes. No new font download or decorative display face. Body/form text is 16px; dense row text may be 14px; supporting metadata is at least 12px. Page headings are approximately 28–32px desktop and 24–28px phone. Use tabular numerals for metrics, moderate font weights and comfortable line height. The mockups' scaled preview text is not the production type scale.

Use a 4/8px spacing rhythm, restrained 8–12px corner radii, fine borders and minimal shadows. Reserve orange for the brand, selected state and real actions. Avoid gradients and unnecessary motion. Keep existing dark-theme support functional through corresponding tokens; a new theme switch is outside this pass.

## Layout and navigation

- **Desktop, 1024px and above:** persistent dark sidebar about 248px wide; compact topbar with company/user identity and sign out; main content constrained to about 1280px with adaptive 24–32px gutters. Sidebar highlights the current dashboard/project using route-aware active states.
- **Below 1024px:** sidebar becomes an accessible menu drawer opened from a clearly labelled topbar button. It lists the actual projects and dashboard, closes on navigation/Escape, traps focus while open and restores focus to its trigger. Reuse Radix Dialog for focus/scroll behavior.
- **Phone:** 16px content gutters and a small persistent bottom navigation with Overview, Projects (opens the project drawer), and My snags (existing dashboard section anchor). No placeholder Alerts or New snag destination. Give scroll content sufficient bottom clearance and respect safe-area insets.
- Maintain a visible skip-to-content link, one main landmark, labelled navigation landmarks, and a logical heading hierarchy.

## Existing screens

### Login

Use the Fieldwork brand treatment and a quiet neutral canvas. Keep the existing email/password form, exact accessible labels, validation errors, pending state and conditional demo-account display. Inputs and submit action are comfortable to tap. Do not add unsupported magic-link/reset-password buttons.

### Dashboard

Lead with the user's real name and a concise contextual subtitle. Display the existing status/overdue/unassigned counts in a responsive metric grid. Prioritize the existing review queue for reviewers and My snags for members; retain project progress and overdue content. Use clearly separated sections and full status labels. Mixed-role users' review queue should include only projects where they are reviewers, using existing shared permissions; this is correct UI scoping, not an authorization change.

Use the existing data, not the mockup's sample counts, clock/date or team sizes. No new dashboard search, create button or notification bell without working functionality.

### Project

Give the project name, code and user role a clear hierarchy. Keep real summary metrics and Snags/Locations/Team URL navigation. Keep status filters as links, indicate the current selection accessibly, and wrap controls without clipping. Locations preserve the current hierarchy; Team preserves real names, emails and roles. Remove misleading management affordances where no management flow exists.

### Snag list and detail

Desktop snag rows align number, title, assignee/project, status, priority and due date. Phone rows stack into readable cards; due dates remain visible, and long titles wrap. Preserve the full accessible link name.

Snag detail uses a main content column and a secondary details/actions column, stacked on phone. Keep all current comments, activity, metadata and role-gated transition forms. Make required rejection/reopen comments explicit, and keep pending/errors visible. Existing photo placeholders use plain user-facing empty-state text without implementation-phase terminology. Do not imply working uploads or images where only metadata exists.

## Accessibility and interaction requirements

- Check normal text contrast at 4.5:1; large text and meaningful UI graphics at 3:1. Verify status, hover, focus and dark variants separately.
- Use semantic links/buttons, visible labels, decorative icon hiding, and descriptive names on icon-only controls. Touch targets are at least 44×44px.
- Visible keyboard focus must not be obscured by sticky bars. Drawer keyboard operation and focus return must work. Active navigation uses `aria-current` where appropriate; filter links retain link semantics rather than pretending to be keyboard tabs.
- Maintain readability at 200% zoom and responsive reflow at 320–375px. Avoid page-level horizontal scrolling; wrap long titles/names and narrow layouts.
- Respect reduced-motion preferences. Use simple color transitions, no entrance choreography or new animation library. Preserve useful pending indicators and error announcements.

## Implementation discretion

The builder may settle exact spacing, component extraction, icon choices within Lucide, small wording changes, and CSS breakpoint details while preserving this layout and scope. Reuse existing primitives and server data boundaries. Add only the client boundaries needed for active navigation and the mobile drawer. Do not move unrelated files or rewrite the data layer.

## Verification and completion

- Inspect installed Next.js version-specific documentation before touching app code, as required by apps/web/AGENTS.md.
- Validate dashboard, project and snag-detail layouts at 375, 768, 1024 and 1440px, plus 200% zoom, keyboard navigation, drawer focus return and reduced motion.
- Use meaningful browser regression coverage for mobile project navigation and existing role-gated actions; preserve the auth suite. Do not add tests that only assert CSS class strings.
- Run web lint, typecheck and production build; shared tests if permission consumers change; browser/auth checks with the real Supabase stack when available. Verify representative admin, manager, member and viewer behavior. Report environmental skips explicitly.
- Keep a clearly labelled, development-only fixture preview available for visual checking if the local backend is unavailable; fixtures never replace production data or become a public app route.
- Record decisions and update PROJECT-STATE after implementation. No deployment or hosted database changes are included.

Current environment limitation: the prior review could not complete full web/mobile dependency installation or run Docker/Supabase. Try the normal setup first, then report any remaining verification limits honestly. The existing isolated PostgreSQL check results do not establish browser behavior.
