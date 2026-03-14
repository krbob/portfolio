# Product Backlog

## Current status

The original foundation backlog is effectively done.

`portfolio` already has:

- routed web UI with dedicated screens for dashboard, holdings, returns, charts, transactions, data, and backups
- `lightweight-charts` based financial visualizations
- a more product-oriented dashboard instead of a single admin-style page
- OpenAPI-generated frontend contracts instead of hand-maintained cross-stack types
- target allocation, drift tracking, and contribution-first rebalance suggestions
- benchmark comparisons and `TWR` next to `MWRR`
- append-only audit events
- operational safeguards around destructive imports and restores
- backup retention and restore history visible in the UI
- rebuildable read-model cache snapshots with diagnostics
- extracted `portfolio-domain`
- optional single-user password auth
- SQLite-only runtime and Dockerized self-hosted deployment

## Current goal

Keep the SQLite self-hosted path production-grade while rebuilding the frontend into a calmer, more mature investor product.

The remaining backlog is ordered by practical value for day-to-day use.

See [ui-revamp-plan.md](/Users/bob/stock/portfolio/docs/ui-revamp-plan.md) for the dedicated execution plan for the frontend redesign.

## Phase 0: UI revamp foundation

### 0.1 Product-grade shell and design system (next)

- replace the current mixed "marketing + dashboard + admin" shell with a calmer investor product frame
- define shared visual primitives instead of expanding the monolithic stylesheet
- centralize locale-aware formatting for money, percentages, and dates
- reduce top-level navigation to product-facing destinations

### 0.2 Dashboard rewrite (next)

- rebuild the dashboard around current value, daily move, allocation, one primary chart, and portfolio health
- remove technical cards and duplicate summary sections from the main screen
- shorten copy and make empty/error/loading states more product-like

### 0.3 Performance rewrite (next)

- merge returns and charts into a single coherent performance experience
- standardize period switchers, legends, benchmark presentation, and chart cards
- keep performance screens optimized for read-heavy usage

### 0.4 Holdings rewrite (later)

- replace the current mixed section/card view with a dense, deliberate holdings table
- improve grouping, sorting, filters, and position drilldown
- make valuation quality and asset-allocation context easy to read at a glance

### 0.5 Transactions rewrite (later)

- split journal, import, profiles, and import history into clearer flows
- keep preview and conflict handling visible before destructive or bulk actions
- make transaction management feel operationally safe and quick to use

### 0.6 Settings and operations consolidation (later)

- move accounts, instruments, backups, audit, and cache diagnostics into one coherent settings area
- keep operational tooling discoverable without polluting primary investor screens

## Phase 1: Deployment hardening

### 1. Docker smoke coverage and fixture hardening (done)

- keep a dedicated end-to-end smoke script for the SQLite Docker stack
- verify bootstrap, demo import, backups, restart durability, and cleanup
- make the smoke checks assert the real API contract, not stale assumptions
- keep the demo fixture representative for multi-account `VWRA.L` plus multiple `EDO` lots

### 2. SQLite deployment polish (in progress)

- add Docker smoke coverage to CI (done)
- document expected volumes, backup paths, and restart behavior more explicitly
- keep startup validation strict around SQLite pathing and journaling assumptions
- keep the default Docker profile zero-surprise for single-user self-hosting

## Phase 2: Real-world data import

### 3. Server-side CSV import profiles (done)

- keep reusable import profiles on the server with delimiter/date/decimal settings
- keep header mappings and account/currency defaults as part of the saved profile
- run preview/import through the backend so preview semantics match the final commit
- keep imports idempotent through the canonical duplicate detection flow

### 4. Better import UX and import history (next)

- add richer preview with per-row warnings and conflict summaries
- expose import audit history in the UI next to backups and other operational events
- make duplicate handling and conflict resolution understandable before the import is applied
- support import sessions with named source files or broker/export metadata

### 5. First broker-specific importers (later)

- implement parsers for the real sources the portfolio is fed from
- keep broker-specific code isolated from the canonical domain model
- prefer deterministic CSV/statement imports over brittle scraping
- fit them into the saved-profile/import-session pipeline instead of inventing a second import path

## Phase 3: Product polish

### 6. Dashboard and chart refinement (next)

- superseded by the dedicated UI revamp phases above

### 7. Operational trust layer (next)

- expand audit visibility for imports, restores, and destructive actions
- keep backup and restore flows easy to inspect after the fact
- add readiness-level checks where they materially improve self-hosted operation
- keep destructive flows safe-by-default

## Notes

- `portfolio` intentionally kept the stronger domain model and data reconstruction approach instead of adopting `folio`'s simpler holding-centric accounting model.
- The valuable ideas borrowed from `folio` were the web information architecture, product-oriented presentation, and better financial charting, not the storage or return-calculation shortcuts.
- Deployment simplification beyond the current SQLite Docker path is intentionally out of scope for this backlog.
