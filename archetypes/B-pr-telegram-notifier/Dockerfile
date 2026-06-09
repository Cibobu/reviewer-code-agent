# Single-process container for archetype B (includes A for shared review brain).
#
#   docker build -t archetype-b -f archetypes/B-pr-telegram-notifier/Dockerfile .
#   docker run --rm -p 9005:9005 --env-file .env archetype-b

FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY shared ./shared
COPY archetypes/A-head-of-research ./archetypes/A-head-of-research
COPY archetypes/B-pr-telegram-notifier ./archetypes/B-pr-telegram-notifier

RUN npm ci --omit=optional --ignore-scripts && npm cache clean --force

EXPOSE 9005
ENV PORT=9005

CMD ["npx", "--no-install", "tsx", "archetypes/B-pr-telegram-notifier/src/server.ts"]
