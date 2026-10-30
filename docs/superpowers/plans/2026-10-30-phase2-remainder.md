# Phase 2 remainder

User-authorized native execution from main `68e3a38`; reuse this checkout and installed dependencies. Routine design choices and execution are authorized without further approval.

## Design

Keep Fieldwork tokens and existing shared permissions. Project Locations gains location and category management for managers/admins; members/viewers see read-only lists. Support creation, rename, location parent/order editing, and confirmed deletion of unused leaves. Stable UUIDs make creation retries safe. Database constraints protect historical references, including deleted snags, and reject cycles/cross-project parents. No hosted changes or database reset.

Place comment composition in the Comments card. Validate with the shared schema, retain drafts on errors, focus feedback, clear only after confirmed success, and reconcile response-loss retries by stable comment UUID and exact author/snag/body. Existing database RLS remains authoritative. Do not add comment editing/deletion or Phase 3 realtime.

## Tasks

1. Add real DB regressions for metadata permissions, historical reference preservation, hierarchy constraints and safe unused deletion. Observe failing preservation tests; add migration 14 and apply locally without reset. Existing database permissions remain unchanged.
2. Add real-browser metadata cases; observe absent controls. Implement project-scoped metadata read/actions and labeled responsive forms with pending locks, confirmation, error focus and root layout invalidation. Test create/rename/reparent/order/delete, duplicate category, role revocation and preserved snag references.
3. Add real-browser comment cases; observe draft/composer/retry failures. Implement shared validation, idempotent posting and thread composer with focused errors, count/limit, pending state, draft retention and refreshed thread. Test member/manager collaboration, viewer gating, network failure and committed response loss.
4. Stop standalone server before build. Run production build, lint/typecheck of touched packages, shared and real DB suites, real Chrome suite and fixture UI suite using distinct output directories. Inspect desktop/375px enlarged-text screenshots. Run transactional authorization SQL and AI docs/index validation.
5. Obtain fresh independent read-only review from baseline 68e3a38, fix substantive findings with regressions, update handoff/decision/index docs, commit and push main. Confirm remote SHA.

## Review focus

- Hidden soft-deleted snag references must prevent metadata deletion.
- Stale permissions and foreign-project IDs must fail in Postgres.
- Parent moves must not introduce cycles, including concurrent moves.
- Response loss must not duplicate comments or metadata; changed drafts must not be silently discarded.
- Metadata lists must be project-scoped and not silently truncated by the global workspace cap.

## Execution ledger

- Design/plan: user requested autonomous completion, independent review and push to main; working in place preserves installed standalone paths and dependencies.
- Task 1 complete: historical-reference and hierarchy tests failed on the baseline; local migration 14 applied without reset and ledger recorded. `node supabase/node_modules/vitest/vitest.mjs run --root supabase` → 46 passed, including five concurrent opposite-move trials within the fourth new metadata case.
- Tasks 2–3 complete: browser controls/composer, metadata/comment caps, unavailable-thread and success-focus regressions failed before implementation/fixes. Production Chrome run → 61 passed; fixture UI run → nine passed. Exact and changed response-loss retry, current authority, draft preservation and two-browser collaboration verified.
- Ruling: inherited global workspace metadata caps affected capture selectors; use project-scoped pagination in both project view and snag form. Comment cap/read-error ambiguity was within the requested polish and was corrected following independent review.
- Task 4 complete: production build, web/shared/DB/E2E configured lint/typecheck, shared declarations, 39 shared units, 25 rolled-back SQL authorization assertions, generated-type refresh (unchanged), docs/index validation and diff whitespace passed. Screenshots inspected at 1440px/375px/enlarged text; landscape and reduced motion exercised. Targeted total: 180 checks. An extra shared `eslint .` run found three pre-existing test-import errors; configured `eslint src` passes.
- Independent review complete: four findings fixed with regressions; follow-up reviewer reported no open findings. Deferred coverage minor carried forward: inactive-user archive/delete lifecycle regressions. Hosted behavior and full mobile/monorepo gate are outside local verification.
- Task 5: handoff/decision/index docs updated; commit and push main after final checks, as explicitly authorized by the user.
