# Portfolio

Portfolio is a self-hosted portfolio tracker for long-term investors.

## Chosen stack

- Frontend: React 19, TypeScript, Vite, Vitest
- Backend: Kotlin 2.3, Ktor 3, Koin, JUnit
- Database target: PostgreSQL
- Deployment target: Docker Compose

## Why this stack

- React is the pragmatic choice for a web-first product with dense tables and charts.
- Kotlin/Ktor fits the existing ecosystem around `stock-analyst` and `edo-calculator`.
- PostgreSQL is a good fit for transaction history, snapshots, and analytical queries.

## Project structure

```text
portfolio/
├── AGENTS.md
├── docs/
├── apps/
│   ├── api/
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
- domain model and initial PostgreSQL schema are defined
- repository storage can run in `memory` or `postgres` mode
- default local mode remains `memory` for fast startup and tests
- PostgreSQL wiring is available for the write model
- server-side JSON backups can be created, listed, retained, and restored
- optional backup scheduling is available in the API process
- benchmark overlays and benchmark-relative return comparisons are available in the web UI
- transaction CSV import now supports preview, validation, name-based mapping, and duplicate skipping
- append-only audit events are available for recent write-model, import, and backup activity

## Local database

For local PostgreSQL:

```bash
docker compose up -d
```

The default backend config expects PostgreSQL at `127.0.0.1:15432` with:

- database: `portfolio`
- user: `portfolio`
- password: `portfolio`

To run the API in PostgreSQL mode without editing YAML, use:

```bash
PORTFOLIO_PERSISTENCE_MODE=postgres \
PORTFOLIO_DB_JDBC_URL=jdbc:postgresql://127.0.0.1:15432/portfolio \
PORTFOLIO_DB_USERNAME=portfolio \
PORTFOLIO_DB_PASSWORD=portfolio \
./gradlew run
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
See [docs/backlog.md](/Users/bob/stock/portfolio/docs/backlog.md) for the current implementation roadmap.

## API contracts

The API now publishes an OpenAPI spec at `GET /v1/openapi.json` and serves a generated docs UI at `GET /openapi`.

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
