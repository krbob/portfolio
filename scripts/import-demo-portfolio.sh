#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
API_BASE_URL=${PORTFOLIO_API_BASE_URL:-http://127.0.0.1:18082}
PAYLOAD_FILE="$PROJECT_ROOT/demo/demo-portfolio-import.json"

curl -sSf \
  -X POST \
  -H 'Content-Type: application/json' \
  --data-binary "@$PAYLOAD_FILE" \
  "$API_BASE_URL/v1/portfolio/state/import"

printf '\n'
