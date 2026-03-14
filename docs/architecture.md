# Architecture

## System outline

```text
React SPA
  -> Portfolio API
       -> password/session auth (optional)
       -> portfolio-domain
       -> SQLite
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

- SQLite is the runtime for the self-hosted product
- SQLite is the default runtime in application config and Docker Compose
- tests default to explicit in-memory storage through Gradle task environment overrides, with opt-in SQLite tests where needed
- the implementation treats SQLite as a first-class storage engine, not as a compatibility shim
- Flyway remains responsible for schema creation on startup
- canonical storage conventions:
  - IDs as `TEXT`
  - exact decimals as canonical decimal `TEXT`
  - dates and timestamps as ISO-8601 `TEXT`
  - JSON payloads as `TEXT`
  - explicit PRAGMA configuration at startup

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
- keep the SQLite deployment path simple: one app stack, one DB volume, one backup volume
