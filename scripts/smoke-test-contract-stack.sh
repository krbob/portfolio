#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)

export COMPOSE_PROJECT_NAME="${PORTFOLIO_CONTRACT_SMOKE_PROJECT_NAME:-portfolio-contract-smoke}"
export PORTFOLIO_API_PORT="${PORTFOLIO_CONTRACT_SMOKE_API_PORT:-28083}"
export PORTFOLIO_WEB_PORT="${PORTFOLIO_CONTRACT_SMOKE_WEB_PORT:-24174}"
export PORTFOLIO_CONTRACT_STOCK_PORT="${PORTFOLIO_CONTRACT_STOCK_PORT:-29080}"
export PORTFOLIO_CONTRACT_EDO_PORT="${PORTFOLIO_CONTRACT_EDO_PORT:-29081}"
export PORTFOLIO_DATABASE_PATH=/srv/portfolio/data/contract-smoke.db
export PORTFOLIO_BACKUPS_DIRECTORY=/srv/portfolio/backups/contract-smoke

API_BASE_URL=${PORTFOLIO_API_BASE_URL:-http://127.0.0.1:${PORTFOLIO_API_PORT}}
WEB_BASE_URL=${PORTFOLIO_WEB_BASE_URL:-http://127.0.0.1:${PORTFOLIO_WEB_PORT}}
STOCK_FIXTURE_URL="http://127.0.0.1:${PORTFOLIO_CONTRACT_STOCK_PORT}"
EDO_FIXTURE_URL="http://127.0.0.1:${PORTFOLIO_CONTRACT_EDO_PORT}"
STOCK_FIXTURE_PID=
EDO_FIXTURE_PID=

compose() {
  cd "$PROJECT_ROOT"
  docker compose -f docker-compose.yml -f docker-compose.market-data.contract-fixtures.yml "$@"
}

cleanup() {
  compose --profile app down -v --remove-orphans >/dev/null 2>&1 || true
  if [ -n "$STOCK_FIXTURE_PID" ]; then
    kill "$STOCK_FIXTURE_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$EDO_FIXTURE_PID" ]; then
    kill "$EDO_FIXTURE_PID" >/dev/null 2>&1 || true
  fi
}

wait_for_url() {
  url=$1
  attempts=${2:-90}
  attempt=0
  while [ "$attempt" -lt "$attempts" ]; do
    if curl -sSf "$url" >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  printf 'Timed out waiting for %s\n' "$url" >&2
  return 1
}

assert_strict_state() {
  OVERVIEW_JSON=$1 HOLDINGS_JSON=$2 READINESS_JSON=$3 WEB_OVERVIEW_JSON=$4 python3 - <<'PY'
import datetime as dt
import json
import os

overview = json.loads(os.environ["OVERVIEW_JSON"])
holdings = json.loads(os.environ["HOLDINGS_JSON"])
readiness = json.loads(os.environ["READINESS_JSON"])
web_overview = json.loads(os.environ["WEB_OVERVIEW_JSON"])

checks = {check["key"]: check["status"] for check in readiness["checks"]}
assert readiness["status"] == "READY", readiness
assert "WARN" not in checks.values(), checks
assert "FAIL" not in checks.values(), checks
assert checks["stock-analyst"] == "PASS", checks
assert checks["edo-calculator"] == "PASS", checks

assert overview["valuationState"] == "MARK_TO_MARKET", overview
assert overview["activeHoldingCount"] == len(holdings) > 0, (overview, holdings)
assert overview["valuedHoldingCount"] == len(holdings), overview
assert overview["unvaluedHoldingCount"] == 0, overview
assert overview["valuationIssueCount"] == 0, overview
assert web_overview["totalCurrentValuePln"] == overview["totalCurrentValuePln"], (web_overview, overview)

today = dt.date.today().isoformat()
for holding in holdings:
    assert holding["valuationStatus"] == "VALUED", holding
    assert holding["valuationIssue"] is None, holding
    assert holding["valuedAt"] == today, holding
    if holding["kind"] == "ETF":
        assert holding["currentPriceNative"] == "123.45", holding
        assert holding["currentPricePln"] == "500.00", holding
    elif holding["kind"] == "BOND_EDO":
        assert holding["currentPriceNative"] == "110", holding
        assert holding["currentPricePln"] == "110.00", holding
        assert all(lot["valuationStatus"] == "VALUED" for lot in holding["edoLots"]), holding
    else:
        raise AssertionError(f"Unexpected fixture-backed holding kind: {holding['kind']}")
PY
}

assert_fixture_requests() {
  STOCK_REQUESTS=$1 EDO_REQUESTS=$2 python3 - <<'PY'
import json
import os

stock = json.loads(os.environ["STOCK_REQUESTS"])
edo = json.loads(os.environ["EDO_REQUESTS"])
assert sum(count for path, count in stock.items() if path.startswith("/v1/quote/")) > 0, stock
assert sum(count for path, count in stock.items() if path.startswith("/v1/history/")) > 0, stock
assert edo.get("/v1/edo/value", 0) > 0, edo
assert edo.get("/v1/inflation/monthly", 0) > 0, edo
PY
}

trap cleanup EXIT INT TERM

cd "$PROJECT_ROOT"
python3 scripts/validate-compatibility-manifest.py
cleanup
python3 scripts/contract-fixture-server.py --kind stock --port "$PORTFOLIO_CONTRACT_STOCK_PORT" &
STOCK_FIXTURE_PID=$!
python3 scripts/contract-fixture-server.py --kind edo --port "$PORTFOLIO_CONTRACT_EDO_PORT" &
EDO_FIXTURE_PID=$!
wait_for_url "$STOCK_FIXTURE_URL/health" 30
wait_for_url "$EDO_FIXTURE_URL/readyz" 30

compose --profile app up -d --build
wait_for_url "$API_BASE_URL/v1/health"
wait_for_url "$WEB_BASE_URL/"
wait_for_url "$API_BASE_URL/v1/readiness/details" 120

PORTFOLIO_API_BASE_URL="$API_BASE_URL" sh "$PROJECT_ROOT/scripts/import-demo-portfolio.sh" >/dev/null

overview=$(curl -sSf "$API_BASE_URL/v1/portfolio/overview")
holdings=$(curl -sSf "$API_BASE_URL/v1/portfolio/holdings")
readiness=$(curl -sSf "$API_BASE_URL/v1/readiness/details")
overview_via_web=$(curl -sSf "$WEB_BASE_URL/api/v1/portfolio/overview")
assert_strict_state "$overview" "$holdings" "$readiness" "$overview_via_web"

stock_requests=$(curl -sSf "$STOCK_FIXTURE_URL/__requests")
edo_requests=$(curl -sSf "$EDO_FIXTURE_URL/__requests")
assert_fixture_requests "$stock_requests" "$edo_requests"

cd "$PROJECT_ROOT/apps/web"
PORTFOLIO_E2E_BASE_URL="$WEB_BASE_URL" npm run test:e2e -- --grep @smoke
PORTFOLIO_E2E_BASE_URL="$WEB_BASE_URL" npm run test:e2e:quality

printf 'Strict contract full-stack smoke passed on %s with no DEGRADED/WARN state.\n' "$API_BASE_URL"
