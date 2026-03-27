# Domain Model

## Canonical entities

### Account

Represents where assets are held.

- examples: brokerage account, bond register, cash account
- has institution, type, base currency, display order, and active flag
- remains stable even as holdings change over time

### Instrument

Represents something the portfolio can value or transact against.

- ETFs and stocks map to market-data symbols
- EDO stays modeled as a dedicated instrument type
- cash and benchmark-like references stay explicit rather than implicit spreadsheet columns

### Transaction

Represents a canonical portfolio event.

- deposit
- withdrawal
- buy
- sell
- redeem
- fee
- tax
- interest
- correction

Transactions are the source of truth for holdings, contributions, daily history, and return calculations.

### Portfolio target

Represents the desired strategic allocation.

- supported asset classes are currently `EQUITIES`, `BONDS`, and `CASH`
- the target set is validated as one allocation, not as unrelated rows
- changes are auditable and surfaced in the UI as target history

### App preference

Represents small persisted configuration payloads such as:

- benchmark settings
- rebalancing settings
- cache and operational preferences

These are canonical operational settings, not analytical output.

### Transaction import profile

Represents reusable CSV parsing rules.

- delimiter
- date format
- decimal separator
- header mapping
- defaults

Profiles are canonical configuration and participate in export/import. Final names must remain unique.

## Derived models

The product derives several read models from canonical state:

- portfolio overview
- holdings view
- allocation drift
- daily history
- returns and benchmark comparison
- readiness and data-quality summaries

These views are rebuildable and must not become hidden source of truth.

## Operational models

Separately from canonical entities, the product persists operational state for resilience and trust:

- audit events
- read-model cache snapshots
- market-data snapshots
- backup records

These support observability and recovery, not portfolio accounting itself.

## Invariants

- transactions remain canonical
- analytical snapshots must stay rebuildable
- ambiguous import lookup must fail explicitly
- target weights must form one valid allocation
- import preview and real import must enforce the same business rules
- JSON export/import must remain portable across environments

## Persistence shape

- UUIDs for canonical entity ids
- explicit enum-like vocabularies for controlled fields
- exact decimals preserved as canonical text
- dates and timestamps preserved as ISO-8601 text
- EDO-specific terms modeled structurally instead of generic JSON blobs
