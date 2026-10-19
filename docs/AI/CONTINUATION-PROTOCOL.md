# CONTINUATION-PROTOCOL (universal resume procedure)

For every request, in order:

1. Read `AGENTS.md`.
2. Read `docs/AI/PROJECT-STATE.md`.
3. Classify the request: BUG | FEATURE | UI | DATABASE | DOC | SECURITY | REFACTOR.
4. Find module in `docs/AI/MODULE-INDEX.md`; find feature in `docs/AI/FEATURE-INDEX.md` (or confirm "planned").
5. Build a minimal CONTEXT SET (3–10 files) from the indexes. Example:

```
CONTEXT SET — FEAT-SNAG-WORKFLOW
- packages/shared/src/workflow.ts
- packages/shared/src/permissions.ts
- supabase/migrations/20261019000007_workflow_rpc.sql
- supabase/tests/workflow.test.ts
load nothing else
```

6. Load only those files (+ sub-AGENTS.md when working in apps/web or apps/mobile).
7. Make the minimal change. New schema? → new migration file only.
8. Run the touched suites (`docs/AI/TESTING.md` matrix).
9. Run non-regression: full gate `pnpm turbo run build lint typecheck test` once before claiming done.
10. Update `docs/AI/PROJECT-STATE.md` (and `CHANGELOG.md` for shipped phases).
11. Regenerate indexes ONLY if the file/route/migration structure changed: `node scripts/ai/update-index.mjs`.
12. Append non-obvious decisions to `docs/DECISIONS.md`.

## Hard rules

- **Never audit the entire repository on a new request.**
- Never re-derive rules that indexes already answer (BUSINESS-RULES.md, DATABASE-INDEX.md).
- Docs vs code conflict → trust code+tests, then FIX the stale doc (trust hierarchy in AGENTS.md).
- Don't start a later phase if an earlier one is incomplete per PROJECT-STATE.md.
