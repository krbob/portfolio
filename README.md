# Portfolio

Portfolio is a self-hosted portfolio tracker for long-term investors.

<a href="docs/screenshots/dashboard.png"><img src="docs/screenshots/dashboard.png" width="720" alt="Dashboard"></a>

<p>
  <a href="docs/screenshots/portfolio-holdings.png"><img src="docs/screenshots/portfolio-holdings.png" width="175" alt="Portfolio holdings"></a>
  <a href="docs/screenshots/performance.png"><img src="docs/screenshots/performance.png" width="175" alt="Performance charts"></a>
  <a href="docs/screenshots/performance-returns.png"><img src="docs/screenshots/performance-returns.png" width="175" alt="Performance returns"></a>
  <a href="docs/screenshots/transactions.png"><img src="docs/screenshots/transactions.png" width="175" alt="Transactions"></a>
</p>

The product is built around a few explicit rules:

- transactions are the canonical source of truth
- analytical views are rebuildable read models
- SQLite is the runtime database
- JSON export, import, backup, and restore remain first-class
- the product is optimized for a single-user self-hosted setup

## What the product covers

- accounts, instruments, transactions, targets, and reusable CSV import profiles
- holdings, allocation drift, and contribution-first rebalance guidance
- dashboard contribution planner with suggested splits and manual asset-class previews
- daily history and performance in `PLN`, `USD`, and gold
- `MWRR`, `TWR`, real return, and benchmark-relative comparison
- benchmark configuration with shipped defaults, target-mix, and unlimited custom references
- EDO valuation via `edo-calculator`
- ETF, FX, and benchmark history via `stock-analyst`
- fallback market-data snapshots surfaced as `STALE` or degraded coverage instead of pretending freshness
- canonical state export/import with preview diff, warnings, and blocking validation
- server backups, restore workflow, audit trail, and read-model cache diagnostics
- target-history visibility through audit events
- optional single-user password auth
- installable PWA shell for phone and tablet use
- active mobile views refresh on app resume after a longer pause

## Repository layout

```text
portfolio/
├── AGENTS.md
├── docker-compose.yml
├── docker-compose.market-data.remote.yml
├── docker-compose.market-data.self-hosted.yml
├── docker-compose.market-data.self-hosted.dev.example.yml
├── docker-compose.full-stack.yml
├── docker-compose.full-stack.example.yml
├── docs/
├── apps/
│   ├── api/
│   │   └── portfolio-domain/
│   └── web/
└── README.md
```

Build inputs, dependency locks, reproducible SBOMs, vulnerability gates, and image attestations are documented in
[`docs/supply-chain.md`](docs/supply-chain.md).
Versioned source/contract/token compatibility evidence and production image-digest hand-off are documented in
[`docs/deployment-compatibility.md`](docs/deployment-compatibility.md).

## Quick start

### 1. Local app stack from this repo

```bash
docker compose --profile app up -d --build
```

This starts:

- `portfolio-api`
- `portfolio-web`
- SQLite on a named Docker volume
- JSON backups on a separate named Docker volume

Endpoints:

- UI: `http://127.0.0.1:4174`
- API: `http://127.0.0.1:18082`

In the default local compose mode:

- live market data is off
- OpenAPI UI is off
- auth is off
- Docker sets `PORTFOLIO_AUTH_SECURE_COOKIE=true`, which is the right default when the app later sits behind HTTPS

The API container runs as UID/GID `10001:10001`. If you upgrade an existing deployment that created the SQLite or backup named volumes with an older root-running image, fix ownership once before starting the updated API:

```bash
sh scripts/fix-volume-ownership.sh
```

### 2. Local app stack with remote market data

```dotenv
PORTFOLIO_STOCK_ANALYST_API_URL=https://your-stock-analyst.example/api
PORTFOLIO_STOCK_ANALYST_UI_URL=https://your-stock-analyst.example
PORTFOLIO_EDO_CALCULATOR_API_URL=https://your-edo-calculator.example
```

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.market-data.remote.yml \
  --profile app up -d --build
```

### 3. Local app stack with self-hosted market-data services

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.market-data.self-hosted.dev.example.yml \
  --profile app up -d --build
```

This adds:

- `stock-analyst`
- `stock-analyst-backend-yfinance`
- `stock-analyst-ui` at `http://127.0.0.1:18083`
- `edo-calculator`

The development example uses moving tags and lets Docker select the native architecture. For a release-like local run,
use `docker-compose.market-data.self-hosted.yml` after exporting the four real upstream image digests.

### 4. Full self-hosted stack from published images

```bash
# Export the six *_IMAGE_DIGEST values from a real published release first.
python3 scripts/validate-compatibility-manifest.py
docker compose -f docker-compose.full-stack.yml up -d
```

The production file fails before pulling when any digest is absent. The tag-based
`docker-compose.full-stack.example.yml` remains available only for disposable development.

## Runtime model

Portfolio is intentionally `SQLite-only`.

Key invariants:

- one API process per database file
- transactions remain canonical
- history and returns stay rebuildable
- market-data snapshots are resilience data, not source of truth
- backups and exports stay portable JSON

Default application config in `apps/api/src/main/resources/application.yaml` is conservative:

- `marketData.enabled=false`
- `openapi.uiEnabled=false`
- `auth.enabled=false`

Compose overrides decide the real runtime mode. That keeps local raw app startup safe by default and makes market-data behavior explicit instead of accidental.

## State export, preview, import, and restore

Portfolio has two import modes: `MERGE` and `REPLACE`.

### `MERGE`

- accounts, instruments, transactions, and user preferences are upserted by id or key
- if the snapshot omits `targets`, the current target allocation is preserved
- if the snapshot contains `targets`, that section replaces the target allocation as one set
- if the snapshot omits `importProfiles`, current profiles are preserved
- if the snapshot contains `importProfiles`, they merge by id, but final profile names must stay unique

### `REPLACE`

- requires explicit `REPLACE` confirmation
- clears the current canonical write model and user preferences before loading the snapshot
- creates a safety backup automatically before the destructive step

Market-data cache payloads/metadata and the active alert-dispatch set are runtime state. They are not exported, counted
as app preferences, shown in import diffs, or overwritten by either import mode. Benchmark, rebalancing, and alert
settings remain portable user preferences.

### Preview behavior

Preview is not a cosmetic dry run. It uses the same validation path as the real import and returns:

- blocking issues
- warnings
- section-by-section diff counts
- skip/preserve semantics for targets and import profiles

If preview says the snapshot is valid, import should not later fail on a hidden business rule that preview skipped.

## Production notes for self-hosting

- keep secrets and upstream URLs in a local `.env`, not in Git
- prefer the example compose file or your own compose wrapper for real deployment
- use `PORTFOLIO_AUTH_SECURE_COOKIE=true` behind HTTPS
- keep `PORTFOLIO_OPENAPI_UI_ENABLED=false` unless you actively need the docs UI
- configure VAPID keys before enabling browser push notifications
- treat `REPLACE` import or restore as a maintenance action, not a casual workflow
- for deployments created before the API ran as UID/GID `10001:10001`, run `sh scripts/fix-volume-ownership.sh` once after pulling the updated image

If you want an empty reset:

```bash
docker compose down --volumes --remove-orphans
docker compose up -d
```

## Important environment variables

### Market data

- `PORTFOLIO_MARKET_DATA_ENABLED`
- `PORTFOLIO_STOCK_ANALYST_API_URL`
- `PORTFOLIO_STOCK_ANALYST_UI_URL`
- `PORTFOLIO_EDO_CALCULATOR_API_URL`
- `PORTFOLIO_GOLD_API_URL`
- `PORTFOLIO_GOLD_API_KEY`
- `PORTFOLIO_MARKET_DATA_STALE_AFTER_DAYS`

`PORTFOLIO_STOCK_ANALYST_UI_URL` is optional. Set it to a browser-reachable Stock Analyst UI URL to enable the
global app switcher and instrument analysis links. The self-hosted overrides default it to
`http://127.0.0.1:18083`; use the public HTTPS URL when deploying behind a reverse proxy.

The two UIs use a small bidirectional handoff contract. Portfolio passes only `uiTheme`, canonical `uiLocale`, and,
for an explicit instrument analysis link, `s`. Stock Analyst receives `PORTFOLIO_URL` (set from
`PORTFOLIO_PUBLIC_URL` in the example stacks) and passes back only `uiTheme` and `uiLocale`. Neither direction
forwards authentication, portfolio state, account data, or arbitrary query parameters. Both applications validate
the configured destination as a root-relative or absolute HTTP(S) URL before rendering a link.

#### Upstream API contracts and timeout budgets

Portfolio calls only the versioned `stock-analyst` and `edo-calculator` `/v1` routes. The configured base URL may
include a deployment prefix such as `/api`, but it must not include the operation path itself.

The reviewed upstream OpenAPI documents are vendored under `apps/api/contracts/upstream`. Their source commits and
SHA-256 hashes are locked in `upstream-contracts.properties`, so an isolated Portfolio checkout does not depend on
sibling repositories. The build parses those snapshots and generates only the response fields and paths consumed by
Portfolio; it does not check in a full generated client runtime.

The Stock Analyst adapter keeps the upstream provenance object (`source`, retrieval and market timestamps,
currency/unit scale, adjustment, coverage, and freshness status) beside quote/history values. Portfolio persists it
in snapshot metadata, exposes it through the generated Portfolio API contract, and renders a shared Market data status
bar without flattening provenance into individual price points.

```bash
cd apps/api
./gradlew checkUpstreamContracts generateUpstreamContracts
```

Timeouts form an explicit outer budget:

| Call | Upstream internal budget | Portfolio request timeout | Spare |
| --- | ---: | ---: | ---: |
| `stock-analyst` quote/history | 15 s | 20 s | 5 s |
| `edo-calculator` value/history/inflation | 8 s | 10 s | 2 s |

The shared transport issues one HTTP request and does not retry HTTP responses. On failure it preserves HTTP status,
`error`, `errorCode`, `retryable`, `requestId`, `Retry-After`, and a bounded response preview in readiness and audit
metadata. Retry policy therefore remains with the explicit upstream budgets instead of multiplying attempts across
services.

### Backups

- `PORTFOLIO_BACKUPS_ENABLED`
- `PORTFOLIO_BACKUPS_DIRECTORY`
- `PORTFOLIO_BACKUPS_INTERVAL_MINUTES`
- `PORTFOLIO_BACKUPS_RETENTION_COUNT`

### Read-model refresh

- `PORTFOLIO_READ_MODEL_REFRESH_ENABLED`
- `PORTFOLIO_READ_MODEL_REFRESH_INTERVAL_MINUTES`
- `PORTFOLIO_READ_MODEL_REFRESH_RUN_ON_START`

### Alerts and web push

- `PORTFOLIO_ALERTS_ENABLED`
- `PORTFOLIO_ALERT_ALLOCATION_DRIFT_THRESHOLD_PCT_POINTS`
- `PORTFOLIO_ALERT_BENCHMARK_UNDERPERFORMANCE_THRESHOLD_PCT_POINTS`
- `PORTFOLIO_WEB_PUSH_VAPID_PUBLIC_KEY`
- `PORTFOLIO_WEB_PUSH_VAPID_PUBLIC_KEY_FILE`
- `PORTFOLIO_WEB_PUSH_VAPID_PRIVATE_KEY_B64`
- `PORTFOLIO_WEB_PUSH_VAPID_PRIVATE_KEY_B64_FILE`
- `PORTFOLIO_WEB_PUSH_VAPID_PRIVATE_KEY`
- `PORTFOLIO_WEB_PUSH_VAPID_PRIVATE_KEY_FILE`
- `PORTFOLIO_WEB_PUSH_VAPID_SUBJECT`
- `PORTFOLIO_WEB_PUSH_VAPID_SUBJECT_FILE`

Web push is optional. Set the VAPID public key, one private-key variant and subject together; `_FILE` variants are supported by the API config reader for secret-backed deployments.

Push dispatch runs after a successful read-model refresh. Enable `PORTFOLIO_READ_MODEL_REFRESH_ENABLED=true` for automatic delivery, or call `POST /v1/portfolio/alerts/dispatch` after a manual data refresh.

Alert types, alert thresholds and global push delivery can also be adjusted in `System -> Notifications`. The alert-related environment variables provide defaults before an in-app setting is saved.

### Web UI

- `PORTFOLIO_SHOW_CHART_ATTRIBUTION`

Set `PORTFOLIO_SHOW_CHART_ATTRIBUTION=false` on a private local container to hide the TradingView attribution logo on Lightweight Charts without rebuilding the image. For local Vite development, use `VITE_SHOW_CHART_ATTRIBUTION=false` in `apps/web/.env.local`.

Portfolio vendors the framework-neutral `stock-ecosystem-ui` design-token contract under
`apps/web/src/styles/vendor`. `source.json` pins the reviewed upstream commit and file hashes; application code uses
only the public semantic/component roles through the local Tailwind adapter. Verify integrity, inventory and the
private primitive boundary with `cd apps/web && npm run validate:tokens`.

### OpenAPI UI

- `PORTFOLIO_OPENAPI_UI_ENABLED`

### Optional auth

- `PORTFOLIO_AUTH_ENABLED`
- `PORTFOLIO_AUTH_PASSWORD`
- `PORTFOLIO_AUTH_SESSION_SECRET`
- `PORTFOLIO_AUTH_SESSION_COOKIE_NAME`
- `PORTFOLIO_AUTH_SECURE_COOKIE`
- `PORTFOLIO_AUTH_SESSION_MAX_AGE_DAYS`

## Local verification

API:

```bash
cd apps/api
./gradlew test detekt
```

Web:

```bash
cd apps/web
npm run lint
npm test
npm run build
```

## Screenshots

The README screenshots are generated with Playwright against a seeded instance:

```bash
cd apps/web
PORTFOLIO_E2E_BASE_URL=http://127.0.0.1:4174 npx playwright test e2e/screenshots.spec.ts
```

Output lands in `docs/screenshots/`. The script seeds a demo portfolio, captures screens in `en-GB` locale, then restores the original data.

## Docs

- [docs/architecture.md](./docs/architecture.md): system shape, runtime boundaries, verification model
- [docs/domain-model.md](./docs/domain-model.md): canonical entities, derived models, and invariants
- [docs/runbook.md](./docs/runbook.md): deployment, health checks, backup/restore, auth guardrails
- [docs/roadmap.md](./docs/roadmap.md): short active priorities only
