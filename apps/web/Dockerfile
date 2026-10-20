# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# SnagFlow web app image.
#
# Build:  docker build -f apps/web/Dockerfile -t snagflow-web .
# Run:    docker run --rm -p 3000:3000 \
#           -e SUPABASE_SERVER_URL=http://host.docker.internal:54321 \
#           snagflow-web
#
# NEXT_PUBLIC_* variables are inlined into the browser bundle at build time,
# so they are build arguments. SUPABASE_SERVER_URL is read at runtime, which
# lets the same image talk to a Supabase stack on the host.
# ---------------------------------------------------------------------------

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.15.9
WORKDIR /app

# --- dependencies ----------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY supabase/package.json supabase/package.json
RUN pnpm install --frozen-lockfile --filter web...

# --- build -----------------------------------------------------------------
FROM deps AS builder
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_DEMO_ACCOUNTS

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_DEMO_ACCOUNTS=$NEXT_PUBLIC_DEMO_ACCOUNTS
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter web build

# --- runtime ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# The standalone bundle mirrors the workspace layout (apps/web/server.js).
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
