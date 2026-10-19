# REPOSITORY-MAP

Structuring files only. Structure changes → update this + `.ai/index.json` via `node scripts/ai/update-index.mjs`.

```
AGENTS.md                     entry point for AI agents
SNAGFLOW_BUILD_PROMPT.md      full functional spec (authoritative scope)
README.md                     human quickstart
project_manifest.json         machine-readable repo map
.ai/index.json                machine-readable feature/route/db/test index
turbo.json / package.json     task pipeline + workspace glue
.github/workflows/ci.yml      CI gate
docs/DECISIONS.md             decision log
docs/AI/                      the rest of the AI docs (this dir)

apps/web/
  src/app/layout.tsx          root layout (fonts, providers)
  src/app/page.tsx            home page (placeholder until Phase 2)
  src/components/ui/*         shadcn-style primitives (button, card, dialog, …)
  src/lib/utils.ts            cn() helper

apps/mobile/
  app.json                    Expo config
  src/app/_layout.tsx         root layout
  src/app/index.tsx           home screen (placeholder until Phase 5)

packages/shared/
  src/index.ts                public exports
  src/roles.ts                Role type, role helpers
  src/permissions.ts          permission matrix (canAct, canEditSnagDetails, canWorkOnSnag, isReviewer)
  src/workflow.ts             SNAG_TRANSITIONS map + TRANSITION_ERRORS codes
  src/schemas.ts              zod schemas (auth, projects, snags, invitations, settings)
  src/terminology.ts          report label helpers (custom snag labels)
  src/db-types.ts             generated DB types (pnpm db:gen-types)
  tests/*.ts                  vitest units

supabase/
  config.toml                 local stack config
  migrations/*.sql            schema — append-only, numbered
  seed.sql                    demo org/users/projects/snags (Password123!)
  tests/helpers.ts            auth client factory, UIDS constants
  tests/*.test.ts             RLS/workflow/integrity DB tests

scripts/ai/update-index.mjs   regenerates derivable parts of .ai/index.json
scripts/ai/check-ai-docs.mjs  validates AI docs, links, JSON
```
