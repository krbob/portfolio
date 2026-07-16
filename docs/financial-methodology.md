# Financial methodology

This document defines how Portfolio interprets canonical transactions and market data. It is a
product contract, not investment or tax advice.

## Source of truth

Transactions are canonical. Holdings, cash, contributions, performance and allocation are derived
by replaying them in `tradeDate`, `createdAt`, then `id` order. The journal is long-only: a create,
edit, delete, batch import or state import must never make an instrument quantity negative at any
point in that replay.

Only `DEPOSIT` and `WITHDRAWAL` are external portfolio cash flows for return calculations. Buys,
sells, fees, taxes, interest and redemptions change assets or cash inside the portfolio and are not
new investor capital.

## Current valuation

- Stock and ETF quantities are valued with Stock Analyst quotes.
- EDO holdings are valued per purchase lot by EDO Calculator and then aggregated.
- Cash remains in its native currency and is converted to PLN when a suitable FX rate exists.
- The daily change uses the upstream previous close when available.

Upstream prices carry source, market time/date, retrieval time, currency basis, adjustment and
coverage metadata. A successful response may still be stale or partial; retrieval time alone does
not make an old market observation fresh.

Missing FX must not remove native cash or instrument quantities from the ledger. The affected PLN
cost/value fields become incomplete and the read model is marked partially valued. A partial result
must not silently replace a compatible last-known-good analytical snapshot.

## Currency basis

PLN is the accounting and allocation base. Historical USD views use the USD/PLN series applicable
to each valuation date rather than today's spot rate. Gold views divide the PLN value and
contributions by the matching gold reference value.

Transaction-level `fxRateToPln`, when supplied, is part of the canonical transaction. Otherwise the
historical market-data series is used. A missing historical conversion is reported as a data gap;
it is never guessed from an unrelated current rate.

Stock Analyst histories are split-adjusted but not dividend-adjusted. London and other exchange
subunit quotations are normalized by the provider before Portfolio consumes them. Portfolio does
not apply a second split or subunit adjustment.

## Daily history

Daily history replays canonical state and combines it with the price, FX, benchmark, gold and
inflation ranges needed by the requested window. Successful historical snapshots record covered
inclusive ranges separately from sparse trading-day observations. A partial overlap is not treated
as complete coverage.

Calendar gaps such as weekends are expected. A missing requested range, missing FX conversion or
unvalued holding is a data-quality issue and can make a currency view or return metric unavailable.

## Money-weighted return (MWRR)

MWRR reflects both investment performance and the timing/size of deposits and withdrawals. The
implementation solves an irregular-date XIRR problem:

- a period that starts after inception begins with the portfolio value as a negative cash flow;
- deposits are negative investor cash flows into the portfolio;
- withdrawals and the terminal portfolio value are positive investor cash flows;
- the solved annual rate is converted to the selected period length for the displayed period MWRR.

MWRR may be unavailable when the period lacks both positive and negative cash flows, required
valuations are missing or the numerical problem has no stable solution.

## Time-weighted return (TWR)

TWR isolates portfolio performance from external deposits and withdrawals. For each consecutive
valuation pair the application removes the external flow from the current value, divides by the
previous value and geometrically links the resulting factors. The selected-period TWR is the total
linked factor minus one; annualized TWR uses a 365-day exponent.

TWR requires a usable start value and complete valuation points. It is intentionally withheld when
data gaps would make the chain misleading.

## Real return and benchmarks

Real PLN return divides the nominal total-return factor by the compounded inflation multiplier for
the latest complete supported month window. Both MWRR and TWR variants are adjusted consistently.
If the inflation range is unavailable or invalid, real return is unavailable rather than silently
falling back to nominal return.

Benchmark comparisons use the same selected period. Built-in and user-configured reference series
are normalized to the period start. The synthetic target-mix benchmark uses configured allocation
weights; it is not a record of trades that actually occurred.

## Rounding and presentation

Canonical decimal values are stored and transported as decimal text. Domain calculations retain
more precision than the UI displays. Currency, percentages and units are rounded only for their
presentation context; displayed rounded values should not be replayed as canonical inputs.

## Data-quality interpretation

- `FRESH`: the required observation and coverage are current for their cadence.
- `STALE`: a compatible last-known-good observation is usable but old.
- `PARTIAL`: some values or ranges are available, but the requested model is incomplete.
- `UNAVAILABLE`/error: the calculation cannot be supported by current or compatible fallback data.

The global header describes live valuation datasets. Bounded historical FX used for old
transactions remains visible in diagnostics but does not by itself make the live headline stale.
