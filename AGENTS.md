# Portfolio Agents

## Product stance

`portfolio` is a self-hosted portfolio tracker for one user.

The core product rules are not negotiable:

- transactions are the source of truth
- analytical views are rebuildable read models
- SQLite is the runtime database
- JSON backup, export, import, and restore remain first-class
- the product optimizes for long-term investing workflows, not generic bookkeeping

## Architecture guardrails

- frontend: React + TypeScript SPA
- backend: Kotlin + Ktor
- core domain logic lives in `apps/api/portfolio-domain`
- portfolio calculations stay on the backend, not in browser code
- read-model logic stays separate from canonical write-model logic
- market-data snapshots are a resilience layer, not canonical state

## Domain and workflow rules

- keep account, instrument, transaction, target, and import-profile semantics explicit
- EDO stays modeled as a dedicated instrument with typed terms, not a special-case blob
- `MERGE` import must preserve omitted `targets` and omitted `importProfiles`
- when `MERGE` includes a `targets` section, that section replaces the target set as one allocation
- preview and real import must share the same business validation path
- ambiguous CSV lookup by account name, instrument name, or symbol must fail explicitly instead of guessing
- destructive `REPLACE` flows require explicit confirmation and a safety backup first

## Runtime assumptions

- supported persistence is one local SQLite database plus JSON backups
- background refresh and market-data mode must be explicit and documented
- keep deployment-specific hostnames, secrets, and upstream URLs out of the repo
- keep OpenAPI UI off by default unless explicitly enabled
- password auth stays optional and single-user oriented
- when auth is enabled, `health`, `meta`, and `auth/session` remain public bootstrap routes

## Quality bar

- prefer boring, testable flows over speculative abstractions
- preserve auditability for state-changing operations
- favor clear investor-facing copy over technical exposition in the main UI
- diagnostics should be actionable; do not surface operational noise without a decision attached
- keep docs current when changing runtime modes, transfer semantics, or operational behavior

## Repository map

- `apps/web`: SPA, route screens, API client, UI primitives
- `apps/api`: Ktor routes, persistence, integrations, operational services
- `apps/api/portfolio-domain`: domain models, repositories, services, calculations
- `docs`: short current architecture, domain, runbook, and roadmap notes

## Documentation rule

Keep `README.md`, `docs/architecture.md`, `docs/domain-model.md`, `docs/runbook.md`, and `docs/roadmap.md` aligned with the actual product.

Do not keep stale redesign plans or dead backlog documents in active docs. If something is no longer current, delete it and rely on Git history.
