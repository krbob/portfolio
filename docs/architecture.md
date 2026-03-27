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
  - targets
  - app preferences
  - transaction import profiles
- analytical read models:
  - overview
  - holdings
  - daily history
  - returns
  - allocation and rebalance guidance
  - diagnostics and readiness views

Transactions remain canonical. Everything analytical must be rebuildable from canonical state plus historical market data.

## Transfer and recoverability model

Operational state transfer is part of the product, not a side script.

- canonical export returns the full write model as JSON
- preview import validates the same rules as real import
- `MERGE` preserves omitted sections where that is the explicit contract
- `REPLACE` is destructive and must be guarded by confirmation plus safety backup
- backup and restore remain JSON-first workflows
- audit events record state-changing operations

Two semantics matter especially:

- `targets` in `MERGE`: missing section means preserve current targets; present section means replace the target allocation set
- `importProfiles` in `MERGE`: missing section means preserve current profiles; present section merges by id, but final names must be unique

## Market-data resilience model

Market data is external and imperfect, so the runtime keeps two distinct layers:

- canonical write model in SQLite
- last-known-good market-data snapshots for quotes, history, benchmark series, and inflation

Those snapshots are not treated as fresh truth. They exist so the product can degrade explicitly:

- `VALUED` when live data is current
- `STALE` when fallback data is usable but old
- partial or missing coverage statuses when full valuation is impossible

This is why readiness, data-quality panels, and market-data snapshot views are part of the settings surface.

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
