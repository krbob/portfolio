# Architecture

## System outline

```text
React SPA
  -> Portfolio API
       -> auth/session guard (optional)
       -> write-model services
       -> read-model services
       -> audit + backup services
       -> SQLite
       -> stock-analyst
       -> edo-calculator
       -> gold-api (optional)
```

## Core split

Portfolio is intentionally split into:

- canonical write model:
  - accounts
  - instruments
  - transactions
  - effective-dated target allocation schedule
  - user preferences (benchmark, rebalancing, alert, and withdrawal-planning settings)
  - transaction import profiles
- analytical read models:
  - overview
  - holdings
  - daily history
  - returns
  - allocation and rebalance guidance
  - diagnostics and readiness views

Transactions remain canonical. Everything analytical must be rebuildable from canonical state plus historical market data.

Runtime-only JSON state has a separate typed repository and SQLite table. Market-data payloads and metadata, plus the
active alert-dispatch set, live there rather than in user preferences. Migration V11 moves historical runtime keys out
of `app_preferences`; read-through migration remains as a compatibility path and never overwrites a newer operational
entry. Late legacy writers are reconciled by `updatedAt`, and the observed legacy row is removed only with a
compare-and-delete so a concurrent replacement remains available for the next reconciliation.

Analytics computations use a key made from the model identity and version, canonical source revision, input range, and
normalized parameters. Concurrent callers for the same key share one supervised computation. Daily history and returns
reuse a successful snapshot for that revision through a small bounded LRU; current valuation only coalesces active work,
and allocation reuses that valuation so market prices are never retained by this layer. A cancelled caller does not
cancel shared work, and failed computations are removed before a later retry.

## Transfer and recoverability model

Canonical state transfer is part of the product, while runtime operational state remains local to the installation.

- canonical export reads the full write model in one database snapshot and returns it as JSON
- export, preview diff, backup, and `appPreferenceCount` include user preferences only
- preview import validates the same rules as real import
- `MERGE` preserves omitted sections where that is the explicit contract
- `REPLACE` is destructive and must be guarded by confirmation plus safety backup
- neither import mode imports, clears, or counts market-data snapshots or active alert-dispatch state
- backup and restore remain JSON-first workflows; backup files are staged, forced, and atomically published
- audit events record state-changing operations

Three semantics matter especially:

- `targetSchedule` in schema-version 5 `MERGE`: missing section means preserve the schedule; a present section replaces it completely, including when it is empty
- legacy `targets` in schema-version 4 `MERGE`: missing section means preserve the schedule; a
  non-empty section updates the allocation effective on the import date without discarding other
  dated phases; an explicitly empty section clears the schedule for compatibility with the old
  single-target-set contract
- `importProfiles` in `MERGE`: missing section means preserve current profiles; present section merges by id, but final names must be unique

## Market-data resilience model

Market data is external and imperfect, so the runtime keeps two distinct layers:

- canonical write model in SQLite
- last-known-good market-data snapshots for quotes, history, benchmark series, and inflation

The snapshots are stored in `operational_state`, outside portable portfolio JSON. Upgrade migration preserves existing
cache payloads and metadata, while restore/import leaves the current runtime state untouched.

Those snapshots are not treated as fresh truth. They exist so the product can degrade explicitly:

- `VALUED` when live data is current
- `STALE` when fallback data is usable but old
- partial or missing coverage statuses when full valuation is impossible

Historical snapshots persist successful inclusive query ranges separately from their sparse price points. A cached
fallback is usable only when the union of those ranges fully covers the request; partial overlap is never promoted to
success. This preserves valid trading-calendar gaps while making pre-instrument history and old point-only snapshots
explicit and safe.

This is why readiness, data-quality panels, and market-data snapshot views are part of the operational UI surface under `System` and the dashboard.

## Runtime modes

The repository supports a small set of explicit runtime modes:

- local app stack with SQLite and backups only
- local app stack with remote market-data upstreams
- local app stack with self-hosted market-data services
- full published-image stack for real self-hosted deployment

The default application config is conservative. Compose overrides opt in to market-data and deployment-specific behavior.

## Persistence rules

- SQLite is the only supported runtime database
- one API process owns one database file
- IDs are stored as `TEXT`
- exact financial values are stored as canonical decimal text
- dates and timestamps are stored as ISO-8601 text
- JSON payloads are stored as `TEXT`
- startup validates durability-related configuration

## Verification model

The quality model is layered:

- backend tests cover domain rules, routes, import/export semantics, and SQLite behavior
- web tests cover user workflows, formatting helpers, labels, and presentation helpers
- OpenAPI sync keeps the web contract aligned with the API surface
- Docker and browser smoke cover the self-hosted runtime path

The goal is not to prove every implementation detail. The goal is to make sure the trusted user workflows fail loudly, deterministically, and close to the actual product surface.
