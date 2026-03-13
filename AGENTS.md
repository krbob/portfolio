# Portfolio Agents

## Goal

`portfolio` is a self-hosted web application for long-term portfolio tracking.

The product is optimized for:

- transaction-based portfolio accounting
- full daily history reconstruction
- ETF + EDO support
- performance reporting in PLN, USD, and gold
- allocation monitoring for a Boglehead-style portfolio

## Non-negotiable product decisions

- Web-first product.
- Frontend in React + TypeScript.
- Backend in Kotlin + Ktor.
- Transactions are the source of truth.
- Daily snapshots are rebuildable cache, not canonical data.
- Historical FX comes from `stock-analyst`.
- EDO is modeled as a separate instrument per purchase.

## Engineering rules

- Keep changes scoped and commit each meaningful step separately.
- Preserve a clean separation between read models and write models.
- Put portfolio calculation logic on the backend, not in the browser.
- Prefer explicit domain names over spreadsheet-shaped naming.
- Avoid binding new code to the legacy Google Sheets model unless it clearly improves the product.

## Initial architecture

- `apps/web`: React SPA for the self-hosted UI
- `apps/api`: Ktor API for portfolio state, calculations, and integrations
- `docs`: architecture notes, roadmap, product decisions

## Current milestones

1. Bootstrap project structure and toolchain.
2. Add app shell, health endpoints, and configuration surfaces.
3. Define core domain model and persistence schema.
4. Implement accounts, instruments, and transactions.
5. Add portfolio overview, holdings, and timeline reconstruction.
