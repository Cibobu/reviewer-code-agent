#!/usr/bin/env bash
# Install Next.js deps for @gitguardian/web when monorepo hoisting fails on the server.
# Usage (from repo root): bash scripts/install-c-web.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/archetypes/C-gitguardian-ai/apps/web"
NESTED="$ROOT/archetypes/C-gitguardian-ai/node_modules/next/dist/bin/next"
LOCAL="$WEB/node_modules/next/dist/bin/next"

cd "$ROOT"

if [[ -x "$NESTED" ]]; then
  echo "Next OK (nested): $NESTED"
  exit 0
fi

if [[ -x "$LOCAL" ]]; then
  echo "Next OK (apps/web): $LOCAL"
  exit 0
fi

echo "Next not found — installing web dependencies in apps/web ..."
cd "$WEB"
npm install

if [[ -x "$LOCAL" ]]; then
  echo "Next OK (apps/web): $LOCAL"
  exit 0
fi

echo "ERROR: next still missing after npm install in apps/web" >&2
exit 1
