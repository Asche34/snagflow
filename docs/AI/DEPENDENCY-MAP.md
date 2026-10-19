# DEPENDENCY-MAP

Functional dependencies only. `A → B` = A depends on B.

```
apps/web (Phase 2+)
  → packages/shared (permissions gating, schemas, workflow map, db-types)
  → Supabase JS client (RLS tables, RPCs, storage, realtime)

apps/mobile (Phase 5+)
  → packages/shared
  → Supabase JS client + expo-sqlite outbox (Phase 6) → snags.client_id idempotency

packages/shared
  → mirrors (must stay in sync, see AGENTS.md §Sync contracts):
      workflow.ts  ↔ transition_snag RPC
      permissions.ts ↔ RLS policy matrix + public.can() helper
      schemas.ts   ↔ DB CHECKs
      db-types.ts  ↔ migrations (generated)
      terminology.ts ↔ org_settings.terminology
```

Layering rules:

- `packages/shared` must NOT import app code or supabase-js (stays dependency-light).
- DB must not depend on app code; app code must never hand-roll authorization rules.
- Tests may import shared freely; DB tests use only `supabase/tests/helpers.ts` for clients.
- Seed (`supabase/seed.sql`) user IDs ↔ `supabase/tests/helpers.ts::UIDS` (break = tests break).
