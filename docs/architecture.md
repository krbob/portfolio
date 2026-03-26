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

## Runtime modes

The product ships with a small set of explicit compose modes instead of ad-hoc shell overrides:

- local app stack with SQLite and backups only
- local app stack with remote market-data upstreams
- local app stack with self-hosted `stock-analyst` and `edo-calculator`
- full published-image stack for self-hosted deployment

This keeps rebuilds and redeploys predictable and makes market-data behavior a documented runtime choice.

## Implementation shape

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind v4 via `app.css`, with a small shared primitive layer on top
- React Router and TanStack Query
- browser-driven `pl` / `en` localization in the SPA
- lightweight PWA shell for self-hosted mobile use
- Vitest + Testing Library
- OpenAPI-generated TypeScript contract definitions consumed by the web client

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

### Persistence and runtime

- SQLite is the runtime for the self-hosted product
- SQLite is the default runtime in application config and Docker Compose
- route-level tests use dedicated in-memory repository bindings, while runtime and integration coverage stay on SQLite
- the implementation treats SQLite as a first-class storage engine, not as a compatibility shim
- Flyway remains responsible for schema creation on startup
- canonical storage conventions:
  - IDs as `TEXT`
  - exact decimals as canonical decimal `TEXT`
  - dates and timestamps as ISO-8601 `TEXT`
- JSON payloads as `TEXT`
- explicit PRAGMA configuration at startup

## Verification model

The verification strategy is split across unit, UI, and runtime levels:

- backend tests cover domain and API behavior through Gradle
- web tests cover screen-level flows plus shared presentation helpers through Vitest
- PR CI runs the fast, deterministic path: API tests, web tests/build, generated API-client sync, and SQLite Docker smoke
- `main` CI additionally runs the self-hosted market-data smoke test before publishing images
- the remote market-data smoke test stays manual because it requires deployment-specific upstreams

## Operating boundaries

- keep transactions as the canonical source of truth
- persist rebuildable read-model cache snapshots for heavy analytical endpoints
- isolate pure portfolio calculations from HTTP/persistence concerns in `portfolio-domain`
- keep `health`, `meta`, and auth session bootstrap routes public while protecting the rest of the API surface when auth is enabled
- keep the SQLite deployment path simple: one app stack, one DB volume, one backup volume
- keep background refresh and data-quality diagnostics explicit rather than hiding stale/degraded data behind silently cached reads
