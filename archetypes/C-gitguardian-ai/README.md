# GitGuardian AI Agent (Archetype C)

Production-ready SaaS for GitHub repository monitoring, AI code review, and Telegram alerts.

## Quick Start

```bash
# From repo root
docker compose -f archetypes/C-gitguardian-ai/docker-compose.yml up -d

cd archetypes/C-gitguardian-ai
npm install
npm run db:push
npm run dev
```

Open http://localhost:3000

## Apps

| App | Port | Description |
|-----|------|-------------|
| Web | 3000 | Next.js dashboard |
| API | 4000 | NestJS backend |
| Worker | — | BullMQ AI processor |

## Documentation

- [Architecture & all deliverables](./docs/ARCHITECTURE.md)
- **[Deploy via SSH (VPS, gratis)](./docs/DEPLOY-SSH.md)**
- [Prisma schema](./packages/db/prisma/schema.prisma)

## User Flow

1. Sign in with GitHub OAuth
2. Sync repositories → Connect Agent (creates webhook)
3. Settings → Telegram → connect bot + chat ID
4. Receive AI reviews on PR/push/merge events
