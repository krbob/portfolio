#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE=${PORTFOLIO_ROLLOUT_COMPOSE_FILE:-docker-compose.full-stack.yml}
WAIT_ATTEMPTS=${PORTFOLIO_ROLLOUT_WAIT_ATTEMPTS:-60}
WAIT_SECONDS=${PORTFOLIO_ROLLOUT_WAIT_SECONDS:-2}

compose() {
  (cd "$PROJECT_ROOT" && docker compose -f "$COMPOSE_FILE" "$@")
}

wait_from_service() {
  probe_service=$1
  url=$2
  label=$3
  attempt=1

  while (( attempt <= WAIT_ATTEMPTS )); do
    if compose exec -T "$probe_service" curl -fsS "$url" >/dev/null 2>&1; then
      printf '%s is ready.\n' "$label"
      return 0
    fi
    sleep "$WAIT_SECONDS"
    ((attempt += 1))
  done

  printf 'Timed out waiting for %s at %s. Portfolio API was not updated.\n' "$label" "$url" >&2
  compose ps >&2 || true
  return 1
}

cd "$PROJECT_ROOT"
python3 scripts/validate-compatibility-manifest.py
compose config >/dev/null
compose pull

compose up -d stock-analyst-backend-yfinance
compose up -d stock-analyst edo-calculator

wait_from_service stock-analyst http://127.0.0.1:8080/readyz 'Stock Analyst'
wait_from_service stock-analyst http://edo-calculator:8080/readyz 'EDO Calculator'

stock_openapi=$(compose exec -T stock-analyst curl -fsS http://127.0.0.1:8080/openapi/v1.json)
grep -Fq '/v1/quote/{stock}' <<<"$stock_openapi"
grep -Fq '/v1/history/{stock}' <<<"$stock_openapi"
printf 'Stock Analyst versioned route gate passed.\n'

compose up -d portfolio-api
wait_from_service portfolio-api http://127.0.0.1:18082/v1/health 'Portfolio API'
compose up -d portfolio-web stock-analyst-ui

printf 'Fail-closed full-stack rollout completed.\n'
