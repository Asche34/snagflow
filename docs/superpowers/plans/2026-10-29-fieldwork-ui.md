# Fieldwork UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Fieldwork design to SnagFlow's existing web screens and make project navigation usable on phones.

**Architecture:** Preserve server-side Supabase loaders and workflow actions. Add a small client navigation component receiving serializable project/user summaries, with Radix Dialog for the mobile drawer. Use semantic CSS tokens and existing UI primitives for consistent styling.

**Tech Stack:** Existing Next.js 16, React, TypeScript, Tailwind v4, Radix Dialog, Lucide, Playwright; no new UI framework.

**Spec:** `docs/superpowers/specs/2026-10-29-fieldwork-ui-design.md` (approved).

## Global Constraints

- Preserve authentication, actual data, existing URL tabs/filters, role gating and workflow RPCs.
- No new snag CRUD, uploads, notifications, reports, project/team management or backend work.
- Geist Sans for body text; Geist Mono for codes. Body/form text 16px, dense rows 14px, metadata at least 12px; touch targets at least 44×44px.
- Use semantic tokens: navigation `#192d25`, primary `#c2410c`, canvas `#f6f7f4`, text `#202b26`; normal text contrast at least 4.5:1.
- Persistent sidebar from 1024px; drawer below; phone bottom navigation uses existing Overview, Projects drawer, and My snags section destinations.
- No production fixture routes, unrelated file moves, database migrations or deployments.
- Existing security-review edits are uncommitted. Preserve them, and stage only this redesign's paths when committing. Do not reset the workspace or silently discard earlier edits.

## Review Focus

1. A keyboard user opening the drawer can Escape and regain trigger focus (Task 2).
2. A long project/snag title at 375px remains readable without horizontal page overflow (Task 3).
3. A manager in one project and member in another sees only actionable items in their review queue (Task 3).
4. A viewer cannot gain workflow/comment controls through the redesigned UI (Task 3).
5. Fixed phone navigation does not obscure focused controls or the last content at 200% zoom (Task 4).

## File responsibilities

- `apps/web/src/app/globals.css`, `app/layout.tsx`: semantic palette, font binding, focus/reduced-motion foundation.
- `apps/web/src/components/ui/{button,input,textarea,select,badge,card,dialog}.tsx`: shared sizing, surfaces and legibility.
- `apps/web/src/components/workspace-navigation.tsx` (new): active navigation, controlled mobile drawer and phone navigation.
- `apps/web/src/components/app-sidebar.tsx`, `app-topbar.tsx`, `app/(app)/layout.tsx`: supply navigation data and compose responsive shell.
- `apps/web/src/components/{dashboard-view,project-view,snag-list,snag-view,snag-actions}.tsx`, `lib/labels.ts`: existing screens/status presentation and per-project review scoping.
- `apps/web/src/app/login/{page,login-panel,login-form}.tsx`: Fieldwork login layout preserving labels and action behavior.
- `e2e/tests/fieldwork.spec.ts` (new): navigation, responsive content and role-gating regressions.
- `e2e/fixtures/fieldwork-api.mjs`, `e2e/playwright.ui.config.ts` (only if real stack unavailable): local-only HTTP fixture transport and dedicated UI test configuration. Reuse actual app routes/components; do not change application loaders to recognize fixtures. Keep real Auth/API suites separate.
- `docs/DECISIONS.md`, `docs/AI/PROJECT-STATE.md` and affected indexes: implementation/verification handoff.

### Task 1: Install/inspect the web runtime and establish the Fieldwork foundation

**Produces:** semantic CSS variables, working font-sans/font-mono bindings, readable shared primitives.

- [ ] Install locked web/test dependencies with a filtered install; retry registry timeouts with a bounded download timeout. Do not upgrade package versions. Read applicable Next.js guides from the installed `next/dist/docs/` before app edits, as required by `apps/web/AGENTS.md`.
- [ ] Run the existing shared tests and relevant package lint/typecheck to record a baseline; record environmental failures separately.
- [ ] Update global tokens and existing dark variants from the spec; connect Geist font variables. Give shared buttons/inputs/selects/textareas 44px minimum control height, visible focus, and reduced-motion support without replacing their APIs.
- [ ] Update badges to preserve full labels, wrapping, and accessible semantic colors; avoid clipping or white-on-orange combinations outside the verified primary pair.
- [ ] Run `pnpm --filter web lint`, `pnpm --filter web typecheck`, and `pnpm --filter web build`. Verify font and palette in the running app. Pure style changes receive visual checks, not CSS-string unit tests.
- [ ] Review the diff and commit the foundation paths after checks pass.

### Task 2: Implement responsive, accessible workspace navigation

**Consumes:** Task 1 tokens and existing workspace loader.

**Produces:** `WorkspaceNavigation({ projects, isAdmin }: { projects: Array<{ id: string; name: string; code: string; roleLabel: string }>; isAdmin: boolean })` as a client component. It derives route state with `usePathname`, owns one drawer instance, and provides labelled menu/project triggers, sidebar links and phone navigation. Server shell supplies only these summaries, not Supabase clients or full workspace data.

- [ ] Add Playwright tests at 375px for a signed-in fixture/seeded manager: `getByRole('button', {name:'Open navigation'})` is visible; clicking it exposes `getByRole('dialog', {name:'Workspace navigation'})`; selecting an actual project navigates and closes it. Add an Escape test asserting the trigger is focused afterward. Run these against the old shell and confirm the expected missing-navigation failure.
- [ ] Prefer the real Supabase stack. If unavailable, create the test-only fixture transport/config described above: bind to 127.0.0.1, use deterministic manager/member/viewer identities, project and snag rows, and only the Auth/REST responses needed to render actual screens. Dedicated `test:ui` config must not replace or weaken existing real Auth/API tests. Label fixture runs as UI-only verification.
- [ ] Build navigation with existing Radix Dialog primitives, accessible title/description, explicit close behavior, focus return, active link `aria-current`, and no dead links. Add `id='main-content'` plus skip link and `id='my-snags'` for the existing dashboard section.
- [ ] Update the shell with 248px desktop sidebar from 1024px, adaptive content gutters, and bottom safe-area/content clearance on phones. Preserve Suspense boundaries and sign-out form behavior.
- [ ] Re-run navigation tests at 375px and 768px; check persistent sidebar at 1024px and 1440px, and verify actual project links still respect loaded project visibility.
- [ ] Run web/E2E lint and typecheck; commit the shell/navigation changes after green checks.

### Task 3: Apply Fieldwork to login, dashboard, project and snag screens

**Consumes:** existing loader models, shared permission helpers, Task 1 primitives and Task 2 shell. No changes to loader signatures or mutation RPCs.

- [ ] Extend `fieldwork.spec.ts` with a long snag/project title fixture and assert the full title is visible at 375px and `document.documentElement.scrollWidth <= window.innerWidth`. Add mixed-role dashboard data and assert review cards exclude projects where the current user is only a member. Add viewer detail coverage asserting no transition/comment forms. Confirm the corresponding failures before behavior changes.
- [ ] Restyle login with Fieldwork branding and quiet background. Preserve exact Email/Password labels, autocomplete, error announcements, sign-in text and demo-account environment gate so existing auth tests remain meaningful.
- [ ] Restyle dashboard with stronger heading/metrics hierarchy, role-aware review/My snags sections and real project progress. Filter review queue by `isReviewer` for each snag's project; preserve all actual stats and remove unsupported action affordances.
- [ ] Restyle project heading, summary cards, URL tab/filter links and readable Locations/Team content. Retain full status labels and current selection semantics; no management buttons without a working flow.
- [ ] Restyle snag lists into aligned desktop rows and stacked phone cards, retaining due dates on phones and allowing title/metadata wrapping. Restyle detail content/actions into responsive columns. Keep all comments/activity/transitions and plain user-facing photo empty text.
- [ ] Run the new behavior tests, existing real auth suite when available, web/E2E lint/typecheck and production build. Inspect actual screenshots, not just test output.
- [ ] Commit screen changes after verification; do not include earlier unrelated security edits.

### Task 4: Visual/accessibility review and handoff

**Produces:** verified responsive Fieldwork screens, clear verification limits, and updated project state.

- [ ] Capture dashboard, project and snag detail at 375, 768, 1024 and 1440px. Verify no unexpected page overflow, long-title wrapping, due dates, focus visibility, usable drawer and readable status labels. Check login separately.
- [ ] Check keyboard navigation, Escape/focus restoration, skip link, 200% zoom/reflow, fixed-bar clearance and reduced motion. Confirm admin/manager/member/viewer gates remain correct; fixture results prove presentation, not real authorization.
- [ ] Check text/background color pairs including statuses, navigation, focus and retained dark tokens. Do not claim complete accessibility conformance from contrast checks alone.
- [ ] Run shared tests plus touched package lint/typecheck, production build and applicable browser suites once after final changes. Report the exact suite/counts and anything skipped. Do not rerun unavailable full-stack suites as if skipped results were passes.
- [ ] Request a fresh code review of the final redesign diff. Fix verified issues, recheck the affected behavior, and retain the security-review edits unchanged.
- [ ] Update decisions, PROJECT-STATE, repository/index files when structure changes, run `node scripts/ai/update-index.mjs`, `node scripts/ai/check-ai-docs.mjs` and `git diff --check`. Commit the validated redesign changes and report local status, screenshots and remaining setup limits. Nothing is deployed.

## Execution recommendation

**Native execution** is recommended: this is one cohesive UI change with shared tokens and closely coupled shell/screen components. I implement the tasks in this chat, then a fresh reviewer checks the final diff. Subagent-driven execution is available if the user prefers a separate implementer/reviewer cycle for each task.
