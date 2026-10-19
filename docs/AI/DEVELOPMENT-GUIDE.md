# DEVELOPMENT-GUIDE

## Setup (Windows)

```powershell
pnpm install
supabase start          # needs Docker Desktop; see PATH quirk in AGENTS.md
supabase.cmd db reset   # migrations + seed
pnpm db:gen-types
```

Copy `supabase/tests/test.env` values from `supabase.cmd status` (see TESTING.md).
App env files: copy `apps/web/.env.example` → `apps/web/.env.local` (Phase 2 uses it).

## Daily loop

```powershell
pnpm dev                        # web on :3000 (mobile: pnpm --filter @snagflow/mobile start)
pnpm turbo run build lint typecheck test
node scripts/ai/update-index.mjs   # after adding/removing files/routes/migrations
node scripts/ai/check-ai-docs.mjs
```

## Conventions

- TypeScript strict; no `any` without a justification comment.
- Commits: one phase/feature per commit; messages `phase N: summary` style; no push without asking.
- Formatting: prettier config at root; editorconfig enforced.
- Note for Expo/Next version quirks: sub-AGENTS.md files (`apps/web/AGENTS.md`, `apps/mobile/AGENTS.md`) apply in addition.
- Schema work: new migration in `supabase/migrations/` (numbered, append-only), then `pnpm db:gen-types`, then update DB tests if behavior changed.

## Definition of done (per deliverable)

1. Implementation + tests touched/added.
2. Related suites green (`TESTING.md` matrix).
3. `docs/AI/PROJECT-STATE.md` updated; indexes regenerated if structure changed.
4. Non-obvious decisions appended to `docs/DECISIONS.md`.
