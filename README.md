# SnagFlow

Collaborative snagging / punch-list / defect tracking for construction and engineering
teams. Web app + mobile app on one Supabase backend.

**Status:** Phase 0 (scaffold) — see `docs/DECISIONS.md` for decisions and the plan.

## Repository layout

```
snagflow/
  apps/web/            Next.js app (App Router, TypeScript, Tailwind v4)
  apps/mobile/         Expo app (Expo Router, TypeScript)
  packages/shared/     Types, zod schemas, permission matrix, status workflow map
  supabase/            config.toml, migrations/, seed.sql, functions/, tests/
  docs/DECISIONS.md    Every non-obvious decision, with reasons
  .github/workflows/   CI: lint, typecheck, tests, migrations, build
```

## Prerequisites

- Node.js >= 20 (developed on 24)
- pnpm 9 (`corepack enable` first if missing)
- Supabase CLI (`npm install -g supabase` or `winget install supabase.cli`)
- Docker Desktop — required by `supabase start` (local Postgres/Auth/Storage/Realtime)

> **Current machine note:** Docker is not yet installed locally, so `supabase start`,
> migrations and DB/RLS tests cannot run here yet. Everything code-side is written
> and CI runs the full stack, which includes Docker preinstalled.

## Getting started

```powershell
corepack enable
pnpm install

# Web
pnpm --filter web dev          # http://localhost:3000

# Mobile (needs a physical device or emulator)
pnpm --filter mobile start

# Database (after installing Docker Desktop)
supabase start                 # API on 54321, Studio on 54323
pnpm db:reset                  # apply migrations + seed demo data
pnpm db:gen-types              # regenerate packages/shared/src/db-types.ts
```

Copy env examples before running:

- `apps/web/.env.example` → `apps/web/.env.local`
- `apps/mobile/.env.example` → `apps/mobile/.env.local`

## Local Supabase credentials

When `supabase start` runs, it prints the URLs and keys (anon + service role).
`supabase status` shows them again. Use those values in the `.env.local` files.

## Demo data

`supabase/seed.sql` creates a demo org with five users (admin, manager, two members,
viewer) and a sample project with locations, categories and 15 snags in varied
states. Passwords are listed in the seed file header for local use only.

## Typecheck / lint / tests

```powershell
pnpm turbo run lint typecheck test
```

## Deployment

- **Web:** Vercel. Set env vars from `apps/web/.env.example` (service-role key server-side
  only). Also supports self-hosting via `output: 'standalone'` (Dockerfile comes in Phase 7).
- **Mobile:** EAS Build profiles (`development`, `preview`, `production`); OTA updates via
  EAS Update. See Phase 7 docs.
- **Supabase:** hosted project; apply schema only with `supabase db push` via migrations.
  Disable public signup in Auth settings for production (the local `config.toml` already
  disables it).

## Conventions

- TypeScript strict everywhere; `any` requires a justification comment.
- Authorization is enforced in Postgres (RLS, triggers, RPCs) — the UI only gates actions.
- The permission matrix and status workflow live in `packages/shared`; the database is
  the source of truth and mirrors them.
