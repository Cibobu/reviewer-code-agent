# PR Risk Scanner

AI agent that scans GitHub pull requests for bugs, security risks, missing tests, and merge impact.

## Quickstart

```bash
npm install
cp .env.example .env
# Edit .env — set LLM_API_KEY (and optionally GITHUB_TOKEN)

cd archetypes/A-head-of-research
npm run dev
# Open http://127.0.0.1:8080
```

Use the **Use demo data** checkbox to scan offline without calling GitHub.

## Configure LLM

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-…
LLM_MODEL=gpt-4o-mini
```

Any OpenAI-compatible endpoint works (including custom routers).

## Scan a live PR

```bash
curl -X POST http://127.0.0.1:8080/invoke \
  -H 'content-type: application/json' \
  -d '{"prUrl":"https://github.com/owner/repo/pull/123"}'
```

For private repos, add `"githubToken":"ghp_…"` or set `GITHUB_TOKEN` in `.env`.

## CLI

```bash
npx foru choose A
npx foru test
npx foru submit
```

## Customize

| File | Purpose |
|------|---------|
| `archetypes/A-head-of-research/SOUL.md` | Agent persona and rules |
| `archetypes/A-head-of-research/src/brain.ts` | Orchestration logic |
| `shared/contracts/src/research.ts` | Input/output schema |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Operator console |
| `POST` | `/invoke` | Scan a PR (JSON in/out) |
| `GET` | `/soul` | SOUL.md plaintext |
| `GET` | `/health` | Liveness probe |
| `ANY` | `/mcp` | MCP tool transport |

## Calibrate

```bash
npm run calibrate
```

Runs the brain with sample demo diff and prints the report.
