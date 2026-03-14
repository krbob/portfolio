# Product Backlog

## Goal

Bring `portfolio` from a solid domain-heavy prototype to a more complete self-hosted product for long-term portfolio tracking.

The ordering below is intentional:

1. improve the product surface first
2. add investor-facing intelligence next
3. harden data operations and safety
4. only then spend time on deeper internal architecture

## Phase 1: Product Surface

### 1. Routed web application (done)

- split the current single-page workspace into product screens:
  - `Dashboard`
  - `Holdings`
  - `Returns`
  - `Charts`
  - `Transactions`
  - `Data`
  - `Backups`
- keep the current API contracts and reuse existing sections
- preserve mobile usability

### 2. Professional charting (done)

- replace the handcrafted SVG portfolio history chart with `lightweight-charts`
- add:
  - value vs contributions series
  - allocation history chart
  - period switchers: `YTD`, `1Y`, `3Y`, `5Y`, `MAX`
- keep PLN / USD / AU views

### 3. Better dashboard (done)

- redesign dashboard around:
  - top stat cards
  - allocation bar
  - valuation health summary
  - recent operational events
  - shortcuts to holdings, transactions and backups
- compute daily change from available history until a dedicated API exists

### 4. Generated frontend contracts (done)

- publish formal API schemas from the backend
- generate TypeScript contracts/client for the web app from backend definitions
- reduce manual duplication between Kotlin and TypeScript

## Phase 2: Portfolio Intelligence

### 5. Target allocation, drift and rebalancing (done)

- persist target weights
- expose current vs target allocation
- compute drift by asset class
- provide contribution-first rebalance suggestions
- later optionally provide sell-assisted rebalance suggestions

### 6. Benchmarks and TWR (done)

- support benchmark series such as:
  - custom `80/20`
  - pure `VWRA`
  - inflation-adjusted benchmark
- add time-weighted return alongside the current money-weighted return
- show portfolio vs benchmark over matching periods

## Phase 3: Data Operations and Safety

### 7. Better real-world import (done)

- add import preview and validation beyond the current raw CSV flow
- support conflict reporting and deduplication
- support account/instrument mapping assistance
- prepare the import pipeline for future broker-specific adapters

### 8. Audit log (done)

- store append-only records for important changes:
  - account/instrument/transaction mutations
  - imports
  - snapshot restores
  - backup runs
- surface recent events in the UI

### 9. Operational safeguards (done)

- require stronger confirmation for destructive actions
- create a server backup before destructive restore/replace operations
- validate critical configuration at startup
- add idempotency or duplicate detection where practical
- improve failure reporting for market data and backup jobs

### 10. Backup retention and backup audit in UI (done)

- surface retention behaviour in the UI
- show:
  - last successful backup
  - last failed backup
  - restore history
  - retention deletions
- allow filtering and inspecting backup-related events

## Phase 4: Architecture Hardening

### 11. Formal read-model cache / snapshot store

- persist rebuildable read models with metadata:
  - version
  - inputs window
  - generation timestamp
  - invalidation reason
- use this for faster history and return queries
- keep transactions as the canonical source of truth

### 12. Extract `portfolio-domain` module

- move domain calculations into a separate module
- keep HTTP, persistence and provider integration outside the domain module
- use the module from API, background jobs and future tooling

## Notes

- SQLite-style deployment simplification is deliberately excluded from this backlog for now.
- The current recommendation is to keep the existing `portfolio` domain model and only borrow selected UX ideas from `folio`.
