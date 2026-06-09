#!/usr/bin/env bash
# Start PostgreSQL + Redis for GitGuardian AI (Agent C).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/archetypes/C-gitguardian-ai/docker-compose.yml"

port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# Never bind Docker Postgres to 5432 — local installs almost always use it.
PG_PORT="${GITGUARDIAN_PG_PORT:-5433}"
REDIS_PORT="${GITGUARDIAN_REDIS_PORT:-6380}"

export GITGUARDIAN_PG_PORT="$PG_PORT"
export GITGUARDIAN_REDIS_PORT="$REDIS_PORT"

if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker daemon is not running."
  echo "   Start Docker Desktop, then run this script again."
  exit 1
fi

if port_in_use "$PG_PORT"; then
  echo "❌ Port $PG_PORT is in use. Try another port:"
  echo "   GITGUARDIAN_PG_PORT=5434 npm run infra:c"
  exit 1
fi

if port_in_use "$REDIS_PORT"; then
  echo "❌ Port $REDIS_PORT is in use. Try:"
  echo "   GITGUARDIAN_REDIS_PORT=6381 npm run infra:c"
  exit 1
fi

echo "→ PostgreSQL: localhost:$PG_PORT"
echo "→ Redis: localhost:$REDIS_PORT"

# Remove stale containers that may still map host 5432
docker rm -f gitguardian-postgres gitguardian-redis 2>/dev/null || true

if docker compose version >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" up -d
elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
  docker-compose -f "$COMPOSE_FILE" up -d
else
  docker run -d --name gitguardian-postgres \
    -e POSTGRES_USER=gitguardian \
    -e POSTGRES_PASSWORD=gitguardian \
    -e POSTGRES_DB=gitguardian \
    -p "${PG_PORT}:5432" \
    -v gitguardian-pgdata:/var/lib/postgresql/data \
    postgres:16-alpine
  docker run -d --name gitguardian-redis \
    -p "${REDIS_PORT}:6379" \
    redis:7-alpine
fi

echo ""
echo "✅ Infrastructure ready. Add to your .env:"
echo ""
echo "DATABASE_URL=postgresql://gitguardian:gitguardian@localhost:${PG_PORT}/gitguardian"
echo "REDIS_URL=redis://localhost:${REDIS_PORT}"
echo ""
