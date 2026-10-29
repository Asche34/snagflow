# Snag Search Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; one fresh final review.

**Goal:** Shareable project snag filtering/search that operates on all authorized rows.
**Architecture:** Normalize GET parameters, query Supabase with RLS before stable pagination,
render a server form/list with project-wide exact statistics. Generated indexed search vector.
**Tech Stack:** Next 16, strict TypeScript, existing Tailwind Fieldwork controls, PostgreSQL, Playwright.
**Spec:** `docs/superpowers/specs/2026-10-29-snag-search-design.md`

## Constraints and review focus

- Preserve authorization, capture and Fieldwork styling. No dependency additions.
- URL repetition/malformed IDs must not crash or produce backend errors.
- Search punctuation must never become PostgREST filter syntax.
- Exact counts and pagination cannot use capped workspace snags.
- Priority ties/due nulls must have deterministic ordering.
- Filtering must not turn backend failure into a misleading no-results response.

## Task 1: Search/filter backend and form

Files: create `e2e/tests/filters.spec.ts`, `apps/web/src/lib/snag-filters.ts`,
`apps/web/src/lib/project-snags.ts`, `apps/web/src/components/snag-filters.tsx`,
`supabase/migrations/20261029000012_snag_search.sql`; modify `lib/data.ts`,
`components/project-view.tsx`, project `page.tsx`, generated shared `db-types.ts`.

Interfaces: `parseSnagFilters(QueryParams): SnagFilters`,
`snagFiltersHref(projectId, filters, overrides): string`,
`loadProjectSnags(projectId, userId, filters)` returns page rows/count/page/stats/error.

- [x] Write real backend/browser tests with disposable project fixtures for form/combined
  filtering, full-text/number search, due presets, URL restore and malformed values.
- [x] Run filters suite against baseline; confirm expected missing-feature failures.
- [x] Implement migration, normalization, query loader and Fieldwork GET form. Use exact
  counts, 50-row pages, number tie-breakers, null-last due sort and error display.
- [x] Apply local migration, regenerate DB types, build and run tests to green.

## Task 2: Boundary verification and delivery

Files: same test file; fixture transport as required for new query shape; AI feature/state
and delivery docs, DECISIONS and generated indexes/manifest as required.

- [x] Add/execute boundary coverage: >1,000 rows, independent stats, RLS, stale pages,
  punctuation/repeated URL parameters and responsive/enlarged text.
- [x] Run existing real browser and Fieldwork UI suites, shared/database tests and
  lint/typecheck/build for touched packages; inspect screenshots and git whitespace.
- [x] Request one independent whole-change review; reproduce/fix important findings with tests.
- [x] Record exact verification and deployment limits; final integration is the authorized commit/push to main with remote-SHA verification at delivery.

## Execution ledger

- Baseline: clean checkout; main fast-forwarded to origin/main `6072b8f`.
- Native execution authorized by routine-autonomy instruction; reuse installed checkout.
- Pre-flight: Task 2 consumes Task 1's URL/query behavior; interfaces agree.
- Ruling: use native PowerShell ledger instead of Bash task scripts on this Windows workspace.
- Task 1: complete; missing search control RED, implementation GREEN; production build and eight real search cases pass.
- Task 2: final production browser suite 30/30; fixture UI 8/8; shared 37/37; DB API 29/29; SQL 25/25; package lint/typecheck/build pass. AI docs/whitespace checked at delivery.
- Integration regression: capture test matched a retained hidden filter label; visible/role locators fix the test, and the final complete suite is green.
- Final review: fresh read-only search_review agent, no important/critical finding. Completed capture/later phases/global metadata caps remain outside scope.
- Final: minor (deferred): capture a single request clock across count/fetch at midnight.
- Final: minor (deferred): explicit repeated-UUID/backend-failure UI assertions; implementation inspected, broader coverage deferred.
