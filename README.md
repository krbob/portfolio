# Portfolio

Portfolio is a self-hosted portfolio tracker for long-term investors.

It is designed around a simple product stance:

- transactions are the source of truth
- daily history is rebuilt from transactions and market data
- SQLite is the runtime database
- JSON backups remain first-class
- the product is optimized for a single-user self-hosted setup

## What it already does

- accounts, instruments, transactions, targets, and reusable import profiles
- holdings, allocation, drift, and contribution-first rebalance guidance
- daily history in `PLN`, `USD`, and `Gold`
- `MWRR`, `TWR`, real return, and benchmark-relative performance
- benchmark configuration, including `VWRA`, inflation, target mix, multi-asset ETF benchmarks, and one custom benchmark
- EDO valuation and inflation via `edo-calculator`
- ETF, FX, and benchmark history via `stock-analyst`
- optional spot gold history via `gold-api`, with `GC=F` fallback when no gold API key is configured or spot history is temporarily unavailable
- server backups, restore, canonical export/import, audit trail, and read-model cache diagnostics
- optional single-user password auth
- background refresh for heavy read models
- installable PWA shell for phone and tablet use

## Project layout

```text
portfolio/
├── AGENTS.md
├── docker-compose.yml
├── docker-compose.market-data.remote.yml
├── docker-compose.market-data.self-hosted.yml
├── docker-compose.full-stack.example.yml
├── docs/
├── apps/
│   ├── api/
│   │   └── portfolio-domain/
│   └── web/
└── README.md
```

## Quick start

### 1. Run just `portfolio` from this repo

This uses the local Dockerfiles in this repository.

```bash
docker compose --profile app up -d --build
```

That starts:

- `portfolio-api`
- `portfolio-web`
- SQLite on a named Docker volume
- JSON backups on a separate named Docker volume

Endpoints:

- UI: `http://127.0.0.1:4174`
- API: `http://127.0.0.1:18082`

By default this profile does **not** enable live market data. The app still works, but read models that depend on external pricing stay degraded until you provide market-data configuration.

### 2. Run `portfolio` with remote market data

If you want the local app stack to use remote market-data services, add the remote override:

```dotenv
PORTFOLIO_STOCK_ANALYST_BASE_URL=https://your-stock-analyst.example/api
PORTFOLIO_EDO_CALCULATOR_BASE_URL=https://your-edo-calculator.example
```

Then run:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.market-data.remote.yml \
  --profile app up -d --build
```

This keeps the app built from the current repository, but points market data at the remote services you provide through:

- `PORTFOLIO_STOCK_ANALYST_BASE_URL`
- `PORTFOLIO_EDO_CALCULATOR_BASE_URL`

### 3. Run `portfolio` with self-hosted market data dependencies

If you want the local app stack together with self-hosted market-data containers, add the self-hosted override:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.market-data.self-hosted.yml \
  --profile app up -d --build
```

That starts:

- `portfolio-api`
- `portfolio-web`
- `stock-analyst`
- `stock-analyst-backend-yfinance`
- `edo-calculator`

The app still uses the local Dockerfiles from this repository, but the market-data services come from their published images.

### 4. Run the full self-hosted stack from published images

If you want `portfolio` together with its market-data dependencies, use the example stack:

```bash
cp docker-compose.full-stack.example.yml docker-compose.full-stack.yml
docker compose -f docker-compose.full-stack.yml up -d
```

This starts:

- `portfolio-api`
- `portfolio-web`
- `stock-analyst`
- `stock-analyst-backend-yfinance`
- `edo-calculator`

The example uses published images for all services, so it is a better fit for a real self-hosted deployment than the local dev compose.
The web container serves the built SPA through `nginx` and proxies `/api` internally to `portfolio-api`, so the browser stays on one origin.

## Compose modes

The repository now has three explicit local runtime modes:

- `docker-compose.yml`
  - local app build, SQLite, backups, no live market data
- `docker-compose.yml` + `docker-compose.market-data.remote.yml`
  - local app build with remote market-data upstreams
- `docker-compose.yml` + `docker-compose.market-data.self-hosted.yml`
  - local app build with self-hosted `stock-analyst` and `edo-calculator`

This matters because market-data mode is no longer something you need to remember as a one-off shell command. Rebuilds remain in the same mode as long as you keep using the same compose file set.

## Full stack example

The repository includes [docker-compose.full-stack.example.yml](./docker-compose.full-stack.example.yml).

It wires `portfolio` to:

- `http://stock-analyst:8080`
- `http://edo-calculator:8080`

and keeps:

- the SQLite database on `portfolio-sqlite-data`
- JSON backups on `portfolio-backup-data`

If you want spot gold history, create a `.env` file next to the compose file and set:

```dotenv
PORTFOLIO_GOLD_API_KEY=your-gold-api-key
```

Without that key the app falls back to `GC=F`, which is a futures proxy rather than spot gold.

The production web image does not use `vite preview`. It serves static files through `nginx` and proxies `/api` to `portfolio-api`, so a reverse proxy such as Traefik only needs to publish the web container.

## Runtime model

Portfolio is intentionally `SQLite-only`.

Key invariants:

- one API process per database file
- transactions remain canonical
- history and returns cache snapshots stay rebuildable
- backups and canonical exports remain JSON-based and portable

SQLite conventions:

- IDs as `TEXT`
- exact financial values as canonical decimal `TEXT`
- dates and timestamps as ISO-8601 `TEXT`
- JSON payloads as `TEXT`
- explicit startup pragmas and durability checks

Default runtime settings:

- database path: `./data/portfolio.db` locally or `/srv/portfolio/data/portfolio.db` in Docker
- journal mode: `WAL`
- synchronous mode: `FULL`
- busy timeout: `5000ms`

The API fails fast on invalid SQLite pathing and unsafe durability settings.

## Important environment variables

### Market data

- `PORTFOLIO_MARKET_DATA_ENABLED`
- `PORTFOLIO_STOCK_ANALYST_BASE_URL`
- `PORTFOLIO_EDO_CALCULATOR_BASE_URL`
- `PORTFOLIO_GOLD_API_KEY`

### Backups

- `PORTFOLIO_BACKUPS_ENABLED`
- `PORTFOLIO_BACKUPS_DIRECTORY`
- `PORTFOLIO_BACKUPS_INTERVAL_MINUTES`
- `PORTFOLIO_BACKUPS_RETENTION_COUNT`

### Background refresh

- `PORTFOLIO_READ_MODEL_REFRESH_ENABLED`
- `PORTFOLIO_READ_MODEL_REFRESH_INTERVAL_MINUTES`
- `PORTFOLIO_READ_MODEL_REFRESH_RUN_ON_START`

### Docs UI

- `PORTFOLIO_OPENAPI_UI_ENABLED`

### Optional auth

- `PORTFOLIO_AUTH_ENABLED`
- `PORTFOLIO_AUTH_PASSWORD`
- `PORTFOLIO_AUTH_SESSION_SECRET`
- `PORTFOLIO_AUTH_SESSION_COOKIE_NAME`
- `PORTFOLIO_AUTH_SECURE_COOKIE`
- `PORTFOLIO_AUTH_SESSION_MAX_AGE_DAYS`

Behavior when auth is enabled:

- `GET /v1/health`, `GET /v1/meta`, and `GET/POST/DELETE /v1/auth/session` stay public
- everything else stays behind the signed session cookie

## Backups and state portability

The app supports:

- server-side backup scheduling
- backup download
- restore with explicit confirmation for destructive `REPLACE`
- canonical export/import of the application state

Canonical state currently includes:

- accounts
- instruments
- targets
- transactions
- app preferences
- benchmark and rebalancing settings
- reusable import profiles

## Read-model refresh

The API can pre-warm heavy read models such as:

- daily history
- returns
- benchmark comparisons

This keeps first-open latency lower on self-hosted installs.

The scheduler is opt-in and does not turn the cache into a second source of truth.

## API contracts

The API publishes:

- OpenAPI spec at `GET /v1/openapi.json`
- docs UI at `GET /openapi`

Frontend types are generated from the backend spec:

```bash
cd apps/web
npm run generate:api
```

## Development

### API

```bash
cd apps/api
./gradlew run
```

### Web

```bash
cd apps/web
npm install
npm run dev
```

`npm run preview` remains available for local preview of a production build, but the Docker image serves the built SPA through `nginx` rather than using Vite as a runtime server.

### Verification

```bash
cd apps/api
./gradlew test

cd ../web
npm test
npm run build

cd ../..
./scripts/smoke-test-sqlite-stack.sh
```

## Related services

- [docs/architecture.md](./docs/architecture.md)
- [docs/domain-model.md](./docs/domain-model.md)
- [docs/roadmap.md](./docs/roadmap.md)
- [stock-analyst](https://github.com/krbob/stock-analyst)
- [edo-calculator](https://github.com/krbob/edo-calculator)
