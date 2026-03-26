# Roadmap

This file should stay short.
Completed work lives in Git, not in a historical backlog document.

## Current stance

`portfolio` is already in a production-usable self-hosted shape.

The next steps should stay narrow and usage-driven:

- polish daily investing workflows based on real use
- keep operational trust high
- avoid broad architectural rewrites unless a concrete feature requires them

## Active priorities

### 1. Real-world workflow polish

- refine the product based on day-to-day usage rather than speculative backlog items
- keep mobile, copy, and table interactions easy to trust and easy to act on

### 2. Broker-specific importers

- add real brokerage importers when manual entry stops scaling
- keep broker-specific parsing isolated from the canonical transaction model
- fit new importers into the existing preview/import-profile pipeline

### 3. Operational confidence

- keep deployment docs, smoke coverage, backup/restore, and valuation diagnostics aligned with the actual production path
- prefer boring, repeatable self-hosted operation over feature sprawl

## Explicit non-goals for now

- multi-user support
- advanced tax engine work
- broker sync / live trading integration
- enterprise-style auth or permissions
- large architectural rewrites for their own sake

## Documentation rule

If there is no active short-term priority, keep this file minimal instead of rebuilding a speculative backlog.
