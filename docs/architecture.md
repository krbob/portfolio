# Architecture

## System outline

```text
React SPA
  -> Portfolio API
       -> password/session auth (optional)
       -> portfolio-domain
       -> PostgreSQL
       -> stock-analyst
       -> edo-calculator
```

## Source of truth

Transactions are canonical. Daily snapshots are cacheable read models that can be rebuilt from:

- transactions
- historical prices
- historical FX rates
- historical EDO valuations

## Initial stack decisions

### Frontend

- React 19
- TypeScript
- Vite
- Custom CSS with design tokens for now
- Vitest + Testing Library

### Backend

- Kotlin 2.3
- Ktor 3
- Koin
- kotlinx.serialization
- JUnit 6
- multi-project Gradle build with:
  - API module for HTTP, persistence, integrations, and operational services
  - `portfolio-domain` for domain models, repository/provider interfaces, and portfolio calculations
- optional single-user password auth with signed session cookies

### Persistence

- PostgreSQL planned for production data
- relational schema already drafted in SQL migrations
- current write-model implementation can run in `memory` or `postgres` mode
- PostgreSQL mode uses Flyway migrations on startup

## First delivery slices

1. Tooling and runnable skeleton
2. Health endpoints and application shell
3. Domain model and schema
4. CRUD for accounts, instruments, and transactions
5. Portfolio overview and history reconstruction

## Current hardening direction

- keep transactions as the canonical source of truth
- persist rebuildable read-model cache snapshots for heavy analytical endpoints
- isolate pure portfolio calculations from HTTP/persistence concerns in `portfolio-domain`
- keep `health`, `meta`, and auth session bootstrap routes public while protecting the rest of the API surface when auth is enabled
