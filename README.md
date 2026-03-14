# Portfolio

Portfolio is a self-hosted portfolio tracker for long-term investors.

## Chosen stack

- Frontend: React 19, TypeScript, Vite, Vitest
- Backend: Kotlin 2.3, Ktor 3, Koin, JUnit
- Database target: SQLite
- Deployment target: Docker Compose

## Why this stack

- React is the pragmatic choice for a web-first product with dense tables and charts.
- Kotlin/Ktor fits the existing ecosystem around `stock-analyst` and `edo-calculator`.
- SQLite is the best fit for a single-user self-hosted deployment with transactional source data and rebuildable read models.

## Project structure

```text
portfolio/
├── AGENTS.md
├── docs/
├── apps/
│   ├── api/
│   │   └── portfolio-domain/
│   └── web/
└── README.md
```

## Planned product scope

- accounts, instruments, and transactions
- holdings and allocation views
- performance metrics including MWRR and real return
- benchmark-relative performance including TWR, VWRA, inflation and target-mix comparisons
- daily history rebuilt from transactions and market data
- ETF pricing via `stock-analyst`
- EDO valuation and inflation via `edo-calculator`

## Current implementation status

- backend write-model API exists for accounts, instruments, and transactions
- domain model and initial relational schema are defined
- repository storage currently runs in `memory` or `postgres` mode while the project migrates toward `sqlite-only`
- default local mode remains `memory` for fast startup and tests
- PostgreSQL wiring is available for the write model
- server-side JSON backups can be created, listed, retained, and restored
- optional backup scheduling is available in the API process
- benchmark overlays and benchmark-relative return comparisons are available in the web UI
- transaction CSV import now supports preview, validation, name-based mapping, and duplicate skipping
- append-only audit events are available for recent write-model, import, and backup activity
- destructive `REPLACE` import and restore flows now require explicit confirmation and create safety backups automatically
- the backups UI exposes retention-related audit activity, restore history, and recent backup failures
- history and returns are persisted as rebuildable read-model cache snapshots with metadata and a small diagnostics view in the web app
- core domain models, repository interfaces and portfolio calculation services now live in the extracted `portfolio-domain` Gradle module
- optional single-user password auth is available through signed session cookies and a login gate in the web UI

## Storage direction

`portfolio` is moving to a `SQLite-only` runtime.

Migration invariants:

- one API process per database file
- database file stored on a local filesystem or Docker volume
- transactions remain the canonical source of truth
- read-model cache snapshots remain rebuildable
- JSON backup/export remains first-class even after SQLite becomes the only database

SQLite encoding conventions for the migration:

- `UUID` as `TEXT`
- `LocalDate` as `TEXT` `YYYY-MM-DD`
- `Instant` as UTC ISO-8601 `TEXT`
- enums as `TEXT`
- booleans as `INTEGER`
- JSON payloads as `TEXT`
- exact financial values as canonical decimal `TEXT`

Until the migration is complete, the current backend config still supports `memory` and `postgres`.

For local PostgreSQL during the transition:

```bash
docker compose up -d
```

To run the API in Docker Compose with a persistent backup volume:

```bash
docker compose --profile app up -d --build
```

This starts:

- `portfolio-postgres`
- `portfolio-api`
- `portfolio-web`
- named volume `portfolio-backup-data` mounted at `/srv/portfolio/backups`

The Compose API profile enables server backups by default and stores them on the named volume.
Market data is disabled in this default container profile; override the relevant env vars if you want live valuations there.
The web UI is exposed on `http://127.0.0.1:4174`.

To run the full stack with live market data without persisting provider URLs in the repo:

```bash
PORTFOLIO_MARKET_DATA_ENABLED=true \
PORTFOLIO_STOCK_ANALYST_BASE_URL=https://your-stock-analyst-host/api \
PORTFOLIO_EDO_CALCULATOR_BASE_URL=https://your-edo-calculator-host \
docker compose --profile app up -d --build
```

See [docs/architecture.md](/Users/bob/stock/portfolio/docs/architecture.md) for the current architecture sketch.
See [docs/backlog.md](/Users/bob/stock/portfolio/docs/backlog.md) for the current SQLite migration roadmap.

## Authentication

The API and SPA can optionally be protected with a single shared password.

Configuration keys:

- `portfolio.auth.enabled`
- `portfolio.auth.password`
- `portfolio.auth.sessionSecret`
- `portfolio.auth.sessionCookieName`
- `portfolio.auth.secureCookie`
- `portfolio.auth.sessionMaxAgeDays`

Environment overrides:

- `PORTFOLIO_AUTH_ENABLED`
- `PORTFOLIO_AUTH_PASSWORD`
- `PORTFOLIO_AUTH_SESSION_SECRET`
- `PORTFOLIO_AUTH_SESSION_COOKIE_NAME`
- `PORTFOLIO_AUTH_SECURE_COOKIE`
- `PORTFOLIO_AUTH_SESSION_MAX_AGE_DAYS`

Behavior:

- `GET /v1/health`, `GET /v1/meta`, and `GET/POST/DELETE /v1/auth/session` stay public
- accounts, instruments, transactions, portfolio read models, imports, and backups are protected when auth is enabled
- the web app shows a login gate and uses signed cookie sessions instead of storing the shared password client-side

Minimal local example:

```bash
PORTFOLIO_AUTH_ENABLED=true \
PORTFOLIO_AUTH_PASSWORD='change-me' \
PORTFOLIO_AUTH_SESSION_SECRET='replace-with-a-long-random-secret' \
./gradlew run
```

## API contracts

The API now publishes an OpenAPI spec at `GET /v1/openapi.json` and serves a generated docs UI at `GET /openapi`.

`apps/api` is now a small multi-project Gradle build:

- root project: Ktor API, persistence, routing, integrations and operational services
- `:portfolio-domain`: domain models, repository/provider interfaces and portfolio calculation services

Frontend contracts are generated from the backend spec instead of being maintained purely by hand:

```bash
cd apps/web
npm run generate:api
```

That script:

- runs `apps/api` task `exportOpenApiSpec`
- writes the spec to `apps/api/build/openapi/portfolio-api.json`
- regenerates TypeScript types in [apps/web/src/api/generated/portfolio-api.d.ts](/Users/bob/stock/portfolio/apps/web/src/api/generated/portfolio-api.d.ts)

The current web app already uses generated OpenAPI types in the read-model layer and the target-allocation/write-model contract layer.

## Server backups

The API can maintain server-side JSON backups of the canonical write model.

Configuration keys:

- `portfolio.backups.enabled`
- `portfolio.backups.directory`
- `portfolio.backups.intervalMinutes`
- `portfolio.backups.retentionCount`

Environment overrides:

- `PORTFOLIO_BACKUPS_ENABLED`
- `PORTFOLIO_BACKUPS_DIRECTORY`
- `PORTFOLIO_BACKUPS_INTERVAL_MINUTES`
- `PORTFOLIO_BACKUPS_RETENTION_COUNT`

Default values:

- scheduler disabled
- directory `./data/backups`
- interval `1440` minutes
- retention `30` backups

In the Docker Compose `app` profile the backup directory is set to `/srv/portfolio/backups` and backed by the named volume `portfolio-backup-data`.

Available API endpoints:

- `GET /v1/portfolio/backups`
- `GET /v1/portfolio/backups/download?fileName=...`
- `POST /v1/portfolio/backups/run`
- `POST /v1/portfolio/backups/restore`

For destructive `REPLACE` operations:

- `POST /v1/portfolio/backups/restore` requires `confirmation: "REPLACE"`
- `POST /v1/portfolio/state/import` requires `confirmation: "REPLACE"`

Both flows create a safety backup automatically before applying destructive changes.

## Demo data

For a ready-made demo portfolio with multiple `VWRA.L` purchases and several `EDO` lots over roughly two years:

```bash
./scripts/import-demo-portfolio.sh
```

The script posts [demo/demo-portfolio-import.json](/Users/bob/stock/portfolio/demo/demo-portfolio-import.json) to the local API in `REPLACE` mode.

If you are running the Docker profile and want to seed the PostgreSQL container directly:

```bash
./scripts/seed-demo-portfolio-docker.sh
```

The SQL fixture lives in [demo/demo-portfolio-seed.sql](/Users/bob/stock/portfolio/demo/demo-portfolio-seed.sql).
