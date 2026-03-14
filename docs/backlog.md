# Product Backlog

## Current status

The investor-facing backlog is complete.

`portfolio` already has:

- routed web UI
- professional charting
- dashboard, holdings, returns, charts, transactions, data and backups screens
- generated frontend contracts
- target allocation, drift and rebalance suggestions
- benchmarks and TWR
- import preview and deduplication
- audit log
- operational safeguards
- backup retention visibility
- read-model cache snapshots
- extracted `portfolio-domain`
- optional single-user password auth

## Current goal

Migrate `portfolio` from `memory/postgres` persistence to a `SQLite-only` runtime that is safer and simpler for a single-user self-hosted deployment.

The ordering below is intentional:

1. codify the migration target first
2. add native SQLite infrastructure
3. move schema and repositories to SQLite-native implementations
4. prove behavioral parity
5. only then remove PostgreSQL

## Phase 1: Migration groundwork

### 1. SQLite-only target and invariants (in progress)

- update `README`, architecture notes and agent guidance to make SQLite the target runtime
- document storage invariants:
  - one app instance per database file
  - local filesystem / Docker volume
  - JSON backups remain first-class
  - transaction data remains canonical
- document SQLite encoding rules:
  - `UUID` as `TEXT`
  - `LocalDate` as `TEXT` `YYYY-MM-DD`
  - `Instant` as UTC ISO-8601 `TEXT`
  - enums as `TEXT`
  - booleans as `INTEGER`
  - JSON as `TEXT`
  - financial values as canonical decimal `TEXT`

### 2. SQLite runtime infrastructure

- add `PersistenceMode.SQLITE`
- add `sqlite-jdbc`
- support SQLite datasource creation and startup PRAGMAs
- add startup validation for DB file paths and SQLite-specific settings
- keep current defaults unchanged until parity is proven

## Phase 2: Native SQLite persistence

### 3. SQLite schema and migrations

- add SQLite-specific Flyway migration directory
- translate PostgreSQL schema to SQLite-native SQL
- remove PostgreSQL-only constructs:
  - `pgcrypto`
  - `gen_random_uuid()`
  - `timestamptz`
  - `jsonb`
- preserve:
  - foreign keys
  - unique constraints
  - indexes
  - data integrity checks

### 4. SQLite repositories for the canonical write model

- implement dedicated repositories for:
  - accounts
  - instruments
  - transactions
  - portfolio targets
- avoid pretending one SQL dialect can cleanly serve both engines
- generate IDs and serialize value objects in application code

### 5. SQLite repositories for operational data

- implement dedicated repositories for:
  - audit events
  - read-model cache snapshots
- make JSON handling explicit in application code
- make multi-step writes transactional

## Phase 3: Confidence and switch-over

### 6. Persistence parity tests (done)

- run the same fixtures through both persistence engines during migration
- assert parity for:
  - overview
  - holdings
  - history
  - returns
  - target allocation and rebalance
  - imports and exports
  - audit events
  - read-model cache metadata

### 7. Switch runtime defaults to SQLite (done)

- make SQLite the default in config, docs, and Docker setup
- store the database file on a named Docker volume
- keep backup volume separate from the DB volume
- expose persistence mode clearly through `meta` and `health`

## Phase 4: PostgreSQL removal

### 8. Remove PostgreSQL runtime support

- remove PostgreSQL datasource wiring
- remove PostgreSQL migrations
- remove PostgreSQL repositories
- remove PostgreSQL driver and Flyway Postgres support
- simplify local and CI workflows around SQLite

### 9. Final hardening and smoke tests

- test fresh bootstrap on empty SQLite DB
- test import of demo portfolio
- test CRUD, history rebuild, returns, targets and backups
- test container restart durability
- document backup and restore expectations for SQLite deployments

## Notes

- This migration is intentionally `SQLite-native`, not a shallow compatibility layer over PostgreSQL assumptions.
- Logical JSON snapshot export/import remains the supported migration path between engines.
- WAL is assumed available for planning purposes, but the implementation should still keep the rest of the SQLite setup production-grade.
