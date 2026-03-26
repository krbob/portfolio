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
- Keep deployment-specific hostnames, upstream URLs, and API keys out of the repo; document only generic `.env` placeholders.

## Repository shape

- `apps/web`: React SPA for the self-hosted UI
- `apps/api`: Ktor API for routing, persistence, integrations, and operational services
- `apps/api/portfolio-domain`: extracted domain module for portfolio models, repository/provider interfaces, and calculation services
- `docs`: architecture notes, roadmap, product decisions
- optional signed-cookie auth spans the SPA and API, but should stay thin and operational rather than becoming a full identity system
- target self-hosted persistence is a single local SQLite database plus JSON backups

## Current product shape

- canonical write-model APIs cover accounts, instruments, targets, transactions, import profiles, and application settings
- analytical read models cover overview, holdings, accounts, daily history, returns, benchmarks, allocation, audit, and operational diagnostics
- backup, restore, export, and import are first-class operational workflows
- the supported self-hosted runtime is SQLite plus JSON backups, with optional market-data integrations and optional single-user auth
- Docker and compose-based deployment are part of the product surface, not afterthought tooling

## Current focus

- Keep the SQLite self-hosted path reliable and well-documented.
- Prefer incremental product work over broad architectural refactors.
- Keep `docs/architecture.md`, `docs/domain-model.md`, and `docs/roadmap.md` short and current.
- Keep CI split pragmatic: deterministic PR checks, deeper self-hosted smoke before image publish, and environment-specific remote smoke outside default CI.
- Do not keep historical backlog or superseded redesign plans in active docs; rely on Git history instead.
