# MODULE-INDEX

| Module       | Description                                  | Backend                     | Frontend            | DB tables                        | Tests                          | Doc                       |
| ------------ | -------------------------------------------- | --------------------------- | ------------------- | -------------------------------- | ------------------------------ | ------------------------- |
| MOD-SHARED   | roles, permission matrix, transitions, zod schemas | — (mirrored in DB)     | imported by web/mobile | —                              | `packages/shared/tests`        | `docs/AI/BUSINESS-RULES.md` |
| MOD-DATABASE | schema, RLS, RPCs, storage policies, seed    | `supabase/migrations`       | —                   | all (`docs/AI/DATABASE-INDEX.md`) | `supabase/tests`               | `docs/AI/SECURITY.md`     |
| MOD-WEB      | Next.js workspace app (auth, dashboard, projects, snag detail) | —                           | `apps/web/src`      | via RLS client                   | turbo build/typecheck (Phase 2+) | —                       |
| MOD-MOBILE   | Expo field app: auth, durable offline capture/sync, markup, workflow, reports and opt-in push | `supabase/functions/push-send` | `apps/mobile/src` | via user-session RLS/RPCs; local SQLite | `apps/mobile/tests`, isolated mobile browser suite | `docs/AI/PHASE6-OFFLINE-PUSH-2026-11-04.md` |
| MOD-CI       | quality gate                                 | —                           | —                   | conditional DB job               | —                              | `.github/workflows/ci.yml` |
