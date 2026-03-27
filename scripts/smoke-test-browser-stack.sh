#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

export COMPOSE_PROJECT_NAME=${PORTFOLIO_BROWSER_SMOKE_PROJECT_NAME:-portfolio-browser-smoke}
export PORTFOLIO_API_PORT=${PORTFOLIO_BROWSER_SMOKE_API_PORT:-28086}
export PORTFOLIO_WEB_PORT=${PORTFOLIO_BROWSER_SMOKE_WEB_PORT:-24177}
export PORTFOLIO_DATABASE_PATH=/srv/portfolio/data/browser-smoke.db
export PORTFOLIO_BACKUPS_DIRECTORY=/srv/portfolio/backups/browser-smoke

API_BASE_URL=${PORTFOLIO_API_BASE_URL:-http://127.0.0.1:${PORTFOLIO_API_PORT}}
WEB_BASE_URL=${PORTFOLIO_WEB_BASE_URL:-http://127.0.0.1:${PORTFOLIO_WEB_PORT}}

cleanup() {
  cd "$PROJECT_ROOT"
  docker compose --profile app down -v --remove-orphans >/dev/null 2>&1 || true
}

wait_for_health() {
  attempt=0
  while [ "$attempt" -lt 60 ]; do
    if curl -sSf "$API_BASE_URL/v1/health" >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  printf 'Timed out waiting for %s/v1/health\n' "$API_BASE_URL" >&2
  return 1
}

wait_for_web() {
  attempt=0
  while [ "$attempt" -lt 60 ]; do
    if curl -sSf "$WEB_BASE_URL/" >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  printf 'Timed out waiting for %s/\n' "$WEB_BASE_URL" >&2
  return 1
}

trap cleanup EXIT

cd "$PROJECT_ROOT"
cleanup
docker compose --profile app up -d --build

wait_for_health
wait_for_web

PORTFOLIO_API_BASE_URL="$API_BASE_URL" sh "$PROJECT_ROOT/scripts/import-demo-portfolio.sh" >/dev/null

cd "$PROJECT_ROOT/apps/web"
PORTFOLIO_E2E_BASE_URL="$WEB_BASE_URL" npm run test:e2e -- --grep @smoke

printf 'Browser smoke test passed on %s\n' "$WEB_BASE_URL"
