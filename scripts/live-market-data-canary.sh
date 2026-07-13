#!/bin/sh

set -eu

: "${PORTFOLIO_STOCK_ANALYST_API_URL:?set PORTFOLIO_STOCK_ANALYST_API_URL}"
: "${PORTFOLIO_EDO_CALCULATOR_API_URL:?set PORTFOLIO_EDO_CALCULATOR_API_URL}"

stock_base=${PORTFOLIO_STOCK_ANALYST_API_URL%/}
edo_base=${PORTFOLIO_EDO_CALCULATOR_API_URL%/}

stock=$(curl --retry 2 --retry-all-errors --connect-timeout 10 --max-time 45 -sSf \
  "$stock_base/v1/history/AAPL?period=1mo&interval=1d")
edo=$(curl --retry 2 --retry-all-errors --connect-timeout 10 --max-time 45 -sSf \
  "$edo_base/v1/inflation/monthly?startYear=2024&startMonth=1&endYear=2024&endMonth=3")

STOCK_JSON=$stock EDO_JSON=$edo python3 - <<'PY'
import json
import os

stock = json.loads(os.environ["STOCK_JSON"])
edo = json.loads(os.environ["EDO_JSON"])
assert stock.get("prices"), stock
assert stock.get("provenance", {}).get("source") == "YAHOO_FINANCE", stock
assert stock.get("provenance", {}).get("status") in {"FRESH", "STALE"}, stock
assert edo.get("points"), edo
assert all("month" in point and "multiplier" in point for point in edo["points"]), edo
PY

printf 'Live Yahoo/GUS canary passed.\n'
