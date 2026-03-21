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
- benchmark-relative performance including TWR, VWRA, inflation, multi-asset ETF benchmarks and target-mix comparisons
- daily history rebuilt from transactions and market data
- ETF pricing and benchmark series via `stock-analyst`
- spot gold history via `gold-api` when `PORTFOLIO_GOLD_API_KEY` is configured
- EDO valuation and inflation via `edo-calculator`

## Current implementation status

- backend write-model API exists for accounts, instruments, and transactions
- domain model and initial relational schema are defined
- runtime storage is SQLite
- tests still use lightweight in-memory repositories where isolation matters, but that path is no longer a runtime mode
- server-side JSON backups can be created, listed, retained, downloaded, and restored
- optional backup scheduling is available in the API process
- benchmark overlays and benchmark-relative return comparisons are available in the web UI
- transaction CSV import now supports preview, validation, name-based mapping, and duplicate skipping
- append-only audit events are available for recent write-model, import, and backup activity
- destructive `REPLACE` import and restore flows now require explicit confirmation and create safety backups automatically
- canonical exports and server backups now include app preferences and reusable import profiles alongside the ledger
- the backups UI exposes retention-related audit activity, restore history, and recent backup failures
- history and returns are persisted as rebuildable read-model cache snapshots with metadata and a small diagnostics view in the web app
- optional background refresh can warm cached history and returns on startup and on a fixed interval
- dashboard and settings expose a dedicated data-quality view for valuation coverage, benchmark coverage, CPI coverage and read-model freshness
- the web app can be installed as a lightweight PWA with a cached shell for mobile use
- core domain models, repository interfaces and portfolio calculation services now live in the extracted `portfolio-domain` Gradle module
- optional single-user password auth is available through signed session cookies and a login gate in the web UI

## Storage model

`portfolio` is now a `SQLite-first` and `SQLite-only` runtime.

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

For local default runtime:

```bash
cd apps/api
./gradlew run
```

That starts the API on SQLite with:

- database file `./data/portfolio.db`
- WAL journaling
- synchronous mode `FULL`
- busy timeout `5000ms`

Startup guardrails:

- the API creates the SQLite parent directory eagerly and fails fast if that path resolves to a directory instead of a file
- the API creates the backup directory eagerly when backups are enabled and fails fast if it is not writable
- unsafe SQLite durability settings are rejected at startup:
  - `journalMode=OFF`
  - `journalMode=MEMORY`
  - `synchronousMode=OFF`

To run the API in Docker Compose with a persistent backup volume:

```bash
docker compose --profile app up -d --build
```

This starts:

- `portfolio-api`
- `portfolio-web`
- named volume `portfolio-sqlite-data` mounted at `/srv/portfolio/data`
- named volume `portfolio-backup-data` mounted at `/srv/portfolio/backups`
- durable restart behavior:
  - the SQLite file lives on `portfolio-sqlite-data`
  - server-side JSON backups live on `portfolio-backup-data`
  - recreating containers does not remove either volume unless you delete them explicitly

The Compose API profile enables server backups by default and stores them on a separate named volume.
Market data is disabled in this default container profile; override the relevant env vars if you want live valuations there.
The web UI is exposed on `http://127.0.0.1:4174`.
You can override published ports with `PORTFOLIO_API_PORT` and `PORTFOLIO_WEB_PORT`.
Read-model background refresh stays disabled by default; enable it explicitly if you want warm history and returns on first open.

To run the full stack with live market data without persisting provider URLs in the repo:

```bash
PORTFOLIO_MARKET_DATA_ENABLED=true \
PORTFOLIO_STOCK_ANALYST_BASE_URL=https://your-stock-analyst-host/api \
PORTFOLIO_EDO_CALCULATOR_BASE_URL=https://your-edo-calculator-host \
PORTFOLIO_GOLD_API_KEY=your-gold-api-key \
docker compose --profile app up -d --build
```

`gold-api` is optional but recommended if you want the `Gold` unit in performance charts to use spot `XAU` history instead of a fallback benchmark symbol.

See [docs/architecture.md](/Users/bob/stock/portfolio/docs/architecture.md) for the current architecture sketch.
See [docs/backlog.md](/Users/bob/stock/portfolio/docs/backlog.md) for the current product backlog and post-migration priorities.

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

The API can maintain server-side JSON backups of the canonical application state.

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

Canonical state export and backup currently include:

- accounts
- instruments
- targets
- transactions
- app preferences, including benchmark and rebalancing settings
- reusable transaction import profiles

## Read-model refresh

The API can proactively warm cached `history` and `returns` read models so the first open each day does not rebuild them synchronously.

Configuration keys:

- `portfolio.readModelRefresh.enabled`
- `portfolio.readModelRefresh.intervalMinutes`
- `portfolio.readModelRefresh.runOnStart`

Environment overrides:

- `PORTFOLIO_READ_MODEL_REFRESH_ENABLED`
- `PORTFOLIO_READ_MODEL_REFRESH_INTERVAL_MINUTES`
- `PORTFOLIO_READ_MODEL_REFRESH_RUN_ON_START`

Default values:

- scheduler disabled
- interval `720` minutes
- run-on-start enabled

Available API endpoints:

- `GET /v1/portfolio/read-model-refresh`
- `POST /v1/portfolio/read-model-refresh/run`

Behavior:

- the scheduler is opt-in and keeps using rebuildable read-model cache snapshots
- `Refresh now` in `Settings -> Cache` forces a rebuild of cached `history` and `returns`
- successful and failed refresh attempts are recorded in the system audit log

Minimal local example:

```bash
PORTFOLIO_READ_MODEL_REFRESH_ENABLED=true \
PORTFOLIO_READ_MODEL_REFRESH_INTERVAL_MINUTES=360 \
./gradlew run
```

## Mobile app / PWA

The web UI includes a lightweight PWA setup intended for personal self-hosted use on phones and tablets.

What it does:

- exposes a manifest and install metadata
- registers a service worker in production builds
- caches the app shell, manifest and icons after the first successful visit
- keeps API requests live; portfolio data is not mirrored into offline storage

In the UI:

- `Settings -> Mobile app` explains installation paths for supported browsers
- browsers with `beforeinstallprompt` support can install directly from the settings screen
- iPhone/iPad users can still use the system `Add to Home Screen` flow

## Demo data

For a ready-made demo portfolio with multiple `VWRA.L` purchases and several `EDO` lots over roughly two years:

```bash
./scripts/import-demo-portfolio.sh
```

The script posts [demo/demo-portfolio-import.json](/Users/bob/stock/portfolio/demo/demo-portfolio-import.json) to the local API in `REPLACE` mode.

If you are running the Docker profile and want to seed the containerized API through its published port:

```bash
./scripts/seed-demo-portfolio-docker.sh
```

## Smoke test

To run an isolated end-to-end smoke test of the SQLite Docker stack:

```bash
./scripts/smoke-test-sqlite-stack.sh
```

The smoke test:

- tears down any stale smoke stack first
- starts an isolated Compose project on alternate ports
- boots a fresh SQLite database
- imports the demo portfolio
- verifies overview, holdings, read-model refresh and backups
- restarts the API container
- confirms data durability after restart
- tears the smoke stack down again
