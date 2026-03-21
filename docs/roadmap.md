# Roadmap

This document tracks only currently open product directions.
Completed implementation history lives in Git.

## Current stance

`portfolio` is already a usable self-hosted product.

The next steps should stay incremental and product-driven:

- improve day-to-day investing workflows
- keep data trust high
- avoid broad architectural rewrites unless a concrete feature requires them

## Near-term candidates

### 1. Broker-specific importers

- add importers for real brokerage exports when manual entry becomes painful
- keep broker-specific parsing isolated from the canonical transaction model
- fit new importers into the existing preview/import-profile pipeline

### 2. Additional benchmark flexibility

- refine the default benchmark set as needed for the actual portfolio
- consider more explicit benchmark grouping or pinning if `Performance` becomes crowded
- keep one custom benchmark as the main escape hatch

### 3. Rebalancing workflow polish

- keep target allocation and drift easy to act on
- improve contribution-first guidance if real usage shows ambiguity
- avoid turning rebalancing into a tax-heavy or broker-specific subsystem

### 4. Read-model refresh ergonomics

- keep background refresh reliable and visible
- improve diagnostics only where they help trust or cold-start performance
- avoid over-engineering the cache into a second source of truth

### 5. Mobile and PWA refinement

- polish narrow-viewport usability based on actual phone usage
- keep the mobile experience read-first and lightweight

## Deprioritized for now

- multi-user support
- advanced tax workflows
- lot-level analytics
- account-wrapper specific logic
- enterprise-style auth or permissions
- large architectural rewrites for their own sake

## Documentation rule

When the roadmap changes materially, update this file instead of recreating historical backlog documents.
