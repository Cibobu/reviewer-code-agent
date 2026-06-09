#!/usr/bin/env bash
# Install Next.js deps for @gitguardian/web when monorepo hoisting fails on the server.
# Usage (from repo root): bash scripts/install-c-web.sh
#
# IMPORTANT: install from repo ROOT — not apps/web alone (local workspaces like
# @foru-workshop/llm are not on npm registry).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/archetypes/C-gitguardian-ai/apps/web"
NESTED="$ROOT/archetypes/C-gitguardian-ai/node_modules/next/dist/bin/next"
LOCAL="$WEB/node_modules/next/dist/bin/next"

next_ok() {
  [[ -x "$NESTED" ]] || [[ -x "$LOCAL" ]]
}

report_next() {
  if [[ -x "$NESTED" ]]; then
    echo "Next OK (nested): $NESTED"
  elif [[ -x "$LOCAL" ]]; then
    echo "Next OK (apps/web): $LOCAL"
  fi
}

cd "$ROOT"

if next_ok; then
  report_next
  exit 0
fi

if [[ ! -f "$ROOT/shared/llm/package.json" ]]; then
  echo "ERROR: missing local workspace shared/llm — clone full repo, not apps/ only." >&2
  exit 1
fi

echo "Installing monorepo deps from root (required for local @foru-workshop/llm) ..."
npm install --legacy-peer-deps

echo "Installing @gitguardian/web workspace ..."
npm install -w @gitguardian/web --legacy-peer-deps

if next_ok; then
  report_next
  exit 0
fi

echo "Fallback: install web packages only (no workspace resolution) ..."
cd "$WEB"
npm install \
  next@^15.1.0 \
  react@^19.0.0 \
  react-dom@^19.0.0 \
  framer-motion@^11.15.0 \
  recharts@^2.15.0 \
  tailwindcss@^3.4.17 \
  postcss@^8.4.49 \
  autoprefixer@^10.4.20 \
  typescript@^5.4.0 \
  @types/node@^20.11.0 \
  @types/react@^19.0.0 \
  @types/react-dom@^19.0.0 \
  --legacy-peer-deps \
  --no-workspaces

if [[ -x "$LOCAL" ]]; then
  echo "Next OK (apps/web): $LOCAL"
  exit 0
fi

echo "ERROR: next still missing after install" >&2
exit 1
