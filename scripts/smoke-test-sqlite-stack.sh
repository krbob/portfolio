#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

export COMPOSE_PROJECT_NAME=${PORTFOLIO_SMOKE_PROJECT_NAME:-portfolio-smoke}
export PORTFOLIO_API_PORT=${PORTFOLIO_SMOKE_API_PORT:-28082}
export PORTFOLIO_WEB_PORT=${PORTFOLIO_SMOKE_WEB_PORT:-24174}
export PORTFOLIO_SQLITE_DATABASE_PATH=/srv/portfolio/data/smoke-test.db
export PORTFOLIO_BACKUPS_DIRECTORY=/srv/portfolio/backups/smoke-test

API_BASE_URL=${PORTFOLIO_API_BASE_URL:-http://127.0.0.1:${PORTFOLIO_API_PORT}}

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

trap cleanup EXIT

cd "$PROJECT_ROOT"
cleanup
docker compose --profile app up -d --build

wait_for_health

PORTFOLIO_API_BASE_URL="$API_BASE_URL" sh "$PROJECT_ROOT/scripts/import-demo-portfolio.sh" >/dev/null

overview=$(curl -sSf "$API_BASE_URL/v1/portfolio/overview")
holdings=$(curl -sSf "$API_BASE_URL/v1/portfolio/holdings")
transactions=$(curl -sSf "$API_BASE_URL/v1/transactions")

printf '%s' "$overview" | grep -F '"totalBookValuePln": "104736.00"' >/dev/null
printf '%s' "$overview" | grep -F '"activeHoldingCount": 7' >/dev/null
printf '%s' "$overview" | grep -F '"missingFxTransactions": 0' >/dev/null
printf '%s' "$holdings" | grep -F '"instrumentName": "Vanguard FTSE All-World UCITS ETF"' >/dev/null
printf '%s' "$holdings" | grep -F '"kind": "BOND_EDO"' >/dev/null
printf '%s' "$transactions" | grep -F '"fxRateToPln": "3.99000000"' >/dev/null

curl -sSf -X POST "$API_BASE_URL/v1/portfolio/backups/run" >/dev/null

backups=$(curl -sSf "$API_BASE_URL/v1/portfolio/backups")
printf '%s' "$backups" | grep -F '"fileName":' >/dev/null

docker compose --profile app restart portfolio-api >/dev/null

wait_for_health

overview_after_restart=$(curl -sSf "$API_BASE_URL/v1/portfolio/overview")
meta_after_restart=$(curl -sSf "$API_BASE_URL/v1/meta")
transactions_after_restart=$(curl -sSf "$API_BASE_URL/v1/transactions")

printf '%s' "$overview_after_restart" | grep -F '"totalBookValuePln": "104736.00"' >/dev/null
printf '%s' "$overview_after_restart" | grep -F '"missingFxTransactions": 0' >/dev/null
printf '%s' "$meta_after_restart" | grep -F '"persistenceMode": "SQLITE"' >/dev/null
printf '%s' "$transactions_after_restart" | grep -F '"fxRateToPln": "3.95500000"' >/dev/null

printf 'SQLite smoke test passed on %s\n' "$API_BASE_URL"
