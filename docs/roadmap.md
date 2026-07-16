# Roadmap

Keep this file short. Active priorities only.

Last reviewed: 2026-07-16.

## Current priorities

### 1. Daily workflow polish

- keep import, editing, and review flows fast to trust
- keep mobile usage practical for a self-hosted single-user setup
- improve user-facing explanations where the product already has strong logic

### 2. What-if planner v2

- extend the shipped contribution planner from asset-class splits to account and instrument-level decisions
- compare candidate contribution plans against current drift without mutating canonical history
- keep simulations clearly separated from real transactions and real audit history

### 3. Operational confidence

- keep deployment docs, smoke coverage, backup/restore, and market-data diagnostics aligned with the real self-hosted path
- refine actionable stale-data guidance based on real incidents rather than generic monitoring noise
- publish a released compatibility manifest with immutable digests for each coordinated ecosystem release

### 4. Partial-value contract

- replace placeholder zero PLN amounts with nullable values or an explicit completeness envelope in the next compatible API revision
- preserve native quantities and balances while making every unavailable derived amount unambiguous to clients

### 5. Broker-specific importers

- add broker-specific CSV adapters when generic profiles stop being enough
- keep broker parsing isolated from canonical transaction logic

## Non-goals for now

- multi-user support
- enterprise auth or permissions
- live broker sync or trading integration
- broad architectural rewrites without a product driver
- speculative backlog expansion in docs
