# Archetype A — PR Risk Scanner

Scans GitHub pull requests for bugs, security risks, missing tests, and merge impact.

| | |
|---|---|
| **Persona** | `SOUL.md` |
| **Orchestration** | `src/brain.ts`, `src/github.ts` |
| **Input** | `{ prUrl, githubToken?, demoDiff? }` |
| **Output** | `{ summary, riskLevel, issuesFound, securityNotes, missingTests, effectIfMerged, recommendedNextAction }` |

## Run locally

```bash
cd archetypes/A-head-of-research
npm run dev
# Open http://127.0.0.1:8080
```

Use **demo data** checkbox for offline scanning without GitHub API.

## Live PR scan

Set `GITHUB_TOKEN` in `.env` or paste a PAT in the UI for private repos.

```bash
curl -X POST http://127.0.0.1:8080/invoke \
  -H 'content-type: application/json' \
  -d '{"prUrl":"https://github.com/owner/repo/pull/123"}'
```
