#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
SEED_FILE="$PROJECT_ROOT/demo/demo-portfolio-seed.sql"

docker compose --profile app exec -T portfolio-postgres \
  psql -U portfolio -d portfolio -v ON_ERROR_STOP=1 -f - < "$SEED_FILE"
