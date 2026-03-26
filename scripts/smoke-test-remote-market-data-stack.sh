#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

: "${PORTFOLIO_STOCK_ANALYST_BASE_URL:?set PORTFOLIO_STOCK_ANALYST_BASE_URL before running the remote market-data smoke test}"
: "${PORTFOLIO_EDO_CALCULATOR_BASE_URL:?set PORTFOLIO_EDO_CALCULATOR_BASE_URL before running the remote market-data smoke test}"

export COMPOSE_PROJECT_NAME=${PORTFOLIO_REMOTE_MARKET_DATA_SMOKE_PROJECT_NAME:-portfolio-remote-market-data-smoke}
export PORTFOLIO_API_PORT=${PORTFOLIO_REMOTE_MARKET_DATA_SMOKE_API_PORT:-28084}
export PORTFOLIO_WEB_PORT=${PORTFOLIO_REMOTE_MARKET_DATA_SMOKE_WEB_PORT:-24175}
export PORTFOLIO_DATABASE_PATH=/srv/portfolio/data/remote-market-data-smoke.db
export PORTFOLIO_BACKUPS_DIRECTORY=/srv/portfolio/backups/remote-market-data-smoke

API_BASE_URL=${PORTFOLIO_API_BASE_URL:-http://127.0.0.1:${PORTFOLIO_API_PORT}}
WEB_BASE_URL=${PORTFOLIO_WEB_BASE_URL:-http://127.0.0.1:${PORTFOLIO_WEB_PORT}}

compose() {
  cd "$PROJECT_ROOT"
  docker compose -f docker-compose.yml -f docker-compose.market-data.remote.yml "$@"
}

cleanup() {
  compose --profile app down -v --remove-orphans >/dev/null 2>&1 || true
}

wait_for_health() {
  attempt=0
  while [ "$attempt" -lt 90 ]; do
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
  while [ "$attempt" -lt 90 ]; do
    if curl -sSf "$WEB_BASE_URL/" >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  printf 'Timed out waiting for %s/\n' "$WEB_BASE_URL" >&2
  return 1
}

wait_for_market_readiness() {
  attempt=0
  while [ "$attempt" -lt 120 ]; do
    readiness=$(curl -s "$API_BASE_URL/v1/readiness" || true)
    if [ -n "$readiness" ] && JSON_PAYLOAD=$readiness python3 - <<'PY'
import json
import os
import sys

payload = json.loads(os.environ["JSON_PAYLOAD"])
checks = {check["key"]: check["status"] for check in payload.get("checks", [])}
status = payload.get("status")

if status not in {"READY", "DEGRADED"}:
    sys.exit(1)
if checks.get("stock-analyst") != "PASS":
    sys.exit(1)
if checks.get("edo-calculator") != "PASS":
    sys.exit(1)
PY
    then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  printf 'Timed out waiting for market-data readiness on %s/v1/readiness\n' "$API_BASE_URL" >&2
  return 1
}

assert_market_backed_state() {
  OVERVIEW_JSON=$1 HOLDINGS_JSON=$2 READINESS_JSON=$3 WEB_OVERVIEW_JSON=$4 python3 - <<'PY'
import json
import os

overview = json.loads(os.environ["OVERVIEW_JSON"])
holdings = json.loads(os.environ["HOLDINGS_JSON"])
readiness = json.loads(os.environ["READINESS_JSON"])
web_overview = json.loads(os.environ["WEB_OVERVIEW_JSON"])

assert overview["activeHoldingCount"] > 0, overview
assert overview["valuationState"] in {"MARK_TO_MARKET", "STALE"}, overview["valuationState"]
assert web_overview["valuationState"] == overview["valuationState"], (web_overview["valuationState"], overview["valuationState"])

market_backed = [holding for holding in holdings if holding["valuationStatus"] in {"VALUED", "STALE"}]
assert len(market_backed) == len(holdings), holdings
assert len(market_backed) == overview["activeHoldingCount"], (len(market_backed), overview["activeHoldingCount"])

checks = {check["key"]: check["status"] for check in readiness.get("checks", [])}
assert checks["stock-analyst"] == "PASS", checks
assert checks["edo-calculator"] == "PASS", checks
PY
}

trap cleanup EXIT

cleanup
compose --profile app up -d --build

wait_for_health
wait_for_web
wait_for_market_readiness

PORTFOLIO_API_BASE_URL="$API_BASE_URL" sh "$PROJECT_ROOT/scripts/import-demo-portfolio.sh" >/dev/null

overview=$(curl -sSf "$API_BASE_URL/v1/portfolio/overview")
holdings=$(curl -sSf "$API_BASE_URL/v1/portfolio/holdings")
readiness=$(curl -sSf "$API_BASE_URL/v1/readiness")
overview_via_web=$(curl -sSf "$WEB_BASE_URL/api/v1/portfolio/overview")

assert_market_backed_state "$overview" "$holdings" "$readiness" "$overview_via_web"

printf 'Remote market-data smoke test passed on %s\n' "$API_BASE_URL"
