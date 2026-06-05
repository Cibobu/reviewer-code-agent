# Single-process container for archetype A.
# Designed to run on Cloud Run / Fly.io / any container host.
#
#   docker build -t archetype-a -f archetypes/A-head-of-research/Dockerfile .
#   docker run --rm -p 8080:8080 --env-file .env archetype-a
#
# NOTE: build context must be the repo root (so the npm workspaces resolve).

FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# Install workspace deps with the full lockfile context.
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY shared ./shared
COPY archetypes/A-head-of-research ./archetypes/A-head-of-research

# Install tsx + workspace deps. We run TS directly via tsx; no build step.
RUN npm ci --omit=optional --ignore-scripts && npm cache clean --force

EXPOSE 8080
ENV PORT=8080

CMD ["npx", "--no-install", "tsx", "archetypes/A-head-of-research/src/server.ts"]
