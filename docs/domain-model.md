# Domain Model

## Design stance

The product does not mirror spreadsheet tabs. It models a portfolio as a set of canonical write-model entities.

## Core entities

### Account

Represents where assets are held.

- examples: brokerage account, bond register, cash account
- has a base currency and institution
- remains stable even as holdings change over time

### Instrument

Represents something that can be valued in the portfolio.

- ETFs and stocks come from market-data sources
- EDO is modeled as one instrument per purchase
- gold is treated as a benchmark instrument, not a holding by default

### EDO terms

EDO-specific valuation data is modeled separately from generic instrument fields:

- purchase date
- first period rate
- margin
- principal units
- maturity date

This keeps the general instrument model clean while preserving strict typing for EDO.

### Transaction

Represents a canonical portfolio event.

- buy / sell
- deposit / withdrawal
- fee / tax / interest
- correction

Transactions are the source of truth for:

- current holdings
- money-weighted return
- reconstructed daily history
- contributions over time

### Daily snapshot

Represents a cached read model of a specific day.

- total value in PLN, USD, and gold
- cumulative contributions in PLN, USD, and gold
- equity and bond weights

Snapshots are rebuildable and must never become canonical state.

## SQL schema choices

- UUID primary keys for write-model entities
- explicit enum-like checks in SQL for controlled vocabularies
- dedicated `edo_terms` table instead of JSON blob
- numeric columns sized for portfolio accounting rather than broker-grade tick storage

## Immediate next step

Build repositories and write-model endpoints on top of:

- `accounts`
- `instruments`
- `edo_terms`
- `transactions`
