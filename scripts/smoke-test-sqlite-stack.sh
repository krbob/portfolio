#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

export COMPOSE_PROJECT_NAME=${PORTFOLIO_SMOKE_PROJECT_NAME:-portfolio-smoke}
export PORTFOLIO_API_PORT=${PORTFOLIO_SMOKE_API_PORT:-28082}
export PORTFOLIO_WEB_PORT=${PORTFOLIO_SMOKE_WEB_PORT:-24174}
export PORTFOLIO_DATABASE_PATH=/srv/portfolio/data/smoke-test.db
export PORTFOLIO_BACKUPS_DIRECTORY=/srv/portfolio/backups/smoke-test

API_BASE_URL=${PORTFOLIO_API_BASE_URL:-http://127.0.0.1:${PORTFOLIO_API_PORT}}
WEB_BASE_URL=${PORTFOLIO_WEB_BASE_URL:-http://127.0.0.1:${PORTFOLIO_WEB_PORT}}
BOND_ACCOUNT_ID=44444444-4444-4444-4444-444444444444

json_field() {
  JSON_PAYLOAD=$1 JSON_FIELD=$2 python3 - <<'PY'
import json
import os

payload = json.loads(os.environ["JSON_PAYLOAD"])
print(payload[os.environ["JSON_FIELD"]])
PY
}

assert_edo_smoke_state() {
  HOLDINGS_JSON=$1 EXPECTED_MODE=$2 python3 - <<'PY'
import json
import os

holdings = json.loads(os.environ["HOLDINGS_JSON"])
mode = os.environ["EXPECTED_MODE"]
holding = next((item for item in holdings if item["instrumentName"] == "EDO0336 Smoke"), None)
if holding is None:
    raise SystemExit("Missing EDO0336 Smoke holding in holdings response.")

lots = {lot["purchaseDate"]: lot["quantity"] for lot in holding.get("edoLots", [])}
if mode == "before":
    assert holding["quantity"] == "100", holding["quantity"]
    assert lots == {"2026-03-02": "70", "2026-03-22": "30"}, lots
elif mode == "after":
    assert holding["quantity"] == "20", holding["quantity"]
    assert lots == {"2026-03-22": "20"}, lots
else:
    raise SystemExit(f"Unsupported assertion mode: {mode}")
PY
}

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

overview=$(curl -sSf "$API_BASE_URL/v1/portfolio/overview")
holdings=$(curl -sSf "$API_BASE_URL/v1/portfolio/holdings")
transactions=$(curl -sSf "$API_BASE_URL/v1/transactions")
read_model_refresh_status=$(curl -sSf "$API_BASE_URL/v1/portfolio/read-model-refresh")
read_model_refresh_run=$(curl -sSf -X POST "$API_BASE_URL/v1/portfolio/read-model-refresh/run")
read_model_cache=$(curl -sSf "$API_BASE_URL/v1/portfolio/read-model-cache")
meta_via_web=$(curl -sSf "$WEB_BASE_URL/api/v1/meta")

printf '%s' "$overview" | grep -F '"totalBookValuePln": "104736.00"' >/dev/null
printf '%s' "$overview" | grep -F '"activeHoldingCount": 7' >/dev/null
printf '%s' "$overview" | grep -F '"missingFxTransactions": 0' >/dev/null
printf '%s' "$holdings" | grep -F '"instrumentName": "Vanguard FTSE All-World UCITS ETF"' >/dev/null
printf '%s' "$holdings" | grep -F '"kind": "BOND_EDO"' >/dev/null
printf '%s' "$transactions" | grep -F '"fxRateToPln": "3.99000000"' >/dev/null
printf '%s' "$read_model_refresh_status" | grep -F '"schedulerEnabled": false' >/dev/null
printf '%s' "$read_model_refresh_run" | grep -F '"refreshedModelCount": 2' >/dev/null
printf '%s' "$read_model_cache" | grep -F '"invalidationReason": "EXPLICIT_REFRESH"' >/dev/null
printf '%s' "$meta_via_web" | grep -F '"name": "Portfolio"' >/dev/null

edo_instrument_response=$(curl -sSf \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "EDO0336 Smoke",
    "kind": "BOND_EDO",
    "assetClass": "BONDS",
    "currency": "PLN",
    "valuationSource": "EDO_CALCULATOR",
    "edoTerms": {
      "seriesMonth": "2026-03",
      "firstPeriodRateBps": 500,
      "marginBps": 150
    }
  }' \
  "$API_BASE_URL/v1/instruments")
edo_instrument_id=$(json_field "$edo_instrument_response" id)

curl -sSf \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{
    \"accountId\": \"$BOND_ACCOUNT_ID\",
    \"type\": \"DEPOSIT\",
    \"tradeDate\": \"2026-03-01\",
    \"settlementDate\": \"2026-03-01\",
    \"grossAmount\": \"15000.00\",
    \"currency\": \"PLN\"
  }" \
  "$API_BASE_URL/v1/transactions" >/dev/null

curl -sSf \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{
    \"accountId\": \"$BOND_ACCOUNT_ID\",
    \"instrumentId\": \"$edo_instrument_id\",
    \"type\": \"BUY\",
    \"tradeDate\": \"2026-03-02\",
    \"settlementDate\": \"2026-03-02\",
    \"quantity\": \"70\",
    \"unitPrice\": \"100.00\",
    \"grossAmount\": \"7000.00\",
    \"feeAmount\": \"0\",
    \"taxAmount\": \"0\",
    \"currency\": \"PLN\"
  }" \
  "$API_BASE_URL/v1/transactions" >/dev/null

curl -sSf \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{
    \"accountId\": \"$BOND_ACCOUNT_ID\",
    \"instrumentId\": \"$edo_instrument_id\",
    \"type\": \"BUY\",
    \"tradeDate\": \"2026-03-22\",
    \"settlementDate\": \"2026-03-22\",
    \"quantity\": \"30\",
    \"unitPrice\": \"100.00\",
    \"grossAmount\": \"3000.00\",
    \"feeAmount\": \"0\",
    \"taxAmount\": \"0\",
    \"currency\": \"PLN\"
  }" \
  "$API_BASE_URL/v1/transactions" >/dev/null

edo_holdings_before_redeem=$(curl -sSf "$API_BASE_URL/v1/portfolio/holdings")
assert_edo_smoke_state "$edo_holdings_before_redeem" before

curl -sSf \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{
    \"accountId\": \"$BOND_ACCOUNT_ID\",
    \"instrumentId\": \"$edo_instrument_id\",
    \"type\": \"REDEEM\",
    \"tradeDate\": \"2026-03-26\",
    \"settlementDate\": \"2026-03-26\",
    \"quantity\": \"80\",
    \"unitPrice\": \"102.00\",
    \"grossAmount\": \"8160.00\",
    \"feeAmount\": \"0\",
    \"taxAmount\": \"160.00\",
    \"currency\": \"PLN\"
  }" \
  "$API_BASE_URL/v1/transactions" >/dev/null

edo_holdings_after_redeem=$(curl -sSf "$API_BASE_URL/v1/portfolio/holdings")
assert_edo_smoke_state "$edo_holdings_after_redeem" after

curl -sSf -X POST "$API_BASE_URL/v1/portfolio/backups/run" >/dev/null

backups=$(curl -sSf "$API_BASE_URL/v1/portfolio/backups")
printf '%s' "$backups" | grep -F '"fileName":' >/dev/null

docker compose --profile app restart portfolio-api >/dev/null

wait_for_health
wait_for_web

overview_after_restart=$(curl -sSf "$API_BASE_URL/v1/portfolio/overview")
meta_after_restart=$(curl -sSf "$API_BASE_URL/v1/meta")
meta_via_web_after_restart=$(curl -sSf "$WEB_BASE_URL/api/v1/meta")
transactions_after_restart=$(curl -sSf "$API_BASE_URL/v1/transactions")
edo_holdings_after_restart=$(curl -sSf "$API_BASE_URL/v1/portfolio/holdings")

printf '%s' "$overview_after_restart" | grep -F '"missingFxTransactions": 0' >/dev/null
printf '%s' "$meta_after_restart" | grep -F '"persistenceMode": "SQLITE"' >/dev/null
printf '%s' "$meta_via_web_after_restart" | grep -F '"persistenceMode": "SQLITE"' >/dev/null
printf '%s' "$transactions_after_restart" | grep -F '"fxRateToPln": "3.95500000"' >/dev/null
printf '%s' "$transactions_after_restart" | grep -F '"type": "REDEEM"' >/dev/null
assert_edo_smoke_state "$edo_holdings_after_restart" after

printf 'SQLite smoke test passed on %s\n' "$API_BASE_URL"
