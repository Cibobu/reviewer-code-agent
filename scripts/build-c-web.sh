#!/usr/bin/env bash
# Build @gitguardian/web — finds next binary in nested, apps/web, or root.
# Usage (from repo root): bash scripts/build-c-web.sh
# Loads .env from repo root for NEXT_PUBLIC_* at build time.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/archetypes/C-gitguardian-ai/apps/web"

bash "$ROOT/scripts/install-c-web.sh"

NEXT=""
for candidate in \
  "$ROOT/archetypes/C-gitguardian-ai/node_modules/next/dist/bin/next" \
  "$WEB/node_modules/next/dist/bin/next" \
  "$ROOT/node_modules/next/dist/bin/next"; do
  if [[ -x "$candidate" ]]; then
    NEXT="$candidate"
    break
  fi
done

if [[ -z "$NEXT" ]]; then
  echo "ERROR: next binary not found" >&2
  exit 1
fi

echo "Using: $NEXT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -v '^#' "$ROOT/.env" | grep -v '^$' | sed 's/^/export /')
  set +a
fi

cd "$WEB"
node "$NEXT" build
