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

echo "Next not found — installing @gitguardian/web dependencies ..."

# Prefer workspace install from root (respects package-lock when present)
if npm install -w @gitguardian/web --legacy-peer-deps; then
  if [[ -x "$NESTED" ]] || [[ -x "$LOCAL" ]]; then
    [[ -x "$NESTED" ]] && echo "Next OK (nested): $NESTED" && exit 0
    [[ -x "$LOCAL" ]] && echo "Next OK (apps/web): $LOCAL" && exit 0
  fi
fi

echo "Workspace install did not place next — installing directly in apps/web ..."
cd "$WEB"
npm install --legacy-peer-deps --no-workspaces 2>/dev/null || npm install --legacy-peer-deps

if [[ -x "$LOCAL" ]]; then
  echo "Next OK (apps/web): $LOCAL"
  exit 0
fi

echo "ERROR: next still missing after install" >&2
exit 1
