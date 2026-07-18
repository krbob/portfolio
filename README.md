# Portfolio

Portfolio is a self-hosted portfolio tracker for a single long-term investor. Transactions are the
canonical source of truth; holdings, allocation, performance and diagnostics are rebuildable read
models backed by SQLite.

## What it covers

- accounts, instruments, transactions, effective-dated allocation schedules and reusable CSV import profiles
- holdings, allocation drift and contribution-first rebalancing guidance
- read-only withdrawal previews with explicit account priority and user-supplied tax buffers
- daily history and performance in PLN, USD and gold
- MWRR, TWR, inflation-adjusted return and benchmark comparisons
- ETF, stock, FX and benchmark data through Stock Analyst
- Polish EDO bond valuation through EDO Calculator
- explicit fresh, stale, partial and unavailable market-data states
- JSON export/import, scheduled backups, restore preview and an audit trail
- optional single-user password authentication and an installable PWA

The calculation rules and data-quality boundaries are documented in
[Financial methodology](docs/financial-methodology.md).

## Repository layout

```text
portfolio/
├── apps/api/                  Kotlin/Ktor API and portfolio-domain module
├── apps/web/                  React/TypeScript SPA
├── deployment/compatibility/ Reviewed cross-repository release manifests
├── docs/                      Architecture, operations and product contracts
├── scripts/                   Validation, smoke and rollout tooling
└── docker-compose*.yml        Local, integration and published-image stacks
```

## Quick start

### Local application

```bash
docker compose --profile app up -d --build
curl -fsS http://127.0.0.1:18082/v1/health
curl -fsS http://127.0.0.1:4174/healthz
```

The UI is available at `http://127.0.0.1:4174` and the API at
`http://127.0.0.1:18082`. Live market data, OpenAPI UI and authentication are disabled in this
mode. SQLite data and JSON backups use separate named volumes.

The API image runs as UID/GID `10001:10001`. Deployments created with an older root-running image
may need a one-time ownership repair before the updated API starts:

```bash
sh scripts/fix-volume-ownership.sh
```

### Remote market-data services

Set the public or private upstream base URLs; do not append an operation path:

```dotenv
PORTFOLIO_STOCK_ANALYST_API_URL=https://stock.example/api
PORTFOLIO_STOCK_ANALYST_UI_URL=https://stock.example
PORTFOLIO_EDO_CALCULATOR_API_URL=https://edo.example
```

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.market-data.remote.yml \
  --profile app up -d --build
```

### Disposable full ecosystem

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.market-data.self-hosted.dev.example.yml \
  --profile app up -d --build
```

This development example uses moving image tags. It is not a production deployment input.

### Published-image deployment

Production images must be supplied as six immutable OCI digests from one released compatibility
manifest. Select that file, export the six values recorded in it and use the staged rollout script:

```bash
export PORTFOLIO_COMPATIBILITY_MANIFEST=deployment/compatibility/<version>.json
python3 scripts/validate-compatibility-manifest.py --require-released
scripts/rollout-full-stack.sh
```

Do not replace this command with a single `docker compose up -d` during an update. Provider
readiness and the Stock Analyst `/v1` contract gate must pass before Portfolio API is replaced.
The rollout script repeats the released-manifest check before its first Compose command and requires
all six exported digest variables to match the selected manifest exactly.
The repository manifest `1.0.0` is a reviewed candidate with unpublished digest placeholders, not
a released set of images.

The supplied script targets the repository's single full-stack Compose project. Installations split
across independent Compose projects must apply the same stages manually; see the
[operations runbook](docs/runbook.md).

## Runtime model

- SQLite is the only supported database.
- One API process owns one database file.
- Exact financial values are persisted as canonical decimal text.
- Transactions remain canonical; analytical snapshots can be discarded and rebuilt.
- Market-data and alert-dispatch snapshots are operational state, not portable portfolio state.
- Degraded data is surfaced explicitly and must not silently replace a last-known-good analytical
  snapshot.

See [Architecture](docs/architecture.md), [Domain model](docs/domain-model.md) and
[Configuration](docs/configuration.md) for the detailed boundaries.

## State transfer and recovery

Portfolio supports `MERGE` and destructive `REPLACE` imports:

- `MERGE` upserts canonical entities and preserves omitted `targetSchedule`, legacy `targets` and `importProfiles`;
- a present `targetSchedule` replaces the complete effective-dated strategy; a non-empty legacy
  `targets` section updates the allocation effective on the import date, while an explicitly empty
  legacy section clears the schedule for schema-version 4 compatibility;
- `REPLACE` requires explicit confirmation and creates a safety backup first;
- preview and real import use the same business validation path;
- market-data snapshots and active alert-dispatch state are excluded from portable JSON and survive
  both modes.

Operational procedures and recovery checks live in the [runbook](docs/runbook.md). Treat `REPLACE`,
restore and volume deletion as maintenance operations.

## Local verification

```bash
python3 scripts/validate-supply-chain.py
python3 scripts/validate-compatibility-manifest.py
python3 scripts/test-compatibility-release-gate.py
python3 scripts/validate-documentation.py

cd apps/api
./gradlew test detekt checkUpstreamContracts

cd ../web
npm run lint
npm test
npm run build
```

CI additionally runs reproducible SBOM checks, vulnerability scans, Docker/SQLite smoke, generated
OpenAPI drift checks and browser accessibility/offline flows.

## Screenshot maintenance

The screenshot suite temporarily replaces all canonical portfolio data. Run it only against a
disposable loopback instance created for documentation; never point it at a personal or production
database. The test refuses non-loopback targets and requires an explicit destructive opt-in:

```bash
cd apps/web
PORTFOLIO_SCREENSHOTS_ALLOW_STATE_REPLACE=true \
PORTFOLIO_E2E_BASE_URL=http://127.0.0.1:4174 \
npx playwright test e2e/screenshots.spec.ts
```

The suite exports the initial state and restores it from teardown, but a disposable database is
still required because no test can recover data after process termination or host failure.

## Documentation

- [Architecture](docs/architecture.md) — system shape and runtime boundaries
- [Domain model](docs/domain-model.md) — canonical entities and invariants
- [Financial methodology](docs/financial-methodology.md) — valuation, FX and return calculations
- [Configuration](docs/configuration.md) — environment variables and defaults
- [Operations runbook](docs/runbook.md) — rollout, backup, restore and verification
- [Troubleshooting](docs/troubleshooting.md) — stale/partial data and startup failures
- [Deployment compatibility](docs/deployment-compatibility.md) — digest hand-off and rollout gates
- [Supply-chain controls](docs/supply-chain.md) — locks, SBOMs, scans and attestations
- [Roadmap](docs/roadmap.md) — short active priorities
