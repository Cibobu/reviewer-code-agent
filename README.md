# PR Risk Scanner Workshop

Tiga agent untuk review dan monitoring GitHub:

| Agent | Archetype | Folder | Trigger | Output |
|-------|-----------|--------|---------|--------|
| **1 — PR Risk Scanner** | A | `archetypes/A-head-of-research` | Manual (UI / API) | Web UI + JSON |
| **2 — GitHub Review Bot** | B | `archetypes/B-pr-telegram-notifier` | Telegram `/setup` + GitHub webhook | Telegram (PR + branch) |
| **3 — GitGuardian AI** | C | `archetypes/C-gitguardian-ai` | GitHub OAuth + webhooks | SaaS Dashboard + Telegram |

Agent B memakai **engine review yang sama** dengan Agent A. Agent C adalah platform SaaS lengkap dengan PostgreSQL, BullMQ, dan pipeline AI 5-layer.

---

## Quickstart — Agent C (GitGuardian AI SaaS)

```bash
# 1. Start Docker Desktop first, then:
npm run infra:c

# Or manually (pick one that works on your machine):
docker compose -f archetypes/C-gitguardian-ai/docker-compose.yml up -d
# docker-compose -f archetypes/C-gitguardian-ai/docker-compose.yml up -d

cp .env.example .env
# Isi: DATABASE_URL, REDIS_URL, GITHUB_CLIENT_ID/SECRET, JWT_*, ENCRYPTION_KEY, LLM_*

npm install
npm run db:c:push
npm run dev:c
# Web: http://localhost:3000 · API: http://localhost:4000/api
```

Dokumentasi lengkap: [`archetypes/C-gitguardian-ai/docs/ARCHITECTURE.md`](archetypes/C-gitguardian-ai/docs/ARCHITECTURE.md)

---

## Quickstart — Agent A (manual)

```bash
npm install
cp .env.example .env
# Edit .env — set LLM_API_KEY

cd archetypes/A-head-of-research
npm run dev
# Open http://127.0.0.1:9004
```

Centang **Use demo data** untuk scan offline tanpa GitHub.

---

## Quickstart — Agent B (Telegram bot + GitHub webhook)

**Panduan lengkap:** [`archetypes/B-pr-telegram-notifier/INSTALL.md`](archetypes/B-pr-telegram-notifier/INSTALL.md)

```bash
# Deploy server (admin)
cp .env.example .env
# Isi: TELEGRAM_BOT_TOKEN, PUBLIC_BASE_URL (HTTPS), LLM_*

npm run dev:b
```

**User flow:** buka bot Telegram → `/setup` → isi repo, token GitHub, pasang webhook → `/selesai`  
Review **PR** dan **branch compare** otomatis dikirim ke chat Telegram.


---

## Configure LLM

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-…
LLM_MODEL=gpt-4o-mini
```

---

## CLI

```bash
npm run choose A   # or B or C
npm run test
npm run submit
npm run calibrate    # Agent A
npm run calibrate:b  # Agent B (dryRun)
npm run dev:a
npm run dev:b
npm run dev:c
npm run db:c:push
```

---

## Endpoints

### Agent A (`:9004`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Operator console |
| `POST` | `/invoke` | Scan a PR |
| `GET` | `/health` | Liveness |

### Agent B (`:9005`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/webhook/github` | GitHub PR events |
| `POST` | `/invoke` | Manual test |
| `GET` | `/health` | Liveness |
| `GET` | `/` | Status page |

---

## Customize

| File | Purpose |
|------|---------|
| `archetypes/A-head-of-research/SOUL.md` | Agent A persona |
| `archetypes/A-head-of-research/src/brain.ts` | Review orchestration |
| `archetypes/B-pr-telegram-notifier/src/format.ts` | Telegram message format |
| `shared/contracts/src/research.ts` | Agent A I/O schema |
| `shared/contracts/src/notifier.ts` | Agent B I/O schema |
