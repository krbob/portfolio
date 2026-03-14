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
- The target runtime database is SQLite, not PostgreSQL.

## Engineering rules

- Keep changes scoped and commit each meaningful step separately.
- Preserve a clean separation between read models and write models.
- Put portfolio calculation logic on the backend, not in the browser.
- Prefer explicit domain names over spreadsheet-shaped naming.
- Avoid binding new code to the legacy Google Sheets model unless it clearly improves the product.
- Treat `REPLACE` import/restore as destructive operations: require explicit confirmation and preserve a safety backup first.
- Keep password auth optional and single-user oriented; if it is enabled, `health`, `meta`, and `auth/session` stay public while the rest of the API remains protected.
- Treat SQLite as a first-class storage engine: explicit encoding, explicit transactions, explicit startup pragmas.
- Favor investor-product clarity over technical exposition in the UI.
- Keep technical diagnostics and operational tooling out of the main dashboard unless they are actionable for day-to-day portfolio review.
- Prefer a small set of shared UI primitives over ad-hoc section-specific styling.
- Use localized formatting consistently; avoid hard-coded `en-US` and `en-GB` formatting in the web app.

## Initial architecture

- `apps/web`: React SPA for the self-hosted UI
- `apps/api`: Ktor API for routing, persistence, integrations, and operational services
- `apps/api/portfolio-domain`: extracted domain module for portfolio models, repository/provider interfaces, and calculation services
- `docs`: architecture notes, roadmap, product decisions
- optional signed-cookie auth spans the SPA and API, but should stay thin and operational rather than becoming a full identity system
- target self-hosted persistence is a single local SQLite database plus JSON backups

## Current milestones

1. Bootstrap project structure and toolchain.
2. Add app shell, health endpoints, and configuration surfaces.
3. Define core domain model and persistence schema.
4. Implement the first write-model API for accounts, instruments, and transactions.
5. Support relational persistence for the write model.
6. Add portfolio overview, holdings, and timeline reconstruction.
7. Rebuild historical daily snapshots from transactions and external market data.
8. Replace PostgreSQL with a SQLite-native runtime and remove transitional persistence code.
9. Keep the SQLite deployment path and smoke coverage production-grade.
10. Rebuild the web UI into a calmer, more mature investor product.

See `docs/backlog.md` and `docs/ui-revamp-plan.md` for the current phased execution order beyond the initial bootstrap milestones.
