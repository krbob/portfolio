# Domain Model

## Canonical entities

### Account

Represents where assets are held.

- examples: brokerage account, bond register, cash account
- has institution, type, base currency, and active flag
- remains stable even as holdings change over time

### Instrument

Represents something the portfolio can value or transact against.

- ETFs and stocks map to market-data symbols
- EDO stays modeled as a dedicated instrument type
- cash stays explicit rather than becoming an implicit spreadsheet column
- benchmark and gold reference series are configured separately from transactable instruments

Legacy exports and databases may still contain `BENCHMARK_GOLD` or `MANUAL` instrument values. They
remain readable and portable, but new instruments cannot select those unsupported configurations.

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

The canonical journal is long-only. Replaying transactions in `tradeDate`, `createdAt`, then `id` order must never
produce a negative instrument quantity for any account and instrument pair. This invariant is checked against the
resulting journal for individual writes, batch imports, and state imports, including backdated edits and deletion of
earlier purchases.

### Portfolio target schedule

Represents the desired strategic allocation as explicit effective-dated phases.

- supported asset classes are currently `EQUITIES`, `BONDS`, and `CASH`
- every phase has a unique `effectiveFrom` date and one allocation whose weights sum to 100%
- the target for a calculation date is the latest phase whose effective date is not later than that date
- dates, intervals and direction of changes are user-defined; the 80/20 to 60/40 generator is only an editable shortcut
- future phases do not change historical allocation calculations or the policy benchmark
- schedule replacement and changes to historical phases are auditable

### App preference

Represents small persisted configuration payloads such as:

- benchmark settings
- rebalancing settings
- alert settings
- ordered withdrawal-planning account rules, classification labels, and manual tax buffers

These are user-owned configuration, participate in export/import, and are counted as app preferences in transfer and
backup responses.

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
- non-mutating withdrawal preview
- readiness and data-quality summaries

These views are rebuildable and must not become hidden source of truth.

## Operational models

Separately from canonical entities, the product persists operational state for resilience and trust:

- audit events
- read-model cache snapshots
- market-data snapshots
- active alert-dispatch state
- backup records

Market-data snapshots and active alert state use the typed operational-state repository, not app preferences. They are
preserved across `MERGE`, `REPLACE`, and restore, but are deliberately absent from portable JSON, preview diffs, and
backup entity counts. These models support observability and recovery, not portfolio accounting itself.

## Invariants

- transactions remain canonical
- instrument quantities never become negative during canonical transaction replay
- analytical snapshots must stay rebuildable
- ambiguous import lookup must fail explicitly
- every non-empty target phase must form one valid allocation and phase dates must be unique
- import preview and real import must enforce the same business rules
- JSON export/import must remain portable across environments

## Persistence shape

- UUIDs for canonical entity ids
- explicit enum-like vocabularies for controlled fields
- exact decimals preserved as canonical text
- dates and timestamps preserved as ISO-8601 text
- EDO-specific terms modeled structurally instead of generic JSON blobs
