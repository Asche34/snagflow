# Team and Invitations Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans natively, one independent final review.

**Goal:** Secure project team management and complete new-account invitation acceptance.
**Architecture:** Authenticated, project-scoped SQL RPCs with existing permission contracts;
server-only privileged email route; existing Fieldwork controls and public invite completion.
**Tech Stack:** Next 16, strict TS, existing Zod/Supabase, PostgreSQL, Vitest/Playwright.
**Spec:** `docs/superpowers/specs/2026-10-29-team-invites-design.md`

## Constraints/review focus

- Never grant org account creation to managers; scope every membership operation to its project.
- Use canonical confirmed Auth email, fresh active authority and no global user directory.
- Never serialize service secrets or bearer invite tokens into team client props.
- Canceled/expired/wrong-user/accepted tokens never grant or restore access.
- Network/delivery uncertainty must remain reviewable and retryable without duplicate membership.

## Task 1: Database lifecycle and contracts

Create migration13, `supabase/tests/team.test.ts`, shared schemas/tests as needed; regenerate types.
RPC interfaces: `add_project_member(email,project,role)`, `set_project_member(project,user,role nullable)`;
`prepare_project_invite(id,email,project,role)`, `cancel_project_invite(id)`,
`get_my_project_invite(token)`, `accept_project_invite(token,name)`.
- [x] Write DB regressions and observe baseline failures, implement RPCs with grants restricted
  to authenticated users, apply locally and verify GREEN.

## Task 2: Team UI, delivery and acceptance

Create team actions/loader/components, server-only admin client, invitation route and public
acceptance page. Modify project Team content, proxy exception, local redirect configuration
and Docker runtime env plumbing. Add real-browser team/invitation tests.
- [x] Observe missing UI baseline failure; implement typed schemas, exact-email add, per-row
  role/removal controls, pending list/cancel/retry and admin send form.
- [x] Complete Auth callback/session and name/password setup with token/email-bound DB acceptance.
  Verify real local email link and invalid/revoked/replay paths, roles and phone accessibility.

## Task 3: Delivery
- [x] Run touched-package gates and full real browser/shared/DB/Fieldwork regressions; inspect visuals.
- [x] Fresh independent security/correctness review; reproduce/fix important findings.
- [x] Update state/indexes/decisions/deployment report; final integration is commit/push main with remote-SHA verification at delivery.

## Ledger

- Main `cd0a3b5` clean and confirmed pushed. Reuse installed checkout, PowerShell ledger,
  installed CLIs and RTK as in prior slices. User routine-autonomy and main-push preference persists.
- Ruling: spec §4/§7 admin account-creation authority wins over §8's manager invitation shorthand.
- Pre-flight: task2 consumes task1 RPC contracts/types; task3 verifies both. No interface conflict.
- Task1: DB missing-RPC RED; new non-member test then caught nullable permission guard, fixed with coalesce(false); six lifecycle cases GREEN. Two shared schema cases RED→GREEN.
- Task2: missing team controls RED; nine final real browser cases GREEN, including captured real Auth emails, session-loss recovery, self-role confirmation and post-error draft retention.
- Final review: team_review fresh read-only agent; P2 consumed-link recovery reproduced/fixed with a real browser. Self-role requirement implemented with RED→GREEN. No critical/important findings remain.
- Final: minor (deferred): delivery failure/retry, lost accepted-response, self-removal and expired-token browser cases; SQL covers the corresponding security/lifecycle invariants.
- Task3 evidence: web build, shared declaration build, package gates; browser46/46, UI8/8, shared39/39, DB38/38, SQL25/25; compose interpolation valid, browser service-key scan0/22. No hosted stack or real external recipients changed.
