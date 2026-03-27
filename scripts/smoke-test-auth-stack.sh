#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

export COMPOSE_PROJECT_NAME=${PORTFOLIO_AUTH_SMOKE_PROJECT_NAME:-portfolio-auth-smoke}
export PORTFOLIO_API_PORT=${PORTFOLIO_AUTH_SMOKE_API_PORT:-28087}
export PORTFOLIO_WEB_PORT=${PORTFOLIO_AUTH_SMOKE_WEB_PORT:-24178}
export PORTFOLIO_DATABASE_PATH=/srv/portfolio/data/auth-smoke.db
export PORTFOLIO_BACKUPS_DIRECTORY=/srv/portfolio/backups/auth-smoke
export PORTFOLIO_AUTH_ENABLED=true
export PORTFOLIO_AUTH_PASSWORD=${PORTFOLIO_AUTH_PASSWORD:-smoke-pass-123456}
export PORTFOLIO_AUTH_SESSION_SECRET=${PORTFOLIO_AUTH_SESSION_SECRET:-0123456789abcdef0123456789abcdef}
export PORTFOLIO_AUTH_SECURE_COOKIE=false

API_BASE_URL=${PORTFOLIO_API_BASE_URL:-http://127.0.0.1:${PORTFOLIO_API_PORT}}
WEB_BASE_URL=${PORTFOLIO_WEB_BASE_URL:-http://127.0.0.1:${PORTFOLIO_WEB_PORT}}
COOKIE_JAR=${PORTFOLIO_AUTH_SMOKE_COOKIE_JAR:-/tmp/portfolio-auth-smoke-cookie.jar}

cleanup() {
  rm -f "$COOKIE_JAR"
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

curl -sSf "$API_BASE_URL/v1/meta" >/dev/null
curl -sSf "$API_BASE_URL/v1/auth/session" | grep -E '"authEnabled"[[:space:]]*:[[:space:]]*true' >/dev/null

unauthorized_status=$(curl -s -o /tmp/portfolio-auth-smoke-unauthorized.json -w '%{http_code}' "$API_BASE_URL/v1/accounts")
[ "$unauthorized_status" = "401" ]

curl -sSf \
  -c "$COOKIE_JAR" \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"$PORTFOLIO_AUTH_PASSWORD\"}" \
  "$API_BASE_URL/v1/auth/session" | grep -E '"authenticated"[[:space:]]*:[[:space:]]*true' >/dev/null

curl -sSf -b "$COOKIE_JAR" "$API_BASE_URL/v1/accounts" >/dev/null
curl -sSf -b "$COOKIE_JAR" "$API_BASE_URL/v1/auth/session" | grep -E '"authenticated"[[:space:]]*:[[:space:]]*true' >/dev/null

cd "$PROJECT_ROOT/apps/web"
PORTFOLIO_E2E_BASE_URL="$WEB_BASE_URL" PORTFOLIO_E2E_PASSWORD="$PORTFOLIO_AUTH_PASSWORD" npm run test:e2e -- --grep @auth

curl -sSf -b "$COOKIE_JAR" -X DELETE "$API_BASE_URL/v1/auth/session" | grep -E '"authenticated"[[:space:]]*:[[:space:]]*false' >/dev/null

unauthorized_after_logout_status=$(curl -s -o /tmp/portfolio-auth-smoke-post-logout.json -w '%{http_code}' "$API_BASE_URL/v1/accounts")
[ "$unauthorized_after_logout_status" = "401" ]

printf 'Auth smoke test passed on %s\n' "$API_BASE_URL"
