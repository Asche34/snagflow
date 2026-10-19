# REFACTOR-CANDIDATES

No oversized multi-responsibility files exist at this point (largest: migration 0005/0006 policy blocks — intended granularity).

Watchlist (revisit when they grow):

- `supabase/migrations/20261019000005_security.sql` + `0006` — helpers vs policies could merge someday; but migrations are append-only by rule, so "merge" means a new migration only if behavior changes.
- `packages/shared/src/schemas.ts` — will split per-domain if it exceeds ~300 lines during Phase 2.
